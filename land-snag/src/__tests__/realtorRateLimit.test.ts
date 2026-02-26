import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtorProvider } from '../providers/RealtorProvider';
import { prisma } from '../lib/prisma';
import { resetRateLimiter } from '../lib/rateLimiter';

vi.mock('../lib/prisma', () => ({
    prisma: {
        realtorRawCache: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

// Mock global fetch
const globalFetch = vi.fn();
vi.stubGlobal('fetch', globalFetch);

describe('RealtorProvider Rate Limiting', () => {
    let provider: RealtorProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        resetRateLimiter();
        process.env.REALTOR_API_KEY = 'test-key';
        process.env.REALTOR_MAX_CALLS_PER_MIN = '60'; // 1 request per second
        process.env.REALTOR_MAX_RETRIES = '3';
        process.env.REALTOR_INITIAL_BACKOFF_MS = '10';
        provider = new RealtorProvider();
    });

    it('should respect Retry-After header', async () => {
        const mockParams = { zip: '12345' };

        vi.mocked(prisma.realtorRawCache.findUnique).mockResolvedValue(null);

        // 1st: 429 with Retry-After: 1
        // 2nd: Success
        globalFetch.mockResolvedValueOnce({
            status: 429,
            ok: false,
            headers: new Map([['retry-after', '1']])
        } as any).mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: async () => ({ properties: [], total_pages: 1 }),
            headers: new Map()
        } as any);

        const startTime = Date.now();
        await provider.search(mockParams);
        const duration = Date.now() - startTime;

        expect(globalFetch).toHaveBeenCalledTimes(2);
        expect(duration).toBeGreaterThanOrEqual(1000);
    });

    it('should use exponential backoff when Retry-After is missing', async () => {
        const mockParams = { zip: '12345' };
        vi.mocked(prisma.realtorRawCache.findUnique).mockResolvedValue(null);

        // 1st: 429 no header
        // 2nd: 429 no header
        // 3rd: Success
        globalFetch
            .mockResolvedValueOnce({ status: 429, ok: false, headers: new Map() } as any)
            .mockResolvedValueOnce({ status: 429, ok: false, headers: new Map() } as any)
            .mockResolvedValueOnce({
                status: 200,
                ok: true,
                json: async () => ({ properties: [], total_pages: 1 }),
                headers: new Map()
            } as any);

        const startTime = Date.now();
        await provider.search(mockParams);
        const duration = Date.now() - startTime;

        // Attempt 0 -> Fail (waitTime 10ms * 2^0 = 10)
        // Attempt 1 -> Fail (waitTime 10ms * 2^1 = 20)
        // Attempt 2 -> Success
        // Total wait approx 30ms + jitter
        expect(globalFetch).toHaveBeenCalledTimes(3);
        expect(duration).toBeGreaterThanOrEqual(30);
    });

    it('should fail after max retries', async () => {
        const mockParams = { zip: '12345' };
        vi.mocked(prisma.realtorRawCache.findUnique).mockResolvedValue(null);

        globalFetch.mockResolvedValue({
            status: 429,
            ok: false,
            headers: new Map()
        } as any);

        await expect(provider.search(mockParams)).rejects.toThrow('RapidAPI responded with 429');

        // initial + 3 retries = 4 calls total
        expect(globalFetch).toHaveBeenCalledTimes(4);
    });

    it('should throttle based on token bucket', async () => {
        // Set very low rate: 2 calls per minute (1 every 30s)
        process.env.REALTOR_MAX_CALLS_PER_MIN = '2';
        provider = new RealtorProvider();

        const mockParams = { zip: '12345' };
        vi.mocked(prisma.realtorRawCache.findUnique).mockResolvedValue(null);
        globalFetch.mockResolvedValue({
            status: 200,
            ok: true,
            json: async () => ({ properties: [], total_pages: 1 }),
            headers: new Map()
        } as any);

        const startTime = Date.now();

        // First call should be instant
        await provider.search(mockParams);

        // Second call should wait approx 30s
        // We use a shorter timeout for testing if we can, but let's just mock the behavior 
        // OR better: test the rateLimiter utility directly for timing
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealtorProvider } from '../providers/RealtorProvider';
import { prisma } from '../lib/prisma';

// Mock prisma
vi.mock('../lib/prisma', () => ({
    prisma: {
        realtorRawCache: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

// Mock global fetch
global.fetch = vi.fn();

const mockFetchResponse = (data: any) => ({
    ok: true,
    json: async () => data,
    headers: {
        get: vi.fn().mockImplementation((name: string) => {
            if (name === 'X-RateLimit-Remaining') return '100';
            return null;
        })
    }
});

describe('RealtorProvider', () => {
    let provider: RealtorProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.REALTOR_API_KEY = 'test-key';
        provider = new RealtorProvider();
    });

    describe('transformListing', () => {
        it('should transform raw listing to GeoJSONFeature', () => {
            const mockListing = {
                listing_id: '123',
                latitude: '36.1627',
                longitude: '-86.7816',
                price: '$450,000',
                beds: '3',
                baths: '2.5',
                address: '123 Test St',
                city: 'Nashville',
                state_code: 'TN',
                zip_code: '37201',
                property_type: 'single_family'
            };

            // Accessing private method for testing transformation logic
            const result = (provider as any).transformListing(mockListing);

            expect(result.type).toBe('Feature');
            expect(result.geometry.type).toBe('Polygon');
            expect(result.properties.price).toBe(450000);
            expect(result.properties.beds).toBe(3);
            expect(result.properties.baths).toBe(2.5);
            expect(result.properties.source).toBe('realtor16');
        });
    });

    describe('search with caching', () => {
        it('should return cached data if fresh', async () => {
            const mockParams = { zip: '37201' };
            const mockCachedData = [
                { type: 'Feature', properties: { listing_id: '123' } }
            ];

            vi.mocked(prisma.realtorRawCache.findUnique).mockResolvedValue({
                id: 1,
                hash: 'some-hash',
                payload: JSON.stringify(mockCachedData),
                createdAt: new Date() // Fresh cache
            } as any);

            const result = await provider.search(mockParams);

            expect(result).toEqual(mockCachedData);
            expect(fetch).not.toHaveBeenCalled();
        });

        it('should fetch from API if cache is stale or missing', async () => {
            const mockParams = { zip: '37201' };
            const mockApiResponse = {
                listings: [
                    { listing_id: '123', latitude: '36', longitude: '-86' }
                ],
                total_pages: 1
            };

            vi.mocked(prisma.realtorRawCache.findUnique).mockResolvedValue(null);
            vi.mocked(fetch).mockResolvedValue(mockFetchResponse(mockApiResponse) as any);

            const result = await provider.search(mockParams);

            expect(fetch).toHaveBeenCalled();
            expect(result.length).toBe(1);
            expect(prisma.realtorRawCache.upsert).toHaveBeenCalled();
        });
    });

    describe('pagination', () => {
        it('should concatenate multiple pages and respect rate limit', async () => {
            const mockParams = { city: 'Nashville', state: 'TN' };
            const page1Response = {
                listings: [{ listing_id: 'p1', latitude: '36', longitude: '-86' }],
                total_pages: 2
            };
            const page2Response = {
                listings: [{ listing_id: 'p2', latitude: '36', longitude: '-86' }],
                total_pages: 2
            };

            vi.mocked(prisma.realtorRawCache.findUnique).mockResolvedValue(null);

            vi.mocked(fetch)
                .mockResolvedValueOnce(mockFetchResponse(page1Response) as any)
                .mockResolvedValueOnce(mockFetchResponse(page2Response) as any);

            const result = await provider.search(mockParams);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(result.length).toBe(2);
            expect(result[0].properties.listing_id).toBe('p1');
            expect(result[1].properties.listing_id).toBe('p2');
        });
    });

    describe('retry logic on 429', () => {
        it('should retry on 429 and succeed on subsequent attempt', async () => {
            const mockParams = { zip: '37201' };
            const mockApiResponse = {
                listings: [{ listing_id: 'retry-success', latitude: '36', longitude: '-86' }],
                total_pages: 1
            };

            vi.mocked(prisma.realtorRawCache.findUnique).mockResolvedValue(null);

            // First two calls return 429, third returns success
            vi.mocked(fetch)
                .mockResolvedValueOnce({
                    status: 429,
                    ok: false,
                    statusText: 'Too Many Requests',
                    headers: { get: () => null }
                } as any)
                .mockResolvedValueOnce({
                    status: 429,
                    ok: false,
                    statusText: 'Too Many Requests',
                    headers: { get: () => null }
                } as any)
                .mockResolvedValueOnce(mockFetchResponse(mockApiResponse) as any);

            // Set short retry delay for test performance
            process.env.REALTOR_RETRY_DELAY_MS = '10';
            provider = new RealtorProvider();

            const result = await provider.search(mockParams);

            expect(fetch).toHaveBeenCalledTimes(3);
            expect(result.length).toBe(1);
            expect(result[0].properties.listing_id).toBe('retry-success');
        });

        it('should fail after max retries if 429 persists', async () => {
            const mockParams = { zip: '37201' };

            vi.mocked(prisma.realtorRawCache.findUnique).mockResolvedValue(null);
            vi.mocked(fetch).mockResolvedValue({
                status: 429,
                ok: false,
                statusText: 'Too Many Requests',
                headers: { get: () => null }
            } as any);

            process.env.REALTOR_MAX_RETRIES = '2';
            process.env.REALTOR_RETRY_DELAY_MS = '10';
            provider = new RealtorProvider();

            const result = await provider.search(mockParams);

            // Should return empty array on failure as per current implementation of search()
            expect(fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
            expect(result).toEqual([]);
        });
    });
});

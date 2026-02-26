import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PropertyService } from './propertyService';
import { prisma } from '../prisma';
import { PropertyProvider, BoundingBox, Property } from './propertyProvider';

// Mock Prisma
vi.mock('../prisma', () => ({
    prisma: {
        property: {
            findMany: vi.fn(),
            createMany: vi.fn(),
        },
    },
}));

// Mock Provider
const createMockProvider = (name: string, results: Property[] = []): PropertyProvider => ({
    providerName: name,
    searchByBoundingBox: vi.fn().mockResolvedValue(results),
    searchByPolygon: vi.fn().mockResolvedValue(results),
});

describe('PropertyService', () => {
    let service: PropertyService;
    let mockProvider1: PropertyProvider;
    const bounds: BoundingBox = { minLat: 35, maxLat: 36, minLng: -81, maxLng: -80 };

    const mockProperty: Property = {
        id: '1',
        externalId: 'ext-1',
        source: 'test',
        latitude: 35.5,
        longitude: -80.5,
        price: 100000,
        address: '123 Test St',
        city: 'Test City',
        county: 'Test County',
        state: 'TS',
        zip: '12345',
        propertyType: 'Land',
        lotSize: 1.0,
        lastFetchedAt: new Date(),
        createdAt: new Date(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return cached data if fresh and above threshold', async () => {
        const cachedResults = Array(10).fill(mockProperty);
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce(cachedResults); // First check (fresh)
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce(cachedResults); // Final return

        mockProvider1 = createMockProvider('P1');
        service = new PropertyService([mockProvider1]);

        const results = await service.searchProperties(bounds);

        expect(results).toHaveLength(10);
        expect(mockProvider1.searchByBoundingBox).not.toHaveBeenCalled();
    });

    it('should fetch from providers if cache is low', async () => {
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([]); // Fresh cache empty
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([mockProperty]); // Final return from DB

        mockProvider1 = createMockProvider('P1', [mockProperty]);
        service = new PropertyService([mockProvider1]);

        await service.searchProperties(bounds);

        expect(mockProvider1.searchByBoundingBox).toHaveBeenCalledWith(bounds);
        expect(prisma.property.createMany).toHaveBeenCalled();
    });

    it('should deduplicate results by externalId', async () => {
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([]);

        const prop1 = { ...mockProperty, externalId: 'dup-1' };
        const prop2 = { ...mockProperty, externalId: 'dup-1', source: 'other' };

        mockProvider1 = createMockProvider('P1', [prop1, prop2]);
        service = new PropertyService([mockProvider1]);

        // We check deduplication inside the private upsert (through CreateMany mock)
        await service.searchProperties(bounds);

        const createManyCall = vi.mocked(prisma.property.createMany).mock.calls[0][0];
        expect(createManyCall.data).toHaveLength(1);
    });

    it('should fallback to DB if provider fails', async () => {
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([]); // Fresh cache empty
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([mockProperty]); // Final return

        const failingProvider: PropertyProvider = {
            providerName: 'Fail',
            searchByBoundingBox: vi.fn().mockRejectedValue(new Error('API Down')),
            searchByPolygon: vi.fn().mockRejectedValue(new Error('API Down')),
        };

        service = new PropertyService([failingProvider]);

        const results = await service.searchProperties(bounds);

        expect(results).toHaveLength(1);
        expect(results[0].externalId).toBe('ext-1');
    });

    it('should apply polygon filtering correctly', async () => {
        const poly: [number, number][] = [[-81, 35], [-80, 35], [-80, 36], [-81, 36], [-81, 35]];
        const propInside = { ...mockProperty, longitude: -80.5, latitude: 35.5 };
        const propOutside = { ...mockProperty, longitude: -82, latitude: 35.5 };

        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([propInside, propOutside]); // Inside low cache check (skipped logic here for simplicity)
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([propInside, propOutside]); // Final return

        service = new PropertyService([]);
        const results = await service.searchProperties(bounds, poly);

        expect(results).toHaveLength(1);
        expect(results[0].latitude).toBe(35.5);
    });
});

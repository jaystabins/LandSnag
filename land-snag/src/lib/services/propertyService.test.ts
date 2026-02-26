import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PropertyService } from './propertyService';
import { prisma } from '../prisma';
import { PropertyProvider, BoundingBox, Property } from './propertyProvider';

// Mock Prisma
vi.mock('../prisma', () => ({
    prisma: {
        property: {
            findMany: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

// Mock Provider
const createMockProvider = (name: string, results: any[] = []): PropertyProvider => ({
    providerName: name,
    search: vi.fn().mockResolvedValue(results),
});

describe('PropertyService', () => {
    let service: PropertyService;
    let mockProvider1: PropertyProvider;
    const bounds: BoundingBox = { minLat: 35, maxLat: 36, minLng: -81, maxLng: -80 };

    const mockFeature = (id: string) => ({
        type: 'Feature',
        properties: {
            listing_id: id,
            latitude: 35.5,
            longitude: -80.5,
            price: 100000,
            address: '123 Test St',
            city: 'Test City',
            county: 'Test County',
            state: 'TS',
            zip: '12345',
            property_type: 'RESIDENTIAL',
            lot_size: 1.0,
            source: 'test'
        }
    });

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
        propertyType: 'RESIDENTIAL',
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
        expect(mockProvider1.search).not.toHaveBeenCalled();
    });

    it('should fetch from providers if cache is low', async () => {
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([]); // Fresh cache empty
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([mockProperty]); // Final return from DB

        mockProvider1 = createMockProvider('P1', [mockFeature('ext-1')]);
        service = new PropertyService([mockProvider1]);

        await service.searchProperties(bounds);

        expect(mockProvider1.search).toHaveBeenCalled();
        expect(prisma.property.upsert).toHaveBeenCalled();
    });

    it('should deduplicate results by externalId', async () => {
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([]);
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([]);

        const feat1 = mockFeature('dup-1');
        const feat2 = { ...feat1, properties: { ...feat1.properties, source: 'other' } };

        mockProvider1 = createMockProvider('P1', [feat1, feat2]);
        service = new PropertyService([mockProvider1]);

        await service.searchProperties(bounds);

        // Deduplication happens before upsert loop
        expect(prisma.property.upsert).toHaveBeenCalledTimes(1);
    });

    it('should fallback to DB if provider fails', async () => {
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([]); // Fresh cache empty
        vi.mocked(prisma.property.findMany).mockResolvedValueOnce([mockProperty]); // Final return

        const failingProvider: PropertyProvider = {
            providerName: 'Fail',
            search: vi.fn().mockRejectedValue(new Error('API Down')),
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

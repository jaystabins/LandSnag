import { Property, PropertyProvider, BoundingBox } from './propertyProvider';
import { PropertyMapper } from './propertyMapper';

/**
 * MockProvider implementation.
 * Simulates a standard real estate listing service.
 */
export class MockProvider implements PropertyProvider {
    readonly providerName = 'MockListingService';
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async searchByBoundingBox(bounds: BoundingBox): Promise<Property[]> {
        console.log(`[MockProvider] Fetching properties for bbox: ${JSON.stringify(bounds)}`);
        await new Promise(resolve => setTimeout(resolve, 600));

        const results: unknown[] = [];
        for (let i = 0; i < 8; i++) {
            const lat = Math.random() * (bounds.maxLat - bounds.minLat) + bounds.minLat;
            const lng = Math.random() * (bounds.maxLng - bounds.minLng) + bounds.minLng;
            const id = `mock_${Math.random().toString(36).substr(2, 9)}`;

            results.push({
                externalId: id,
                source: this.providerName,
                latitude: lat,
                longitude: lng,
                price: Math.floor(Math.random() * 500000) + 150000,
                address: `${Math.floor(Math.random() * 9999)} Mock St`,
                city: 'Charlotte',
                county: 'Mecklenburg',
                state: 'NC',
                zip: '28202',
                propertyType: 'RESIDENTIAL',
                lotSize: Math.random() * 1.5,
            });
        }

        return PropertyMapper.toInternalArray(results);
    }

    async searchByPolygon(polygon: [number, number][]): Promise<Property[]> {
        // For simplicity in mock, just use bbox of polygon
        const lngs = polygon.map(p => p[0]);
        const lats = polygon.map(p => p[1]);
        const bounds = {
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats),
            minLng: Math.min(...lngs),
            maxLng: Math.max(...lngs),
        };
        return this.searchByBoundingBox(bounds);
    }
}

import { Property, PropertyProvider, BoundingBox } from './propertyProvider';
import { PropertyMapper } from './propertyMapper';

/**
 * ExampleTaxSaleProvider implementation.
 * Simulates a county-level tax sale or auction listing service.
 * Returns properties with lower prices and specific types.
 */
export class ExampleTaxSaleProvider implements PropertyProvider {
    readonly providerName = 'CountyTaxSale';

    async searchByBoundingBox(bounds: BoundingBox): Promise<Property[]> {
        console.log(`[TaxSaleProvider] Fetching properties for bbox: ${JSON.stringify(bounds)}`);
        await new Promise(resolve => setTimeout(resolve, 400));

        const results: unknown[] = [];
        for (let i = 0; i < 5; i++) {
            const lat = Math.random() * (bounds.maxLat - bounds.minLat) + bounds.minLat;
            const lng = Math.random() * (bounds.maxLng - bounds.minLng) + bounds.minLng;
            const id = `tax_${Math.random().toString(36).substr(2, 9)}`;

            results.push({
                externalId: id,
                source: this.providerName,
                latitude: lat,
                longitude: lng,
                price: Math.floor(Math.random() * 100000) + 10000, // Cheaper properties
                address: `${Math.floor(Math.random() * 9999)} Auction Way`,
                city: 'Rural County',
                county: 'Anson',
                state: 'NC',
                zip: '28001',
                propertyType: 'VACANT_LAND',
                lotSize: Math.random() * 10 + 2, // Larger lots
            });
        }

        return PropertyMapper.toInternalArray(results);
    }

    async searchByPolygon(polygon: [number, number][]): Promise<Property[]> {
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

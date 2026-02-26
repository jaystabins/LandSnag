import { PropertyProvider } from './propertyProvider';
import { GeoJSONFeature } from '../types/geojson';

/**
 * ExampleTaxSaleProvider implementation.
 * Simulates a county-level tax sale or auction listing service.
 * Returns properties with lower prices and specific types.
 */
export class ExampleTaxSaleProvider implements PropertyProvider {
    readonly providerName = 'CountyTaxSale';

    async search(params: {
        bbox?: [number, number, number, number];
        city?: string;
        state?: string;
        zip?: string;
    }): Promise<GeoJSONFeature[]> {
        console.log(`[TaxSaleProvider] Fetching properties with params: ${JSON.stringify(params)}`);
        await new Promise(resolve => setTimeout(resolve, 400));

        const features: GeoJSONFeature[] = [];
        for (let i = 0; i < 5; i++) {
            const lat = params.bbox ? Math.random() * (params.bbox[3] - params.bbox[1]) + params.bbox[1] : 35.2271;
            const lon = params.bbox ? Math.random() * (params.bbox[2] - params.bbox[0]) + params.bbox[0] : -80.8431;

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [lon - 0.00005, lat - 0.00005],
                        [lon + 0.00005, lat - 0.00005],
                        [lon + 0.00005, lat + 0.00005],
                        [lon - 0.00005, lat + 0.00005],
                        [lon - 0.00005, lat - 0.00005]
                    ]]
                },
                properties: {
                    listing_id: `tax_${Math.random().toString(36).substr(2, 9)}`,
                    source: this.providerName,
                    latitude: lat,
                    longitude: lon,
                    price: Math.floor(Math.random() * 100000) + 10000,
                    address: `${Math.floor(Math.random() * 9999)} Auction Way`,
                    city: 'Rural County',
                    county: 'Anson',
                    state: 'NC',
                    zip: '28001',
                    property_type: 'VACANT_LAND',
                    lot_size: Math.random() * 10 + 2,
                }
            });
        }

        return features;
    }
}

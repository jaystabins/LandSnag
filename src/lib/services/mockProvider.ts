import { PropertyProvider } from './propertyProvider';
import { GeoJSONFeature } from '../types/geojson';

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

    async search(params: {
        bbox?: [number, number, number, number];
        city?: string;
        state?: string;
        zip?: string;
    }): Promise<GeoJSONFeature[]> {
        console.log(`[MockProvider] Fetching properties with params: ${JSON.stringify(params)}`);
        await new Promise(resolve => setTimeout(resolve, 600));

        const features: GeoJSONFeature[] = [];
        for (let i = 0; i < 8; i++) {
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
                    listing_id: `mock_${Math.random().toString(36).substr(2, 9)}`,
                    source: this.providerName,
                    latitude: lat,
                    longitude: lon,
                    price: Math.floor(Math.random() * 500000) + 150000,
                    address: `${Math.floor(Math.random() * 9999)} Mock St`,
                    city: 'Charlotte',
                    county: 'Mecklenburg',
                    state: 'NC',
                    zip: '28202',
                    property_type: 'RESIDENTIAL',
                    lot_size: Math.random() * 1.5,
                }
            });
        }

        return features;
    }
}

import { GeoJSONFeature, GeoJSONGeometry } from '../types/geojson';

export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

export interface Property {
    id: string;
    externalId: string | null;
    source: string;
    latitude: number;
    longitude: number;
    price: number;
    address: string;
    city: string;
    county: string | null;
    state: string;
    zip: string;
    propertyType: string;
    lotSize: number | null;
    lastFetchedAt: Date;
    createdAt: Date;
}

export interface PropertyProvider {
    readonly providerName: string;
    search(params: {
        bbox?: [number, number, number, number];
        polygon?: GeoJSONGeometry;
        city?: string;
        state?: string;
        zip?: string;
        radius?: number;
    }): Promise<GeoJSONFeature[]>;
}

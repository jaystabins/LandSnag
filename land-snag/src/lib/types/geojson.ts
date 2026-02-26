export type GeoJSONGeometry = {
    type: 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon' | 'GeometryCollection';
    coordinates: any;
};

export type GeoJSONFeature = {
    type: 'Feature';
    geometry: GeoJSONGeometry;
    properties: Record<string, any>;
};

export type GeoJSONFeatureCollection = {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
    meta?: Record<string, any>;
};

/**
 * Computes the distance between two points on Earth using the Haversine formula.
 * @returns distance in kilometers
 */
export function haversineDistance(
    point1: { lat: number; lon: number },
    point2: { lat: number; lon: number }
): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLon = ((point2.lon - point1.lon) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Converts a bounding box [west, south, east, north] to a center point and radius.
 * The radius is half the diagonal distance of the bounding box.
 */
export function bboxToCenterAndRadius(bbox: [number, number, number, number]): {
    lat: number;
    lon: number;
    radiusKm: number;
} {
    const [west, south, east, north] = bbox;

    const centerLat = (south + north) / 2;
    const centerLon = (west + east) / 2;

    // Radius is half the diagonal distance
    const diagonalDistance = haversineDistance(
        { lat: south, lon: west },
        { lat: north, lon: east }
    );
    const radiusKm = Math.ceil(diagonalDistance / 2);

    return {
        lat: centerLat,
        lon: centerLon,
        radiusKm,
    };
}

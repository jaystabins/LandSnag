import { prisma } from '../prisma';
import { isPointInPolygon } from '../geo-utils';

export interface SearchParams {
    bbox?: {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
    };
    polygon?: [number, number][]; // [lng, lat]
}

export async function searchProperties(params: SearchParams) {
    const { bbox, polygon } = params;

    if (bbox) {
        return await prisma.property.findMany({
            where: {
                latitude: { gte: bbox.minLat, lte: bbox.maxLat },
                longitude: { gte: bbox.minLng, lte: bbox.maxLng },
            },
        });
    }

    if (polygon) {
        // Basic approach for SQLite: Fetch properties in the polygon's bounding box first, then filter in-memory
        const lngs = polygon.map((p) => p[0]);
        const lats = polygon.map((p) => p[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        const candidates = await prisma.property.findMany({
            where: {
                latitude: { gte: minLat, lte: maxLat },
                longitude: { gte: minLng, lte: maxLng },
            },
        });

        return candidates.filter((p) => isPointInPolygon([p.longitude, p.latitude], polygon));
    }

    return await prisma.property.findMany({ take: 100 });
}

export async function getPropertyDetail(id: string) {
    return await prisma.property.findUnique({
        where: { id },
    });
}

import { NextRequest, NextResponse } from 'next/server';
import { propertyService } from '@/lib/services/propertyService';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const bboxStr = searchParams.get('bbox');
    const polygonStr = searchParams.get('polygon');

    try {
        let bounds: any = null;
        let polygon: [number, number][] | undefined = undefined;

        if (polygonStr) {
            polygon = polygonStr.split(';').map((p) => {
                const [lng, lat] = p.split(',').map(Number);
                return [lng, lat] as [number, number];
            });

            const lngs = polygon.map((p) => p[0]);
            const lats = polygon.map((p) => p[1]);
            bounds = {
                minLat: Math.min(...lats),
                maxLat: Math.max(...lats),
                minLng: Math.min(...lngs),
                maxLng: Math.max(...lngs),
            };
        } else if (bboxStr) {
            const [minLat, maxLat, minLng, maxLng] = bboxStr.split(',').map(Number);
            bounds = { minLat, maxLat, minLng, maxLng };
        } else {
            // Default fallback viewport
            bounds = { minLat: 35.1, maxLat: 35.4, minLng: -80.9, maxLng: -80.7 };
        }

        const properties = await propertyService.searchProperties(bounds, polygon);

        const geojson = {
            type: 'FeatureCollection',
            features: properties.map((p) => ({
                type: 'Feature',
                id: p.id,
                geometry: {
                    type: 'Point',
                    coordinates: [p.longitude, p.latitude],
                },
                properties: {
                    id: p.id,
                    externalId: p.externalId,
                    source: p.source,
                    price: p.price,
                    address: p.address,
                    city: p.city,
                    state: p.state,
                    zip: p.zip,
                    propertyType: p.propertyType,
                    lotSize: p.lotSize,
                    lastFetchedAt: p.lastFetchedAt,
                },
            })),
        };

        return NextResponse.json(geojson);
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

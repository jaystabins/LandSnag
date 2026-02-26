import { NextRequest, NextResponse } from 'next/server';
import { searchProperties } from '@/lib/data/property';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const bboxStr = searchParams.get('bbox'); // minLat,maxLat,minLng,maxLng
    const polygonStr = searchParams.get('polygon'); // lng1,lat1;lng2,lat2;...

    let params = {};

    if (bboxStr) {
        const [minLat, maxLat, minLng, maxLng] = bboxStr.split(',').map(Number);
        params = { bbox: { minLat, maxLat, minLng, maxLng } };
    } else if (polygonStr) {
        const polygon = polygonStr.split(';').map((p) => {
            const [lng, lat] = p.split(',').map(Number);
            return [lng, lat] as [number, number];
        });
        params = { polygon };
    }

    try {
        const properties = await searchProperties(params);

        // Map to GeoJSON
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
                    price: p.price,
                    address: p.address,
                    city: p.city,
                    state: p.state,
                    zip: p.zip,
                    propertyType: p.propertyType,
                    lotSize: p.lotSize,
                    createdAt: p.createdAt,
                },
            })),
        };

        return NextResponse.json(geojson);
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

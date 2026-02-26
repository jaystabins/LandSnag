import { NextRequest, NextResponse } from 'next/server';
import { RealtorProvider } from '@/providers/RealtorProvider';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const radius = searchParams.get('radius');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const zip = searchParams.get('zip');

    console.log(`[Ingest API] Realtor request: lat=${lat}, lon=${lon}, radius=${radius}, city=${city}, state=${state}, zip=${zip}`);

    const params: any = {};
    if (lat && lon) {
        params.bbox = [parseFloat(lon) - 0.1, parseFloat(lat) - 0.1, parseFloat(lon) + 0.1, parseFloat(lat) + 0.1];
        params.radius = radius ? parseFloat(radius) : 10;
    } else if (city && state) {
        params.city = city;
        params.state = state;
        params.radius = radius ? parseFloat(radius) : 10;
    } else if (zip) {
        params.zip = zip;
        params.radius = radius ? parseFloat(radius) : 10;
    } else {
        console.warn('[Ingest API] Missing search parameters');
        return NextResponse.json({ error: 'Missing search parameters (lat/lon, city/state, or zip)' }, { status: 400 });
    }

    try {
        const provider = new RealtorProvider();
        const features = await provider.search(params);

        console.log(`[Ingest API] Realtor ingestion successful. Returning ${features.length} features.`);

        return NextResponse.json({
            type: "FeatureCollection",
            features: features,
            meta: { fetchedAt: new Date().toISOString() }
        });
    } catch (error) {
        console.error('[Ingest API] Realtor ingestion failed:', error);
        return NextResponse.json({ error: 'External API failure' }, { status: 502 });
    }
}

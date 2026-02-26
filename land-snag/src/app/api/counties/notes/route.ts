import { NextRequest, NextResponse } from 'next/server';
import { propertyService } from '@/lib/services/propertyService';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const county = searchParams.get('county');
    const state = searchParams.get('state');

    if (!county || !state) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    try {
        const note = await propertyService.getCountyNote(county, state);
        return NextResponse.json(note || { content: '' });
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { county, state, content } = await request.json();
        const result = await propertyService.saveCountyNote(county, state, content);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

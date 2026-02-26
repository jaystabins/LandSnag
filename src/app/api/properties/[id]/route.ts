import { NextRequest, NextResponse } from 'next/server';
import { propertyService } from '@/lib/services/propertyService';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        // Next.js 15+ requires awaiting params
        const params = await (context.params as any);
        const { id } = params;

        console.log(`[API] GET /api/properties/${id}`);
        const details = await propertyService.getPropertyById(id);

        if (!details) {
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        return NextResponse.json(details);
    } catch (error) {
        console.error(`[API] Detail fetch failed:`, error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const params = await (context.params as any);
        const { id } = params;
        const result = await propertyService.toggleSaveProperty(id);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const params = await (context.params as any);
        const { id } = params;
        const { status } = await request.json();
        const result = await propertyService.updateStatus(id, status);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

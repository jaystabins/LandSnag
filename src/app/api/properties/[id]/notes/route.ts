import { NextRequest, NextResponse } from 'next/server';
import { propertyService } from '@/lib/services/propertyService';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const params = await (context.params as any);
        const { id } = params;
        const { content } = await request.json();
        const result = await propertyService.addNote(id, content);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { propertyService } from '@/lib/services/propertyService';

export async function GET() {
    console.log('[Dev API] Received request to clear property cache');
    propertyService.clearCache();
    return NextResponse.json({ ok: true, message: 'In-memory cache cleared' });
}

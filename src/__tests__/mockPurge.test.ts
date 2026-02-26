import { describe, it, expect } from 'vitest';

describe('Mock Purge Verification', () => {
    it('should only return realtor16 listings after purge', async () => {
        // 1. Clear cache
        const clearRes = await fetch('http://localhost:3000/api/dev/clearCache');
        expect(clearRes.ok).toBe(true);

        // 2. Search for properties (Nashville coordinates as per previous successful integration test)
        const lat = 36.1627;
        const lon = -86.7816;
        const radius = 5;
        const searchUrl = `http://localhost:3000/api/ingest/realtor?lat=${lat}&lon=${lon}&radius=${radius}`;

        const response = await fetch(searchUrl);
        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.type).toBe('FeatureCollection');

        if (data.features.length > 0) {
            data.features.forEach((feature: any) => {
                expect(feature.properties.source).toBe('realtor16');
                expect(feature.properties.source).not.toBe('mock');
                expect(feature.properties.source).not.toBeNull();
            });
        }
    });
});

# Property Providers

This document explains how to add new property data sources to LandSnag.

## Adding a CSV-based or RapidAPI Provider

To add a new provider (like Realtor16), follow these steps:

### 1. Create a class implementing `PropertyProvider`
File: `src/providers/MyNewProvider.ts`

```typescript
import { PropertyProvider } from '@/lib/services/propertyProvider';
import { GeoJSONFeature } from '@/lib/types/geojson';

export class MyNewProvider implements PropertyProvider {
    readonly providerName = 'my-source';

    async search(params: {
        bbox?: [number, number, number, number];
        city?: string;
        state?: string;
        zip?: string;
        radius?: number;
    }): Promise<GeoJSONFeature[]> {
        // Implementation logic here
    }
}
```

### 2. Cache-key strategy
Use a SHA-256 hash of the normalized search parameters to avoid redundant API calls. Store raw responses in a dedicated cache table if necessary.

```typescript
private computeHash(params: any): string {
    const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc: any, key) => {
            acc[key] = params[key];
            return acc;
        }, {});
    return crypto.createHash('sha256').update(JSON.stringify(sortedParams)).digest('hex');
}
```

### 3. Register the provider
Add your new provider to the array in `src/lib/services/providerRegistry.ts`.

```typescript
import { MyNewProvider } from '@/providers/MyNewProvider';

export function getProviders() {
    const providers = [
        new RealtorProvider(),
        new MyNewProvider()
    ];

    if (process.env.ENABLE_MOCKS === 'true') {
        // providers.push(new MockProvider(...));
    }

    return providers;
}
```

### 4. Expose a custom ingestion endpoint
Create a Next.js API route to manually trigger data ingestion for the new source.
File: `src/app/api/ingest/my-source/route.ts`


## Debugging the Realtor16 Provider

### Required Environment Variables
Ensure the following are set in your `.env.local` or `.env`:
```env
REALTOR_API_KEY=your_rapidapi_key
REALTOR_TTL_HOURS=24
REALTOR_RATE_MS=200
```

### Where to find logs
Diagnostics for the Realtor16 provider are prefixed with `[RealtorProvider]` in the server console. You will see:
- API endpoint URLs and query parameters.
- Masked headers and response status codes.
- Cache hits/misses and SHA-256 hash IDs.
- Pagination progress (e.g., "Page 1/5").
- Sample raw listings for schema verification.

### How pagination works
The provider automatically follows `total_pages` or computes them from the `total` result count. It respects `REALTOR_RATE_MS` between requests to avoid 429 errors.

### Manual Invocation
To trigger an ingestion manually, use `curl` or visit the URL in your browser:
```bash
curl "http://localhost:3000/api/ingest/realtor?lat=36.5&lon=-93.2&radius=30"
```
The response will be a GeoJSON `FeatureCollection`.

### Parameter mapping – bbox → center/radius

TheLandSnag frontend uses bounding boxes, but the Realtor-16 API requires center points and radii. The `RealtorProvider` automatically converts these using the Haversine formula (implemented in `src/lib/realtorHelper.ts`).

```typescript
const { lat, lon, radiusKm } = bboxToCenterAndRadius(params.bbox);
// lat = (south + north) / 2
// lon = (west + east) / 2
// radiusKm = haversineDistance(sw, ne) / 2
```

The provider also validates search parameters using Zod to ensure type safety and prevent malformed requests.

### Troubleshooting Empty Results
If the `features` array is empty:
1. Check the server logs for `404` (endpoint mismatch), `401` (invalid key), or `429` (quota exceeded).
2. Verify that the API response contains a `properties` or `listings` array.
3. Increasing the `radius` parameter can help if data in the target area is sparse.

## Mock Provider (Currently Disabled)

The `MockProvider` and `ExampleTaxSaleProvider` are currently disabled to ensure `RealtorProvider` is the primary source of data.

To re-enable mock data for development:
1. Set `ENABLE_MOCKS=true` in `.env.local`.
2. Uncomment the instantiation lines in `src/lib/services/providerRegistry.ts`.
3. (Optional) Uncomment the import lines if TypeScript errors occur.

The mock source files remain in `src/lib/services/mockProvider.ts` and `src/lib/services/taxSaleProvider.ts`.

## Data purge (early‑dev cleanup)

After disabling the mock provider, run:

```bash
npx prisma migrate dev --name remove_mock_data
curl http://localhost:3000/api/dev/clearCache
```

This removes any mock rows that may already exist in SQLite and clears the runtime cache.

## Rate‑limit handling for Realtor16

The `RealtorProvider` uses a token‑bucket algorithm and jittered exponential backoff to handle RapidAPI limits.

### Configuration

You can configure the behavior in `.env.local`:

- `REALTOR_MAX_CALLS_PER_MIN`: Max allowed calls per minute (default: `30`).
- `REALTOR_MAX_RETRIES`: Number of retry attempts for 429s (default: `5`).
- `REALTOR_INITIAL_BACKOFF_MS`: Base back-off for exponential strategy (default: `500`).

### Development

For testing purposes, you can reset the limiter:

```typescript
import { resetRateLimiter } from '@/lib/rateLimiter';
if (process.env.NODE_ENV !== 'production') {
  resetRateLimiter();
}
```



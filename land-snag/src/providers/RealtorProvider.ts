import { PropertyProvider } from '@/lib/services/propertyProvider';
import { GeoJSONFeature, GeoJSONGeometry } from '@/lib/types/geojson';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { getRateLimiter, TokenBucketLimiter } from '@/lib/rateLimiter';
import { z } from 'zod';
import { bboxToCenterAndRadius } from '@/lib/realtorHelper';
import { PropertyMapper } from '@/lib/services/propertyMapper';
import { ProviderError } from '@/lib/errors/PropertyErrors';

const SearchParamsSchema = z.object({
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    polygon: z.any().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    radius: z.number().int().optional(),
});
export class RealtorProvider implements PropertyProvider {
    readonly providerName = 'realtor16';
    private readonly apiKey: string;
    private readonly baseUrl = 'https://realtor16.p.rapidapi.com';
    private readonly ttlHours: number;
    private readonly initialBackoffMs: number;
    private readonly maxRetries: number;
    private readonly limiter: TokenBucketLimiter;

    constructor() {
        this.apiKey = process.env.REALTOR_API_KEY || '';
        this.ttlHours = parseInt(process.env.REALTOR_TTL_HOURS || '24', 10);

        const maxCallsPerMin = parseInt(process.env.REALTOR_MAX_CALLS_PER_MIN || '30', 10);
        this.maxRetries = parseInt(process.env.REALTOR_MAX_RETRIES || '5', 10);
        this.initialBackoffMs = parseInt(process.env.REALTOR_INITIAL_BACKOFF_MS || '500', 10);

        this.limiter = getRateLimiter(this.providerName);

        if (!this.apiKey) {
            console.warn('[RealtorProvider] WARNING: REALTOR_API_KEY is not defined in environment variables.');
        } else {
            console.log(`[RealtorProvider] Initialized with API Key: ${this.apiKey.substring(0, 4)}...`);
        }
    }

    async search(params: {
        bbox?: [number, number, number, number];
        polygon?: GeoJSONGeometry;
        city?: string;
        state?: string;
        zip?: string;
        radius?: number;
    }): Promise<GeoJSONFeature[]> {
        // 0. Validate params
        const validated = SearchParamsSchema.safeParse(params);
        if (!validated.success) {
            console.error('[RealtorProvider] Invalid search parameters:', validated.error.format());
            throw new Error('Invalid search parameters');
        }

        const hash = this.computeHash(params);
        console.log(`[RealtorProvider] Search params: ${JSON.stringify(params)}`);
        console.log(`[RealtorProvider] Computed SHA-256 hash: ${hash}`);

        // 1. Check Cache
        const cached = await (prisma as any).realtorRawCache.findUnique({
            where: { hash }
        });

        if (cached) {
            const ageInHours = (Date.now() - cached.createdAt.getTime()) / (1000 * 60 * 60);
            if (ageInHours < this.ttlHours) {
                console.log(`[RealtorProvider] Cache HIT for hash: ${hash} (Age: ${ageInHours.toFixed(2)}h)`);
                return JSON.parse(cached.payload) as GeoJSONFeature[];
            } else {
                console.log(`[RealtorProvider] Cache EXPIRED for hash: ${hash} (Age: ${ageInHours.toFixed(2)}h > TTL: ${this.ttlHours}h). Deleting...`);
                await (prisma as any).realtorRawCache.delete({ where: { hash } });
            }
        } else {
            console.log(`[RealtorProvider] Cache MISS for hash: ${hash}`);
        }

        // 2. Fetch From API
        console.log(`[RealtorProvider] Starting API fetch sequence...`);
        try {
            const allFeatures: GeoJSONFeature[] = [];
            let currentPage = 1;
            let totalPages = 1;

            do {
                const response = await this.fetchPage(params, currentPage);
                if (!response) {
                    console.warn(`[RealtorProvider] Received null or empty response for page ${currentPage}. Aborting loop.`);
                    break;
                }

                // RapidAPI "Realtor16" returns properties in 'properties' (standard) or 'listings'/'results'
                const listings = response.properties || response.listings || response.results || [];

                if (listings.length === 0) {
                    if (currentPage === 1) {
                        const summary = params.bbox ? `bbox ${JSON.stringify(params.bbox)}` :
                            params.zip ? `zip ${params.zip}` :
                                params.city ? `${params.city}, ${params.state}` : 'unknown query';
                        console.log(`[RealtorProvider] No listings found for query ${summary}`);
                    }
                    console.log(`[RealtorProvider] Page ${currentPage} is empty. Aborting loop.`);
                    break;
                }

                // Pagination: handle total_pages, totalPages, or compute from 'total'
                if (response.total_pages || response.totalPages) {
                    totalPages = response.total_pages || response.totalPages;
                } else if (response.total) {
                    // Assuming 40 items per page if not specified
                    totalPages = Math.ceil(response.total / 40);
                } else {
                    totalPages = 1;
                }

                console.log(`[RealtorProvider] Page ${currentPage}/${totalPages}: Received ${listings.length} listings.`);

                const transformed = listings.map((listing: any) => {
                    try {
                        return this.transformListing(listing);
                    } catch (error) {
                        console.warn(`[RealtorProvider] Failed to transform listing:`, error);
                        return null;
                    }
                }).filter((feature: GeoJSONFeature | null): feature is GeoJSONFeature => feature !== null);
                
                allFeatures.push(...transformed);

                console.log(`[RealtorProvider] Total features collected so far: ${allFeatures.length}`);

                if (currentPage >= totalPages) {
                    console.log(`[RealtorProvider] Reached last page: ${currentPage}.`);
                    break;
                }
                currentPage++;
            } while (currentPage <= totalPages);


            console.log(`[RealtorProvider] Finished collection. Total: ${allFeatures.length} features.`);

            // 3. Persist Cache
            if (allFeatures.length > 0) {
                console.log(`[RealtorProvider] Persisting results to cache...`);
                await (prisma as any).realtorRawCache.upsert({
                    where: { hash },
                    update: {
                        payload: JSON.stringify(allFeatures),
                        createdAt: new Date()
                    },
                    create: {
                        hash,
                        payload: JSON.stringify(allFeatures)
                    }
                });
            } else {
                console.warn(`[RealtorProvider] No features found. Skipping cache persistence.`);
            }

            return allFeatures;
        } catch (error) {
            console.error(`[RealtorProvider] Search failed:`, error);
            throw error;
        }
    }

    private async fetchPage(params: any, page: number): Promise<any> {
        let url = '';
        const queryParams = new URLSearchParams();
        queryParams.append('page', page.toString());
        queryParams.append('limit', '40'); // Standard limit

        if (params.bbox) {
            const { lat, lon, radiusKm } = bboxToCenterAndRadius(params.bbox);
            console.log(`[RealtorProvider] Bbox converted: { lat: ${lat}, lon: ${lon}, radius: ${radiusKm} }`);
            url = `${this.baseUrl}/properties/coordinates`;
            queryParams.append('lat', lat.toString());
            queryParams.append('lon', lon.toString());
            queryParams.append('radius', radiusKm.toString());
        } else if (params.city && params.state) {
            url = `${this.baseUrl}/properties/city`;
            queryParams.append('city', params.city);
            queryParams.append('state_code', params.state);
            queryParams.append('radius', params.radius?.toString() || '10');
        } else if (params.zip) {
            url = `${this.baseUrl}/properties/zip`;
            queryParams.append('zip_code', params.zip);
            queryParams.append('radius', params.radius?.toString() || '10');
        } else {
            console.error('[RealtorProvider] Invalid search parameters provided to fetchPage:', params);
            return null;
        }

        const fullUrl = `${url}?${queryParams.toString()}`;

        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            // Respect token bucket rate limit before even trying
            await this.limiter.waitForToken();

            try {
                console.log(`[RealtorProvider] FETCH [Page ${page}] [Attempt ${attempt}]: ${fullUrl}`);
                const response = await fetch(fullUrl, {
                    headers: {
                        'X-RapidAPI-Key': this.apiKey,
                        'X-RapidAPI-Host': 'realtor16.p.rapidapi.com'
                    }
                });

                const rateLimitRemaining = response.headers.get('x-ratelimit-remaining') || response.headers.get('X-RateLimit-Remaining');
                if (rateLimitRemaining) {
                    console.log(`[RealtorProvider] Quota Remaining: ${rateLimitRemaining}`);
                }

                if (response.status === 429) {
                    const retryAfter = response.headers.get('retry-after') || response.headers.get('Retry-After');
                    let waitTime = 0;

                    if (retryAfter) {
                        // Retry-After can be seconds or a date
                        waitTime = parseInt(retryAfter, 10);
                        if (isNaN(waitTime)) {
                            const retryDate = new Date(retryAfter);
                            waitTime = Math.max(0, Math.ceil((retryDate.getTime() - Date.now()) / 1000));
                        }
                        waitTime = waitTime * 1000; // Convert to ms
                        console.warn(`[RealtorProvider] 429 Received. Retry-After: ${retryAfter}. Waiting ${waitTime}ms...`);
                    } else {
                        // Exponential backoff with jitter: initial * 2^(attempt) + random jitter (0-200ms)
                        waitTime = Math.min(8000, this.initialBackoffMs * Math.pow(2, attempt)) + Math.random() * 200;
                        console.warn(`[RealtorProvider] 429 Received. No Retry-After header. Using exponential backoff: ${waitTime.toFixed(0)}ms...`);
                    }

                    if (attempt < this.maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue; // Retry
                    } else {
                        throw new Error(`RapidAPI responded with 429 and max retries (${this.maxRetries}) reached.`);
                    }
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[RealtorProvider] API Error: ${response.status} - ${errorText}`);
                    throw new Error(`RapidAPI responded with ${response.status}`);
                }

                const data = await response.json();
                console.log(`[RealtorProvider] RESPONSE [Page ${page}]: Received data successfully.`);
                return data;
            } catch (error: any) {
                console.error(`[RealtorProvider] Fetch attempt ${attempt} failed:`, error.message);
                lastError = error;
                if (attempt === this.maxRetries) break;

                // If it's a generic catch (network error), still apply a small backoff before retrying
                const delay = this.initialBackoffMs * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError || new Error(`Failed to fetch page ${page} after ${this.maxRetries} retries`);
    }

    private transformListing(listing: any): GeoJSONFeature {
        // Handle different possible key names for lat/lon
        const latVal = listing.latitude || listing.lat || (listing.location?.address?.coordinate?.lat);
        const lonVal = listing.longitude || listing.lon || (listing.location?.address?.coordinate?.lon);

        const lat = parseFloat(latVal);
        const lon = parseFloat(lonVal);

        if (isNaN(lat) || isNaN(lon)) {
            console.warn(`[RealtorProvider] Missing or invalid coordinates for listing: ${listing.listing_id || listing.id}. Coords: lat=${latVal}, lon=${lonVal}`);
        }

        // Tiny square polygon (approx 10m x 10m)
        const d = 0.0001;
        const coordinates = [[
            [lon - d, lat - d],
            [lon + d, lat - d],
            [lon + d, lat + d],
            [lon - d, lat + d],
            [lon - d, lat - d]
        ]];

        const rawPrice = listing.price || listing.list_price || '0';
        const cleanedPrice = typeof rawPrice === 'string' ? rawPrice.replace(/[^0-9.]/g, '') : rawPrice.toString();
        const price = Math.floor(parseFloat(cleanedPrice) || 0);

        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates
            },
            properties: {
                ...listing,
                listing_id: (listing.listing_id || listing.id || Math.random().toString(36).substr(2, 9)).toString(),
                price: price,
                beds: typeof listing.beds === 'string' ? parseInt(listing.beds, 10) || 0 : listing.beds || 0,
                baths: typeof listing.baths === 'string' ? parseFloat(listing.baths) || 0 : listing.baths || 0,
                source: 'realtor16'
            }
        };
    }

    private computeHash(params: any): string {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((acc: any, key) => {
                acc[key] = params[key];
                return acc;
            }, {});
        return crypto.createHash('sha256').update(JSON.stringify(sortedParams)).digest('hex');
    }
}

import { prisma } from '../prisma';
import { PropertyProvider, BoundingBox, Property } from './propertyProvider';
import { getProviders } from './providerRegistry';
import { isPointInPolygon } from '../geo-utils';
import { PropertyRepository, PrismaPropertyRepository } from '../repositories/propertyRepository';
import { PropertyMapper } from './propertyMapper';
import { 
    PropertyError, 
    ProviderError, 
    DatabaseError, 
    ValidationError 
} from '../errors/PropertyErrors';

export class PropertyService {
    private providers: PropertyProvider[];
    private repository: PropertyRepository;
    private cacheThreshold: number;
    private cacheTTLHours: number;
    private maxResults: number;
    private internalCache = new Map<string, Property[]>();

    constructor(
        providers?: PropertyProvider[],
        repository?: PropertyRepository
    ) {
        // Dependency Injection: accepts array of providers, defaults to registry
        this.providers = providers || getProviders();
        this.repository = repository || new PrismaPropertyRepository(prisma);
        
        // Configuration from environment variables
        this.cacheThreshold = parseInt(process.env.CACHE_THRESHOLD || '5', 10);
        this.cacheTTLHours = parseInt(process.env.CACHE_TTL_HOURS || '24', 10);
        this.maxResults = parseInt(process.env.MAX_RESULTS || '500', 10);
    }

    async searchProperties(bounds: BoundingBox, polygon?: [number, number][]): Promise<Property[]> {
        try {
            // 1. Check for fresh cached data
            const cachedFresh = await this.repository.findPropertiesByBoundsWithFreshness(
                bounds, 
                this.cacheTTLHours, 
                this.maxResults
            );

            // 2. If below threshold, fire off providers in parallel
            if (cachedFresh.length < this.cacheThreshold) {
                console.log(`[PropertyService] Cache low (${cachedFresh.length}). Fetching from ${this.providers.length} providers...`);

                const searchParams = {
                    bbox: [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat] as [number, number, number, number],
                    polygon: polygon ? { type: 'Polygon', coordinates: [polygon] } as any : undefined
                };

                const providerPromises = this.providers.map(p => p.search(searchParams));

                const resultsArray = await Promise.allSettled(providerPromises);
                const allFetched: Property[] = [];

                resultsArray.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        const validatedProperties = PropertyMapper.toInternalArray(result.value);
                        allFetched.push(...validatedProperties);
                    } else {
                        // Graceful failure: log but continue
                        const providerError = new ProviderError(
                            `Provider ${this.providers[index].providerName} failed`,
                            this.providers[index].providerName,
                            { error: result.reason }
                        );
                        console.error(`[PropertyService] ${providerError.message}:`, providerError.details);
                    }
                });

                // 3. Deduplicate and upsert in batch
                if (allFetched.length > 0) {
                    const uniqueFetched = this.deduplicate(allFetched);
                    await this.upsertProperties(uniqueFetched);
                }
            }

            // 4. Return final results from DB
            let finalResults = await this.repository.findPropertiesByBounds(bounds, this.maxResults);

            // 5. Final spatial filter if polygon is provided
            if (polygon && finalResults.length > 0) {
                finalResults = finalResults.filter((p) =>
                    isPointInPolygon([p.longitude, p.latitude], polygon)
                );
            }

            return finalResults;

        } catch (error) {
            const dbError = new DatabaseError('Search failed', { error });
            console.error(`[PropertyService] ${dbError.message}:`, dbError.details);
            
            // Fallback to whatever is in the DB even if search logic fails
            try {
                return await this.repository.findPropertiesByBounds(bounds, this.maxResults);
            } catch (fallbackError) {
                throw new DatabaseError('Failed to fetch properties even with fallback', { fallbackError });
            }
        }
    }

    private deduplicate(properties: Property[]): Property[] {
        const seen = new Set<string>();
        return properties.filter(p => {
            // Priority 1: externalId
            if (p.externalId) {
                if (seen.has(p.externalId)) return false;
                seen.add(p.externalId);
                return true;
            }
            // Priority 2: Simple Lat/Lng + Address hash
            const fuzzyKey = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)},${p.address.toLowerCase().trim()}`;
            if (seen.has(fuzzyKey)) return false;
            seen.add(fuzzyKey);
            return true;
        });
    }

    private async upsertProperties(properties: Property[]) {
        // Optimization: createMany with skipDuplicates handles the batch insert efficiently
        // We filter for properties with externalId to ensure uniqueness check works
        const validForUpsert = properties
            .filter(p => p.externalId)
            .map(p => ({
                externalId: p.externalId!,
                source: p.source,
                latitude: p.latitude,
                longitude: p.longitude,
                price: p.price,
                address: p.address,
                city: p.city,
                state: p.state,
                zip: p.zip,
                propertyType: p.propertyType,
                lotSize: p.lotSize,
                lastFetchedAt: new Date(),
            }));

        if (validForUpsert.length === 0) return;

        try {
            await this.repository.createManyProperties(validForUpsert);
        } catch (err) {
            const dbError = new DatabaseError('Batch upsert failed', { error: err });
            console.error(`[PropertyService] ${dbError.message}:`, dbError.details);
        }
    }

    // --- Research Features (Consolidated) ---

    async getPropertyById(id: string) {
        console.log(`[PropertyService] Fetching property details for ID: ${id}`);
        try {
            return await this.repository.findPropertyById(id);
        } catch (error) {
            const dbError = new DatabaseError('Failed to fetch property by ID', { error, id });
            console.error(`[PropertyService] ${dbError.message}:`, dbError.details);
            throw dbError;
        }
    }

    async toggleSaveProperty(id: string) {
        try {
            return await this.repository.toggleSaveProperty(id);
        } catch (error) {
            const dbError = new DatabaseError('Failed to toggle save property', { error, id });
            console.error(`[PropertyService] ${dbError.message}:`, dbError.details);
            throw dbError;
        }
    }

    async updateStatus(propertyId: string, status: string) {
        try {
            return await this.repository.updatePropertyStatus(propertyId, status);
        } catch (error) {
            const dbError = new DatabaseError('Failed to update property status', { error, propertyId, status });
            console.error(`[PropertyService] ${dbError.message}:`, dbError.details);
            throw dbError;
        }
    }

    async addNote(propertyId: string, content: string) {
        try {
            return await this.repository.addPropertyNote(propertyId, content);
        } catch (error) {
            const dbError = new DatabaseError('Failed to add property note', { error, propertyId, content });
            console.error(`[PropertyService] ${dbError.message}:`, dbError.details);
            throw dbError;
        }
    }

    async getCountyNote(county: string, state: string) {
        try {
            return await this.repository.getCountyNote(county, state);
        } catch (error) {
            const dbError = new DatabaseError('Failed to get county note', { error, county, state });
            console.error(`[PropertyService] ${dbError.message}:`, dbError.details);
            throw dbError;
        }
    }

    async saveCountyNote(county: string, state: string, content: string) {
        try {
            return await this.repository.saveCountyNote(county, state, content);
        } catch (error) {
            const dbError = new DatabaseError('Failed to save county note', { error, county, state, content });
            console.error(`[PropertyService] ${dbError.message}:`, dbError.details);
            throw dbError;
        }
    }

    public clearCache(): void {
        console.log('[PropertyService] Clearing in-memory cache...');
        this.internalCache.clear();
    }
}

export const propertyService = new PropertyService();

import { prisma } from '../prisma';
import { PropertyProvider, BoundingBox, Property } from './propertyProvider';
import { getProviders } from './providerRegistry';
import { isPointInPolygon } from '../geo-utils';

export class PropertyService {
    private providers: PropertyProvider[];
    private cacheThreshold = 5;
    private cacheTTLHours = 24;
    private maxResults = 500;

    constructor(providers?: PropertyProvider[]) {
        // Dependency Injection: accepts array of providers, defaults to registry
        this.providers = providers || getProviders();
    }

    async searchProperties(bounds: BoundingBox, polygon?: [number, number][]): Promise<Property[]> {
        try {
            // 1. Check for fresh cached data
            const freshThresholdDate = new Date();
            freshThresholdDate.setHours(freshThresholdDate.getHours() - this.cacheTTLHours);

            const cachedFresh = await prisma.property.findMany({
                where: {
                    latitude: { gte: bounds.minLat, lte: bounds.maxLat },
                    longitude: { gte: bounds.minLng, lte: bounds.maxLng },
                    lastFetchedAt: { gte: freshThresholdDate },
                },
                take: this.maxResults,
            });

            // 2. If below threshold, fire off providers in parallel
            if (cachedFresh.length < this.cacheThreshold) {
                console.log(`[PropertyService] Cache low (${cachedFresh.length}). Fetching from ${this.providers.length} providers...`);

                const providerPromises = this.providers.map(p =>
                    polygon ? p.searchByPolygon(polygon) : p.searchByBoundingBox(bounds)
                );

                const resultsArray = await Promise.allSettled(providerPromises);
                const allFetched: Property[] = [];

                resultsArray.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        allFetched.push(...result.value);
                    } else {
                        // Graceful failure: log but continue
                        console.error(`[PropertyService] Provider ${this.providers[index].providerName} failed:`, result.reason);
                    }
                });

                // 3. Deduplicate and upsert in batch
                if (allFetched.length > 0) {
                    const uniqueFetched = this.deduplicate(allFetched);
                    await this.upsertProperties(uniqueFetched);
                }
            }

            // 4. Return final results from DB
            let finalResults = await prisma.property.findMany({
                where: {
                    latitude: { gte: bounds.minLat, lte: bounds.maxLat },
                    longitude: { gte: bounds.minLng, lte: bounds.maxLng },
                },
                take: this.maxResults,
                orderBy: { id: 'desc' },
            });

            // 5. Final spatial filter if polygon is provided
            if (polygon && finalResults.length > 0) {
                finalResults = finalResults.filter((p) =>
                    isPointInPolygon([p.longitude, p.latitude], polygon)
                );
            }

            return finalResults as Property[];

        } catch (error) {
            console.error(`[PropertyService] Search failed:`, error);
            // Fallback to whatever is in the DB even if search logic fails
            try {
                return await prisma.property.findMany({
                    where: {
                        latitude: { gte: bounds.minLat, lte: bounds.maxLat },
                        longitude: { gte: bounds.minLng, lte: bounds.maxLng },
                    },
                    take: this.maxResults,
                }) as Property[];
            } catch {
                throw new Error('Failed to fetch properties even with fallback');
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
            await prisma.property.createMany({
                data: validForUpsert,
                skipDuplicates: true,
            });

            // For updates (if we want to refresh and not just skip duplicates), 
            // we would need a separate update loop or a more complex query, 
            // but requirement 4 specified createMany with skipDuplicates.
            console.log(`[PropertyService] Batch upserted ${validForUpsert.length} records.`);
        } catch (err) {
            console.error(`[PropertyService] Batch upsert failed:`, err);
        }
    }

    // --- Research Features (Consolidated) ---

    async getPropertyById(id: string) {
        console.log(`[PropertyService] Fetching property details for ID: ${id}`);
        return await prisma.property.findUnique({
            where: { id },
            include: {
                savedProperties: true,
                notes: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
    }

    async toggleSaveProperty(id: string) {
        const existing = await prisma.savedProperty.findUnique({
            where: { propertyId: id }
        });

        if (existing) {
            return await prisma.savedProperty.delete({
                where: { propertyId: id }
            });
        } else {
            return await prisma.savedProperty.create({
                data: {
                    propertyId: id,
                    status: 'SAVED'
                }
            });
        }
    }

    async updateStatus(propertyId: string, status: string) {
        return await prisma.savedProperty.upsert({
            where: { propertyId },
            update: { status },
            create: { propertyId, status }
        });
    }

    async addNote(propertyId: string, content: string) {
        return await prisma.propertyNote.create({
            data: { propertyId, content }
        });
    }

    async getCountyNote(county: string, state: string) {
        return await prisma.countyNote.findUnique({
            where: {
                county_state: { county, state }
            }
        });
    }

    async saveCountyNote(county: string, state: string, content: string) {
        return await prisma.countyNote.upsert({
            where: {
                county_state: { county, state }
            },
            update: { content },
            create: { county, state, content }
        });
    }
}

export const propertyService = new PropertyService();

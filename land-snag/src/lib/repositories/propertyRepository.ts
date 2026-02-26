import { PrismaClient, Property, SavedProperty, PropertyNote, CountyNote } from '@prisma/client';
import { BoundingBox } from '../services/propertyProvider';
import { DatabaseError } from '../errors/PropertyErrors';

export interface PropertyRepository {
    findPropertiesByBounds(bounds: BoundingBox, limit: number): Promise<Property[]>;
    findPropertiesByBoundsWithFreshness(bounds: BoundingBox, freshnessHours: number, limit: number): Promise<Property[]>;
    findPropertyById(id: string): Promise<Property | null>;
    upsertProperties(properties: Array<{
        externalId: string;
        source: string;
        latitude: number;
        longitude: number;
        price: number;
        address: string;
        city: string;
        state: string;
        zip: string;
        propertyType: string;
        lotSize: number | null;
        lastFetchedAt: Date;
    }>): Promise<void>;
    createManyProperties(properties: Array<{
        externalId: string;
        source: string;
        latitude: number;
        longitude: number;
        price: number;
        address: string;
        city: string;
        state: string;
        zip: string;
        propertyType: string;
        lotSize: number | null;
        lastFetchedAt: Date;
    }>): Promise<void>;
    toggleSaveProperty(propertyId: string): Promise<SavedProperty | null>;
    updatePropertyStatus(propertyId: string, status: string): Promise<SavedProperty>;
    addPropertyNote(propertyId: string, content: string): Promise<PropertyNote>;
    getCountyNote(county: string, state: string): Promise<CountyNote | null>;
    saveCountyNote(county: string, state: string, content: string): Promise<CountyNote>;
}

export class PrismaPropertyRepository implements PropertyRepository {
    constructor(private prisma: PrismaClient) {}

    async findPropertiesByBounds(bounds: BoundingBox, limit: number): Promise<Property[]> {
        try {
            return await this.prisma.property.findMany({
                where: {
                    latitude: { gte: bounds.minLat, lte: bounds.maxLat },
                    longitude: { gte: bounds.minLng, lte: bounds.maxLng },
                },
                take: limit,
                orderBy: { id: 'desc' },
            });
        } catch (error) {
            throw new DatabaseError('Failed to find properties by bounds', { error, bounds, limit });
        }
    }

    async findPropertiesByBoundsWithFreshness(bounds: BoundingBox, freshnessHours: number, limit: number): Promise<Property[]> {
        try {
            const freshThresholdDate = new Date();
            freshThresholdDate.setHours(freshThresholdDate.getHours() - freshnessHours);

            return await this.prisma.property.findMany({
                where: {
                    latitude: { gte: bounds.minLat, lte: bounds.maxLat },
                    longitude: { gte: bounds.minLng, lte: bounds.maxLng },
                    lastFetchedAt: { gte: freshThresholdDate },
                },
                take: limit,
            });
        } catch (error) {
            throw new DatabaseError('Failed to find properties by bounds with freshness', { error, bounds, freshnessHours, limit });
        }
    }

    async findPropertyById(id: string): Promise<Property | null> {
        try {
            return await this.prisma.property.findUnique({
                where: { id },
                include: {
                    savedProperties: true,
                    notes: {
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });
        } catch (error) {
            throw new DatabaseError('Failed to find property by ID', { error, id });
        }
    }

    async upsertProperties(properties: Array<{
        externalId: string;
        source: string;
        latitude: number;
        longitude: number;
        price: number;
        address: string;
        city: string;
        state: string;
        zip: string;
        propertyType: string;
        lotSize: number | null;
        lastFetchedAt: Date;
    }>): Promise<void> {
        try {
            for (const item of properties) {
                await this.prisma.property.upsert({
                    where: { externalId: item.externalId },
                    update: {
                        lastFetchedAt: item.lastFetchedAt,
                        price: item.price,
                        lotSize: item.lotSize,
                    },
                    create: item
                });
            }
        } catch (error) {
            throw new DatabaseError('Failed to upsert properties', { error, propertiesCount: properties.length });
        }
    }

    async createManyProperties(properties: Array<{
        externalId: string;
        source: string;
        latitude: number;
        longitude: number;
        price: number;
        address: string;
        city: string;
        state: string;
        zip: string;
        propertyType: string;
        lotSize: number | null;
        lastFetchedAt: Date;
    }>): Promise<void> {
        if (properties.length === 0) return;

        try {
            await this.prisma.property.createMany({
                data: properties,
            });
        } catch (error) {
            // Fallback to individual upserts if createMany fails
            console.warn('[PropertyRepository] createMany failed, falling back to individual upserts:', error);
            await this.upsertProperties(properties);
        }
    }

    async toggleSaveProperty(propertyId: string): Promise<SavedProperty | null> {
        try {
            const existing = await this.prisma.savedProperty.findUnique({
                where: { propertyId }
            });

            if (existing) {
                return await this.prisma.savedProperty.delete({
                    where: { propertyId }
                });
            } else {
                return await this.prisma.savedProperty.create({
                    data: {
                        propertyId,
                        status: 'SAVED'
                    }
                });
            }
        } catch (error) {
            throw new DatabaseError('Failed to toggle save property', { error, propertyId });
        }
    }

    async updatePropertyStatus(propertyId: string, status: string): Promise<SavedProperty> {
        try {
            return await this.prisma.savedProperty.upsert({
                where: { propertyId },
                update: { status },
                create: { propertyId, status }
            });
        } catch (error) {
            throw new DatabaseError('Failed to update property status', { error, propertyId, status });
        }
    }

    async addPropertyNote(propertyId: string, content: string): Promise<PropertyNote> {
        try {
            return await this.prisma.propertyNote.create({
                data: { propertyId, content }
            });
        } catch (error) {
            throw new DatabaseError('Failed to add property note', { error, propertyId, content });
        }
    }

    async getCountyNote(county: string, state: string): Promise<CountyNote | null> {
        try {
            return await this.prisma.countyNote.findUnique({
                where: {
                    county_state: { county, state }
                }
            });
        } catch (error) {
            throw new DatabaseError('Failed to get county note', { error, county, state });
        }
    }

    async saveCountyNote(county: string, state: string, content: string): Promise<CountyNote> {
        try {
            return await this.prisma.countyNote.upsert({
                where: {
                    county_state: { county, state }
                },
                update: { content },
                create: { county, state, content }
            });
        } catch (error) {
            throw new DatabaseError('Failed to save county note', { error, county, state, content });
        }
    }
}
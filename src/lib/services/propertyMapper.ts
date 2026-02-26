import { Property } from './propertyProvider';
import { z } from 'zod';
import { ValidationError } from '../errors/PropertyErrors';

export const PropertySchema = z.object({
    id: z.string().optional(),
    externalId: z.string().nullable().optional(),
    source: z.string().default('local'),
    latitude: z.number(),
    longitude: z.number(),
    price: z.number().int(),
    address: z.string(),
    city: z.string(),
    county: z.string().nullable().optional(),
    state: z.string(),
    zip: z.string(),
    propertyType: z.string(),
    lotSize: z.number().nullable().optional(),
    lastFetchedAt: z.coerce.date().default(() => new Date()),
    createdAt: z.coerce.date().default(() => new Date()),
});

export type ValidatedProperty = z.infer<typeof PropertySchema>;

export class PropertyMapper {
    /**
     * Maps and validates external API data to internal Property interface.
     * Skips invalid records and logs a warning.
     */
    static validateAndMap(externalData: unknown): Property | null {
        try {
            const validated = PropertySchema.parse(externalData);
            return {
                id: validated.id || '',
                externalId: validated.externalId || null,
                source: validated.source,
                latitude: validated.latitude,
                longitude: validated.longitude,
                price: validated.price,
                address: validated.address,
                city: validated.city,
                county: validated.county || null,
                state: validated.state,
                zip: validated.zip,
                propertyType: validated.propertyType,
                lotSize: validated.lotSize || null,
                lastFetchedAt: validated.lastFetchedAt,
                createdAt: validated.createdAt,
            };
        } catch (error) {
            const validationError = new ValidationError('Property validation failed', {
                address: (externalData as any)?.address,
                error: error instanceof Error ? error.message : error
            });
            console.warn(`[PropertyMapper] ${validationError.message}:`, validationError.details);
            return null;
        }
    }

    /**
     * Maps an array of external data objects, filtering out invalid ones.
     */
    static toInternalArray(externalDataArray: unknown[]): Property[] {
        return externalDataArray
            .map(data => this.validateAndMap(data))
            .filter((p): p is Property => p !== null);
    }
}

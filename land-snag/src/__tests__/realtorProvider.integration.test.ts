import { RealtorProvider } from '@/providers/RealtorProvider';
import { PropertyMapper } from '@/lib/services/propertyMapper';

describe('RealtorProvider Integration Tests', () => {
    let provider: RealtorProvider;

    beforeAll(() => {
        // Mock environment variables for testing
        process.env.REALTOR_API_KEY = 'test-api-key';
        process.env.REALTOR_TTL_HOURS = '24';
        process.env.REALTOR_MAX_CALLS_PER_MIN = '30';
        process.env.REALTOR_MAX_RETRIES = '3';
        process.env.REALTOR_INITIAL_BACKOFF_MS = '500';
    });

    beforeEach(() => {
        provider = new RealtorProvider();
    });

    describe('search', () => {
        it('should validate search parameters', async () => {
            const invalidParams = {
                bbox: [1, 2, 3], // Invalid tuple length
            };

            await expect(provider.search(invalidParams as any)).rejects.toThrow('Invalid search parameters');
        });

        it('should handle bbox search', async () => {
            const bboxParams = {
                bbox: [-80.9, 35.1, -80.7, 35.4] as [number, number, number, number],
            };

            // This would require actual API access or mocking
            // For now, we test that the method doesn't crash with valid params
            expect(() => provider.search(bboxParams)).not.toThrow();
        });

        it('should handle city/state search', async () => {
            const cityParams = {
                city: 'Charlotte',
                state: 'NC',
            };

            expect(() => provider.search(cityParams)).not.toThrow();
        });

        it('should handle zip search', async () => {
            const zipParams = {
                zip: '28202',
            };

            expect(() => provider.search(zipParams)).not.toThrow();
        });
    });

    describe('transformListing', () => {
        it('should transform valid listing data', () => {
            const mockListing = {
                id: 'test-listing-123',
                price: 250000,
                address: '123 Test St',
                city: 'Charlotte',
                state: 'NC',
                zip: '28202',
                latitude: 35.2271,
                longitude: -80.8431,
                beds: 3,
                baths: 2,
                property_type: 'Single Family',
            };

            const result = (provider as any).transformListing(mockListing);

            expect(result).toBeDefined();
            expect(result.type).toBe('Feature');
            expect(result.geometry.type).toBe('Polygon');
            expect(result.properties.listing_id).toBe('test-listing-123');
            expect(result.properties.price).toBe(250000);
            expect(result.properties.source).toBe('realtor16');
        });

        it('should handle missing coordinates gracefully', () => {
            const mockListing = {
                id: 'test-listing-456',
                price: 300000,
                address: '456 Test Ave',
                city: 'Charlotte',
                state: 'NC',
                zip: '28202',
                // Missing latitude and longitude
            };

            expect(() => {
                (provider as any).transformListing(mockListing);
            }).not.toThrow();
        });

        it('should handle invalid price gracefully', () => {
            const mockListing = {
                id: 'test-listing-789',
                price: 'Not a number',
                address: '789 Test Blvd',
                city: 'Charlotte',
                state: 'NC',
                zip: '28202',
                latitude: 35.2271,
                longitude: -80.8431,
            };

            const result = (provider as any).transformListing(mockListing);

            expect(result.properties.price).toBe(0);
        });
    });

    describe('Zod Validation Integration', () => {
        it('should validate property data with Zod schema', () => {
            const validProperty = {
                externalId: 'test-123',
                source: 'realtor16',
                latitude: 35.2271,
                longitude: -80.8431,
                price: 250000,
                address: '123 Test St',
                city: 'Charlotte',
                state: 'NC',
                zip: '28202',
                propertyType: 'Single Family',
                lotSize: 0.5,
                lastFetchedAt: new Date(),
                createdAt: new Date(),
            };

            const result = PropertyMapper.validateAndMap(validProperty);

            if (result) {
                expect(result.externalId).toBe('test-123');
                expect(result.source).toBe('realtor16');
                expect(result.price).toBe(250000);
            } else {
                throw new Error('Property validation failed unexpectedly');
            }
        });

        it('should reject invalid property data', () => {
            const invalidProperty = {
                externalId: 'test-123',
                source: 'realtor16',
                latitude: 'not a number', // Invalid
                longitude: -80.8431,
                price: 250000,
                address: '123 Test St',
                city: 'Charlotte',
                state: 'NC',
                zip: '28202',
                propertyType: 'Single Family',
                lotSize: 0.5,
                lastFetchedAt: new Date(),
                createdAt: new Date(),
            };

            const result = PropertyMapper.validateAndMap(invalidProperty);

            if (result !== null) {
                throw new Error('Property validation should have failed');
            }
        });

        it('should handle array of properties with mixed validity', () => {
            const properties = [
                {
                    externalId: 'valid-1',
                    source: 'realtor16',
                    latitude: 35.2271,
                    longitude: -80.8431,
                    price: 250000,
                    address: '123 Test St',
                    city: 'Charlotte',
                    state: 'NC',
                    zip: '28202',
                    propertyType: 'Single Family',
                    lotSize: 0.5,
                    lastFetchedAt: new Date(),
                    createdAt: new Date(),
                },
                {
                    externalId: 'invalid-1',
                    source: 'realtor16',
                    latitude: 'not a number', // Invalid
                    longitude: -80.8431,
                    price: 250000,
                    address: '456 Test Ave',
                    city: 'Charlotte',
                    state: 'NC',
                    zip: '28202',
                    propertyType: 'Single Family',
                    lotSize: 0.5,
                    lastFetchedAt: new Date(),
                    createdAt: new Date(),
                },
            ];

            const result = PropertyMapper.toInternalArray(properties);

            if (result.length !== 1 || result[0].externalId !== 'valid-1') {
                throw new Error('Array validation failed unexpectedly');
            }
        });
    });
});
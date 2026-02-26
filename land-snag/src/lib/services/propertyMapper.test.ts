import { describe, it, expect } from 'vitest';
import { PropertyMapper } from './propertyMapper';

describe('PropertyMapper', () => {
    const validRawData = {
        externalId: 'ext-123',
        source: 'test-source',
        latitude: 35.123,
        longitude: -80.456,
        price: 250000,
        address: '123 Test St',
        city: 'Charlotte',
        state: 'NC',
        zip: '28205',
        propertyType: 'Land',
        lotSize: 1.5,
    };

    it('should correctly map valid raw data', () => {
        const result = PropertyMapper.validateAndMap(validRawData);
        expect(result).not.toBeNull();
        expect(result?.externalId).toBe('ext-123');
        expect(result?.price).toBe(250000);
        expect(result?.lastFetchedAt).toBeInstanceOf(Date);
    });

    it('should return null for data with missing required fields', () => {
        const invalidData = { ...validRawData, address: undefined };
        const result = PropertyMapper.validateAndMap(invalidData);
        expect(result).toBeNull();
    });

    it('should handle nullable fields like lotSize and county', () => {
        const dataWithNulls = { ...validRawData, lotSize: null, county: null };
        const result = PropertyMapper.validateAndMap(dataWithNulls);
        expect(result).not.toBeNull();
        expect(result?.lotSize).toBeNull();
        expect(result?.county).toBeNull();
    });

    it('should successfully map an array of mixed data', () => {
        const mixedArray = [
            validRawData,
            { ...validRawData, externalId: 'ext-456', address: '456 Side St' },
            { address: 'missing fields' }
        ];
        const results = PropertyMapper.toInternalArray(mixedArray);
        expect(results).toHaveLength(2);
        expect(results[0].externalId).toBe('ext-123');
        expect(results[1].externalId).toBe('ext-456');
    });
});

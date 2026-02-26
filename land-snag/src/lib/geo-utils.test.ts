import { describe, it, expect } from 'vitest';
import { isPointInPolygon } from './geo-utils';

describe('geo-utils', () => {
    describe('isPointInPolygon', () => {
        const square: [number, number][] = [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0]
        ];

        it('should return true for points inside the polygon', () => {
            expect(isPointInPolygon([5, 5], square)).toBe(true);
            expect(isPointInPolygon([1, 1], square)).toBe(true);
            expect(isPointInPolygon([9, 9], square)).toBe(true);
        });

        it('should return false for points outside the polygon', () => {
            expect(isPointInPolygon([11, 5], square)).toBe(false);
            expect(isPointInPolygon([-1, 5], square)).toBe(false);
            expect(isPointInPolygon([5, 11], square)).toBe(false);
            expect(isPointInPolygon([5, -1], square)).toBe(false);
        });

        it('should handle complex concave polygons', () => {
            const concave: [number, number][] = [
                [0, 0], [10, 0], [10, 10], [5, 5], [0, 10], [0, 0]
            ];
            expect(isPointInPolygon([5, 2], concave)).toBe(true);
            expect(isPointInPolygon([5, 8], concave)).toBe(false);
        });
    });
});

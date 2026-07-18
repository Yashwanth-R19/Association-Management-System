const { sanitizeField, quoted, csvRow } = require('../server/lib/csvShape');

describe('csvShape', () => {
    test('sanitizeField strips commas, quotes, and newlines', () => {
        expect(sanitizeField('Smith, "John"\nJr')).toBe('Smith JohnJr');
    });

    test('sanitizeField treats null/undefined as empty string', () => {
        expect(sanitizeField(null)).toBe('');
        expect(sanitizeField(undefined)).toBe('');
    });

    test('quoted wraps a sanitized value in quotes, including empty values', () => {
        expect(quoted('gym')).toBe('"gym"');
        expect(quoted('')).toBe('""');
        expect(quoted(null)).toBe('""');
    });

    test('csvRow joins fields with commas', () => {
        expect(csvRow([1, quoted('a'), quoted('b')])).toBe('1,"a","b"');
    });
});

import { escapeLike } from '../../src/utils/escapeLike.js';

describe('escapeLike (SEC-L-5)', () => {
    it('escapes % and _ and backslash', () => {
        expect(escapeLike('50% off_a\\b')).toBe('50\\% off\\_a\\\\b');
    });

    it('leaves ordinary terms untouched', () => {
        expect(escapeLike('alpha')).toBe('alpha');
    });

    it('handles non-string input', () => {
        expect(escapeLike(123)).toBe('123');
    });
});
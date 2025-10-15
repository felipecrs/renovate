import { logger } from '../../../../logger';
import { serializeJSON } from './serialize-json';
import { Fixtures } from '~test/fixtures';

vi.mock('../../../../logger');

describe('workers/repository/config-migration/branch/serialize-json', () => {
  describe('serializeJSON', () => {
    it('updates property values in basic JSON', () => {
      const obj = Fixtures.getJson('./serialize-json/1-basic-update/obj.json');
      const original = Fixtures.get(
        './serialize-json/1-basic-update/original.json',
      );
      const expected = Fixtures.get(
        './serialize-json/1-basic-update/expected.json',
      );

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('preserves comments when updating properties', () => {
      const obj = Fixtures.getJson(
        './serialize-json/2-preserve-comments/obj.json',
      );
      const original = Fixtures.get(
        './serialize-json/2-preserve-comments/original.json',
      );
      const expected = Fixtures.get(
        './serialize-json/2-preserve-comments/expected.json',
      );

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('adds new properties to the end', () => {
      const obj = Fixtures.getJson(
        './serialize-json/3-add-new-property/obj.json',
      );
      const original = Fixtures.get(
        './serialize-json/3-add-new-property/original.json',
      );
      const expected = Fixtures.get(
        './serialize-json/3-add-new-property/expected.json',
      );

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('removes properties not in migrated config', () => {
      const obj = Fixtures.getJson(
        './serialize-json/4-remove-property/obj.json',
      );
      const original = Fixtures.get(
        './serialize-json/4-remove-property/original.json',
      );
      const expected = Fixtures.get(
        './serialize-json/4-remove-property/expected.json',
      );

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('falls back to JSON.stringify when original content is null', () => {
      const obj = Fixtures.getJson(
        './serialize-json/5-null-original-content/obj.json',
      );
      const original = null;
      const expected = Fixtures.get(
        './serialize-json/5-null-original-content/expected.json',
      );

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('falls back to JSON.stringify when JSON is invalid', () => {
      const obj = Fixtures.getJson(
        './serialize-json/6-invalid-json-fallback/obj.json',
      );
      const original = Fixtures.get(
        './serialize-json/6-invalid-json-fallback/original.json',
      );
      const expected = Fixtures.get(
        './serialize-json/6-invalid-json-fallback/expected.json',
      );

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to retain comments, falling back to standard JSON',
      );
    });

    it('handles complex operations with multiple comments', () => {
      const original = Fixtures.get(
        './serialize-json/7-complex-comments/original.json',
      );
      const obj = Fixtures.getJson(
        './serialize-json/7-complex-comments/obj.json',
      );
      const expected = Fixtures.get(
        './serialize-json/7-complex-comments/expected.json',
      );

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('respects custom indentation fallback', () => {
      const obj = Fixtures.getJson(
        './serialize-json/1-basic-update/original.json',
      );
      const original = null;

      const result = serializeJSON(obj, original, '    ');
      // Should use 4-space indentation
      expect(result).toContain('    "enabled"');
      expect(result).toContain('    "extends"');
    });
  });
});

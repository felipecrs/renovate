import { codeBlock } from 'common-tags';
import { logger } from '../../../../logger';
import { serializeJSON } from './serialize-json';
import { Fixtures } from '~test/fixtures';

vi.mock('../../../../logger');

describe('workers/repository/config-migration/branch/serialize-json', () => {
  describe('serializeJSON', () => {
    it('updates property values in basic JSON', () => {
      const obj = {
        enabled: true,
        extends: ['config:base'],
        timezone: 'America/New_York',
      };
      const original = codeBlock`
        {
          "enabled": true,
          "extends": ["config:recommended"],
          "timezone": "America/New_York"
        }
      `;
      const expected = codeBlock`
        {
          "enabled": true,
          "extends": ["config:base"],
          "timezone": "America/New_York"
        }
      `;

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('preserves comments when updating properties', () => {
      const obj = {
        enabled: true,
        extends: ['config:base'],
        timezone: 'America/New_York',
      };
      const original = codeBlock`
        {
          // This is a comment about enabled
          "enabled": true,
          // This is a comment about extends
          "extends": ["config:recommended"],
          "timezone": "America/New_York"
        }
      `;
      const expected = codeBlock`
        {
          // This is a comment about enabled
          "enabled": true,
          // This is a comment about extends
          "extends": ["config:base"],
          "timezone": "America/New_York"
        }
      `;

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('adds new properties to the end', () => {
      const obj = {
        enabled: true,
        extends: ['config:recommended'],
        timezone: 'America/New_York',
        prHourlyLimit: 2,
      };
      const original = codeBlock`
        {
          "enabled": true,
          "extends": ["config:recommended"],
          "timezone": "America/New_York"
        }
      `;
      const expected = codeBlock`
        {
          "enabled": true,
          "extends": ["config:recommended"],
          "timezone": "America/New_York",
          "prHourlyLimit": 2
        }
      `;

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('removes properties not in migrated config', () => {
      const obj = {
        enabled: true,
        extends: ['config:recommended'],
        timezone: 'America/New_York',
      };
      const original = codeBlock`
        {
          "enabled": true,
          "extends": ["config:recommended"],
          "timezone": "America/New_York",
          "oldProperty": "will be removed"
        }
      `;
      const expected = codeBlock`
        {
          "enabled": true,
          "extends": ["config:recommended"],
          "timezone": "America/New_York"
        }
      `;

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('falls back to JSON.stringify when original content is null', () => {
      const obj = {
        enabled: true,
        extends: ['config:recommended'],
      };
      const original = null;
      const expected = codeBlock`
        {
          "enabled": true,
          "extends": [
            "config:recommended"
          ]
        }
      `;

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('falls back to JSON.stringify when JSON is invalid', () => {
      const obj = {
        enabled: true,
        extends: ['config:recommended'],
      };
      const original = 'invalid json{';
      const expected = codeBlock`
        {
          "enabled": true,
          "extends": [
            "config:recommended"
          ]
        }
      `;

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to retain comments, falling back to standard JSON',
      );
    });

    it('handles complex operations with multiple comments', () => {
      const obj = {
        enabled: false,
        extends: ['config:base'],
        timezone: 'America/Los_Angeles',
        schedule: ['after 11pm'],
        renamedProperty: 'newvalue',
        inlineArray: ['element'],
        someArray: ['one', 'four', 'three'],
        someObject: {
          a: 1,
          d: 4,
          c: 3,
        },
        replacedWithArray: ['someValue'],
        anotherReplacedWithArray: ['anotherValue'],
      };
      const original = codeBlock`
        {
          // Comment at start
          "enabled": true,
          "extends": ["config:recommended"],
          /* Multi-line
             comment */
          "timezone": "America/New_York",
          // Comment before last property
          "schedule": ["after 10pm" // comment
          ],
          "toBeRenamedProperty": "oldvalue", // should not be removed
          "inlineArray": ["element"] // inline comment
          "someArray": [
            "one",
            "two",
            "three" // element comment
          ], /* another inline comment */
          "someObject": {
            "a": 1,
            "b": 2,
            "c": 3 // object comment
          },
          "replacedWithArray": "someString",
          "anotherToBeReplacedWithArray": "anotherString" // keep this
        }
      `;
      const expected = codeBlock`
        {
          // Comment at start
          "enabled": false,
          "extends": ["config:base"],
          /* Multi-line
             comment */
          "timezone": "America/Los_Angeles",
          // Comment before last property
          "schedule": ["after 11pm" // comment
          ],
          "renamedProperty": "newvalue", // should not be removed
          "inlineArray": ["element"] // inline comment
          "someArray": [
            "one",
            "four",
            "three" // element comment
          ], /* another inline comment */
          "someObject": {
            "a": 1,
            "d": 4,
            "c": 3 // object comment
          },
          "replacedWithArray": [
            "someValue"
          ],
          "anotherReplacedWithArray": [
            "anotherValue"
          ] // keep this
        }
      `;

      const result = serializeJSON(obj, original);
      expect(result).toBe(expected);
    });

    it('respects custom indentation fallback', () => {
      const obj = {
        enabled: true,
        extends: ['config:recommended'],
        timezone: 'America/New_York',
      };
      const original = null;

      const result = serializeJSON(obj, original, '    ');
      // Should use 4-space indentation
      expect(result).toContain('    "enabled"');
      expect(result).toContain('    "extends"');
    });

    it('preserves comments when migrating real renovate.json config', () => {
      const renovateJson = Fixtures.get('./renovate.json');
      const migratedConfigObj = Fixtures.getJsonc('./migrated.json');
      const migratedDataJson = Fixtures.getJson('./migrated-data.json');

      const result = serializeJSON(migratedConfigObj, renovateJson);
      expect(result).toBe(migratedDataJson.content);
    });
  });
});

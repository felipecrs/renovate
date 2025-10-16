import { codeBlock } from 'common-tags';
import { logger } from '../../../../logger';
import { stringifyJsonPreservingComments } from './stringify-json-preserving-comments';

vi.mock('../../../../logger');

describe('workers/repository/config-migration/branch/stringify-json-preserving-comments', () => {
  describe('stringifyJsonPreservingComments', () => {
    it('preserves comments and formatting', () => {
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
          "removedProperty": "toBeRemoved",
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

      const result = stringifyJsonPreservingComments(obj, original);
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

      const result = stringifyJsonPreservingComments(obj, original);
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

      const result = stringifyJsonPreservingComments(obj, original);
      expect(result).toBe(expected);
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to preserve comments during JSON stringification, falling back to standard JSON',
      );
    });

    it('respects custom indentation fallback', () => {
      const obj = {
        enabled: true,
        extends: ['config:recommended'],
        timezone: 'America/New_York',
      };
      const original = null;

      const result = stringifyJsonPreservingComments(obj, original, '    ');
      // Should use 4-space indentation
      expect(result).toContain('    "enabled"');
      expect(result).toContain('    "extends"');
    });
  });
});

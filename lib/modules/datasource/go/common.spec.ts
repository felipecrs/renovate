import { encodeGoCase, getSourceUrl } from './common.ts';

describe('modules/datasource/go/common', () => {
  describe('encodeGoCase', () => {
    it.each`
      input    | expected
      ${'foo'} | ${'foo'}
      ${'Foo'} | ${'!foo'}
      ${'FOO'} | ${'!f!o!o'}
    `('encodeGoCase($input) => $expected', ({ input, expected }) => {
      expect(encodeGoCase(input)).toBe(expected);
    });
  });

  describe('getSourceUrl', () => {
    it.each`
      expected                                   | datasource          | packageName
      ${'https://bitbucket.org/foo/bar'}         | ${'bitbucket-tags'} | ${'foo/bar'}
      ${'https://code.forgejo.org/go-chi/cache'} | ${'forgejo-tags'}   | ${'go-chi/cache'}
      ${'https://gitea.com/go-chi/cache'}        | ${'gitea-tags'}     | ${'go-chi/cache'}
      ${'https://github.com/go-foo/foo'}         | ${'github-tags'}    | ${'go-foo/foo'}
      ${'https://gitlab.com/foo/bar'}            | ${'gitlab-tags'}    | ${'foo/bar'}
      ${undefined}                               | ${'git-tags'}       | ${'https://dev.azure.com/foo/bar/_git/baz'}
    `(
      '($datasource, $packageName) => $expected',
      ({ expected, datasource, packageName }) => {
        const res = getSourceUrl({ datasource, packageName });
        expect(res).toEqual(expected);
      },
    );
  });
});

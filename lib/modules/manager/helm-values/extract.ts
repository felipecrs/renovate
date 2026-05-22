import { logger } from '../../../logger/index.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { id as dockerVersioning } from '../../versioning/docker/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import type { HelmDockerImageDependency } from './types.ts';
import {
  matchesHelmValuesDockerHeuristic,
  matchesHelmValuesInlineImage,
} from './util.ts';

function getHelmDep(
  registry: string,
  repository: string,
  tag: string,
): PackageDependency {
  const dep = getDep(`${registry}${repository}:${tag}`, false);
  dep.replaceString = tag;
  dep.versioning = dockerVersioning;
  dep.autoReplaceStringTemplate =
    '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}';
  return dep;
}

/**
 * Recursively find all supported dependencies in the yaml object.
 *
 * @param parsedContent
 */
export function findDependencies(
  parsedContent: Record<string, unknown> | HelmDockerImageDependency,
): PackageDependency[] {
  return findDependenciesInternal(parsedContent, []);
}
export function findDependenciesInternal(
  parsedContent: Record<string, unknown> | HelmDockerImageDependency,
  packageDependencies: PackageDependency[],
): PackageDependency[] {
  if (!parsedContent || typeof parsedContent !== 'object') {
    return packageDependencies;
  }

  Object.entries(parsedContent).forEach(([key, value]) => {
    if (matchesHelmValuesDockerHeuristic(key, value)) {
      const currentItem = value;

      let registry = currentItem.registry;
      registry = registry ? `${registry}/` : '';
      const repository = String(currentItem.repository);
      const tag = `${currentItem.tag ?? currentItem.version}`;
      packageDependencies.push(getHelmDep(registry, repository, tag));
    } else if (matchesHelmValuesInlineImage(key, value)) {
      packageDependencies.push(getDep(value, true));
    } else {
      findDependenciesInternal(
        value as Record<string, unknown>,
        packageDependencies,
      );
    }
  });
  return packageDependencies;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  let parsedContent: Record<string, unknown>[] | HelmDockerImageDependency[];
  try {
    // a parser that allows extracting line numbers would be preferable, with
    // the current approach we need to match anything we find again during the update
    // TODO: fix me (#9610)
    parsedContent = parseYaml(content) as any;
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse helm-values YAML');
    return null;
  }
  try {
    const deps: PackageDependency<Record<string, any>>[] = [];

    for (const con of parsedContent) {
      deps.push(...findDependencies(con));
    }

    if (deps.length) {
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { err, packageFile },
      'Error parsing helm-values parsed content',
    );
  }
  return null;
}

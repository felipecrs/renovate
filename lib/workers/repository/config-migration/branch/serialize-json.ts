import { parse } from 'jsonc-morph';
import { logger } from '../../../../logger';

/**
 * Serializes an object to JSON while preserving comments and formatting from
 * the original JSON content. Fallbacks to JSON.stringify if parsing fails.
 *
 * @param obj - The object to serialize
 * @param originalContent - The original JSON content with comments
 * @param indentSpaceFallback - The indentation string used during JSON.stringify fallback
 * @returns The serialized config string with preserved comments
 */
export function serializeJSON(
  obj: object,
  originalContent: string | null,
  indentSpaceFallback = '  ',
): string {
  if (originalContent === null) {
    // Comments cannot be preserved without original content
    return JSON.stringify(obj, undefined, indentSpaceFallback);
  }

  let root;
  let rootObj;
  try {
    root = parse(originalContent, {
      allowComments: true,
      allowTrailingCommas: true,
    });
    rootObj = root.asObjectOrThrow();
  } catch (error) {
    logger.warn(
      { error },
      'Failed to retain comments, falling back to standard JSON',
    );
    return JSON.stringify(obj, undefined, indentSpaceFallback);
  }

  // Get existing property keys in original order
  const existingProps = new Map(
    rootObj
      .properties()
      .map((prop: any) => [prop.name()?.decodedValue() ?? '', prop]),
  );

  // Track which properties we've processed
  const processedKeys = new Set<string>();

  // Update existing properties and track them
  for (const [key, value] of Object.entries(obj)) {
    processedKeys.add(key);
    const existingProp = existingProps.get(key);

    if (existingProp) {
      // Update existing property value (preserves comments)
      (existingProp as any).setValue(value);
    } else {
      // Add new property at the end
      rootObj.append(key, value);
    }
  }

  // Remove properties that don't exist in migrated config
  for (const [key, prop] of existingProps) {
    if (!processedKeys.has(key as string)) {
      (prop as any).remove();
    }
  }

  const content = root.toString();
  return content;
}

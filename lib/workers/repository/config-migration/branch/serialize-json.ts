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
      .map((prop: any) => [prop.name()?.decodedValue(), prop]),
  );

  // Track which properties we've processed
  const processedKeys = new Set<string>();

  // Build list of keys in the order they appear in obj
  const objRecord = obj as Record<string, unknown>;
  let insertIndex = 0;

  // Update existing properties and insert new ones in the correct position
  for (const [key, value] of Object.entries(objRecord)) {
    processedKeys.add(key);
    const existingProp = existingProps.get(key) as any;

    if (existingProp) {
      // Update existing property value (preserves comments)
      existingProp.setValue(value);
      insertIndex = existingProp.propertyIndex() + 1;

      // Format arrays as multiline
      if (Array.isArray(value) && value.length > 0) {
        const arrayValue = existingProp.valueIfArray();
        if (arrayValue) {
          arrayValue.ensureMultiline();
        }
      }
    } else {
      // Insert new property at the current position
      const newProp = rootObj.insert(insertIndex, key, value);
      insertIndex++;

      // Format arrays as multiline
      if (Array.isArray(value) && value.length > 0) {
        const arrayValue = newProp.valueIfArray();
        if (arrayValue) {
          arrayValue.ensureMultiline();
        }
      }
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

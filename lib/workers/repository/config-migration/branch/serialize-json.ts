import type { JsonObject } from 'jsonc-morph';
import { parse } from 'jsonc-morph';
import { logger } from '../../../../logger';

/**
 * Updates a JSON object in place, preserving comments and formatting.
 * Handles nested objects and arrays recursively.
 */
function updateObject(
  targetObj: JsonObject,
  newObj: Record<string, unknown>,
): void {
  // Get existing property keys in original order
  const existingProps = new Map(
    targetObj
      .properties()
      .map((prop: any) => [prop.name()?.decodedValue(), prop]),
  );

  // Track which properties we've processed
  const processedKeys = new Set<string>();

  // Track properties to be removed
  const propsToRemove = new Set<string>();
  for (const key of existingProps.keys()) {
    if (!(key in newObj)) {
      propsToRemove.add(key as string);
    }
  }

  let insertIndex = 0;

  // Update existing properties and insert new ones in the correct position
  for (const [key, value] of Object.entries(newObj)) {
    processedKeys.add(key);
    const existingProp = existingProps.get(key);

    if (existingProp) {
      updatePropertyValue(existingProp, value);
      insertIndex = existingProp.propertyIndex() + 1;
    } else {
      // Check if there's a property being removed at this position that might be a rename
      let renamedFrom: any = null;
      for (const [oldKey, oldProp] of existingProps) {
        if (
          propsToRemove.has(oldKey as string) &&
          !processedKeys.has(oldKey as string) &&
          oldProp.propertyIndex() === insertIndex
        ) {
          // Found a property at the same index being removed - likely a rename
          renamedFrom = { key: oldKey, prop: oldProp };
          break;
        }
      }

      if (renamedFrom) {
        // This is a rename - replace the property in place
        renamedFrom.prop.replaceWith(key, value);
        processedKeys.add(renamedFrom.key);
        propsToRemove.delete(renamedFrom.key);
        insertIndex = renamedFrom.prop.propertyIndex() + 1;

        // Format arrays as multiline if the new value is an array
        if (Array.isArray(value) && value.length > 0) {
          // Get the renamed property and format it
          const updatedProp = targetObj.get(key);
          if (updatedProp) {
            const arrayValue = updatedProp.valueIfArray();
            if (arrayValue) {
              arrayValue.ensureMultiline();
            }
          }
        }
      } else {
        // Insert new property at the current position
        const newProp = targetObj.insert(insertIndex, key, value);
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
  }

  // Remove properties that don't exist in migrated config
  for (const [key, prop] of existingProps) {
    if (propsToRemove.has(key as string)) {
      prop.remove();
    }
  }
}

/**
 * Updates a property value, recursively handling objects and arrays
 * to preserve comments.
 */
function updatePropertyValue(prop: any, value: unknown): void {
  if (Array.isArray(value)) {
    updateArrayValue(prop, value);
  } else if (value !== null && typeof value === 'object') {
    updateObjectValue(prop, value as Record<string, unknown>);
  } else {
    // For primitive values, just update the value (preserves comments)
    prop.setValue(value);
  }
}

/**
 * Updates an array property value, preserving comments on elements.
 */
function updateArrayValue(prop: any, value: unknown[]): void {
  const existingArray = prop.valueIfArray();
  if (existingArray) {
    const existingElements = existingArray.elements();

    // Remove elements from the end first to avoid index issues
    for (let i = existingElements.length - 1; i >= value.length; i--) {
      const element = existingElements[i];
      // Use the typed node's remove method
      if (element.isString()) {
        element.asStringLit()?.remove();
      } else if (element.isNumber()) {
        element.asNumberLit()?.remove();
      } else if (element.isBoolean()) {
        element.asBooleanLit()?.remove();
      } else if (element.isNull()) {
        element.asNullKeyword()?.remove();
      } else if (element.isContainer()) {
        const asArray = element.asArray();
        if (asArray) {
          asArray.remove();
        } else {
          element.asObject()?.remove();
        }
      }
    }

    // Update or insert elements
    for (let i = 0; i < value.length; i++) {
      if (i < existingElements.length) {
        // Get the specific typed node and use its replaceWith
        const element = existingElements[i];
        if (element.isString()) {
          element.asStringLit()?.replaceWith(value[i]);
        } else if (element.isNumber()) {
          element.asNumberLit()?.replaceWith(value[i]);
        } else if (element.isBoolean()) {
          element.asBooleanLit()?.replaceWith(value[i]);
        } else if (element.isNull()) {
          element.asNullKeyword()?.replaceWith(value[i]);
        } else if (element.isContainer()) {
          // For arrays and objects, use the container's replaceWith
          const asArray = element.asArray();
          if (asArray) {
            asArray.replaceWith(value[i]);
          } else {
            element.asObject()?.replaceWith(value[i]);
          }
        }
      } else {
        // Add new elements
        existingArray.append(value[i]);
      }
    }
  } else {
    // Not an array currently, replace with array and format as multiline
    prop.setValue(value);
    if (value.length > 0) {
      const newArray = prop.valueIfArray();
      if (newArray) {
        newArray.ensureMultiline();
      }
    }
  }
}

/**
 * Updates an object property value, recursively preserving comments.
 */
function updateObjectValue(prop: any, value: Record<string, unknown>): void {
  const existingObj = prop.valueIfObject();
  if (existingObj) {
    // Recursively update the nested object
    updateObject(existingObj, value);
  } else {
    // Not an object currently, just replace the whole value
    prop.setValue(value);
  }
}

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

  // Update the root object recursively
  updateObject(rootObj, obj as Record<string, unknown>);

  const content = root.toString();
  return content;
}

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
  // Build a map of existing properties by name
  const existingProps = new Map(
    targetObj.properties().map((prop) => [prop.name()?.decodedValue(), prop]),
  );

  // Track which existing properties we've already processed
  const processedKeys = new Set<string>();

  // Identify properties to be removed (exist in old but not in new)
  const propsToRemove = new Set<string>();
  for (const key of existingProps.keys()) {
    if (!(key in newObj)) {
      propsToRemove.add(key as string);
    }
  }

  let insertIndex = 0;

  // Process each property in the new object
  for (const [key, value] of Object.entries(newObj)) {
    processedKeys.add(key);
    const existingProp = existingProps.get(key);

    if (existingProp) {
      // Property exists - update its value in place
      updatePropertyValue(existingProp, value);
      insertIndex = existingProp.propertyIndex() + 1;
    } else {
      // Property is new - check if it might be a rename
      let renamedFromProp = null;
      for (const [oldKey, oldProp] of existingProps) {
        if (
          propsToRemove.has(oldKey as string) &&
          !processedKeys.has(oldKey as string) &&
          oldProp.propertyIndex() === insertIndex
        ) {
          // Found a property at the same position being removed - treat as rename
          renamedFromProp = { key: oldKey, prop: oldProp };
          break;
        }
      }

      if (renamedFromProp) {
        // Rename: replace the old property with the new one in place
        renamedFromProp.prop.replaceWith(key, value);
        processedKeys.add(renamedFromProp.key);
        propsToRemove.delete(renamedFromProp.key);
        insertIndex = renamedFromProp.prop.propertyIndex() + 1;

        // Format arrays as multiline
        if (Array.isArray(value) && value.length > 0) {
          const renamedProp = targetObj.get(key);
          const arrayValue = renamedProp?.valueIfArray();
          arrayValue?.ensureMultiline();
        }
      } else {
        // New property: insert at current position
        const newProp = targetObj.insert(insertIndex, key, value);
        insertIndex++;

        // Format arrays as multiline
        if (Array.isArray(value) && value.length > 0) {
          newProp.valueIfArray()?.ensureMultiline();
        }
      }
    }
  }

  // Remove properties that no longer exist in the new object
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
    // For primitive values (string, number, boolean, null), just update
    prop.setValue(value);
  }
}

/**
 * Replaces a node with a new value. Handles all node types.
 */
function replaceNode(node: any, newValue: unknown): void {
  if (node.isString()) {
    node.asStringLit()?.replaceWith(newValue);
  } else if (node.isNumber()) {
    node.asNumberLit()?.replaceWith(newValue);
  } else if (node.isBoolean()) {
    node.asBooleanLit()?.replaceWith(newValue);
  } else if (node.isNull()) {
    node.asNullKeyword()?.replaceWith(newValue);
  } else if (node.isContainer()) {
    const asArray = node.asArray();
    if (asArray) {
      asArray.replaceWith(newValue);
    } else {
      node.asObject()?.replaceWith(newValue);
    }
  }
}

/**
 * Removes a node from its parent. Handles all node types.
 */
function removeNode(node: any): void {
  if (node.isString()) {
    node.asStringLit()?.remove();
  } else if (node.isNumber()) {
    node.asNumberLit()?.remove();
  } else if (node.isBoolean()) {
    node.asBooleanLit()?.remove();
  } else if (node.isNull()) {
    node.asNullKeyword()?.remove();
  } else if (node.isContainer()) {
    const asArray = node.asArray();
    if (asArray) {
      asArray.remove();
    } else {
      node.asObject()?.remove();
    }
  }
}

/**
 * Updates an array property value, preserving comments on elements.
 */
function updateArrayValue(prop: any, value: unknown[]): void {
  const existingArray = prop.valueIfArray();
  if (existingArray) {
    const existingElements = existingArray.elements();

    // Remove excess elements from the end first to avoid index issues
    for (let i = existingElements.length - 1; i >= value.length; i--) {
      removeNode(existingElements[i]);
    }

    // Update or insert elements
    for (let i = 0; i < value.length; i++) {
      if (i < existingElements.length) {
        replaceNode(existingElements[i], value[i]);
      } else {
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
    // Object exists - recursively update it
    updateObject(existingObj, value);
  } else {
    // Not an object currently - replace with the new object value
    prop.setValue(value);
  }
}

/**
 * Serializes an object to JSON while preserving comments and formatting from
 * the original JSON content.
 *
 * This function parses the original content with comments, updates it in place
 * to match the new object structure, and returns the modified JSON string with
 * comments preserved. Falls back to standard JSON.stringify if parsing fails.
 *
 * @param obj - The object to serialize
 * @param originalContent - The original JSON content with comments (null if unavailable)
 * @param indentSpaceFallback - The indentation string for JSON.stringify fallback
 * @returns The serialized JSON string with preserved comments
 */
export function stringifyJsonPreservingComments(
  obj: object,
  originalContent: string | null,
  indentSpaceFallback = '  ',
): string {
  if (originalContent === null) {
    // No original content available - comments cannot be preserved
    return JSON.stringify(obj, undefined, indentSpaceFallback);
  }

  try {
    const root = parse(originalContent, {
      allowComments: true,
      allowTrailingCommas: true,
    });
    const rootObj = root.asObjectOrThrow();

    // Update the root object recursively to match the new structure
    updateObject(rootObj, obj as Record<string, unknown>);

    return root.toString();
  } catch (error) {
    logger.warn(
      { error },
      'Failed to preserve comments during JSON serialization, falling back to standard JSON',
    );
    return JSON.stringify(obj, undefined, indentSpaceFallback);
  }
}

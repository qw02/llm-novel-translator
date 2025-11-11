import { extractTextFromTag } from "../../utils/data-extraction.js";

export class PostEditProcessor {
  /**
   * Parses the LLM response and applies the operations to the translated lines.
   *
   * @param {string[]} originalLines - Array of translated text lines before editing
   * @param {string} llmResponse - Raw response from post-editing LLM
   * @returns {{edited: string[], preQC: string[]}} Edited lines and original for debugging
   */
  process(originalLines, llmResponse) {
    const preQC = [...originalLines]; // Save for debugging

    try {
      const operationsJson = extractTextFromTag(llmResponse, 'operations');

      if (!operationsJson) {
        console.warn('Post-edit response missing operations. Skipping edits.');
        return { edited: originalLines, preQC };
      }

      const parsedActions = JSON.parse(operationsJson);
      const actions = this._normalizeActions(parsedActions);

      // Check for explicit "no changes needed"
      if (actions.length === 1 && actions[0].action === 'none') {
        return { edited: originalLines, preQC };
      }

      // Validate actions
      const validationError = this._validateActions(actions, originalLines.length);
      if (validationError) {
        console.error(`Invalid post-edit actions: ${validationError}. Skipping edits.`, actions);
        return { edited: originalLines, preQC };
      }

      // Execute actions
      const edited = this._executeActions(originalLines, actions);
      return { edited, preQC };

    } catch (error) {
      console.error('Failed to parse or apply post-edit operations. Returning original.', error);
      return { edited: originalLines, preQC };
    }
  }

  /**
   * Normalizes actions to always be an array.
   *
   * @param {object | object[]} parsed - Parsed JSON from LLM
   * @returns {object[]} Array of action objects
   */
  _normalizeActions(parsed) {
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  /**
   * Validates the structure and content of action commands.
   *
   * @param {object[]} actions - Array of action objects
   * @param {number} lineCount - Number of lines in text being edited
   * @returns {string | null} Error message if invalid, otherwise null
   */
  _validateActions(actions, lineCount) {
    const validActions = new Set(['update', 'delete', 'add', 'none']);
    let currentLineCount = lineCount;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      // Check action type exists and is valid
      if (!action.action || !validActions.has(action.action)) {
        return `Action ${i}: invalid action type '${action.action}'`;
      }

      if (action.action === 'none') continue;

      // Check line number is valid
      if (typeof action.line !== 'number' || !Number.isInteger(action.line) || action.line < 0) {
        return `Action ${i} (${action.action}): 'line' must be a non-negative integer (0-indexed).`;
      }

      // Check line number bounds considering previous operations
      if (action.action === 'add') {
        // Can add at position 0 to currentLineCount (inclusive)
        if (action.line > currentLineCount) {
          return `Action ${i} (${action.action}): 'line' ${action.line} out of bounds. Max is ${currentLineCount}.`;
        }
      } else { // update, delete
        if (action.line >= currentLineCount) {
          return `Action ${i} (${action.action}): 'line' ${action.line} out of bounds. Max is ${currentLineCount - 1}.`;
        }
      }

      // Check text field for operations that need it
      if ((action.action === 'add' || action.action === 'update') && typeof action.text !== 'string') {
        return `Action ${i} (${action.action}): 'text' field must be a string.`;
      }

      // Update expected line count for next validation
      if (action.action === 'add') currentLineCount++;
      if (action.action === 'delete') currentLineCount--;
    }

    return null; // All valid
  }

  /**
   * Executes a sequence of actions on a copy of the original lines.
   *
   * @param {string[]} originalLines - Initial array of text lines
   * @param {object[]} actions - Validated actions to perform
   * @returns {string[]} New array of text lines after all actions
   */
  _executeActions(originalLines, actions) {
    // Work on a copy to avoid side effects
    const lines = [...originalLines];

    for (const action of actions) {
      const index = action.line;

      switch (action.action) {
        case 'update':
          if (index < lines.length) {
            lines[index] = action.text;
          }
          break;

        case 'add':
          lines.splice(index, 0, action.text);
          break;

        case 'delete':
          if (index < lines.length) {
            lines.splice(index, 1);
          }
          break;

        case 'none':
          // No-op
          break;
      }
    }

    return lines;
  }
}
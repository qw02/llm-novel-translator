/**
 * background/main.js
 *
 * Placeholder background script for testing data flow.
 * Returns mock responses based on patterns in the request.
 *
 * Future: Replace with actual API router (OpenAI, Anthropic, etc.)
 */

// Track tasks by client for cancellation
const tasksByClient = new Map(); // clientId -> Set<taskId>
const pendingTasks = new Map(); // taskId -> { timeoutId, resolve, reject }

let nextTaskId = 1;
let echoCounter = 0;
let postEditCounter = 0;

/**
 * Mock response generator based on request patterns.
 * Returns realistic mock data for testing.
 */
function generateMockResponse(llmId, systemPrompt, userMessage) {
  console.log('[Background] Mock Request:', {
    systemPrompt: systemPrompt.substring(0, 60) + '...',
    userMessage: userMessage.substring(0, 100) + '...',
  });

  // Pattern matching for different types of responses

  // Glossary extraction mock
  if (llmId === '99-1') {
    const jsonString = JSON.stringify({
      "entries": [
        {
          "keys": ["アメリカ合衆国", "アメリカ"],
          "value": "[location] Name: United States (アメリカ)",
        },
        {
          "keys": ["ジャック", "another-key_947306"],
          "value": "[test] Test data to intersect wil existing.",
        },
        {
          "keys": ["new-entry-8564", "new-entry-1235"],
          "value": "[test] New entry to be inserted",
        },
      ],
    }, null, 2)
    return {
      ok: true,
      data: {
        assistant: `\`\`\`json\n${jsonString}\n\`\`\``,
        reasoning: 'Reasoning from Glossary Extraction',
      },
    };
  }

  // GLossary Update mock
  if (llmId === '99-2') {
    // Default for glossary update model
    let response = "{ \"action\": \"none\" }";

    if (userMessage.includes('ジャック')) {
      // Assume there is the string literal `..."id":<space>${Number}...` somewhere in the user message
      const extractId = str => (str.match(/"id":\s*(\d+),/) || [])[1] || '';

      const idFromMsg = extractId(userMessage);

      response = JSON.stringify([
        { "action": "update", "id": Number(idFromMsg), "data": "[test] Updated string from LLM" },
        { "action": "add_key", "id": Number(idFromMsg), "data": ["new-key-from-llm"] },
        { "action": "del_key", "id": Number(idFromMsg), "data": ["key-to-delete-456"] },
      ]);
    } else if (userMessage.includes('new-entry-8564')) { // From above
      response = JSON.stringify(
        [
          { "action": "add_entry" },
        ],
      )
    }

    return {
      ok: true,
      data: {
        assistant: response,
        reasoning: null,
      },
    };
  }

  // Text Chunking mock
  if (llmId === '99-3') {
    // Extract start and end from metadata section
    const startMatch = userMessage.match(/Start:\s*(\d+)/);
    const endMatch = userMessage.match(/End:\s*(\d+)/);

    if (!startMatch || !endMatch) {
      // Invalid format, return error
      return {
        ok: false,
        error: 'Invalid metadata format in mock',
      };
    }

    const start = Number(startMatch[1]);
    const end = Number(endMatch[1]);

    // Generate random intervals covering [start, end]
    const intervals = [];
    let current = start;

    while (current <= end) {
      // Random chunk size between 4 and 7 paragraphs
      const chunkSize = Math.floor(Math.random() * 4) + 4; // 4, 5, 6, or 7
      const intervalEnd = Math.min(current + chunkSize - 1, end);

      intervals.push([current, intervalEnd]);

      current = intervalEnd + 1;
    }

    // Return as JSON string (matching LLM output format)
    const response = JSON.stringify(intervals);

    return {
      ok: true,
      data: {
        assistant: response,
        reasoning: null,
      },
    };
  }

  // Translation mock (echo with counter)
  if (llmId === '99-4') {
    // Extract text from <raw-text> tags
    const match = userMessage.match(/<raw-text>\s*([\s\S]*?)\s*<\/raw-text>/);

    if (!match) {
      return {
        ok: false,
        error: 'No <raw-text> block found in user message'
      };
    }

    const rawText = match[1];

    // Split by newlines and filter out empty lines
    const lines = rawText.split('\n').filter(line => line.trim().length > 0);

    // Generate echo response with incrementing counter
    const echoLines = lines.map(line => {
      echoCounter++;
      return `<translation>#${echoCounter} Echo: ${line}</translation>`;
    });

    const response = echoLines.join('\n');

    return {
      ok: true,
      data: {
        assistant: response,
        reasoning: null,
      },
    };
  }

  if (llmId === '99-5') {
    // Extract line numbers from Machine Translation section
    const translationMatch = userMessage.match(/## Machine Translation.*?\n([\s\S]*?)(?:\n---|$)/);

    if (!translationMatch) {
      return {
        ok: false,
        error: 'No Machine Translation section found'
      };
    }

    const translationSection = translationMatch[1];

    // Extract all line numbers (0-indexed as shown in prompt)
    const lineMatches = [...translationSection.matchAll(/^(\d+)\./gm)];
    const lineNumbers = lineMatches.map(m => parseInt(m[1]));

    if (lineNumbers.length === 0) {
      return {
        ok: false,
        error: 'No lines found in translation section'
      };
    }

    const minLine = Math.min(...lineNumbers);
    const maxLine = Math.max(...lineNumbers);
    const numLines = lineNumbers.length;

    // Cycle through action types (0-3)
    const actionType = postEditCounter % 4;
    postEditCounter++;

    let operations;

    switch (actionType) {
      case 0:
        // No changes
        operations = { action: 'none' };
        break;

      case 1:
        // Update first line
        operations = [
          {
            action: 'update',
            line: minLine,
            text: `Edited line #${echoCounter++}: updated content`
          }
        ];
        break;

      case 2:
        // Delete last line (only if more than 1 line exists)
        if (numLines > 1) {
          operations = [
            { action: 'delete', line: maxLine }
          ];
        } else {
          // Fallback to none if only one line
          operations = { action: 'none' };
        }
        break;

      case 3:
        // Add a line after the first line
        operations = [
          {
            action: 'add',
            line: minLine + 1,
            text: `Added line #${echoCounter++}: new content`
          }
        ];
        break;
    }

    const response = `<operations>${JSON.stringify(operations)}</operations>`;

    return {
      ok: true,
      data: {
        assistant: response,
        reasoning: null,
      },
    };
  }


// Default echo response
  return {
    ok: true,
    data: {
      assistant: `[MOCK ECHO] Received from ${llmId}: ${userMessage.substring(0, 100)}`,
      reasoning: null,
    },
  };
}

/**
 * Simulates processing a task with artificial delay.
 */
function processTask(taskId, clientId, llmId, systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    // Simulate network latency (200-800ms, longer for MOCK_SLOW)
    const baseDelay = userMessage.includes('MOCK_SLOW') ? 2000 : 200;
    const jitter = Math.random() * 600;
    const delay = baseDelay + jitter;

    console.log(`[Background] Processing task ${taskId} for client ${clientId} (delay: ${Math.round(delay)}ms)`);

    const timeoutId = setTimeout(() => {
      // Generate mock response
      const response = generateMockResponse(llmId, systemPrompt, userMessage);

      console.log(`[Background] Task ${taskId} completed:`, response.ok ? 'SUCCESS' : 'FAILED');

      // Clean up tracking
      pendingTasks.delete(taskId);
      tasksByClient.get(clientId)?.delete(taskId);

      resolve(response);
    }, delay);

    // Store for potential cancellation
    pendingTasks.set(taskId, {
      timeoutId,
      resolve,
      reject,
    });
  });
}

/**
 * Cancels a pending task.
 */
function cancelTask(taskId) {
  const task = pendingTasks.get(taskId);
  if (task) {
    clearTimeout(task.timeoutId);
    pendingTasks.delete(taskId);
    console.log(`[Background] Task ${taskId} cancelled`);
  }
}

/**
 * Message handler for llm_request and llm_cancel
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle LLM request
  if (message.type === 'llm_request') {
    const { clientId, llmId, systemPrompt, userMessage, customParams } = message.payload;
    const taskId = nextTaskId++;

    console.log(`[Background] Received llm_request from client ${clientId}`, {
      taskId,
      userMessage: userMessage,
      systemMessage: systemPrompt,
    });

    // Track this task for the client
    if (!tasksByClient.has(clientId)) {
      tasksByClient.set(clientId, new Set());
    }
    tasksByClient.get(clientId).add(taskId);

    // Process asynchronously
    processTask(taskId, clientId, llmId, systemPrompt, userMessage)
      .then(response => {
        sendResponse(response);
      })
      .catch(error => {
        console.error(`[Background] Task ${taskId} error:`, error);
        sendResponse({
          ok: false,
          error: error.message || 'Unknown error',
        });
      });

    return true; // Keep message channel open for async response
  }

  // Handle cancellation
  if (message.type === 'llm_cancel') {
    const { clientId, pendingCount } = message.payload;

    console.log(`[Background] Received llm_cancel from client ${clientId} (${pendingCount} pending)`);

    // Cancel all queued/pending tasks for this client
    const tasks = tasksByClient.get(clientId);
    if (tasks) {
      let cancelledCount = 0;
      for (const taskId of tasks) {
        cancelTask(taskId);
        cancelledCount++;
      }
      tasksByClient.delete(clientId);
      console.log(`[Background] Cancelled ${cancelledCount} tasks for client ${clientId}`);
    } else {
      console.log(`[Background] No tasks found for client ${clientId}`);
    }

    return false; // No response needed
  }

  // Unknown message type
  console.warn('[Background] Unknown message type:', message.type);
  return false;
});

// Log when service worker starts
console.log('[Background] Service worker started');

// Optional: Log when service worker is about to be terminated
// (Chrome terminates idle service workers after ~30 seconds)
self.addEventListener('beforeunload', () => {
  console.log('[Background] Service worker terminating...');
});
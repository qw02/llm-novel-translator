import { getProgressTracker } from './progress-tracking.js';

// Generate unique client IDs
let nextClientId = 1;

/**
 * Thin wrapper for chrome.runtime.sendMessage.
 * Automatically registers with the global progress tracker.
 * Handles worker death/restart and cancellation on disposal.
 */
class LLMClient {
  /**
   * @param {Object} params
   * @param {string} params.llmId - Unique label for a LLM to be used
   * @param {string} params.stageId - Stage identifier for progress tracking
   * @param {string} params.stageLabel - Human-readable stage name
   */
  constructor({ llmId, stageId, stageLabel }) {
    this.clientId = `client_${nextClientId++}_${Date.now()}`;
    this.llmId = llmId;
    this.stageId = stageId;
    this._disposed = false;

    this._pendingRequests = new Map();
    this._nextRequestId = 1;

    // Register with progress tracker
    this.progressTracker = getProgressTracker();
    this.progressTracker.createStage(this.stageId, stageLabel);
  }

  /**
   * Sends a single LLM request.
   * @param {Object} prompt
   * @param {string} prompt.system - The system message/prompt
   * @param {string} prompt.user - The user message/prompt
   * @returns {Promise<string>} The assistant's completion text
   */
  async request(prompt) {
    if (this._disposed) {
      throw new Error('LLMClient has been disposed');
    }

    const requestId = this._nextRequestId++;

    this.progressTracker.addTasks(this.stageId, 1);

    return new Promise((resolve, reject) => {
      this._pendingRequests.set(requestId, {
        prompt,
        resolve,
        reject,
        retryCount: 0,
      });

      this._sendRequest(requestId);
    });
  }

  /**
   * Internal method to send or retry a request.
   * @private
   */
  async _sendRequest(requestId) {
    const pending = this._pendingRequests.get(requestId);
    if (!pending || this._disposed) {
      return;
    }

    try {
      const payload = {
        clientId: this.clientId,
        llmId: this.llmId,
        systemPrompt: pending.prompt.system,
        userMessage: pending.prompt.user,
      };

      const response = await chrome.runtime.sendMessage({ type: 'llm_request', payload });


      this._pendingRequests.delete(requestId);

      if (!response.ok) {
        this.progressTracker.markError(this.stageId, response.error || 'Unknown error');
        pending.reject(new Error(response.error || 'LLM request failed'));
      } else {
        this.progressTracker.markComplete(this.stageId);
        pending.resolve(response.data.assistant);
      }

    } catch (error) {
      const isWorkerDead =
        chrome.runtime.lastError?.message?.includes('Receiving end does not exist') ||
        error.message?.includes('Receiving end does not exist') ||
        error.message?.includes('message port closed') ||
        error.message?.includes('Extension context invalidated');

      if (isWorkerDead) {
        pending.retryCount++;

        if (pending.retryCount <= 3) {
          console.warn(
            `[LLMClient] Background worker unavailable for request ${requestId}, ` +
            `retrying (${pending.retryCount}/3)...`,
          );

          setTimeout(() => this._sendRequest(requestId), 1000);
        } else {
          this._pendingRequests.delete(requestId);
          this.progressTracker.markError(
            this.stageId,
            'Background worker unavailable after retries',
          );
          pending.reject(
            new Error('Background worker unavailable after 3 retry attempts'),
          );
        }
      } else {
        this._pendingRequests.delete(requestId);
        this.progressTracker.markError(this.stageId, error.message);
        pending.reject(error);
      }
    }
  }

  /**
   * Sends multiple requests concurrently.
   *
   * @param {Array<Object>} prompts - Array of prompts (system/user message)
   * @returns {Promise<Array<{ok: boolean, data?: string, error?: string}>>}
   */
  async requestBatch(prompts) {
    if (this._disposed) {
      throw new Error('LLMClient has been disposed');
    }

    const promises = prompts.map(async (userMessage) => {
      try {
        const result = await this.request(userMessage);
        return { ok: true, data: result };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Cleans up this client instance.
   * - Marks the stage as finished in the progress tracker
   * - Sends cancellation message to background worker
   * - Rejects all pending requests
   *
   * Used when:
   * - Pipeline stage finishes
   * - Cancellation by user
   */
  dispose() {
    if (this._disposed) return;

    this._disposed = true;

    // Reject all pending requests
    for (const [requestId, pending] of this._pendingRequests) {
      pending.reject(new Error('LLMClient disposed'));
    }

    const pendingCount = this._pendingRequests.size;
    this._pendingRequests.clear();

    // Mark stage as done in progress tracker
    this.progressTracker.finishStage(this.stageId);

    // Send cancellation message to background worker
    // Fire and forget - don't await, we're cleaning up
    const payload = {
      clientId: this.clientId,
      pendingCount,
    };

    chrome.runtime.sendMessage({ type: 'llm_cancel', payload }).catch(() => {
      // Ignore errors - worker might already be dead, or we might be shutting down
    });

    this.progressTracker = null;
  }
}

export { LLMClient };
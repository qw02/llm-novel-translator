// Minimal async mutex to separate pending entries selection / scheduling from dictionary update / mutation
import { parseJSONFromLLM } from "../../utils/data-extraction.js";

export class AsyncMutex {
  constructor() {
    this._locked = false;
    this._waiters = [];
  }

  acquire() {
    return new Promise((resolve) => {
      const take = () => {
        this._locked = true;
        resolve(this._release.bind(this));
      };
      if (!this._locked) take();
      else this._waiters.push(take);
    });
  }

  _release() {
    this._locked = false;
    const next = this._waiters.shift();
    if (next) next();
  }

  async runExclusive(fn) {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * Updater class that handles the complex locking and scheduling logic
 */
export class GlossaryUpdater {
  constructor(client, promptBuilder) {
    this.client = client;
    this.promptBuilder = promptBuilder;
    this.nextId = 1;
    this._mutex = new AsyncMutex();
    this._usedKeys = new Set(); // union of lock sets of all in-flight tasks
  }

  async update(existingGlossary, newEntries) {
    const workingDict = this._cloneDictionary(existingGlossary);
    this.nextId = this._getMaxId(workingDict) + 1;

    // Pending work (preserve relative order to reduce starvation)
    const pending = newEntries.map((entry, idx) => ({ idx, entry }));

    // In-flight requests: [{ id, p }]
    const inFlight = [];
    let seq = 1;

    // Find a maximal batch of entries whose lock sets do not intersect _usedKeys.
    const scheduleAvailable = async () => {
      await this._mutex.runExclusive(async () => {
        // Try to schedule until either no candidate fits
        for (let i = 0; i < pending.length;) {
          const candidate = pending[i];

          const { conflicts, lockKeys } = this._computeLocks(workingDict, candidate.entry);

          // No conflict: add immediately, no LLM needed
          if (conflicts.length === 0) {
            this._addEntry(workingDict, candidate.entry);
            pending.splice(i, 1);
            // Don't increment i since we removed current index
            continue;
          }

          // Has conflicts: check if we can schedule LLM request
          if (this._intersects(lockKeys, this._usedKeys)) {
            i += 1; // cannot schedule this one now; try next
            continue;
          }

          // Lock keys for this task
          for (const k of lockKeys) this._usedKeys.add(k);

          // Build prompt using prompt builder
          const prompt = this._createConflictPrompt(conflicts, candidate.entry);

          // Enqueue request using LLMClient
          const basePromise = this.client.request(prompt);

          // Attach metadata and a local sequence id so we can identify which promise completed.
          const meta = {
            entry: candidate.entry,
            conflicts,
            lockKeys: Array.from(lockKeys),
          };
          const id = seq++;

          // Wrap promise to include metadata and handle errors
          const wrapped = basePromise
            .then((response) => ({ result: { ok: true, response }, meta, id }))
            .catch((error) => ({ result: { ok: false, error: error.message }, meta, id }));

          inFlight.push({ id, p: wrapped });

          // Remove from pending once scheduled
          pending.splice(i, 1);
          // Do not increment i here, as we removed the current index
        }
      });
    };

    // Kick off the first batch
    await scheduleAvailable();

    // Process completions as they arrive
    while (pending.length > 0 || inFlight.length > 0) {
      if (inFlight.length === 0) {
        // No work in-flight; try scheduling again
        await scheduleAvailable();
        if (inFlight.length === 0) break; // nothing schedulable (should not happen with empty usedKeys)
      }

      // Wait for one completion
      const { result, meta, id } = await Promise.race(inFlight.map((it) => it.p));

      // Apply LLM result under mutex, then unlock and attempt more scheduling
      await this._mutex.runExclusive(async () => {
        if (result.ok) {
          try {
            const parsed = parseJSONFromLLM(result.response);
            const actions = this._normalizeActions(parsed);
            const validationError = this._validateActions(actions, meta.conflicts);
            if (!validationError) {
              this._executeActions(workingDict, actions, meta.entry);
            } else {
              console.error('Action validation failed:', validationError);
              // Treat as no-op
            }
          } catch (err) {
            console.error('Failed to parse/execute actions:', err);
            // Treat as no-op
          }
        } else {
          console.warn('Glossary update LLM call failed:', result.error);
          // Treat as no-op
        }

        // Unlock original lock keys
        for (const k of meta.lockKeys) this._usedKeys.delete(k);

        // Remove this promise from in-flight
        const idx = inFlight.findIndex((it) => it.id === id);
        if (idx !== -1) inFlight.splice(idx, 1);
      });

      // See if freeing these keys opens new scheduling opportunities
      await scheduleAvailable();
    }

    return workingDict;
  }

  // Compute conflicts (existing entries that intersect keys) and the lock set
  _computeLocks(workingDict, newEntry) {
    const conflicts = this._findConflicts(workingDict, newEntry);
    const lockKeys = new Set(newEntry.keys);
    for (const c of conflicts) {
      for (const k of c.keys) lockKeys.add(k);
    }
    return { conflicts, lockKeys };
  }

  _intersects(keysSet, usedKeys) {
    for (const k of keysSet) {
      if (usedKeys.has(k)) return true;
    }
    return false;
  }

  _findConflicts(workingDict, newEntry) {
    const newKeys = new Set(newEntry.keys);
    const conflicts = [];

    for (const existingEntry of workingDict.entries) {
      // Check for key intersection
      const hasIntersection = existingEntry.keys.some(key => newKeys.has(key));
      if (hasIntersection) {
        conflicts.push(existingEntry);
      }
    }

    return conflicts;
  }

  _addEntry(workingDict, entry) {
    const newEntry = {
      id: this.nextId++,
      keys: [...entry.keys],
      value: entry.value,
    };
    workingDict.entries.push(newEntry);
  }

  _createConflictPrompt(conflicts, newEntry) {
    const existingDict = {
      entries: conflicts,
    };

    const newUpdates = {
      entries: [newEntry],
    };

    // Use the prompt builder to generate the prompt
    return this.promptBuilder.build(existingDict, newUpdates);
  }

  /**
   * Normalize actions: handle both single object and array
   * Input: { action: "none" } OR [{ action: "delete", id: 7 }, ...]
   * Output: Always an array
   */
  _normalizeActions(parsed) {
    if (Array.isArray(parsed)) {
      return parsed;
    }
    // Single object (e.g., { action: "none" })
    return [parsed];
  }

  /**
   * Validate actions structure and content
   * Returns: null if valid, error string if invalid
   */
  _validateActions(actions, conflicts) {
    const validActions = new Set(['update', 'delete', 'add_key', 'del_key', 'add_entry', 'none']);
    const conflictIds = new Set(conflicts.map(c => c.id));

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      // Check action is valid
      if (!action.action || !validActions.has(action.action)) {
        return `Action ${i}: invalid action type '${action.action}'`;
      }

      // Validate based on action type
      switch (action.action) {
        case 'none':
          // No additional validation needed
          break;

        case 'add_entry':
          // No id or data required
          if (action.id !== undefined || action.data !== undefined) {
            return `Action ${i} (add_entry): should not have 'id' or 'data' fields`;
          }
          break;

        case 'delete':
          // Requires only id
          if (!action.id) {
            return `Action ${i} (delete): missing 'id' field`;
          }
          if (!conflictIds.has(action.id)) {
            return `Action ${i} (delete): id ${action.id} not in conflict set`;
          }
          if (action.data !== undefined) {
            return `Action ${i} (delete): should not have 'data' field`;
          }
          break;

        case 'update':
          // Requires id and data (string)
          if (!action.id) {
            return `Action ${i} (update): missing 'id' field`;
          }
          if (!conflictIds.has(action.id)) {
            return `Action ${i} (update): id ${action.id} not in conflict set`;
          }
          if (typeof action.data !== 'string') {
            return `Action ${i} (update): 'data' must be a string`;
          }
          break;

        case 'add_key':
          // Requires id and data (array of strings)
          if (!action.id) {
            return `Action ${i} (add_key): missing 'id' field`;
          }
          if (!conflictIds.has(action.id)) {
            return `Action ${i} (add_key): id ${action.id} not in conflict set`;
          }
          if (!Array.isArray(action.data)) {
            return `Action ${i} (add_key): 'data' must be an array`;
          }
          if (!action.data.every(k => typeof k === 'string')) {
            return `Action ${i} (add_key): all keys in 'data' must be strings`;
          }
          break;

        case 'del_key':
          // Requires id and data (array of strings)
          if (!action.id) {
            return `Action ${i} (del_key): missing 'id' field`;
          }
          if (!conflictIds.has(action.id)) {
            return `Action ${i} (del_key): id ${action.id} not in conflict set`;
          }
          if (!Array.isArray(action.data)) {
            return `Action ${i} (del_key): 'data' must be an array`;
          }
          if (!action.data.every(k => typeof k === 'string')) {
            return `Action ${i} (del_key): all keys in 'data' must be strings`;
          }
          break;
      }
    }

    return null; // Valid
  }

  _executeActions(workingDict, actions, newEntry) {
    for (const action of actions) {
      try {
        this._executeAction(workingDict, action, newEntry);
      } catch (err) {
        console.error('Failed to execute action:', action, err);
      }
    }
  }

  _executeAction(workingDict, action, newEntry) {
    switch (action.action) {
      case 'update':
        this._actionUpdate(workingDict, action.id, action.data);
        break;
      case 'delete':
        this._actionDelete(workingDict, action.id);
        break;
      case 'add_key':
        this._actionAddKey(workingDict, action.id, action.data);
        break;
      case 'del_key':
        this._actionDelKey(workingDict, action.id, action.data);
        break;
      case 'add_entry':
        this._addEntry(workingDict, newEntry);
        break;
      case 'none':
        // No-op
        break;
      default:
        console.warn(`Unknown action type: ${action.action}`);
    }
  }

  _actionUpdate(workingDict, id, newValue) {
    const entry = workingDict.entries.find(e => e.id === id);
    if (entry) {
      entry.value = newValue;
    } else {
      console.warn(`Update action: entry ${id} not found`);
    }
  }

  _actionDelete(workingDict, id) {
    const index = workingDict.entries.findIndex(e => e.id === id);
    if (index !== -1) {
      workingDict.entries.splice(index, 1);
    } else {
      console.warn(`Delete action: entry ${id} not found`);
    }
  }

  _actionAddKey(workingDict, id, keys) {
    const entry = workingDict.entries.find(e => e.id === id);
    if (entry) {
      entry.keys.push(...keys);
      // Remove duplicates
      entry.keys = [...new Set(entry.keys)];
    } else {
      console.warn(`Add key action: entry ${id} not found`);
    }
  }

  _actionDelKey(workingDict, id, keys) {
    const entry = workingDict.entries.find(e => e.id === id);
    if (entry) {
      const keysToRemove = new Set(keys);
      entry.keys = entry.keys.filter(k => !keysToRemove.has(k));
    } else {
      console.warn(`Delete key action: entry ${id} not found`);
    }
  }

  _cloneDictionary(dict) {
    return JSON.parse(JSON.stringify(dict));
  }

  _getMaxId(dict) {
    if (!dict.entries || dict.entries.length === 0) {
      return 0;
    }
    return Math.max(...dict.entries.map(e => e.id));
  }
}

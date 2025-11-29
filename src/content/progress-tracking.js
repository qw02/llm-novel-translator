/**
 * Global progress tracker for LLM inference tasks in a tab / content script instance
 * Singleton instance, automatically created on first access.
 */

let globalTracker = null;

/**
 * Gets or creates the global ProgressMetrics instance for this tab.
 */
function getProgressTracker(totalStages) {
  if (!globalTracker) {
    globalTracker = new ProgressMetrics(totalStages);
  }
  return globalTracker;
}

class ProgressMetrics {
  constructor(totalStages) {
    this.stages = new Map(); // stageId -> StageTracker
    this.totalStages = totalStages || 5;
  }

  /**
   * Creates a new progress stage.
   * Called automatically by LLMClient constructor.
   */
  createStage(stageId, label) {
    if (this.stages.has(stageId)) {
      return;
    }

    this.stages.set(stageId, new StageTracker(stageId, label));
  }

  /**
   * Adds tasks to a stage's total count.
   */
  addTasks(stageId, count) {
    const stage = this._getStage(stageId);
    stage.addTasks(count);
  }

  /**
   * Marks one task as successfully completed.
   */
  markComplete(stageId) {
    const stage = this._getStage(stageId);
    stage.markComplete();
  }

  /**
   * Marks one task as failed with an error.
   */
  markError(stageId, errorMessage) {
    const stage = this._getStage(stageId);
    stage.markError(errorMessage);
  }

  /**
   * Marks a stage as done.
   * Called by LLMClient.dispose().
   */
  finishStage(stageId) {
    const stage = this._getStage(stageId);
    stage.finish();
  }

  /**
   * Gets the current state of all stages + global progress.
   */
  getState() {
    const state = {};
    let globalProgress = 0;
    let globalTotal = 0;
    let globalCompleted = 0;
    let globalErrors = 0;

    const stageWeight = 1 / this.totalStages;

    for (const [stageId, stage] of this.stages) {
      const stageData = stage.toJSON();
      state[stageId] = stageData;

      globalTotal += stageData.total || 0;
      globalCompleted += stageData.completed || 0;
      globalErrors += stageData.errorCount || 0;

      // Calculate weighted progress for this stage
      if (stageData.total > 0) {
        // Cap at 1 in case completed somehow exceeds total
        const stageProgress = Math.min(stageData.completed / stageData.total, 1);
        globalProgress += stageProgress * stageWeight;
      } else if (stageData.done) {
        // Stage marked done with no tasks (skipped stage scenario)
        globalProgress += stageWeight;
      }
      // If total === 0 and not done, stage contributes nothing yet
    }

    state.global = {
      progress: globalProgress,
      total: globalTotal,
      completed: globalCompleted,
      remaining: globalTotal - globalCompleted,
      errors: globalErrors,
    };

    return state;
  }

  /**
   * Clears all stages.
   */
  reset() {
    this.stages.clear();
  }

  /**
   * Internal: Retrieves a stage or throws.
   * @private
   */
  _getStage(stageId) {
    const stage = this.stages.get(stageId);
    if (!stage) {
      throw new Error(`Stage '${stageId}' does not exist`);
    }
    return stage;
  }
}

/**
 * Internal class for a single pipeline stage.
 * @private
 */
class StageTracker {
  constructor(id, label) {
    this.id = id;
    this.label = label;
    this.total = 0;
    this.completed = 0;
    this.errors = [];
    this.startTime = null;
    this.endTime = null;
    this.done = false;
  }

  addTasks(count) {
    this.total += count;
    if (this.startTime === null) {
      this.startTime = Date.now();
    }
  }

  markComplete() {
    this.completed += 1;
  }

  markError(errorMessage) {
    this.completed += 1;
    this.errors.push(errorMessage);
  }

  finish() {
    this.done = true;
    this.endTime = Date.now();
  }

  toJSON() {
    // If stage is done, return minimal info
    if (this.done) {
      return {
        id: this.id,
        label: this.label,
        done: true,
        total: this.total,
        completed: this.completed,
        errorCount: this.errors.length,
      };
    }

    // Otherwise, return detailed progress
    const now = Date.now();
    const elapsed = this.startTime ? (now - this.startTime) / 1000 : 0;
    const remaining = Math.max(0, this.total - this.completed);
    const inProgress = this.total - this.completed;
    const progress = this.total > 0 ? this.completed / this.total : 0;

    const speed = elapsed > 0 ? this.completed / elapsed : 0;
    const eta = speed > 0 && remaining > 0 ? remaining / speed : 0;

    return {
      id: this.id,
      label: this.label,
      done: false,
      total: this.total,
      completed: this.completed,
      in_progress: inProgress,
      progress: Math.round(progress * 100) / 100,
      errorCount: this.errors.length,
      errors: [...this.errors],
      elapsed: Math.round(elapsed),
      eta: Math.round(eta),
      speed: Math.round(speed * 100) / 100,
    };
  }
}

export { ProgressMetrics, getProgressTracker };

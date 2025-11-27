import { clearElement, createSection, createButton } from "../ui/dom.js";

let isDetailsOpen = false;

function formatPercent(val) {
  return typeof val === "number" ? `${Math.round(val * 100)}%` : "0%";
}

function buildSimpleProgressText(data) {
  if (!data || !data.global) return "Waiting for pipeline...";

  const lines = [];
  const g = data.global;

  lines.push(`Global Progress: ${(g.progress * 100).toFixed(1)}%`);
  lines.push(`Total: ${g.total} | Completed: ${g.completed} | Remaining: ${g.remaining}`);
  lines.push(`Errors: ${g.errors}`);
  lines.push("");

  lines.push("Stages:");
  for (const [stageId, stage] of Object.entries(data)) {
    if (stageId === "global") continue;

    lines.push(`${stage.label || stageId}`);
    lines.push(`Status: ${stage.done ? "✓ Done" : "In Progress"}`);
    lines.push(`Completed: ${stage.completed}/${stage.total}`);

    if (!stage.done) {
      const pct = typeof stage.progress === "number" ? (stage.progress * 100).toFixed(1) : "0.0";
      lines.push(`Progress: ${pct}%  |  Speed: ${stage.speed} tasks/sec, ETA: ${stage.eta}s  |  Elapsed: ${stage.elapsed}s`);
    }

    if (stage.errorCount > 0) {
      lines.push(`Errors: ${stage.errorCount}`);
    }
  }

  return lines.join("\n");
}

export function renderInProgressView(root, { pipelineState, progressData }) {
  clearElement(root);

  const { section, body } = createSection("Translating…", "Running pipeline");

  const globalProgress = progressData?.global?.progress ?? 0;

  const progressContainer = document.createElement("div");
  progressContainer.className = "progress-container";

  const bar = document.createElement("div");
  bar.className = "progress-bar";

  const barFill = document.createElement("div");
  barFill.className = "progress-bar-fill";
  barFill.style.width = formatPercent(globalProgress);

  bar.appendChild(barFill);
  progressContainer.appendChild(bar);

  const labelRow = document.createElement("div");
  labelRow.className = "progress-label-row";

  const left = document.createElement("span");
  left.textContent = "Progress";

  const right = document.createElement("span");
  right.textContent = formatPercent(globalProgress);

  labelRow.appendChild(left);
  labelRow.appendChild(right);
  progressContainer.appendChild(labelRow);

  body.appendChild(progressContainer);

  const buttons = document.createElement("div");
  buttons.className = "button-row";

  const detailsToggle = createButton(
    isDetailsOpen ? "Hide detailed" : "View detailed",
    { variant: "secondary" }
  );

  buttons.appendChild(detailsToggle);
  body.appendChild(buttons);

  const simpleText = document.createElement("div");
  simpleText.className = "code-block";

  simpleText.style.display = isDetailsOpen ? "block" : "none";
  simpleText.textContent = buildSimpleProgressText(progressData);

  body.appendChild(simpleText);

  detailsToggle.addEventListener("click", () => {
    isDetailsOpen = !isDetailsOpen;

    // Update DOM to reflect new state
    simpleText.style.display = isDetailsOpen ? "block" : "none";
    detailsToggle.textContent = isDetailsOpen ? "Hide detailed" : "View detailed";
  });

  const footer = document.createElement("div");
  footer.className = "footer-row";

  const hint = document.createElement("span");
  hint.className = "text-small text-muted";
  hint.textContent = "This may take several minutes depending on chapter length.";

  footer.appendChild(hint);
  body.appendChild(footer);

  root.appendChild(section);
}

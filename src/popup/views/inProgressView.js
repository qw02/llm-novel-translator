import { clearElement, createSection, createButton } from "../ui/dom.js";

function formatPercent(globalProgress) {
  if (!globalProgress && globalProgress !== 0) return "0%";
  return `${Math.round(globalProgress * 100)}%`;
}

function buildSimpleProgressText(progressData) {
  if (!progressData || !progressData.global) return "No progress data.";

  const lines = [];
  const g = progressData.global;

  lines.push(`Global Progress: ${(g.progress * 100).toFixed(1)}%`);
  lines.push(
    `Total: ${g.total} | Completed: ${g.completed} | Remaining: ${g.remaining}`
  );
  lines.push(`Errors: ${g.errors}`);
  lines.push("");

  lines.push("Stages:");
  for (const [stageId, stage] of Object.entries(progressData)) {
    if (stageId === "global") continue;
    const label = stage.label || stageId;

    lines.push("");
    lines.push(`${label}`);
    lines.push(`Status: ${stage.done ? "✓ Done" : "In Progress"}`);
    lines.push(`Completed: ${stage.completed}/${stage.total}`);

    if (!stage.done) {
      const pct =
        typeof stage.progress === "number"
        ? (stage.progress * 100).toFixed(1)
        : "0.0";
      lines.push(`Progress: ${pct}%`);
      lines.push(`Speed: ${stage.speed} tasks/sec | ETA: ${stage.eta}s`);
      lines.push(`Elapsed: ${stage.elapsed}s`);
    }

    if (stage.errorCount > 0) {
      lines.push(`Errors: ${stage.errorCount}`);
    }
  }

  return lines.join("\n");
}

export function renderInProgressView(root, { pipelineState }) {
  clearElement(root);

  const { section, body } = createSection("Translating…", "Running pipeline");

  const progressData = pipelineState?.progress || null;
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

  const detailsToggle = createButton("View detailed", {
    variant: "secondary",
  });

  buttons.appendChild(detailsToggle);
  body.appendChild(buttons);

  const simpleText = document.createElement("div");
  simpleText.className = "code-block";
  simpleText.style.display = "none";

  simpleText.textContent = buildSimpleProgressText(progressData);
  body.appendChild(simpleText);

  detailsToggle.addEventListener("click", () => {
    if (simpleText.style.display === "none") {
      simpleText.style.display = "block";
      detailsToggle.textContent = "Hide detailed";
    } else {
      simpleText.style.display = "none";
      detailsToggle.textContent = "View detailed";
    }
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

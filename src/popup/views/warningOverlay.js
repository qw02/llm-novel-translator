/**
 * Simple modal overlay for validation warnings.
 */

let currentOverlay = null;

export function showWarningOverlay(root, warning, { onContinue, onCancel }) {
  removeWarningOverlayIfAny();

  const overlay = document.createElement("div");
  overlay.className = "warning-overlay";

  const modal = document.createElement("div");
  modal.className = "warning-modal";

  const title = document.createElement("h3");
  title.className = "warning-title";
  title.textContent = "Warning before translation";

  const body = document.createElement("p");
  body.className = "warning-body";
  body.textContent = warning || "There is a potential issue with the configuration.";

  modal.appendChild(title);
  modal.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "button-row";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-secondary";
  cancelBtn.textContent = "Cancel";

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "btn btn-primary";
  continueBtn.textContent = "Continue anyway";

  cancelBtn.addEventListener("click", () => {
    onCancel?.();
  });

  continueBtn.addEventListener("click", () => {
    onContinue?.();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(continueBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  // Attach to body so it covers the whole popup
  document.body.appendChild(overlay);

  currentOverlay = overlay;
}

export function removeWarningOverlayIfAny() {
  if (currentOverlay && currentOverlay.parentNode) {
    currentOverlay.parentNode.removeChild(currentOverlay);
  }
  currentOverlay = null;
}

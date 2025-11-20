import { clearElement, createSection, createNotice } from "../ui/dom.js";

export function renderCompleteView(root, { kind, pipelineState }) {
  clearElement(root);

  const isSuccess = kind === "success";
  const { section, body } = createSection(
    isSuccess ? "Translation complete" : "Translation failed"
  );

  if (isSuccess) {
    const msg = document.createElement("p");
    msg.className = "text-small";
    msg.textContent = "The translation pipeline has finished. There are no further actions.";
    body.appendChild(msg);

    const badge = document.createElement("span");
    badge.className = "badge badge-success";
    badge.textContent = "Done";
    body.appendChild(badge);
  } else {
    const errMsg = pipelineState?.error?.message || "An unrecoverable error occurred.";

    const notice = createNotice(
      "error",
      "The pipeline encountered an unrecoverable error. Refresh the page to try again."
    );
    body.appendChild(notice);

    const detail = document.createElement("p");
    detail.className = "error-text";
    detail.textContent = errMsg;
    body.appendChild(detail);
  }

  const footer = document.createElement("div");
  footer.className = "footer-row";

  const hint = document.createElement("span");
  hint.className = "text-small text-muted";
  hint.textContent = "Close this popup; there is nothing else to run.";

  footer.appendChild(hint);
  body.appendChild(footer);

  root.appendChild(section);
}

import { clearElement, createSection, createButton, createNotice } from "../ui/dom.js";

export function renderWelcomeView(root, { onOpenOptions }) {
  clearElement(root);

  const { section, body } = createSection("Welcome", "Web Novel Translator");

  const intro = document.createElement("p");
  intro.className = "text-small";
  intro.textContent =
    "No API keys are configured yet. To start translating, please open the options page and add your LLM provider keys.";
  body.appendChild(intro);

  const hint = createNotice(
    "muted",
    "After saving your settings in the options page, reopen this popup."
  );
  body.appendChild(hint);

  const buttons = document.createElement("div");
  buttons.className = "button-row";

  const openOptionsBtn = createButton("Open Options", {
    variant: "primary",
    full: true,
    onClick: onOpenOptions,
  });

  buttons.appendChild(openOptionsBtn);
  body.appendChild(buttons);

  root.appendChild(section);
}

import { clearElement, createSection, createButton, createNotice } from "../ui/dom.js";

export function renderWelcomeView(root, { onOpenOptions }) {
  clearElement(root);

  const { section, body } = createSection("Welcome", "LLM Novel Translator (BYOK)");

  const intro = document.createElement("p");
  intro.className = "text-small";
  intro.textContent = "No API keys are configured yet. Please open the options page and add an API key for at least 1 provider.";
  body.appendChild(intro);

  const hint = createNotice(
    "muted",
    "After saving your settings in the options page, reopen this popup.",
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

import {
  clearElement,
  createSection,
  createButton,
  createRow,
  createCheckboxRow,
  createNotice,
} from "../ui/dom.js";
import { LANGS } from "../../common/languages.js";

function getLanguageLabel(config, key, fallback) {
  if (!config) return fallback;
  const code = config[key] || fallback;
  return LANGS[code];
}

export function renderIdleReadyView(
  root,
  {
    config,
    popupError,
    skipGlossary,
    onOpenOptions,
    onTranslate,
    onShowGlossary,
    onToggleSkipGlossary,
  }
) {
  clearElement(root);

  const { section, body } = createSection("Translate this page");

  const srcLang = getLanguageLabel(config, "sourceLang", "");
  const tgtLang = getLanguageLabel(config, "targetLang", "");

  body.appendChild(createRow("Source language", srcLang));
  body.appendChild(createRow("Target language", tgtLang));

  const glossaryEnabled =
    !!config?.llm?.glossaryGenerate || !!config?.updateGlossary;

  if (glossaryEnabled) {
    const { row: checkboxRow } = createCheckboxRow(
      "skip-glossary-checkbox",
      "Skip glossary generation/update for this run",
      skipGlossary,
      onToggleSkipGlossary
    );
    body.appendChild(checkboxRow);
  }

  if (popupError) {
    const errNotice = createNotice("error", popupError);
    body.appendChild(errNotice);
  }

  const buttons = document.createElement("div");
  buttons.className = "button-row";

  const glossaryBtn = createButton("Show Glossary", {
    variant: "secondary",
    onClick: onShowGlossary,
  });

  const translateBtn = createButton("Translate", {
    variant: "primary",
    onClick: onTranslate,
  });

  buttons.appendChild(glossaryBtn);
  buttons.appendChild(translateBtn);

  body.appendChild(buttons);

  const footer = document.createElement("div");
  footer.className = "footer-row";

  const hint = document.createElement("span");
  hint.className = "text-small text-muted";
  hint.textContent = "Config from options page; overrides apply only to this tab.";

  const optionsButton = createButton("Options", {
    variant: "ghost",
    onClick: onOpenOptions,
  });

  footer.appendChild(hint);
  footer.appendChild(optionsButton);

  body.appendChild(footer);

  root.appendChild(section);
}

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

export function renderIdleUnsupportedView(
  root,
  {
    config,
    popupError,
    skipGlossary,
    onOpenOptions,
    onTranslate,
    onShowGlossary,
    onShowPreview,
    onToggleSkipGlossary,
  },
) {
  clearElement(root);

  const { section, body } = createSection("Translate this page");

  const warning = createNotice(
    "warning",
    "This site is not fully supported. Text extraction may fail or miss content.",
  );
  body.appendChild(warning);

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
      onToggleSkipGlossary,
    );
    body.appendChild(checkboxRow);
  }

  if (popupError) {
    const errNotice = createNotice("error", popupError);
    body.appendChild(errNotice);
  }

  const buttonsTop = document.createElement("div");
  buttonsTop.className = "button-row";

  const previewBtn = createButton("Display Preview", {
    variant: "secondary",
    onClick: onShowPreview,
  });

  buttonsTop.appendChild(previewBtn);
  body.appendChild(buttonsTop);

  const buttonsBottom = document.createElement("div");
  buttonsBottom.className = "button-row";

  const glossaryBtn = createButton("Show Glossary", {
    variant: "secondary",
    onClick: onShowGlossary,
  });

  const translateBtn = createButton("Translate", {
    variant: "primary",
    onClick: onTranslate,
  });

  buttonsBottom.appendChild(glossaryBtn);
  buttonsBottom.appendChild(translateBtn);

  body.appendChild(buttonsBottom);

  const footer = document.createElement("div");
  footer.className = "footer-row";

  const hint = document.createElement("span");
  hint.className = "text-small text-muted";
  hint.textContent = "Check preview once; later chapters will likely behave similarly.";

  const optionsButton = createButton("Options", {
    variant: "ghost",
    onClick: onOpenOptions,
  });

  footer.appendChild(hint);
  footer.appendChild(optionsButton);

  body.appendChild(footer);

  root.appendChild(section);
}

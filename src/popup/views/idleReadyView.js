import {
  clearElement,
  createSection,
  createButton,
  createRow,
  createCheckboxRow,
  createNotice,
} from "../ui/dom.js";
import { LANGS } from "../../common/languages.js";

function createLangSelect(selectedValue, onChange) {
  const select = document.createElement("select");
  select.className = "lang-select";

  Object.entries(LANGS).forEach(([code, name]) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = name;
    if (code === selectedValue) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  select.addEventListener("change", (e) => {
    onChange?.(e.target.value);
  });

  return select;
}

export function renderIdleReadyView(
  root,
  {
    config,
    popupError,
    skipGlossary,
    selectedSourceLang,
    selectedTargetLang,
    onOpenOptions,
    onTranslate,
    onShowGlossary,
    onToggleSkipGlossary,
    onSourceLangChange,
    onTargetLangChange,
  }
) {
  clearElement(root);

  const { section, body } = createSection("Translate this page");

  const srcSelect = createLangSelect(
    selectedSourceLang || config?.sourceLang || "ja",
    onSourceLangChange
  );
  const tgtSelect = createLangSelect(
    selectedTargetLang || config?.targetLang || "en",
    onTargetLangChange
  );

  body.appendChild(createRow("Source language", srcSelect));
  body.appendChild(createRow("Target language", tgtSelect));

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

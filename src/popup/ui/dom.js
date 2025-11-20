export function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export function createSection(title, subtitle) {
  const section = document.createElement("section");
  section.className = "section";

  const header = document.createElement("div");
  header.className = "section-header";

  const titleEl = document.createElement("h2");
  titleEl.className = "section-title";
  titleEl.textContent = title;

  header.appendChild(titleEl);

  if (subtitle) {
    const subtitleEl = document.createElement("p");
    subtitleEl.className = "section-subtitle";
    subtitleEl.textContent = subtitle;
    header.appendChild(subtitleEl);
  }

  section.appendChild(header);

  const body = document.createElement("div");
  body.className = "section-body";
  section.appendChild(body);

  return { section, body };
}

export function createButton(label, { variant = "primary", full = false, onClick } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn ${
    variant === "primary"
    ? "btn-primary"
    : variant === "secondary"
      ? "btn-secondary"
      : "btn-ghost"
  } ${full ? "btn-full" : ""}`;
  btn.textContent = label;
  if (onClick) {
    btn.addEventListener("click", onClick);
  }
  return btn;
}

export function createRow(label, value) {
  const row = document.createElement("div");
  row.className = "row";

  const labelEl = document.createElement("div");
  labelEl.className = "row-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("div");
  valueEl.className = "row-value";
  if (value instanceof Node) {
    valueEl.appendChild(value);
  } else {
    valueEl.textContent = String(value);
  }

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

export function createCheckboxRow(id, labelText, checked, onChange) {
  const row = document.createElement("label");
  row.className = "checkbox-row";
  row.htmlFor = id;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = !!checked;

  const label = document.createElement("span");
  label.textContent = labelText;

  input.addEventListener("change", () => {
    onChange?.(input.checked);
  });

  row.appendChild(input);
  row.appendChild(label);

  return { row, input };
}

export function createNotice(kind, text) {
  const div = document.createElement("div");
  div.className =
    "notice " +
    (kind === "warning"
     ? "notice-warning"
     : kind === "error"
       ? "notice-error"
       : "notice-muted");
  div.textContent = text;
  return div;
}

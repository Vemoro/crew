for (const picker of document.querySelectorAll('.file-picker')) {
  const input = picker.querySelector<HTMLInputElement>('input[type="file"]');
  const controls = picker.querySelector<HTMLElement>('.file-picker-control');
  const button = controls?.querySelector('button');
  const title = button?.querySelector('span');
  const name = controls?.querySelector('[role="status"]');
  if (!input || !controls || !button || !title || !name) continue;

  const fieldId = input.id;
  const restoreFocus = document.activeElement === input || input.autofocus;
  input.id = `${fieldId}-native`;
  button.id = fieldId;
  button.setAttribute('aria-labelledby', `${fieldId}-label ${fieldId}-choose`);
  for (const attribute of ['aria-describedby', 'aria-invalid']) {
    const value = input.getAttribute(attribute);
    if (value) button.setAttribute(attribute, value);
  }
  const showFilename = () => {
    const file = input.files?.[0];
    name.textContent = file?.name ?? 'Keine Datei ausgewählt';
    title.textContent = file ? 'Andere Datei wählen' : 'Datei wählen';
  };
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', showFilename);
  showFilename();
  controls.hidden = false;
  input.hidden = true;
  if (restoreFocus) button.focus();
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open-dialog]")) {
  const dialog = document.getElementById(button.dataset.openDialog ?? '');
  if (!(dialog instanceof HTMLDialogElement)) continue;
  button.addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("close", () => button.focus());
}

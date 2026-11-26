for (const button of document.querySelectorAll("[data-open-dialog]")) {
  const dialog = document.getElementById(button.dataset.openDialog);
  button.addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("close", () => button.focus());
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open-dialog]")) {
  const dialog = document.getElementById(button.dataset.openDialog ?? '');
  if (!(dialog instanceof HTMLDialogElement)) continue;
  button.addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("close", () => button.focus());
}

const mobileMenu = document.querySelector<HTMLDetailsElement>('.mobile-nav');
const trigger = mobileMenu?.querySelector('summary');
const navigationLinks = document.querySelectorAll<HTMLAnchorElement>('header nav a');

function markCurrentSection() {
  for (const link of navigationLinks) {
    if (link.href === location.href) link.setAttribute('aria-current', link.hash ? 'location' : 'page');
    else link.removeAttribute('aria-current');
  }
}

window.addEventListener('hashchange', markCurrentSection);
window.addEventListener('popstate', markCurrentSection);
markCurrentSection();

mobileMenu?.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !mobileMenu.open) return;
  event.preventDefault();
  mobileMenu.open = false;
  trigger?.focus();
});
mobileMenu?.addEventListener('click', event => {
  const link = event.target instanceof Element ? event.target.closest('a') : undefined;
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const destination = new URL(link.href);
  if (destination.origin !== location.origin || destination.pathname !== location.pathname || !destination.hash) return;
  const target = document.getElementById(destination.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  if (destination.hash !== location.hash) history.pushState(null, '', destination);
  markCurrentSection();
  mobileMenu.open = false;
  document.querySelector('main')?.focus({ preventScroll: true });
  target.scrollIntoView();
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open-dialog]")) {
  const dialog = document.getElementById(button.dataset.openDialog ?? '');
  if (!(dialog instanceof HTMLDialogElement)) continue;
  button.addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("close", () => button.focus());
}

const mobileMenu = document.querySelector<HTMLDetailsElement>('.mobile-nav');
const trigger = mobileMenu?.querySelector('summary');
const navigationLinks = document.querySelectorAll<HTMLAnchorElement>('header nav a');
let lastMobileLink: HTMLAnchorElement | undefined;

mobileMenu?.addEventListener('focusin', event => {
  lastMobileLink = event.target instanceof HTMLAnchorElement ? event.target : undefined;
});
matchMedia('(max-width: 35rem)').addEventListener('change', event => {
  if (event.matches || !mobileMenu?.open) return;
  const focusInMenu = mobileMenu.contains(document.activeElement) || document.activeElement === document.body;
  mobileMenu.open = false;
  if (!focusInMenu) return;
  const desktopLinks = [...document.querySelectorAll<HTMLAnchorElement>('.desktop-nav a')];
  const target = desktopLinks.find(link => link.href === lastMobileLink?.href)
    ?? desktopLinks.find(link => link.hasAttribute('aria-current')) ?? desktopLinks[0];
  target?.focus();
});

function markCurrentSection() {
  for (const link of navigationLinks) {
    const samePage = link.origin === location.origin && link.pathname === location.pathname;
    if (samePage && (!link.hash || link.hash === location.hash)) link.setAttribute('aria-current', link.hash ? 'location' : 'page');
    else link.removeAttribute('aria-current');
  }
}

window.addEventListener('hashchange', markCurrentSection);
window.addEventListener('popstate', markCurrentSection);
markCurrentSection();

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !mobileMenu?.open || document.querySelector('dialog[open]')) return;
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
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView();
});

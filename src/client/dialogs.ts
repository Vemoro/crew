import './file-picker';

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open-dialog]")) {
  const dialog = document.getElementById(button.dataset.openDialog ?? '');
  if (!(dialog instanceof HTMLDialogElement)) continue;
  button.addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("close", () => button.focus());
}

const mobileMenu = document.querySelector<HTMLDetailsElement>('.mobile-nav');
const trigger = mobileMenu?.querySelector('summary');
const navigationLinks = [...document.querySelectorAll<HTMLAnchorElement>('.sidebar nav a')];
const desktopPanel = document.querySelector('.desktop-nav');
let lastFocused = document.activeElement;

document.addEventListener('focusin', event => {
  if (event.target instanceof Element) lastFocused = event.target;
});
matchMedia('(max-width: 44rem)').addEventListener('change', event => {
  const focused = document.activeElement === document.body ? lastFocused : document.activeElement;
  if (event.matches) {
    if (desktopPanel?.contains(focused)) trigger?.focus();
    return;
  }
  if (!mobileMenu) return;
  mobileMenu.open = false;
  if (!mobileMenu.contains(focused)) return;
  if (focused?.matches('.sign-out button')) {
    desktopPanel?.querySelector<HTMLButtonElement>('.sign-out button')?.focus();
    return;
  }
  const href = focused instanceof HTMLAnchorElement ? focused.href : undefined;
  const desktopLinks = navigationLinks.filter(link => desktopPanel?.contains(link));
  const target = desktopLinks.find(link => link.href === href)
    ?? desktopLinks.find(link => link.hasAttribute('aria-current')) ?? desktopLinks[0];
  target?.focus();
});

function markCurrentSection() {
  const target = document.getElementById(location.hash.slice(1));
  const section = target?.closest('section[id]');
  const fragment = section ? `#${section.id}` : location.hash;
  const hasCurrentSection = navigationLinks.some(link => link.pathname === location.pathname && link.hash && link.hash === fragment);
  for (const link of navigationLinks) {
    const samePage = link.origin === location.origin && link.pathname === location.pathname;
    const current = link.hash ? link.hash === fragment : !link.hasAttribute('data-overview') || !hasCurrentSection;
    if (samePage && current) link.setAttribute('aria-current', link.hash ? 'location' : 'page');
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

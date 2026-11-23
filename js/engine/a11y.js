const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ');

const LIVE_REGION_SELECTORS = [
  '#live-region',
  '#a11y-announcer',
  '[data-a11y-announcer]',
  '#live-announcer'
];

const modalStack = [];
let backgroundSnapshots = [];
let listenersAttached = false;
let announceTimerId = null;
let clearAnnounceTimerId = null;

function getDocument() {
  return typeof globalThis.document !== 'undefined' ? globalThis.document : null;
}

function getWindow() {
  return typeof globalThis.window !== 'undefined' ? globalThis.window : null;
}

function isHiddenOrInertAncestor(el, boundaryEl) {
  let cursor = el;
  while (cursor && cursor !== boundaryEl) {
    if (
      (typeof cursor.hasAttribute === 'function' &&
        (cursor.hasAttribute('hidden') || cursor.hasAttribute('inert'))) ||
      cursor.hidden === true ||
      cursor.inert === true ||
      (cursor !== boundaryEl &&
        typeof cursor.getAttribute === 'function' &&
        cursor.getAttribute('aria-hidden') === 'true')
    ) {
      return true;
    }
    cursor = cursor.parentElement || null;
  }
  return false;
}

function isElementFocusableCandidate(el) {
  return Boolean(el && typeof el.focus === 'function');
}

export function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== 'function') {
    return [];
  }
  const win = container.ownerDocument?.defaultView || getWindow();
  const candidates = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));

  return candidates.filter((el) => {
    if (!isElementFocusableCandidate(el)) {
      return false;
    }
    if (el.disabled === true || (typeof el.hasAttribute === 'function' && el.hasAttribute('disabled'))) {
      return false;
    }
    if (isHiddenOrInertAncestor(el, container)) {
      return false;
    }
    if (win && typeof win.getComputedStyle === 'function') {
      const computed = win.getComputedStyle(el);
      if (computed && (computed.display === 'none' || computed.visibility === 'hidden')) {
        return false;
      }
    }
    return true;
  });
}

function isLiveOrNonVisualElement(el) {
  if (!el || typeof el.tagName !== 'string') {
    return true;
  }
  const tag = el.tagName.toUpperCase();
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE') {
    return true;
  }
  if (
    el.id === 'live-region' ||
    el.id === 'a11y-announcer' ||
    el.id === 'live-announcer' ||
    (typeof el.hasAttribute === 'function' &&
      (el.hasAttribute('aria-live') || el.hasAttribute('data-a11y-announcer')))
  ) {
    return true;
  }
  if (typeof el.querySelector === 'function' && el.querySelector('[aria-live]')) {
    return true;
  }
  return false;
}

function focusFirstInModal(modalEl) {
  const focusables = getFocusableElements(modalEl);
  const preferred = focusables.find(
    (el) =>
      typeof el.hasAttribute === 'function' &&
      (el.hasAttribute('data-autofocus') || el.hasAttribute('autofocus'))
  );
  const target = preferred || focusables[0] || modalEl;
  if (isElementFocusableCandidate(target)) {
    target.focus({ preventScroll: false });
  }
}

function handleDocumentKeyDown(event) {
  const topEntry = modalStack[modalStack.length - 1];
  if (!topEntry) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    if (typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    closeModal(topEntry.modalEl);
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const doc = getDocument();
  const focusables = getFocusableElements(topEntry.modalEl);
  if (focusables.length === 0) {
    event.preventDefault();
    if (isElementFocusableCandidate(topEntry.modalEl)) {
      topEntry.modalEl.focus();
    }
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = doc ? doc.activeElement : null;
  const insideModal = Boolean(
    active && typeof topEntry.modalEl.contains === 'function' && topEntry.modalEl.contains(active)
  );

  if (event.shiftKey) {
    if (!insideModal || active === first || active === topEntry.modalEl) {
      event.preventDefault();
      last.focus();
    }
  } else if (!insideModal || active === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleDocumentFocusIn(event) {
  const topEntry = modalStack[modalStack.length - 1];
  if (!topEntry) {
    return;
  }
  if (typeof topEntry.modalEl.contains === 'function' && !topEntry.modalEl.contains(event.target)) {
    focusFirstInModal(topEntry.modalEl);
  }
}

function attachModalListeners(doc) {
  if (listenersAttached || !doc || typeof doc.addEventListener !== 'function') {
    return;
  }
  doc.addEventListener('keydown', handleDocumentKeyDown);
  doc.addEventListener('focusin', handleDocumentFocusIn);
  listenersAttached = true;
}

function detachModalListeners(doc) {
  if (!listenersAttached || !doc || typeof doc.removeEventListener !== 'function') {
    return;
  }
  doc.removeEventListener('keydown', handleDocumentKeyDown);
  doc.removeEventListener('focusin', handleDocumentFocusIn);
  listenersAttached = false;
}

function isolateBackground(doc, modalEl) {
  if (doc.documentElement?.classList) {
    doc.documentElement.classList.add('modal-open');
  }
  if (doc.body?.classList) {
    doc.body.classList.add('modal-open');
  }
  if (!doc.body || !doc.body.children) {
    return;
  }
  backgroundSnapshots = [];
  for (const child of Array.from(doc.body.children)) {
    if (child === modalEl) {
      continue;
    }
    if (typeof child.contains === 'function' && child.contains(modalEl)) {
      continue;
    }
    if (isLiveOrNonVisualElement(child)) {
      continue;
    }
    backgroundSnapshots.push({
      el: child,
      prevAriaHidden: typeof child.getAttribute === 'function' ? child.getAttribute('aria-hidden') : null,
      prevInert: Boolean(child.inert)
    });
    if (typeof child.setAttribute === 'function') {
      child.setAttribute('aria-hidden', 'true');
    }
    child.inert = true;
  }
}

function restoreBackground(doc) {
  for (const snap of backgroundSnapshots) {
    if (snap.prevAriaHidden === null) {
      if (typeof snap.el.removeAttribute === 'function') {
        snap.el.removeAttribute('aria-hidden');
      }
    } else if (typeof snap.el.setAttribute === 'function') {
      snap.el.setAttribute('aria-hidden', snap.prevAriaHidden);
    }
    snap.el.inert = snap.prevInert;
  }
  backgroundSnapshots = [];
  if (doc.documentElement?.classList) {
    doc.documentElement.classList.remove('modal-open');
  }
  if (doc.body?.classList) {
    doc.body.classList.remove('modal-open');
  }
}

function showModalElement(modalEl) {
  modalEl.hidden = false;
  if (typeof modalEl.removeAttribute === 'function') {
    modalEl.removeAttribute('hidden');
  }
  if (typeof modalEl.setAttribute === 'function') {
    modalEl.setAttribute('aria-hidden', 'false');
    modalEl.setAttribute('aria-modal', 'true');
    if (typeof modalEl.hasAttribute === 'function' && !modalEl.hasAttribute('tabindex')) {
      modalEl.setAttribute('tabindex', '-1');
    }
    if (modalEl.tagName === 'DIALOG' && !modalEl.hasAttribute('open')) {
      modalEl.setAttribute('open', '');
    }
  }
  modalEl.inert = false;
  if (modalEl.classList) {
    modalEl.classList.add('is-open');
  }
}

function hideModalElement(modalEl) {
  if (modalEl.classList) {
    modalEl.classList.remove('is-open');
  }
  if (typeof modalEl.setAttribute === 'function') {
    modalEl.setAttribute('aria-hidden', 'true');
  }
  modalEl.hidden = true;
  if (modalEl.tagName === 'DIALOG' && typeof modalEl.removeAttribute === 'function') {
    modalEl.removeAttribute('open');
  }
}

function canRestoreFocusTo(el) {
  if (!el || !isElementFocusableCandidate(el)) {
    return false;
  }
  if (el.isConnected === false || el.disabled === true) {
    return false;
  }
  if (typeof el.closest === 'function' && el.closest('[hidden], [inert], [aria-hidden="true"]')) {
    return false;
  }
  return true;
}

export function focusMainContent(selector = '#main-content') {
  const doc = getDocument();
  if (!doc || typeof doc.querySelector !== 'function') {
    return false;
  }
  const mainEl = doc.querySelector(selector);
  if (!mainEl) {
    return false;
  }
  if (typeof mainEl.hasAttribute === 'function' && !mainEl.hasAttribute('tabindex')) {
    mainEl.setAttribute('tabindex', '-1');
  }
  if (isElementFocusableCandidate(mainEl)) {
    mainEl.focus();
    return true;
  }
  return false;
}

export function openModal(modalEl, triggerEl = null, onClose = null) {
  const doc = getDocument();
  if (!modalEl || !doc) {
    return false;
  }

  const existingIndex = modalStack.findIndex((entry) => entry.modalEl === modalEl);
  if (existingIndex !== -1) {
    const existing = modalStack[existingIndex];
    if (typeof onClose === 'function') {
      existing.onClose = onClose;
    }
    if (existingIndex !== modalStack.length - 1) {
      const prevTop = modalStack[modalStack.length - 1];
      if (prevTop && prevTop.modalEl !== modalEl) {
        if (typeof prevTop.modalEl.setAttribute === 'function') {
          prevTop.modalEl.setAttribute('aria-hidden', 'true');
        }
        prevTop.modalEl.inert = true;
      }
      modalStack.splice(existingIndex, 1);
      modalStack.push(existing);
    }
    showModalElement(modalEl);
    focusFirstInModal(modalEl);
    return true;
  }

  const activeEl = doc.activeElement;
  const resolvedTrigger = triggerEl && triggerEl.nodeType === 1
    ? triggerEl
    : (activeEl && activeEl.nodeType === 1 && !(typeof modalEl.contains === 'function' && modalEl.contains(activeEl))
      ? activeEl
      : null);

  if (modalStack.length === 0) {
    isolateBackground(doc, modalEl);
    attachModalListeners(doc);
  } else {
    const prevTop = modalStack[modalStack.length - 1];
    if (prevTop && !(typeof prevTop.modalEl.contains === 'function' && prevTop.modalEl.contains(modalEl))) {
      if (typeof prevTop.modalEl.setAttribute === 'function') {
        prevTop.modalEl.setAttribute('aria-hidden', 'true');
      }
      prevTop.modalEl.inert = true;
    }
  }

  showModalElement(modalEl);
  modalStack.push({
    modalEl,
    triggerEl: resolvedTrigger,
    onClose: typeof onClose === 'function' ? onClose : null
  });
  focusFirstInModal(modalEl);
  return true;
}

export function closeModal(modalEl = null, options = {}) {
  const doc = getDocument();
  if (!doc) {
    return false;
  }

  const restoreFocus = options.restoreFocus !== false;
  const invokeOnClose = options.invokeOnClose !== false;
  const targetModal = modalEl ?? modalStack[modalStack.length - 1]?.modalEl ?? null;

  if (!targetModal) {
    return false;
  }

  const index = modalStack.findIndex((entry) => entry.modalEl === targetModal);
  if (index === -1) {
    hideModalElement(targetModal);
    return false;
  }

  while (modalStack.length - 1 > index) {
    const upper = modalStack[modalStack.length - 1];
    closeModal(upper.modalEl, { restoreFocus: false, invokeOnClose });
  }

  const [entry] = modalStack.splice(index, 1);
  hideModalElement(entry.modalEl);

  if (modalStack.length === 0) {
    restoreBackground(doc);
    detachModalListeners(doc);
  } else {
    const parentEntry = modalStack[modalStack.length - 1];
    if (typeof parentEntry.modalEl.setAttribute === 'function') {
      parentEntry.modalEl.setAttribute('aria-hidden', 'false');
    }
    parentEntry.modalEl.inert = false;
  }

  try {
    if (invokeOnClose && typeof entry.onClose === 'function') {
      entry.onClose(entry.modalEl);
    }
  } finally {
    if (restoreFocus) {
      if (canRestoreFocusTo(entry.triggerEl)) {
        entry.triggerEl.focus();
      } else if (modalStack.length > 0) {
        focusFirstInModal(modalStack[modalStack.length - 1].modalEl);
      } else {
        focusMainContent('#main-content');
      }
    }
  }

  return true;
}

export function closeAllModals(options = { restoreFocus: false }) {
  while (modalStack.length > 0) {
    const top = modalStack[modalStack.length - 1];
    closeModal(top.modalEl, options);
  }
}

export function getActiveModal() {
  return modalStack.length > 0 ? modalStack[modalStack.length - 1].modalEl : null;
}

export function isModalOpen(modalEl) {
  if (!modalEl) {
    return modalStack.length > 0;
  }
  return modalStack.some((entry) => entry.modalEl === modalEl);
}

function getOrCreateLiveRegion(doc) {
  for (const selector of LIVE_REGION_SELECTORS) {
    if (typeof doc.querySelector === 'function') {
      const existing = doc.querySelector(selector);
      if (existing) {
        return existing;
      }
    }
  }
  if (typeof doc.createElement !== 'function' || !doc.body) {
    return null;
  }
  const region = doc.createElement('div');
  region.id = 'a11y-announcer';
  region.className = 'sr-only';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  doc.body.appendChild(region);
  return region;
}

export function announce(message, options = {}) {
  const doc = getDocument();
  const text = String(message ?? '').trim();
  if (!doc || !text) {
    return;
  }

  const priority = options.priority === 'assertive' ? 'assertive' : 'polite';
  const delayMs = typeof options.delayMs === 'number' && Number.isFinite(options.delayMs) && options.delayMs >= 0
    ? options.delayMs
    : 30;
  const clearAfterMs = typeof options.clearAfterMs === 'number' && Number.isFinite(options.clearAfterMs) && options.clearAfterMs > 0
    ? options.clearAfterMs
    : 0;

  const region = getOrCreateLiveRegion(doc);
  if (!region) {
    return;
  }

  if (typeof region.setAttribute === 'function') {
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
  }

  if (announceTimerId !== null) {
    clearTimeout(announceTimerId);
    announceTimerId = null;
  }
  if (clearAnnounceTimerId !== null) {
    clearTimeout(clearAnnounceTimerId);
    clearAnnounceTimerId = null;
  }

  region.textContent = '';

  const applyAnnouncement = () => {
    region.textContent = text;
    if (clearAfterMs > 0) {
      clearAnnounceTimerId = setTimeout(() => {
        region.textContent = '';
        clearAnnounceTimerId = null;
      }, clearAfterMs);
    }
  };

  if (delayMs === 0) {
    applyAnnouncement();
  } else {
    announceTimerId = setTimeout(() => {
      announceTimerId = null;
      applyAnnouncement();
    }, delayMs);
  }
}

export function prefersReducedMotion() {
  const win = getWindow();
  if (!win || typeof win.matchMedia !== 'function') {
    return false;
  }
  return Boolean(win.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export function syncReducedMotion(settingEnabled) {
  const effective = Boolean(settingEnabled) || prefersReducedMotion();
  const doc = getDocument();
  if (doc && doc.documentElement) {
    if (typeof doc.documentElement.setAttribute === 'function') {
      doc.documentElement.setAttribute('data-reduced-motion', effective ? 'true' : 'false');
    }
    if (doc.documentElement.classList) {
      doc.documentElement.classList.toggle('reduced-motion', effective);
    }
  }
  return effective;
}

export function subscribeReducedMotion(onChange) {
  if (typeof onChange !== 'function') {
    return () => {};
  }
  const win = getWindow();
  if (!win || typeof win.matchMedia !== 'function') {
    return () => {};
  }
  const mediaQuery = win.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (event) => {
    onChange(Boolean(event?.matches));
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }
  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }
  return () => {};
}

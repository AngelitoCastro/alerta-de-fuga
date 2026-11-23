import { openModal, closeModal } from '../engine/a11y.js';

function createEl(doc, tag, className = '', text = '') {
  const el = doc.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== '') {
    el.textContent = text;
  }
  return el;
}

function normalizeQuery(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function createGlossaryDrawer({ container, loadGlossary }) {
  if (!container) {
    return {
      open() {},
      close() {},
      destroy() {}
    };
  }

  const doc = container.ownerDocument || globalThis.document;
  const cleanups = [];
  let terms = [];
  let loadError = null;
  let loading = false;
  let searchQuery = '';
  let highlightedTermId = null;

  let listEl = null;
  let countEl = null;
  let searchInput = null;
  let shellMounted = false;

  function listen(el, type, handler) {
    el.addEventListener(type, handler);
    cleanups.push(() => el.removeEventListener(type, handler));
  }

  function renderTermsList() {
    if (!listEl || !countEl) {
      return;
    }
    listEl.replaceChildren();

    if (loading) {
      countEl.textContent = 'Cargando términos del glosario...';
      return;
    }

    if (loadError) {
      countEl.textContent = 'No se pudo cargar el glosario.';
      const errItem = createEl(
        doc,
        'li',
        'alert alert--danger',
        'Error al cargar data/glossary.json. Verifica que estés ejecutando el sitio desde un servidor HTTP local.'
      );
      listEl.appendChild(errItem);
      return;
    }

    const q = normalizeQuery(searchQuery);
    const filtered = q
      ? terms.filter((entry) => {
        const haystack = normalizeQuery(
          `${entry.id} ${entry.term} ${entry.definition} ${entry.analogy} ${entry.analogyLimit}`
        );
        return haystack.includes(q);
      })
      : terms;

    countEl.textContent =
      filtered.length === terms.length
        ? `Mostrando ${terms.length} términos de criptografía y seguridad.`
        : `Mostrando ${filtered.length} de ${terms.length} términos.`;

    if (filtered.length === 0) {
      const emptyItem = createEl(
        doc,
        'li',
        'alert alert--info',
        `No se encontraron términos que coincidan con «${searchQuery}». Prueba con otra palabra como TLS, HSTS, Argon2id o AES-GCM.`
      );
      listEl.appendChild(emptyItem);
      return;
    }

    let highlightedNode = null;
    for (const entry of filtered) {
      const isHighlighted = Boolean(highlightedTermId && entry.id === highlightedTermId);
      const li = createEl(doc, 'li', `glossary-item${isHighlighted ? ' is-highlighted' : ''}`);
      li.setAttribute('data-term-id', entry.id);

      const heading = createEl(doc, 'h3', 'glossary-term', entry.term);
      const def = createEl(doc, 'p', '', entry.definition);
      const analogy = createEl(doc, 'p', 'glossary-analogy', `Analogía cotidiana: ${entry.analogy}`);
      const limit = createEl(
        doc,
        'div',
        'analogy-limit',
        `Límite de la analogía: ${entry.analogyLimit}`
      );
      const ref = createEl(
        doc,
        'p',
        'text-muted',
        `Relacionado con Nivel ${entry.relatedLevel} (reto ${entry.relatedChallengeId}).`
      );

      li.append(heading, def, analogy, limit, ref);
      listEl.appendChild(li);

      if (isHighlighted) {
        highlightedNode = li;
      }
    }

    if (highlightedNode && typeof highlightedNode.scrollIntoView === 'function') {
      highlightedNode.scrollIntoView({ block: 'nearest' });
    }
  }

  function ensureShell() {
    if (shellMounted) {
      return;
    }
    shellMounted = true;

    const panel = createEl(doc, 'div', 'drawer-panel');
    const header = createEl(doc, 'div', 'drawer-header');
    const title = createEl(doc, 'h2', 'modal-title', 'Glosario criptográfico');
    title.id = 'glossary-drawer-title';
    container.setAttribute('aria-labelledby', 'glossary-drawer-title');

    const closeBtn = createEl(doc, 'button', 'btn btn--ghost modal-close', 'Cerrar');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Cerrar glosario');
    header.append(title, closeBtn);

    const body = createEl(doc, 'div', 'drawer-body');
    const controls = createEl(doc, 'div', 'glossary-controls');
    const label = createEl(doc, 'label', '', 'Buscar término o concepto');
    label.setAttribute('for', 'glossary-search-input');

    searchInput = createEl(doc, 'input', 'glossary-search-input');
    searchInput.id = 'glossary-search-input';
    searchInput.type = 'search';
    searchInput.setAttribute('placeholder', 'Ejemplo: TLS, HSTS, Argon2id, AES-GCM, RSA-OAEP...');
    searchInput.setAttribute('data-autofocus', '');

    countEl = createEl(doc, 'p', 'text-muted', '');
    controls.append(label, searchInput, countEl);

    listEl = createEl(doc, 'ul', 'glossary-list');
    body.append(controls, listEl);
    panel.append(header, body);
    container.replaceChildren(panel);

    const handleClose = () => closeModal(container);
    listen(closeBtn, 'click', handleClose);
    listen(container, 'click', (event) => {
      if (event.target === container) {
        handleClose();
      }
    });
    listen(searchInput, 'input', () => {
      searchQuery = searchInput.value;
      highlightedTermId = null;
      renderTermsList();
    });
  }

  async function ensureLoaded() {
    if (terms.length > 0 || loading) {
      return;
    }
    if (typeof loadGlossary !== 'function') {
      return;
    }
    loading = true;
    loadError = null;
    renderTermsList();
    try {
      const data = await loadGlossary();
      terms = Array.isArray(data?.terms) ? data.terms : [];
    } catch (err) {
      loadError = err;
    } finally {
      loading = false;
      renderTermsList();
    }
  }

  return {
    async open({ triggerEl = null, termId = null } = {}) {
      ensureShell();
      highlightedTermId = termId || null;
      if (termId && searchInput) {
        searchQuery = '';
        searchInput.value = '';
      }
      container.setAttribute('role', 'dialog');
      openModal(container, triggerEl, () => {
        container.removeAttribute('role');
      });
      renderTermsList();
      await ensureLoaded();
      if (termId) {
        highlightedTermId = termId;
        renderTermsList();
      }
    },
    close() {
      closeModal(container);
      container.removeAttribute('role');
    },
    destroy() {
      for (const cleanup of cleanups) {
        cleanup();
      }
      cleanups.length = 0;
      shellMounted = false;
      listEl = null;
      countEl = null;
      searchInput = null;
      container.removeAttribute('role');
      container.replaceChildren();
    }
  };
}

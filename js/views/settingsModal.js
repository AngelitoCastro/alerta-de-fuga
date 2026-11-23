import { openModal, closeModal, announce, syncReducedMotion } from '../engine/a11y.js';

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

export function createSettingsModal({ container, store, onResetComplete }) {
  if (!container || !store) {
    return {
      open() {},
      close() {},
      sync() {},
      destroy() {}
    };
  }

  const doc = container.ownerDocument || globalThis.document;
  const cleanups = [];
  let confirmingReset = false;
  let shellMounted = false;

  let timerToggle = null;
  let motionToggle = null;
  let memNotice = null;
  let confirmBox = null;
  let confirmBtn = null;
  let resetBtn = null;

  function clearListeners() {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  }

  function listen(el, type, handler) {
    el.addEventListener(type, handler);
    cleanups.push(() => el.removeEventListener(type, handler));
  }

  function syncUi() {
    if (!shellMounted) {
      return;
    }
    const state = store.getState();

    const timerOn = Boolean(state.settings.timerEnabled);
    timerToggle.textContent = timerOn ? 'Activado' : 'Desactivado';
    timerToggle.className = `btn toggle-btn ${timerOn ? 'btn--primary' : 'btn--secondary'}`;
    timerToggle.setAttribute('aria-pressed', timerOn ? 'true' : 'false');

    const motionOn = Boolean(state.settings.reducedMotion);
    motionToggle.textContent = motionOn ? 'Activado' : 'Desactivado';
    motionToggle.className = `btn toggle-btn ${motionOn ? 'btn--primary' : 'btn--secondary'}`;
    motionToggle.setAttribute('aria-pressed', motionOn ? 'true' : 'false');

    memNotice.hidden = !store.isMemoryFallback();
    confirmBox.hidden = !confirmingReset;
    if (confirmBtn) {
      confirmBtn.disabled = !confirmingReset;
    }
  }

  function ensureShell() {
    if (shellMounted) {
      return;
    }
    shellMounted = true;

    const dialog = createEl(doc, 'div', 'modal-dialog');
    const header = createEl(doc, 'div', 'modal-header');
    const title = createEl(doc, 'h2', 'modal-title', 'Ajustes de la consola');
    title.id = 'settings-modal-title';
    container.setAttribute('aria-labelledby', 'settings-modal-title');

    const closeBtn = createEl(doc, 'button', 'btn btn--ghost modal-close', 'Cerrar');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Cerrar ajustes');
    header.append(title, closeBtn);

    const body = createEl(doc, 'div', 'modal-body');
    const settingsList = createEl(doc, 'div', 'settings-list');

    // Temporizador opcional
    const timerRow = createEl(doc, 'div', 'toggle-row');
    const timerInfo = createEl(doc, 'div', 'toggle-info');
    timerInfo.append(
      createEl(doc, 'strong', '', 'Temporizador opcional'),
      createEl(
        doc,
        'p',
        'text-muted',
        'Desactivado no penaliza ni altera el rango final. Activado otorga un bono de 0 a 30 puntos por acierto y se pausa al leer la retroalimentación.'
      )
    );
    timerToggle = createEl(doc, 'button', 'btn toggle-btn btn--secondary', 'Desactivado');
    timerToggle.type = 'button';
    timerToggle.setAttribute('aria-label', 'Alternar temporizador opcional');
    timerToggle.setAttribute('data-autofocus', '');
    timerRow.append(timerInfo, timerToggle);

    // Animaciones reducidas
    const motionRow = createEl(doc, 'div', 'toggle-row');
    const motionInfo = createEl(doc, 'div', 'toggle-info');
    motionInfo.append(
      createEl(doc, 'strong', '', 'Animaciones reducidas'),
      createEl(
        doc,
        'p',
        'text-muted',
        'Reduce transiciones y movimiento visual. También se respeta automáticamente la preferencia del sistema (prefers-reduced-motion).'
      )
    );
    motionToggle = createEl(doc, 'button', 'btn toggle-btn btn--secondary', 'Desactivado');
    motionToggle.type = 'button';
    motionToggle.setAttribute('aria-label', 'Alternar animaciones reducidas');
    motionRow.append(motionInfo, motionToggle);

    memNotice = createEl(
      doc,
      'div',
      'alert alert--warning',
      'Almacenamiento local no disponible: tu progreso se guarda solo en memoria durante esta sesión.'
    );
    memNotice.hidden = true;

    // Restablecer progreso con confirmación explícita
    const resetSection = createEl(doc, 'div', 'toggle-row');
    const resetInfo = createEl(doc, 'div', 'toggle-info');
    resetInfo.append(
      createEl(doc, 'strong', '', 'Restablecer progreso'),
      createEl(
        doc,
        'p',
        'text-muted',
        'Borra niveles desbloqueados, puntuaciones y resultados de cuestionarios guardados localmente. Requiere confirmación.'
      )
    );
    resetBtn = createEl(doc, 'button', 'btn btn--danger', 'Restablecer progreso');
    resetBtn.type = 'button';
    resetSection.append(resetInfo, resetBtn);

    confirmBox = createEl(doc, 'div', 'reset-confirm-box');
    confirmBox.setAttribute('role', 'region');
    confirmBox.setAttribute('aria-label', 'Confirmar restablecimiento de progreso');
    confirmBox.hidden = true;
    confirmBox.appendChild(
      createEl(
        doc,
        'p',
        '',
        '¿Confirmas que deseas restablecer todo tu progreso en Alerta de Fuga? Esta acción reinicia niveles y puntajes a su estado inicial.'
      )
    );

    const confirmActions = createEl(doc, 'div', 'hero-actions');
    confirmBtn = createEl(doc, 'button', 'btn btn--danger', 'Confirmar restablecimiento');
    confirmBtn.type = 'button';
    confirmBtn.disabled = true;
    const cancelBtn = createEl(doc, 'button', 'btn btn--secondary', 'Cancelar');
    cancelBtn.type = 'button';
    confirmActions.append(confirmBtn, cancelBtn);
    confirmBox.appendChild(confirmActions);

    settingsList.append(timerRow, motionRow, memNotice, resetSection, confirmBox);
    body.appendChild(settingsList);

    const footer = createEl(doc, 'div', 'modal-footer');
    const doneBtn = createEl(doc, 'button', 'btn btn--secondary', 'Listo');
    doneBtn.type = 'button';
    footer.appendChild(doneBtn);

    dialog.append(header, body, footer);
    container.replaceChildren(dialog);

    const handleClose = () => {
      confirmingReset = false;
      syncUi();
      closeModal(container);
    };

    listen(closeBtn, 'click', handleClose);
    listen(doneBtn, 'click', handleClose);
    listen(container, 'click', (event) => {
      if (event.target === container) {
        handleClose();
      }
    });

    listen(timerToggle, 'click', () => {
      const next = !store.getState().settings.timerEnabled;
      store.updateSettings({ timerEnabled: next });
      announce(next ? 'Temporizador opcional activado.' : 'Temporizador opcional desactivado.');
      syncUi();
    });

    listen(motionToggle, 'click', () => {
      const next = !store.getState().settings.reducedMotion;
      store.updateSettings({ reducedMotion: next });
      syncReducedMotion(next);
      announce(next ? 'Animaciones reducidas activadas.' : 'Animaciones reducidas desactivadas.');
      syncUi();
    });

    listen(resetBtn, 'click', () => {
      confirmingReset = true;
      syncUi();
      confirmBtn.focus();
    });

    listen(cancelBtn, 'click', () => {
      confirmingReset = false;
      syncUi();
      resetBtn.focus();
      announce('Restablecimiento cancelado. Tu progreso se mantiene intacto.');
    });

    listen(confirmBtn, 'click', () => {
      if (!confirmingReset) {
        return;
      }
      confirmingReset = false;
      store.resetProgress({ preserveSettings: true });
      syncUi();
      announce('Progreso restablecido correctamente al estado inicial.');
      closeModal(container);
      if (typeof onResetComplete === 'function') {
        onResetComplete();
      }
    });
  }

  return {
    open(triggerEl = null) {
      ensureShell();
      confirmingReset = false;
      syncUi();
      container.setAttribute('role', 'dialog');
      openModal(container, triggerEl, () => {
        confirmingReset = false;
        syncUi();
        container.removeAttribute('role');
      });
    },
    close() {
      confirmingReset = false;
      syncUi();
      closeModal(container);
      container.removeAttribute('role');
    },
    sync() {
      syncUi();
    },
    destroy() {
      clearListeners();
      confirmingReset = false;
      shellMounted = false;
      container.removeAttribute('role');
      container.replaceChildren();
    }
  };
}

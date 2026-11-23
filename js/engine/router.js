export const ROUTES = Object.freeze({
  INICIO: 'inicio',
  QUIZ_PRE: 'quiz-pre',
  NIVEL_1: 'nivel-1',
  NIVEL_2: 'nivel-2',
  NIVEL_3: 'nivel-3',
  NIVEL_4: 'nivel-4',
  QUIZ_POST: 'quiz-post',
  RESULTADOS: 'resultados'
});

export const VALID_ROUTES = Object.freeze(Object.values(ROUTES));

const VALID_ROUTE_SET = new Set(VALID_ROUTES);

function isLevel4Completed(state) {
  if (!state || typeof state !== 'object') {
    return false;
  }
  const accepted4 = state.levels?.[4]?.acceptedAttempt ?? state.acceptedAttempts?.[4];
  if (accepted4 && accepted4.completed === true && accepted4.failed !== true) {
    return true;
  }
  if (Array.isArray(state.completedLevels) && state.completedLevels.includes(4)) {
    return true;
  }
  return false;
}

export function normalizeRoute(hashOrRoute) {
  if (hashOrRoute === null || hashOrRoute === undefined) {
    return ROUTES.INICIO;
  }
  const cleaned = String(hashOrRoute).trim().replace(/^#\/?/, '').toLowerCase();
  if (cleaned === '') {
    return ROUTES.INICIO;
  }
  return VALID_ROUTE_SET.has(cleaned) ? cleaned : null;
}

export function isRouteUnlocked(route, state) {
  const normalized = normalizeRoute(route);
  if (!normalized) {
    return false;
  }
  if (normalized === ROUTES.INICIO || normalized === ROUTES.QUIZ_PRE) {
    return true;
  }

  if (normalized.startsWith('nivel-')) {
    const levelNumber = Number(normalized.slice('nivel-'.length));
    if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 4) {
      return false;
    }
    const unlockedLevel = Number.isFinite(state?.unlockedLevel) ? state.unlockedLevel : 1;
    return unlockedLevel >= levelNumber;
  }

  if (normalized === ROUTES.QUIZ_POST) {
    return isLevel4Completed(state);
  }

  if (normalized === ROUTES.RESULTADOS) {
    return isLevel4Completed(state) && Boolean(state?.postQuiz?.completed === true);
  }

  return false;
}

export function getHighestUnlockedRoute(state) {
  if (isRouteUnlocked(ROUTES.RESULTADOS, state)) {
    return ROUTES.RESULTADOS;
  }
  if (isRouteUnlocked(ROUTES.QUIZ_POST, state)) {
    return ROUTES.QUIZ_POST;
  }
  const rawUnlocked = Number.isFinite(state?.unlockedLevel) ? state.unlockedLevel : 1;
  const clamped = Math.max(1, Math.min(4, Math.floor(rawUnlocked)));
  if (clamped > 1) {
    return `nivel-${clamped}`;
  }
  const hasStarted = Boolean(
    state?.preQuiz?.completed ||
    state?.preQuiz?.skipped ||
    (state?.levels?.[1]?.attemptsCount ?? 0) > 0
  );
  return hasStarted ? ROUTES.NIVEL_1 : ROUTES.INICIO;
}

export function resolveGuardedRoute(requestedRoute, state, options = {}) {
  const canAccess = typeof options.canAccess === 'function' ? options.canAccess : isRouteUnlocked;
  const fallback = options.fallback === 'highest' ? 'highest' : 'inicio';

  const normalized = normalizeRoute(requestedRoute);
  if (normalized === null) {
    return {
      route: ROUTES.INICIO,
      redirectedFrom: requestedRoute,
      reason: 'unknown'
    };
  }

  if (canAccess(normalized, state)) {
    return {
      route: normalized,
      redirectedFrom: null,
      reason: null
    };
  }

  const candidate = fallback === 'highest' ? getHighestUnlockedRoute(state) : ROUTES.INICIO;
  const target = canAccess(candidate, state) ? candidate : ROUTES.INICIO;
  return {
    route: target,
    redirectedFrom: normalized,
    reason: 'locked'
  };
}

function extractCleanup(result) {
  if (typeof result === 'function') {
    return result;
  }
  if (result && typeof result.destroy === 'function') {
    return () => result.destroy();
  }
  return null;
}

export function createRouter(options = {}) {
  const getState = typeof options.getState === 'function'
    ? options.getState
    : () => ({ unlockedLevel: 1 });
  const canAccess = typeof options.canAccess === 'function'
    ? options.canAccess
    : isRouteUnlocked;
  const fallbackMode = options.fallbackMode === 'highest' ? 'highest' : 'inicio';
  const onRouteChange = typeof options.onRouteChange === 'function'
    ? options.onRouteChange
    : () => undefined;
  const onBlocked = typeof options.onBlocked === 'function' ? options.onBlocked : null;
  const onError = typeof options.onError === 'function' ? options.onError : null;
  const beforeLeave = typeof options.beforeLeave === 'function' ? options.beforeLeave : null;
  const announceRoute = typeof options.announceRoute === 'function' ? options.announceRoute : null;
  const focusTargetSelector = typeof options.focusTargetSelector === 'string' && options.focusTargetSelector.trim()
    ? options.focusTargetSelector
    : '#main-content';
  const win = options.win !== undefined
    ? options.win
    : (typeof globalThis.window !== 'undefined' ? globalThis.window : null);
  const doc = options.doc !== undefined
    ? options.doc
    : (typeof globalThis.document !== 'undefined' ? globalThis.document : null);

  let started = false;
  let currentRoute = null;
  let currentCleanup = null;
  let navigationToken = 0;
  let activeAbortController = null;

  function runCurrentCleanup() {
    const cleanup = currentCleanup;
    currentCleanup = null;
    if (typeof cleanup === 'function') {
      cleanup();
    }
  }

  function syncUrlHash(route, replace = false) {
    if (!win || !win.location) {
      return;
    }
    const targetHash = `#${route}`;
    if (win.location.hash === targetHash) {
      return;
    }
    if (replace && win.history && typeof win.history.replaceState === 'function') {
      win.history.replaceState(null, '', targetHash);
      return;
    }
    win.location.hash = targetHash;
  }

  function finalizeMountFocus(isInitial, route) {
    if (isInitial || !doc || typeof doc.querySelector !== 'function') {
      return;
    }
    const mainEl = doc.querySelector(focusTargetSelector);
    if (!mainEl) {
      return;
    }
    if (typeof mainEl.hasAttribute === 'function' && !mainEl.hasAttribute('tabindex')) {
      mainEl.setAttribute('tabindex', '-1');
    }
    if (typeof mainEl.focus === 'function') {
      mainEl.focus();
    }
    if (announceRoute) {
      announceRoute(route, mainEl);
    }
  }

  function activateRoute(resolved, { isInitial }) {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }

    const token = ++navigationToken;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    activeAbortController = controller;
    const prevRoute = currentRoute;
    currentRoute = resolved.route;

    try {
      if (beforeLeave) {
        beforeLeave();
      }
    } finally {
      runCurrentCleanup();
    }

    const context = {
      route: resolved.route,
      prevRoute,
      isInitial,
      redirectedFrom: resolved.redirectedFrom,
      reason: resolved.reason,
      signal: controller ? controller.signal : undefined,
      isStale: () => token !== navigationToken
    };

    const mountResult = onRouteChange(resolved.route, context);

    if (mountResult && typeof mountResult.then === 'function') {
      mountResult.then(
        (asyncValue) => {
          const cleanup = extractCleanup(asyncValue);
          if (token !== navigationToken) {
            if (cleanup) {
              cleanup();
            }
            return;
          }
          currentCleanup = cleanup;
          finalizeMountFocus(isInitial, resolved.route);
        },
        (err) => {
          if (err?.name === 'AbortError' || token !== navigationToken) {
            return;
          }
          if (onError) {
            onError(err, resolved.route);
          }
        }
      );
    } else {
      if (token === navigationToken) {
        currentCleanup = extractCleanup(mountResult);
        finalizeMountFocus(isInitial, resolved.route);
      } else {
        const staleCleanup = extractCleanup(mountResult);
        if (staleCleanup) {
          staleCleanup();
        }
      }
    }
  }

  function handleHashChange() {
    if (!started) {
      return;
    }
    const rawHash = win?.location?.hash ?? '';
    const resolved = resolveGuardedRoute(rawHash, getState(), {
      canAccess,
      fallback: fallbackMode
    });

    if (resolved.redirectedFrom !== null && onBlocked) {
      onBlocked(resolved.redirectedFrom, resolved.route, resolved.reason);
    }

    syncUrlHash(resolved.route, true);

    if (resolved.route === currentRoute) {
      return;
    }

    activateRoute(resolved, { isInitial: false });
  }

  return {
    start() {
      if (started) {
        return currentRoute;
      }
      started = true;
      if (win && typeof win.addEventListener === 'function') {
        win.addEventListener('hashchange', handleHashChange);
      }
      const initialHash = win?.location?.hash ?? '';
      const resolved = resolveGuardedRoute(initialHash, getState(), {
        canAccess,
        fallback: fallbackMode
      });
      if (resolved.redirectedFrom !== null && onBlocked) {
        onBlocked(resolved.redirectedFrom, resolved.route, resolved.reason);
      }
      syncUrlHash(resolved.route, true);
      activateRoute(resolved, { isInitial: true });
      return currentRoute;
    },

    navigate(route, navOptions = {}) {
      const replace = Boolean(navOptions.replace);
      const force = Boolean(navOptions.force);
      const resolved = resolveGuardedRoute(route, getState(), {
        canAccess,
        fallback: fallbackMode
      });

      if (resolved.redirectedFrom !== null && onBlocked) {
        onBlocked(resolved.redirectedFrom, resolved.route, resolved.reason);
      }

      if (resolved.route === currentRoute && !force) {
        syncUrlHash(resolved.route, true);
        return resolved.route;
      }

      syncUrlHash(resolved.route, replace);
      activateRoute(resolved, { isInitial: false });
      return resolved.route;
    },

    getCurrentRoute() {
      return currentRoute;
    },

    destroy() {
      try {
        if (win && typeof win.removeEventListener === 'function') {
          win.removeEventListener('hashchange', handleHashChange);
        }
        if (activeAbortController) {
          activeAbortController.abort();
          activeAbortController = null;
        }
        navigationToken += 1;
        runCurrentCleanup();
      } finally {
        started = false;
        currentRoute = null;
      }
    }
  };
}

// ==UserScript==
// @name         ChatGPT - ?q= + Extra High + autoenviar
// @namespace    chatgpt.extra-high-autosend
// @version      1.3.3
// @description  ?q= y ?prompt=: detecta el editor data-composer-markdown, selecciona Extra High y envía una vez.
// @homepageURL  https://github.com/alexx-ftw/chatgpt-extra-high-autosend
// @supportURL   https://github.com/alexx-ftw/chatgpt-extra-high-autosend/issues
// @updateURL    https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-extra-high.meta.js
// @downloadURL  https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-extra-high.user.js
// @match        https://chatgpt.com/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// @inject-into  page
// @noframes
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const url = new URL(location.href);
  // q tiene prioridad cuando ambos parámetros contienen texto.
  const QUERY_KEYS = ['q', 'prompt'];
  const prompt = QUERY_KEYS.map(key => url.searchParams.get(key))
    .find(value => value?.trim() && value.trim() !== '%s');
  if (window.top !== window.self || url.pathname !== '/' ||
      !prompt?.trim() || prompt.trim() === '%s') return;

  const VERSION = '1.3.3';
  const RUN_KEY = '__chatgptQExtraHighV1__';
  const previousRun = window[RUN_KEY];
  if (!previousRun) window[RUN_KEY] = VERSION;

  // No borrar estos parámetros al cargar: la aplicación puede necesitarlos
  // para rellenar su editor. Se eliminan únicamente al solicitar el envío.

  const TIMEOUT_MS = 90_000;
  const MENU_TIMEOUT_MS = 8_000;
  const POLL_MS = 100;
  const TARGET_EFFORT = 'max'; // «Extra High» en el HTML facilitado.
  const STATUS_ID = 'cgpt-q-extra-high-v131-status';
  const deadline = Date.now() + TIMEOUT_MS;
  // El editor del HTML aportado NO tiene id="prompt-textarea".
  // Usar su atributo propio evita confundirlo con buscadores u otros editores.
  // Se mantienen los dos selectores antiguos por compatibilidad.
  const EDITOR = '[data-composer-markdown][contenteditable="true"], ' +
    '#prompt-textarea[contenteditable="true"], textarea#prompt-textarea';
  const EFFORT = 'button[data-composer-navigation-target="reasoning"], ' +
    'button[data-codex-intelligence-trigger="true"][data-selected-reasoning-effort]';
  const SEND = 'button[data-testid="send-button"], ' +
    'button[type="submit"][aria-label="Send"], ' +
    'button[type="submit"][aria-label="Send message"], ' +
    'button[type="submit"][aria-label="Enviar"], ' +
    'button[type="submit"][aria-label="Enviar mensaje"]';
  // Marcas de mensaje/actividad observadas en las capturas del usuario,
  // más las antiguas. La misma detección protege y confirma el único envío.
  const ACTIVITY = '[data-user-message-bubble="true"], [data-message-author-role="user"], ' +
    '[data-testid="stop-button"], button[aria-label="Stop generating"], ' +
    'form[data-chatgpt-composer] button[aria-label="Stop"], ' +
    'form[data-chatgpt-composer] button[aria-label="Detener"]';
  const INTERACTIONS = ['keydown', 'pointerdown', 'beforeinput', 'paste', 'drop'];
  let cancelled = '';
  let writing = false;
  let finished = false;
  let phase = 'Inicio';
  const trace = [];
  const record = message => {
    trace.push(new Date().toISOString().slice(11, 19) + ' ' + String(message).slice(0, 700));
    if (trace.length > 60) trace.shift();
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = text => String(text ?? '').replace(/\r\n?/g, '\n').trim();
  const textOf = node => node instanceof HTMLTextAreaElement
    ? node.value : (node?.innerText ?? node?.textContent ?? '');

  // Un párrafo de ProseMirror representa una línea. innerText puede incluir
  // saltos adicionales entre párrafos, así que aceptamos ambas lecturas.
  function matchesPrompt(node) {
    if (!node) return false;
    if (normalize(textOf(node)) === normalize(prompt)) return true;
    if (!node.matches('.ProseMirror')) return false;
    const blocks = [...node.childNodes];
    if (!blocks.length || !blocks.every(child => child.nodeType === 1 &&
        /^(P|DIV|PRE|BLOCKQUOTE|H[1-6])$/.test(child.tagName))) return false;
    const plain = child => {
      if (child.nodeType === 3) return child.textContent;
      if (child.nodeType !== 1) return '';
      if (child.tagName === 'BR') return child.classList.contains('ProseMirror-trailingBreak') ? '' : '\n';
      return [...child.childNodes].map(plain).join('');
    };
    return normalize(blocks.map(plain).join('\n')) === normalize(prompt);
  }
  // Leer el estado de fondo no equivale a interactuar con él. Radix puede
  // ocultarlo a accesibilidad o volverlo inert mientras el menú está abierto.
  const painted = node => !!node?.isConnected && !!node.getClientRects().length &&
    !node.closest('[hidden]') &&
    !['hidden', 'collapse'].includes(getComputedStyle(node).visibility);
  const rendered = node => painted(node) && !node.closest('[inert]');
  const visible = node => rendered(node) && !node.closest('[aria-hidden="true"]');
  const enabled = node => visible(node) && !node.matches(':disabled') &&
    node.getAttribute('aria-disabled') !== 'true' && !node.hasAttribute('data-disabled');
  const first = (selector, root = document) => [...root.querySelectorAll(selector)].find(visible);
  const editor = () => first(EDITOR);
  const effort = () => {
    const exact = [...document.querySelectorAll(EFFORT)].find(painted);
    if (exact) return exact;
    const input = [...document.querySelectorAll(EDITOR)].find(painted);
    const form = input?.closest('form');
    const fallback = 'button[aria-haspopup="menu"][aria-label="Select ChatGPT model"], ' +
      'button[data-testid="model-switcher-dropdown-button"]';
    return (form && [...form.querySelectorAll(fallback)].find(painted)) ||
      [...document.querySelectorAll(fallback)].find(painted);
  };
  const targetLabel = text => /(?:^|[^a-z])extra[\s-]+(?:high|alto)(?:$|[^a-z])/i.test(normalize(text));
  const effortLabel = trigger => normalize(textOf(trigger?.querySelector(
    '[class*="ModelPickerTriggerLabel-"], [data-testid="model-switcher-label"]') || trigger));

  function isExtraHigh() {
    const trigger = effort();
    if (!trigger || trigger.matches(':disabled') || trigger.getAttribute('aria-disabled') === 'true') return false;
    const value = trigger.getAttribute('data-selected-reasoning-effort');
    const label = effortLabel(trigger);
    const targetValue = [TARGET_EFFORT, 'xhigh', 'extra_high'].includes(value);
    if (/\bpro\b/i.test(label)) return false;
    // No enviar mientras etiqueta y atributo se contradigan durante un render.
    if (targetLabel(label)) return !value || targetValue;
    if (/\b(?:instant|light|low|medium|standard|extended|heavy|high|alto|bajo)\b/i.test(label)) return false;
    return targetValue;
  }

  function diagnostic() {
    const input = [...document.querySelectorAll(EDITOR)].find(painted);
    const trigger = effort();
    const power = readPower();
    // No incluye el prompt, mensajes, cookies, tokens ni HTML de la página.
    return [
      'ChatGPT Extra High v' + VERSION,
      'Paso: ' + phase,
      'Otra ejecución previa: ' + Boolean(previousRun),
      'Parámetro: ' + QUERY_KEYS.filter(key => url.searchParams.has(key)).join(', '),
      'URL actual: ' + queryStatus().summary,
      'Editor detectado: ' + Boolean(input),
      'Coincidencias del editor en DOM: ' + document.querySelectorAll(EDITOR).length,
      'Tipo de editor: ' + (input ? (input.tagName.toLowerCase() +
        (input.hasAttribute('data-composer-markdown') ? '[data-composer-markdown]' : '#prompt-textarea')) : '(ninguno)'),
      'Editor interactuable: ' + Boolean(input && enabled(input)),
      'Caracteres en editor: ' + (input ? textOf(input).length : 0),
      'Texto esperado coincide: ' + Boolean(input && matchesPrompt(input)),
      'Selector detectado: ' + Boolean(trigger),
      'Etiqueta selector: ' + effortLabel(trigger).slice(0, 180),
      'Esfuerzo: ' + (trigger?.getAttribute('data-selected-reasoning-effort') || '(sin atributo)'),
      'Menú expandido: ' + trigger?.getAttribute('aria-expanded'),
      'Power: ' + (power ? power.key : '(no detectado)'),
      'Botones Enviar detectados: ' + document.querySelectorAll(SEND).length,
      'Botones Enviar habilitados: ' + [...document.querySelectorAll(SEND)].filter(enabled).length,
      'Menús visibles: ' + menuScopes().length,
      'Mensaje o actividad detectado: ' + Boolean(document.querySelector(ACTIVITY)),
      '--- Registro ---', ...trace
    ].join('\n');
  }

  function notify(message, error = false, removeAfter = 0) {
    record(message);
    if (!document.body) return;
    let box = document.getElementById(STATUS_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = STATUS_ID;
      box.setAttribute('data-version', VERSION);
      box.style.cssText = 'all:initial;position:fixed;right:16px;top:16px;' +
        'z-index:2147483647;max-width:min(440px,calc(100vw - 32px));padding:12px 16px;border-radius:12px;' +
        'background:#202124;color:#fff;font:13px/1.5 system-ui,sans-serif;' +
        'box-shadow:0 4px 20px #0004;pointer-events:auto;white-space:pre-wrap;';
      const title = document.createElement('strong');
      title.textContent = 'Extra High · v' + VERSION;
      title.style.cssText = 'display:block;margin-bottom:6px;font:600 13px system-ui;color:#fff;';
      const status = document.createElement('div');
      status.setAttribute('role', 'status');
      status.setAttribute('data-autosend-message', '');
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = 'Copiar diagnóstico';
      copy.style.cssText = 'all:initial;display:inline-block;margin-top:10px;padding:5px 9px;' +
        'border:1px solid #888;border-radius:6px;color:#fff;background:#34363a;' +
        'font:12px system-ui;cursor:pointer;';
      copy.addEventListener('click', async () => {
        const report = diagnostic();
        try {
          await navigator.clipboard.writeText(report);
          copy.textContent = 'Diagnóstico copiado';
        } catch {
          let area = box.querySelector('textarea');
          if (!area) {
            area = document.createElement('textarea');
            area.readOnly = true;
            area.style.cssText = 'display:block;width:100%;height:150px;margin-top:8px;color:#111;background:#fff;';
            box.append(area);
          }
          area.value = report;
          area.focus();
          area.select();
          copy.textContent = 'Copia el texto seleccionado';
        }
      });
      box.append(title, status, copy);
      document.body.append(box);
    }
    box.style.border = error ? '1px solid #ef8585' : '1px solid #888';
    box.querySelector('[data-autosend-message]').textContent = message;
    // Los errores se mantienen hasta recargar: no desaparecen a los 20 s.
    if (removeAfter && !error) setTimeout(() => box.remove(), removeAfter);
  }

  function onInteraction(event) {
    if (finished || writing || !event.isTrusted ||
        event.target?.closest?.('#' + STATUS_ID)) return;
    // No bloquear el texto. Escape cancela en cualquier sitio; las acciones
    // de edición cancelan únicamente si ocurren dentro del compositor.
    const editing = event.target?.closest?.(EDITOR);
    if (event.type === 'keydown' && event.key === 'Escape') {
      cancelled = 'Cancelado con Escape.';
    } else if (editing && event.type !== 'pointerdown' &&
        !(event.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key))) {
      cancelled = 'Cancelado por edición manual (' + event.type + ').';
    } else if (event.type === 'pointerdown' &&
        event.target?.closest?.('button, [role="menuitem"], [role="menuitemradio"], [role="slider"]')) {
      cancelled = 'Cancelado por interacción manual con los controles.';
    }
    if (cancelled) record(cancelled);
  }
  function onNavigate() { cancelled = 'Has cambiado de página.'; }
  for (const type of INTERACTIONS) document.addEventListener(type, onInteraction, true);
  window.addEventListener('pagehide', onNavigate);
  window.addEventListener('popstate', onNavigate);

  function cleanup() {
    for (const type of INTERACTIONS) document.removeEventListener(type, onInteraction, true);
    window.removeEventListener('pagehide', onNavigate);
    window.removeEventListener('popstate', onNavigate);
  }

  // La URL puede consumirse dejando q vacío o pasando el mismo texto a prompt.
  // Comparar el contenido, no la presencia de cada alias. Nunca volver a
  // decodificar: un '+' o un '%20' literal puede formar parte del mensaje.
  function queryStatus() {
    const currentUrl = new URL(location.href);
    const expected = normalize(prompt);
    const entries = QUERY_KEYS.map(key => ({
      key,
      values: currentUrl.searchParams.getAll(key).map(normalize),
      initial: url.searchParams.getAll(key).map(normalize)
    }));
    // Misma prioridad q > prompt que al iniciar. Un alias secundario antiguo
    // no puede convertirse ahora en la consulta principal de este autoenvío.
    const active = entries.map(entry => entry.values[0])
      .find(value => value && value !== '%s');
    const conflict = Boolean(active && active !== expected) || entries.some(entry =>
      entry.values.some((value, index) => value && value !== expected &&
        value !== entry.initial[index]));
    // Solo estados categóricos. No incluir el texto ni la URL en el registro.
    const summary = entries.map(entry => {
      const states = entry.values.map((value, index) => {
        if (!value) return 'vacío';
        if (value === expected) return 'mismo texto';
        if (value === entry.initial[index]) return 'valor inicial secundario';
        return 'texto distinto';
      });
      return entry.key + '=' + (states.length ? states.join(', ') : 'ausente');
    }).join('; ');
    return { conflict, summary };
  }

  function guard() {
    if (cancelled) throw new Error(cancelled);
    if (location.pathname !== '/') throw new Error('La dirección ha cambiado.');
    const query = queryStatus();
    if (query.conflict) {
      record('Consulta diferente: ' + query.summary);
      throw new Error('La consulta de la dirección ha cambiado.');
    }
    if (document.querySelector(ACTIVITY)) {
      throw new Error('Ya hay una conversación o un envío en curso.');
    }
  }

  async function waitFor(read, message, timeout = TIMEOUT_MS, stableMs = 0) {
    const until = Math.min(deadline, Date.now() + timeout);
    let previous = null;
    let since = 0;
    while (Date.now() < until) {
      guard();
      const value = read();
      if (value) {
        if (value !== previous) { previous = value; since = Date.now(); }
        if (Date.now() - since >= stableMs) return value;
      } else {
        previous = null;
      }
      await sleep(POLL_MS);
    }
    throw new Error(message);
  }

  function menuScopes() {
    const trigger = effort();
    const controlled = document.getElementById(trigger?.getAttribute('aria-controls') || '');
    if (visible(controlled)) return [controlled];
    const menus = [...document.querySelectorAll('[role="menu"], [role="listbox"], ' +
      '[role="dialog"][data-state="open"]')]
      .filter(node => visible(node) && node.getAttribute('data-state') !== 'closed');
    const owned = menus.filter(node => trigger?.id &&
      (node.getAttribute('aria-labelledby') || '').split(/\s+/).includes(trigger.id));
    return owned.length ? owned : menus;
  }

  function findExtraHighOption() {
    const labelMatches = text => /^(?:extra[\s-]+high|extra[\s-]+alto)$/i
      .test(normalize(text).replace(/\s+/g, ' '));
    const candidates = new Set();
    for (const scope of menuScopes()) {
      for (const node of scope.querySelectorAll('[role="menuitemradio"], [role="menuitem"], ' +
          '[role="radio"], [role="option"], button')) {
        if (!enabled(node) || node.matches('[data-model-picker-view-toggle], [data-reasoning-slider]')) continue;
        const byValue = node.getAttribute('data-reasoning-effort') === TARGET_EFFORT ||
          node.getAttribute('data-value') === TARGET_EFFORT;
        const byLabel = labelMatches(node.getAttribute('aria-label')) || labelMatches(textOf(node)) ||
          [...node.querySelectorAll('span, div, p')].some(child => labelMatches(child.textContent));
        if (byValue || byLabel) candidates.add(node);
      }
    }
    return [...candidates].sort((a, b) => a.textContent.length - b.textContent.length)[0];
  }

  function pointerClick(node) {
    for (const type of ['pointerdown', 'pointerup']) {
      node.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
        isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0
      }));
    }
  }

  function pressKey(node, key) {
    node.focus({ preventScroll: true });
    const keyCode = { ArrowLeft: 37, ArrowRight: 39, ArrowDown: 40, Enter: 13, Escape: 27 }[key] || 0;
    for (const type of ['keydown', 'keyup']) {
      node.dispatchEvent(new KeyboardEvent(type, {
        key, code: key, keyCode, which: keyCode,
        bubbles: true, composed: true, cancelable: true, view: window
      }));
    }
  }

  function findPowerSlider() {
    for (const scope of menuScopes()) {
      // La fila es accesible, pero el thumb interno también puede procesar
      // eventos aunque lleve aria-hidden=true. Se conserva para el fallback.
      const row = first('[data-reasoning-slider="true"]', scope);
      if (row) return row;
      const standard = first('[role="slider"]', scope);
      if (standard) return standard;
    }
    return null;
  }

  function readPower() {
    const control = findPowerSlider();
    if (!control) return null;
    const thumb = control.matches('[role="slider"]') ? control : control.querySelector('[role="slider"]');
    const descriptions = (control.getAttribute('aria-describedby') || '').split(/\s+/)
      .map(id => document.getElementById(id)).filter(Boolean);
    const announcement = descriptions.find(node => node.getAttribute('role') === 'status') || descriptions[0];
    const label = normalize(thumb?.getAttribute('aria-valuetext') || announcement?.textContent || '');
    const number = attr => {
      const value = thumb?.getAttribute(attr);
      return value === null || value === undefined || value === '' ? null :
        (Number.isFinite(Number(value)) ? Number(value) : null);
    };
    const value = number('aria-valuenow');
    const min = number('aria-valuemin');
    const max = number('aria-valuemax');
    const container = control.querySelector('[data-model-picker-power-slider]');
    const root = thumb?.closest('[data-orientation][aria-disabled], [data-orientation][data-disabled]') ||
      container?.firstElementChild || control;
    const disabled = !enabled(control) || !!control.closest('[aria-disabled="true"], [data-disabled]') ||
      root?.getAttribute('aria-disabled') === 'true' || root?.hasAttribute('data-disabled') ||
      !!root?.querySelector('[aria-disabled="true"], [data-disabled]');
    // La posición máxima puede ser Pro. Nunca utilizar End ni asumir max=Extra High.
    return { control, root, thumb, label, value, min, max, disabled, key: String(value) + '|' + label };
  }

  function powerIsTarget(state) {
    if (!state) return false;
    // La etiqueta asociada al control tiene prioridad sobre una cifra de posición.
    return state.label ? targetLabel(state.label) && !/\bpro\b/i.test(state.label) : isExtraHigh();
  }

  async function waitForPowerChange(previous) {
    const until = Math.min(deadline, Date.now() + 1_300);
    let last = '', since = 0;
    while (Date.now() < until) {
      guard();
      const state = readPower();
      if (state && state.key !== previous.key) {
        if (last !== state.key) { last = state.key; since = Date.now(); }
        if (Date.now() - since >= 250) return state;
      } else {
        last = '';
      }
      await sleep(POLL_MS);
    }
    return null;
  }

  function sliderReactProps(state) {
    // Respaldo opcional: llamar al callback del MISMO Slider controlado.
    // No editar atributos DOM, hooks, stores globales ni opciones de cuenta.
    // Las propiedades __reactFiber$ son internas: pueden no estar disponibles.
    const node = state.root || state.thumb;
    if (!node) return null;
    const accepts = props => props && Array.isArray(props.value) && props.value.length === 1 &&
      props.value[0] === state.value && typeof props.onValueChange === 'function' &&
      !props.disabled && (props.min == null || props.min === state.min) &&
      (props.max == null || props.max === state.max);
    try {
      const keys = Object.getOwnPropertyNames(node);
      const direct = keys.find(key => key.startsWith('__reactProps$'));
      if (direct && accepts(node[direct])) return node[direct];
      const key = keys.find(key => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'));
      let fiber = key && node[key];
      const seen = new Set();
      for (let depth = 0; fiber && depth < 24 && !seen.has(fiber); depth++, fiber = fiber.return) {
        seen.add(fiber);
        const host = fiber.stateNode;
        if (host?.nodeType === 1 && !state.control.contains(host)) break;
        for (const current of [fiber, fiber.alternate]) {
          if (accepts(current?.memoizedProps)) return current.memoizedProps;
        }
        if (host === state.control) break;
      }
    } catch (error) {
      record('Respaldo React no accesible: ' + error.message);
    }
    return null;
  }

  async function movePower(state, direction) {
    const key = direction < 0 ? 'ArrowLeft' : 'ArrowRight';
    // Eventos enviados a la fila NO llegan a sus descendientes. Probar también
    // el thumb real y el root interno, incluso si el thumb está aria-hidden.
    const targets = ['control', 'thumb', 'root'];
    const tried = new Set();
    for (const name of targets) {
      guard();
      const current = readPower();
      if (!current || current.disabled) throw new Error('Power dejó de estar disponible.');
      if (current.key !== state.key) return current;
      const node = current[name];
      if (!node?.isConnected || tried.has(node)) continue;
      tried.add(node);
      record('Power: ' + key + ' en ' + name + '; antes=' + current.key);
      pressKey(node, key);
      const changed = await waitForPowerChange(current);
      if (changed) return changed;
    }
    guard();
    const current = readPower();
    if (!current || current.disabled) throw new Error('Power dejó de estar disponible.');
    if (current.key !== state.key) return current;
    if (current.value === null || current.min === null || current.max === null) return null;
    const props = sliderReactProps(current);
    if (!props) { record('No se encontró callback de Slider controlado.'); return null; }
    const step = Number.isFinite(props.step) && props.step > 0 ? props.step : 1;
    const next = Math.min(current.max, Math.max(current.min, current.value + direction * step));
    if (next === current.value) return null;
    record('Power: callback del Slider [' + current.value + '] → [' + next + ']');
    // Mismo contrato público que Slider.Root.onValueChange/onValueCommit.
    props.onValueChange([next]);
    if (typeof props.onValueCommit === 'function') props.onValueCommit([next]);
    return await waitForPowerChange(current);
  }

  async function adjustPower() {
    let state = readPower();
    if (!state) throw new Error('No aparece el control Power.');
    let direction = /\bpro\b/i.test(state.label) ||
      (state.max !== null && state.value === state.max) ? -1 : 1;
    const visited = new Set();
    for (let step = 0; step < 20; step++) {
      guard();
      state = readPower();
      if (!state) throw new Error('El control Power ha desaparecido.');
      if (state.disabled) throw new Error('El control Power está deshabilitado.');
      if (powerIsTarget(state)) { record('Extra High leído en Power: ' + state.key); return; }
      if (state.value !== null && state.min !== null && state.max !== null) {
        if (state.value >= state.max) direction = -1;
        if (state.value <= state.min) direction = 1;
      }
      const visit = state.key + '|' + direction;
      if (visited.has(visit)) break;
      visited.add(visit);
      notify('Paso 2/3 · Seleccionando Extra High\nNivel detectado: ' + (state.label || effortLabel(effort())));
      let changed = await movePower(state, direction);
      if (!changed) {
        direction *= -1;
        changed = await movePower(readPower() || state, direction);
      }
      if (!changed) {
        throw new Error('E22: Power no respondió al teclado ni al control interno. ' +
          'Nivel: ' + (state.label || 'desconocido') + '. Usa «Copiar diagnóstico».');
      }
    }
    throw new Error('E23: No encontré Extra High entre los niveles de Power. No envío con otro nivel.');
  }

  async function openEffortMenu() {
    const opened = () => effort()?.getAttribute('aria-expanded') === 'true' && menuScopes().length > 0;
    if (opened()) return;
    // ArrowDown abre Radix explícitamente, sin alternar abierto/cerrado.
    for (const method of ['ArrowDown', 'pointer', 'click']) {
      guard();
      const trigger = effort();
      if (!trigger || trigger.matches(':disabled') || trigger.getAttribute('aria-disabled') === 'true') continue;
      record('Abrir selector: ' + method + '; etiqueta=' + effortLabel(trigger));
      if (method === 'ArrowDown') pressKey(trigger, 'ArrowDown');
      else if (method === 'pointer') pointerClick(trigger);
      else trigger.click();
      const until = Math.min(deadline, Date.now() + 1_200);
      while (Date.now() < until) {
        guard();
        if (opened() || findPowerSlider() || findExtraHighOption()) return;
        await sleep(POLL_MS);
      }
    }
    throw new Error('E21: Detecto el selector, pero no se abre. Usa «Copiar diagnóstico».');
  }

  async function closeEffortMenu(trigger) {
    trigger = effort() || trigger;
    if (!trigger?.isConnected || trigger.getAttribute('aria-expanded') !== 'true') return;
    const scope = menuScopes()[0];
    const focused = scope?.contains(document.activeElement) ? document.activeElement : scope || trigger;
    pressKey(focused, 'Escape');
    await sleep(150);
    trigger = effort() || trigger;
    if (trigger.getAttribute('aria-expanded') === 'true') {
      trigger.click();
      await sleep(150);
      if (trigger.getAttribute('aria-expanded') === 'true') {
        pointerClick(trigger);
        await sleep(150);
      }
    }
    if (trigger.getAttribute('aria-expanded') === 'true') {
      throw new Error('No se pudo cerrar el selector. Pulsa Escape para cerrarlo.');
    }
  }

  async function selectExtraHigh() {
    let trigger = await waitFor(() => {
      const node = effort();
      return node && !node.matches(':disabled') && node.getAttribute('aria-disabled') !== 'true' && node;
    }, 'No aparece el selector de Thinking effort.', TIMEOUT_MS, 300);
    try {
      const openState = readPower();
      if (isExtraHigh() && (!openState || powerIsTarget(openState))) return;
      await openEffortMenu();
      const control = await waitFor(() => findPowerSlider() || findExtraHighOption(),
        'No aparece Power ni una opción Extra High habilitada.', MENU_TIMEOUT_MS);
      if (control.matches('[data-reasoning-slider], [role="slider"]')) {
        await adjustPower();
      } else {
        control.focus({ preventScroll: true });
        control.click();
        await sleep(500);
        if (!isExtraHigh() && control.isConnected) {
          record('Opción clásica: respaldo Enter.');
          pressKey(control, 'Enter');
          await sleep(300);
        }
      }
    } finally {
      // Cerrar también un menú que ya estuviera abierto. Después se verifica
      // el estado definitivo del botón, fuera del menú modal de Radix.
      await closeEffortMenu(effort() || trigger);
    }
    await waitFor(isExtraHigh, 'El botón no confirma Extra High después de cerrar Power.', MENU_TIMEOUT_MS, 400);
  }

  async function fillPrompt(node) {
    if (matchesPrompt(node)) return;
    if (normalize(textOf(node))) throw new Error('Hay un borrador distinto. Lo he conservado.');
    guard();
    writing = true;
    try {
      node.focus({ preventScroll: true });
      if (node instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (!setter) throw new Error('No se puede escribir en este editor.');
        setter.call(node, prompt);
        node.dispatchEvent(new InputEvent('input', {
          bubbles: true, composed: true, inputType: 'insertText', data: prompt
        }));
        return;
      }
      // Una aplicación puede atender este evento y actualizar su editor.
      // preventDefault NO demuestra que haya insertado el texto.
      if (typeof DataTransfer === 'function' && typeof ClipboardEvent === 'function') {
        try {
          const clipboard = new DataTransfer();
          clipboard.setData('text/plain', prompt);
          node.dispatchEvent(new ClipboardEvent('paste', {
            bubbles: true, composed: true, cancelable: true, clipboardData: clipboard
          }));
        } catch {
          // Un navegador sin este constructor pasa a la edición nativa.
        }
      }
    } finally {
      writing = false;
    }

    // Dejar que los manejadores de pegado actualicen el estado del editor.
    await sleep(350);
    guard();
    if (node !== editor()) return; // React ha sustituido el editor: releerlo.
    if (matchesPrompt(node)) return;
    if (normalize(textOf(node))) throw new Error('El editor contiene otro texto. Lo he conservado.');

    writing = true;
    try {
      node.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      if (!selection) throw new Error('No se puede seleccionar el editor.');
      selection.removeAllRanges();
      selection.addRange(range);
      if (typeof document.execCommand !== 'function') {
        throw new Error('Este navegador no permite la inserción automática. Puedes pegar el texto manualmente.');
      }
      // Fallback nativo para contenteditable. No asigna innerHTML ni crea
      // un texto visual desconectado mediante una falsa pulsación de tecla.
      document.execCommand('insertText', false, prompt);
    } finally {
      writing = false;
    }
    // El resultado se comprueba en ensurePrompt, nunca por el valor devuelto
    // por execCommand ni por defaultPrevented del evento de pegado.
  }

  async function ensurePrompt() {
    const until = Math.min(deadline, Date.now() + 12_000);
    const nativeUntil = Date.now() + 1_500;
    let attempts = 0;
    let nextAttempt = nativeUntil;
    let stableNode = null;
    let stableSince = 0;
    while (Date.now() < until) {
      guard();
      const node = editor();
      if (enabled(node)) {
        if (matchesPrompt(node)) {
          if (node !== stableNode) { stableNode = node; stableSince = Date.now(); }
          if (Date.now() - stableSince >= 400) return node;
        } else {
          stableNode = null;
          if (normalize(textOf(node))) throw new Error('Hay un borrador distinto. Lo he conservado.');
          if (Date.now() >= nextAttempt && attempts < 3) {
            attempts++;
            await fillPrompt(node);
            nextAttempt = Date.now() + 1_000;
          }
        }
      } else {
        stableNode = null;
      }
      await sleep(POLL_MS);
    }
    throw new Error('El texto no quedó cargado. El editor sigue libre para que escribas o pegues manualmente.');
  }

  function consumeQuery() {
    const currentUrl = new URL(location.href);
    for (const key of QUERY_KEYS) currentUrl.searchParams.delete(key);
    history.replaceState(history.state, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
  }

  async function main() {
    phase = '1/3 Texto';
    await waitFor(() => document.body, 'La página no terminó de cargar.');
    notify('Paso 1/3 · Cargando texto\nEscape cancela el autoenvío.');
    await waitFor(() => document.readyState !== 'loading' &&
      ((enabled(editor()) && editor()) ||
       (effort()?.getAttribute('aria-expanded') === 'true' && menuScopes()[0])),
      'No encuentro el editor. Comprueba que has iniciado sesión.', TIMEOUT_MS, 400);
    // Un menú previamente abierto puede ocultar el editor con aria-hidden.
    await closeEffortMenu(effort());

    // Primero el texto, sin ningún menú que pueda retener el foco.
    await ensurePrompt();
    record('Texto confirmado en editor ' + editor()?.tagName +
      '; data-composer-markdown=' + Boolean(editor()?.hasAttribute('data-composer-markdown')));
    phase = '2/3 Selector';
    notify('Paso 2/3 · Texto cargado. Abriendo selector…\nEscape cancela el autoenvío.');
    await selectExtraHigh();
    guard();
    phase = '3/3 Envío';
    notify('Paso 3/3 · Extra High confirmado. Preparando envío…');
    // El cambio de esfuerzo puede reconstruir el editor. No enviar vacío.
    await ensurePrompt();

    const button = await waitFor(() => {
      const current = editor();
      if (!current || !matchesPrompt(current) || !isExtraHigh()) return null;
      const root = current.closest('form') || document;
      return [...root.querySelectorAll(SEND)].find(enabled);
    }, 'El texto, Extra High o el botón Enviar no quedaron listos. No se ha enviado.', TIMEOUT_MS, 400);

    guard();
    if (!isExtraHigh() || !matchesPrompt(editor()) || !enabled(button)) {
      throw new Error('El estado del editor cambió antes del envío.');
    }
    // Consumir solo ahora: conservar parámetros ajenos y evitar el reenvío
    // al recargar. No hay esperas entre esta comprobación y el único click.
    consumeQuery();
    if (!isExtraHigh() || !matchesPrompt(editor()) || !enabled(button)) {
      throw new Error('La página cambió justo antes del envío. El texto se conserva.');
    }
    finished = true;
    cleanup();
    record('Único clic en Enviar; selector=' + effortLabel(effort()));
    button.click();
    notify('Paso 3/3 · Se ha pulsado Enviar. Comprobando respuesta de la página…');
    const until = Date.now() + 12_000;
    while (Date.now() < until) {
      if (document.querySelector(ACTIVITY)) {
        phase = 'Envío observado';
        notify('La interfaz ha iniciado el mensaje con Extra High seleccionado.', false, 8_000);
        return;
      }
      await sleep(200);
    }
    phase = 'Envío sin confirmar';
    notify('E31: Se pulsó Enviar, pero no detecto el inicio del mensaje.\nNo reintento para evitar duplicados. Usa «Copiar diagnóstico».', true);
  }

  // Expuesto localmente para depuración. No se transmite ningún dato.
  window.__chatgptExtraHighDebug = { version: VERSION, diagnostic };
  if (previousRun) {
    finished = true;
    cleanup();
    const showConflict = () => notify('E00: Ya se está ejecutando otra copia del script.\n' +
      'Desactiva las versiones anteriores, deja solo la v' + VERSION + ' y recarga.', true);
    if (document.body) showConflict();
    else document.addEventListener('DOMContentLoaded', showConflict, { once: true });
    return;
  }

  main().catch(error => {
    finished = true;
    cleanup();
    console.warn('[ChatGPT q → Extra High]', error.message);
    notify('Detenido en ' + phase + '\n' + error.message + '\nUsa «Copiar diagnóstico».', true);
  });
})();

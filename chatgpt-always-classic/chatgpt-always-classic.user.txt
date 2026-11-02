// ==UserScript==
// @name         ChatGPT - Always Classic
// @namespace    local.chatgpt.always-classic
// @version      1.0.3
// @homepageURL  https://github.com/alexx-ftw/chatgpt-extra-high-autosend/tree/main/chatgpt-always-classic
// @updateURL    https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js
// @downloadURL  https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js
// @description  Toggle classic ChatGPT on or off, remember the preference, and always exclude Dots.
// @match        *://chatgpt.com/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// @inject-into  page
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const parameter = 'oauth_return_surface';
    const redirectKey = 'userscript:chatgpt-always-classic:redirect';
    const preferenceKey = 'userscript:chatgpt-always-classic:enabled';
    const originalReplaceState = history.replaceState;
    let enabled = readPreference();
    let control = null;
    let statusMessage = '';

    // Return a corrected URL, or null when no correction is needed.
    function classicURL(value, base = location.href) {
        const url = new URL(value, base);
        if (url.origin !== location.origin) return null;

        const values = url.searchParams.getAll(parameter);

        // OFF and Dots remove only classic, preserving other surface values.
        if (!enabled || isDots(url)) {
            if (!values.includes('classic')) return null;

            url.searchParams.delete(parameter);
            for (const value of values) {
                if (value !== 'classic') url.searchParams.append(parameter, value);
            }
            return url.href;
        }

        if (values.length === 1 && values[0] === 'classic') return null;
        url.searchParams.set(parameter, 'classic');
        return url.href;
    }


    function readPreference(fallback = true) {
        try {
            return localStorage.getItem(preferenceKey) !== 'off';
        } catch {
            return fallback;
        }
    }

    function isDots(url = new URL(location.href)) {
        return url.pathname === '/dots' || url.pathname.startsWith('/dots/');
    }

    function createControl() {
        const host = document.createElement('div');
        host.id = 'chatgpt-always-classic-toggle';
        host.style.cssText = [
            'position:fixed', 'right:14px', 'bottom:14px',
            'right:max(14px,env(safe-area-inset-right))',
            'bottom:max(14px,env(safe-area-inset-bottom))',
            'z-index:2147483646', 'display:block',
        ].join(';');

        const root = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = [
            ':host{all:initial;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
            'button{display:flex;align-items:center;gap:8px;min-height:36px;box-sizing:border-box;',
            'padding:7px 11px;border:1px solid #d7d7d7;border-radius:999px;background:#fff;',
            'color:#242424;font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;',
            'box-shadow:0 2px 10px #0002;cursor:pointer;user-select:none;white-space:nowrap}',
            'button:hover{border-color:#8b8b8b}',
            'button:focus-visible{outline:3px solid #10a37f;outline-offset:3px}',
            'button:disabled{cursor:wait;opacity:.7}',
            '.track{width:28px;height:16px;border-radius:999px;background:#8c8c8c;display:block}',
            '.thumb{display:block;width:12px;height:12px;margin:2px;border-radius:50%;background:#fff}',
            'button[aria-checked="true"] .track{background:#10a37f}',
            'button[aria-checked="true"] .thumb{transform:translateX(12px)}',
            '.value{font-size:10px;min-width:21px;text-align:center}',
            '.note{max-width:190px;margin:5px 0 0 auto;padding:3px 7px;border-radius:7px;',
            'background:#fff;color:#5f5f5f;font:11px/1.3 system-ui,sans-serif;text-align:right;',
            'box-shadow:0 1px 5px #0001}',
            '.note[hidden]{display:none}',
            '@media(prefers-color-scheme:dark){button{background:#242424;color:#f3f3f3;',
            'border-color:#525252}.note{background:#242424;color:#c4c4c4}}',
        ].join('');

        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'switch');
        button.setAttribute('aria-label', 'Modo clásico');
        button.setAttribute('aria-describedby', 'classic-toggle-note');

        const label = document.createElement('span');
        label.textContent = 'Clásico';
        const track = document.createElement('span');
        track.className = 'track';
        track.setAttribute('aria-hidden', 'true');
        const thumb = document.createElement('span');
        thumb.className = 'thumb';
        track.append(thumb);
        const value = document.createElement('span');
        value.className = 'value';
        value.setAttribute('aria-hidden', 'true');
        button.append(label, track, value);

        const note = document.createElement('div');
        note.id = 'classic-toggle-note';
        note.className = 'note';
        note.setAttribute('role', 'status');
        note.setAttribute('aria-live', 'polite');
        button.addEventListener('click', toggleClassic);
        root.append(style, button, note);
        return { host, button, value, note };
    }

    function updateControl() {
        if (!document.body) return;
        if (!control) control = createControl();
        if (!control.host.isConnected) document.body.append(control.host);

        const exempt = isDots();
        control.button.setAttribute('aria-checked', String(enabled));
        control.value.textContent = enabled ? 'ON' : 'OFF';
        control.button.title = exempt
            ? 'Preferencia para el resto de ChatGPT. Dots siempre está excluido.'
            : enabled
                ? 'Desactivar el modo clásico y recargar esta pestaña'
                : 'Activar el modo clásico y recargar esta pestaña';
        const message = exempt && statusMessage === 'Recarga para aplicar'
            ? ''
            : statusMessage;
        control.note.textContent = message || (exempt ? 'Dots excluido' : '');
        control.note.hidden = !control.note.textContent;
    }

    function toggleClassic() {
        const next = !enabled;
        try {
            // Persist first: a reload must not silently revert the new choice.
            localStorage.setItem(preferenceKey, next ? 'on' : 'off');
        } catch {
            statusMessage = 'No se pudo guardar el ajuste';
            updateControl();
            return;
        }

        enabled = next;
        statusMessage = '';
        updateControl();
        if (isDots()) {
            keepParameter();
            return;
        }

        try {
            sessionStorage.removeItem(redirectKey);
        } catch {
            // The redirect guard is optional.
        }
        control.button.disabled = true;
        location.replace(classicURL(location.href) || location.href);
    }

    function syncPreference() {
        const saved = readPreference(enabled);
        if (saved !== enabled) {
            enabled = saved;
            statusMessage = isDots() ? '' : 'Recarga para aplicar';
        }
        // Other tabs update their preference and URL without losing active work.
        keepParameter();
    }

    function keepParameter() {
        const corrected = classicURL(location.href);
        if (corrected) {
            Reflect.apply(originalReplaceState, history, [
                history.state, '', corrected,
            ]);
        }
        updateControl();
    }

    const initialURL = classicURL(location.href);
    if (initialURL) {
        // Load the page with the parameter so the server can receive it.
        // Suppress rapid repeated redirects if the server strips it again.
        let shouldRedirect = true;
        try {
            const previous = JSON.parse(sessionStorage.getItem(redirectKey));
            const now = Date.now();
            shouldRedirect = !(previous && previous.url === initialURL &&
                now - previous.time >= 0 && now - previous.time < 10000);
            if (shouldRedirect) {
                sessionStorage.setItem(redirectKey, JSON.stringify({
                    url: initialURL, time: now,
                }));
            }
        } catch {
            // The script also works when sessionStorage is unavailable.
        }

        if (shouldRedirect) {
            location.replace(initialURL);
            return;
        }
        keepParameter();
    } else {
        try {
            sessionStorage.removeItem(redirectKey);
        } catch {
            // Storage access is optional.
        }
    }

    // ChatGPT can change routes without loading a new document.
    for (const method of ['pushState', 'replaceState']) {
        const original = history[method];
        history[method] = function (...args) {
            if (args.length >= 3 && args[2] != null) {
                try {
                    const corrected = classicURL(args[2], document.baseURI);
                    if (corrected) args[2] = corrected;
                } catch {
                    // Let the native method handle invalid input normally.
                }
            }
            const result = Reflect.apply(original, this, args);
            updateControl();
            return result;
        };
    }

    window.addEventListener('popstate', keepParameter);
    window.addEventListener('pageshow', syncPreference);
    window.addEventListener('hashchange', keepParameter);
    window.addEventListener('storage', event => {
        if (event.key === preferenceKey || event.key === null) syncPreference();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateControl, { once: true });
    } else {
        updateControl();
    }
})();

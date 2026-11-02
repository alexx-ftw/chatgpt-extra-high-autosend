// ==UserScript==
// @name         ChatGPT - Always Classic
// @namespace    local.chatgpt.always-classic
// @version      1.0.4
// @homepageURL  https://github.com/alexx-ftw/chatgpt-extra-high-autosend/tree/main/chatgpt-always-classic
// @updateURL    https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js
// @downloadURL  https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js
// @description  Toggle classic ChatGPT from the userscript-manager menu, remember the preference, and always exclude Dots.
// @match        *://chatgpt.com/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        unsafeWindow
// @sandbox      raw
// @inject-into  page
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const parameter = 'oauth_return_surface';
    const redirectKey = 'userscript:chatgpt-always-classic:redirect';
    const preferenceKey = 'userscript:chatgpt-always-classic:enabled';
    // Grants enable sandboxing; intercept the actual page's History object.
    const pageHistory = unsafeWindow.history;
    const originalReplaceState = pageHistory.replaceState;
    let enabled = readPreference();
    let menuId = null;
    let menuLabel = '';
    let navigating = false;
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

    function updateMenu() {
        const state = enabled ? 'ON' : 'OFF';
        const action = enabled ? 'desactivar' : 'activar';
        const message = isDots() && statusMessage === 'Recarga para aplicar'
            ? ''
            : statusMessage;
        const suffix = message || (isDots() ? 'Dots excluido' : '');
        const label = 'Modo clásico: ' + state + ' (' + action + ')' +
            (suffix ? ' · ' + suffix : '');

        if (menuId !== null && menuLabel === label) return;
        if (menuId !== null) GM_unregisterMenuCommand(menuId);
        menuId = GM_registerMenuCommand(label, toggleClassic);
        menuLabel = label;
    }

    function toggleClassic() {
        if (navigating) return;
        const next = !enabled;
        try {
            // Persist first: a reload must not silently revert the new choice.
            localStorage.setItem(preferenceKey, next ? 'on' : 'off');
        } catch {
            statusMessage = 'No se pudo guardar el ajuste';
            updateMenu();
            return;
        }

        enabled = next;
        statusMessage = '';
        updateMenu();
        if (isDots()) {
            keepParameter();
            return;
        }

        try {
            sessionStorage.removeItem(redirectKey);
        } catch {
            // The redirect guard is optional.
        }
        navigating = true;
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
            Reflect.apply(originalReplaceState, pageHistory, [
                pageHistory.state, '', corrected,
            ]);
        }
        updateMenu();
    }

    // Register before any redirect; the toggle also works on Dots.
    updateMenu();

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
        const original = pageHistory[method];
        pageHistory[method] = function (...args) {
            if (args.length >= 3 && args[2] != null) {
                try {
                    const corrected = classicURL(args[2], document.baseURI);
                    if (corrected) args[2] = corrected;
                } catch {
                    // Let the native method handle invalid input normally.
                }
            }
            const result = Reflect.apply(original, this, args);
            updateMenu();
            return result;
        };
    }

    window.addEventListener('popstate', keepParameter);
    window.addEventListener('pageshow', () => {
        navigating = false;
        syncPreference();
    });
    window.addEventListener('hashchange', keepParameter);
    window.addEventListener('storage', event => {
        if (event.key === preferenceKey || event.key === null) syncPreference();
    });

})();

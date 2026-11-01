// ==UserScript==
// @name         ChatGPT - Always Classic
// @namespace    local.chatgpt.always-classic
// @version      1.0.1
// @homepageURL  https://github.com/alexx-ftw/chatgpt-extra-high-autosend/tree/main/chatgpt-always-classic
// @updateURL    https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js
// @downloadURL  https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js
// @description  Add oauth_return_surface=classic to every ChatGPT page and retain it during navigation.
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
    const originalReplaceState = history.replaceState;

    // Return a corrected URL, or null when no correction is needed.
    function classicURL(value, base = location.href) {
        const url = new URL(value, base);
        if (url.origin !== location.origin) return null;

        const values = url.searchParams.getAll(parameter);
        if (values.length === 1 && values[0] === 'classic') return null;

        url.searchParams.set(parameter, 'classic');
        return url.href;
    }

    function keepParameter() {
        const corrected = classicURL(location.href);
        if (corrected) {
            Reflect.apply(originalReplaceState, history, [
                history.state, '', corrected,
            ]);
        }
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
            return Reflect.apply(original, this, args);
        };
    }

    window.addEventListener('popstate', keepParameter);
    window.addEventListener('pageshow', keepParameter);
    window.addEventListener('hashchange', keepParameter);
})();

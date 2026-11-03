'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '..', 'chatgpt-always-classic.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const preferenceKey = 'userscript:chatgpt-always-classic:enabled';
const parameter = 'oauth_return_surface';
const injectInto = source.match(/^\/\/ @inject-into\s+(\S+)/m)[1];

function events() {
    const listeners = new Map();
    return {
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
        },
        emit(type, values = {}) {
            for (const listener of listeners.get(type) || []) {
                listener({ type, ...values });
            }
        },
    };
}

function storage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        failWrites: false,
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) {
            if (this.failWrites) throw new Error('Storage is unavailable');
            values.set(key, String(value));
        },
        removeItem(key) { values.delete(key); },
    };
}

// An isolated content world and a page world share only document URL/state.
// Page History methods are frozen, so tests cannot accidentally succeed by
// allowing a content script to replace the page's JavaScript functions.
function createTab({
    href = 'https://chatgpt.com/?oauth_return_surface=classic',
    saved = storage(),
    navigationAPI = true,
    legacyMenu = false,
} = {}) {
    let currentURL = new URL(href);
    let currentState = { original: true };
    let visibilityState = 'visible';
    const windowEvents = events();
    const documentEvents = events();
    const navigation = events();
    const queued = [];
    const intervals = [];
    const menus = new Map();
    const registrations = [];
    const redirects = [];
    const contentWrites = [];
    const pageWrites = [];
    const trace = [];
    let queuedCount = 0;

    function historyFor(writes) {
        return Object.freeze({
            get state() { return currentState; },
            pushState: Object.freeze(function (state, title, url) {
                changeHistory(state, url, writes, 'pushState');
            }),
            replaceState: Object.freeze(function (state, title, url) {
                changeHistory(state, url, writes, 'replaceState');
            }),
        });
    }

    function changeHistory(state, url, writes, method) {
        if (url != null) currentURL = new URL(url, currentURL);
        currentState = state;
        writes.push({ method, href: currentURL.href, state });
        // In browsers this event can fire synchronously inside replaceState.
        if (navigationAPI) navigation.emit('currententrychange');
    }

    const pageHistory = historyFor(pageWrites);
    const contentHistory = historyFor(contentWrites);
    const location = {
        get href() { return currentURL.href; },
        get origin() { return currentURL.origin; },
        replace(url) {
            redirects.push(new URL(url, currentURL).href);
            trace.push({ type: 'redirect', href: redirects.at(-1) });
            // Record the pending document load. The old document remains alive
            // until a test creates its replacement or simulates BFCache restore.
        },
    };
    const document = new Proxy({
        addEventListener: documentEvents.addEventListener,
        get visibilityState() { return visibilityState; },
    }, {
        get(target, key) {
            if (key in target) return Reflect.get(target, key);
            throw new Error('Unexpected page DOM access: ' + String(key));
        },
    });
    const window = {
        history: contentHistory,
        navigation: navigationAPI ? navigation : undefined,
        addEventListener: windowEvents.addEventListener,
        setInterval(callback, delay) {
            intervals.push({ callback, delay });
            return intervals.length;
        },
    };
    const sandbox = {
        URL,
        location,
        window,
        document,
        localStorage: {
            getItem: key => saved.getItem(key),
            setItem(key, value) {
                saved.setItem(key, value);
                trace.push({ type: 'save', key, value });
            },
        },
        sessionStorage: storage(),
        queueMicrotask(callback) {
            queued.push(callback);
            queuedCount++;
        },
        GM_registerMenuCommand(label, callback, options = {}) {
            assert.equal(typeof callback, 'function');
            const key = legacyMenu ? label : options.id || label;
            menus.set(key, { label, callback });
            registrations.push({ key, label, callback });
            return key;
        },
    };
    Object.defineProperty(sandbox, 'unsafeWindow', {
        get() { throw new Error('The content script must not access the page world'); },
    });
    Object.defineProperty(sandbox, 'GM_unregisterMenuCommand', {
        get() { throw new Error('Menu callbacks must remain registered'); },
    });
    vm.runInNewContext(source, sandbox, { filename: scriptPath });

    function dispatch(key, realm) {
        if (arguments.length < 2) realm = injectInto;
        const CONTENT = 'content';
        const invokeContent = (command, data) => {
            assert.equal(command, 'Command');
            return menus.get(data.key)?.callback({ type: 'mouseup' });
        };
        const postViaBridge = undefined;
        // Exact routing expression from Violentmonkey's setupContentInvoker:
        // src/injected/content/inject.js at 37cdb9a10cacd70aa8b94eceea1554ace388d1d1.
        // This is a dispatcher regression model, not a live extension test.
        (realm === CONTENT ? invokeContent : postViaBridge)(
            'Command', { key }, undefined, undefined,
        );
    }

    return {
        saved, menus, registrations, redirects, contentWrites, pageWrites,
        pageHistory, contentHistory, trace, intervals,
        get url() { return new URL(currentURL); },
        get queuedCount() { return queuedCount; },
        get key() { return menus.keys().next().value; },
        get label() { return menus.values().next().value.label; },
        dispatch,
        setURL(url) { currentURL = new URL(url, currentURL); },
        emit: windowEvents.emit,
        setVisibility(value) {
            visibilityState = value;
            documentEvents.emit('visibilitychange');
        },
        tick() { for (const timer of intervals) timer.callback(); },
        flush() {
            let count = 0;
            while (queued.length) {
                assert.ok(++count <= 20, 'navigation correction must settle');
                queued.shift()();
            }
        },
    };
}

test('isolated menu dispatch works without a page bridge; missing bridge reproduces the reported error', () => {
    const tab = createTab({ href: 'https://chatgpt.com/dots/home' });
    const expected = {
        name: 'TypeError',
        message: '(intermediate value)(intermediate value)(intermediate value) is not a function',
    };
    assert.throws(() => tab.dispatch(tab.key, 'page'), expected);
    assert.throws(() => tab.dispatch(tab.key, undefined), expected);
    assert.equal(injectInto, 'content');
    assert.doesNotThrow(() => tab.dispatch(tab.key));
    assert.equal(tab.saved.getItem(preferenceKey), 'off');
    assert.equal(tab.redirects.length, 0);
});

test('initial load redirects once, preserving other parameters and the fragment', () => {
    const tab = createTab({
        href: 'https://chatgpt.com/c/abc?q=a%20b&oauth_return_surface=modern&oauth_return_surface=classic#draft',
    });
    assert.equal(tab.menus.size, 1, 'menu is registered before redirecting');
    assert.equal(tab.redirects.length, 1);
    const target = new URL(tab.redirects[0]);
    assert.deepEqual(target.searchParams.getAll(parameter), ['classic']);
    assert.equal(target.searchParams.get('q'), 'a b');
    assert.equal(target.hash, '#draft');
    assert.equal(tab.pageWrites.length + tab.contentWrites.length, 0);
});

test('Dots and OFF remove only classic values on initial load', () => {
    for (const [pathname, enabled] of [['/dots', 'on'], ['/dots/home', 'on'], ['/c/abc', 'off']]) {
        const tab = createTab({
            href: `https://chatgpt.com${pathname}?keep=1&oauth_return_surface=classic&oauth_return_surface=dots#draft`,
            saved: storage({ [preferenceKey]: enabled }),
        });
        const target = new URL(tab.redirects[0]);
        assert.deepEqual(target.searchParams.getAll(parameter), ['dots']);
        assert.equal(target.searchParams.get('keep'), '1');
        assert.equal(target.hash, '#draft');
    }
});

test('toggle saves before reloading only its tab, survives reload, and synchronizes another tab without reloading it', () => {
    const saved = storage();
    const current = createTab({ saved });
    const other = createTab({ saved, href: 'https://chatgpt.com/c/other?oauth_return_surface=classic#draft' });
    current.dispatch(current.key);
    current.dispatch(current.key);
    assert.deepEqual(current.trace.map(item => item.type), ['save', 'redirect']);
    assert.equal(saved.getItem(preferenceKey), 'off');
    assert.equal(current.redirects.length, 1, 'duplicate click while navigating is ignored');
    assert.equal(new URL(current.redirects[0]).searchParams.has(parameter), false);

    other.emit('storage', { key: preferenceKey });
    other.flush();
    assert.equal(other.redirects.length, 0);
    assert.equal(other.url.searchParams.has(parameter), false);
    assert.equal(other.url.hash, '#draft');
    assert.match(other.label, /OFF.*Recarga para aplicar/);

    const reloaded = createTab({ saved, href: current.redirects[0] });
    assert.equal(reloaded.redirects.length, 0);
    assert.match(reloaded.label, /OFF \(activar\)/);
    reloaded.dispatch(reloaded.key);
    assert.equal(saved.getItem(preferenceKey), 'on');
    assert.equal(new URL(reloaded.redirects[0]).searchParams.get(parameter), 'classic');
});

test('a popup key captured before caption changes still invokes the single registered callback', () => {
    const tab = createTab({ href: 'https://chatgpt.com/dots/home?keep=1#draft' });
    const popupKey = tab.key;
    tab.saved.setItem(preferenceKey, 'off');
    tab.emit('storage', { key: preferenceKey });
    assert.match(tab.label, /OFF.*Dots excluido/);
    tab.dispatch(popupKey);
    assert.match(tab.label, /ON.*Dots excluido/);
    assert.equal(tab.saved.getItem(preferenceKey), 'on');
    assert.equal(tab.key, popupKey);
    assert.equal(tab.menus.size, 1);
    assert.equal(new Set(tab.registrations.map(item => item.callback)).size, 1);
    assert.equal(tab.redirects.length, 0);
    assert.equal(tab.url.href, 'https://chatgpt.com/dots/home?keep=1#draft');
});

for (const navigationAPI of [true, false]) {
    test(`SPA transitions preserve Dots, query/hash and history state with ${navigationAPI ? 'Navigation API' : 'timer fallback'}`, () => {
        const tab = createTab({ navigationAPI });
        const settle = () => navigationAPI ? tab.flush() : tab.tick();
        const dotsState = { router: { route: 'dots', scroll: 12 } };
        tab.pageHistory.pushState(dotsState, '', '/dots/home?keep=1&oauth_return_surface=classic&oauth_return_surface=dots#draft');
        settle();
        assert.deepEqual(tab.url.searchParams.getAll(parameter), ['dots']);
        assert.equal(tab.url.searchParams.get('keep'), '1');
        assert.equal(tab.url.hash, '#draft');
        assert.equal(tab.contentHistory.state, dotsState);
        assert.match(tab.label, /Dots excluido/);

        const chatState = { router: { route: 'chat', scroll: 24 } };
        tab.pageHistory.replaceState(chatState, '', '/c/new?q=a+b#latest');
        settle();
        assert.deepEqual(tab.url.searchParams.getAll(parameter), ['classic']);
        assert.equal(tab.url.searchParams.get('q'), 'a b');
        assert.equal(tab.url.hash, '#latest');
        assert.equal(tab.contentHistory.state, chatState);
        assert.doesNotMatch(tab.label, /Dots excluido/);
        assert.equal(tab.pageWrites.length, 2);
        assert.equal(tab.contentWrites.length, 2);
        assert.equal(tab.redirects.length, 0);
        if (navigationAPI) assert.equal(tab.queuedCount, 2, 'own replaceState event does not recursively queue work');

        tab.tick();
        tab.flush();
        assert.equal(tab.contentWrites.length, 2, 'unchanged URLs do not cause history writes');
    });
}

test('failed storage writes leave the preference and document unchanged', () => {
    const tab = createTab();
    const popupKey = tab.key;
    tab.saved.failWrites = true;
    tab.dispatch(popupKey);
    assert.match(tab.label, /ON.*No se pudo guardar el ajuste/);
    assert.equal(tab.saved.getItem(preferenceKey), null);
    assert.equal(tab.redirects.length + tab.contentWrites.length, 0);
    tab.saved.failWrites = false;
    tab.dispatch(popupKey);
    assert.equal(tab.saved.getItem(preferenceKey), 'off');
    assert.equal(tab.redirects.length, 1);
});

test('older managers retain one neutral menu command across multiple Dots toggles', () => {
    const tab = createTab({ href: 'https://chatgpt.com/dots/home', legacyMenu: true });
    const popupKey = tab.key;
    tab.dispatch(popupKey);
    assert.equal(tab.saved.getItem(preferenceKey), 'off');
    tab.dispatch(popupKey);
    assert.equal(tab.saved.getItem(preferenceKey), 'on');
    assert.equal(tab.label, 'Alternar modo clásico');
    assert.equal(tab.menus.size, 1);
    assert.equal(tab.registrations.length, 1);
    assert.equal(tab.redirects.length, 0);
});

test('BFCache pageshow resets pending navigation; focus and visibility synchronize suspended tabs', () => {
    const tab = createTab({ navigationAPI: false });
    tab.dispatch(tab.key);
    assert.equal(tab.redirects.length, 1);
    tab.emit('pageshow', { persisted: true });
    assert.equal(tab.url.searchParams.has(parameter), false);
    tab.dispatch(tab.key);
    assert.equal(tab.redirects.length, 2, 'toggle works again after returning via BFCache');

    const other = createTab({ navigationAPI: false });
    other.saved.setItem(preferenceKey, 'off');
    other.emit('focus');
    assert.equal(other.url.searchParams.has(parameter), false);
    other.saved.setItem(preferenceKey, 'on');
    other.setVisibility('hidden');
    assert.equal(other.url.searchParams.has(parameter), false);
    other.setVisibility('visible');
    assert.equal(other.url.searchParams.get(parameter), 'classic');
    assert.equal(other.redirects.length, 0);
});

test('Back/Forward and fragment event handlers correct routes without Navigation API or polling', () => {
    const tab = createTab({ navigationAPI: false });
    tab.setURL('/dots?oauth_return_surface=classic&keep=1#draft');
    tab.emit('popstate');
    assert.equal(tab.url.searchParams.has(parameter), false);
    assert.equal(tab.url.searchParams.get('keep'), '1');
    tab.setURL('/dots-other?keep=2#next');
    tab.emit('hashchange');
    assert.equal(tab.url.searchParams.get(parameter), 'classic', '/dots-other is not a Dots route');
    assert.equal(tab.url.hash, '#next');
    assert.equal(tab.redirects.length, 0);
});

test('distribution copies and update metadata preserve the existing installation identity', () => {
    assert.equal(fs.readFileSync(scriptPath.replace(/\.js$/, '.txt'), 'utf8'), source);
    const metadata = key => source.match(new RegExp('^// @' + key + '\\s+(.+)$', 'm'))?.[1];
    assert.equal(metadata('name'), 'ChatGPT - Always Classic');
    assert.equal(metadata('namespace'), 'local.chatgpt.always-classic');
    assert.equal(metadata('match'), '*://chatgpt.com/*');
    assert.equal(metadata('run-at'), 'document-start');
    assert.equal(metadata('inject-into'), 'content');
    assert.equal(metadata('sandbox'), 'DOM');
    const download = 'https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-always-classic/chatgpt-always-classic.user.js';
    assert.equal(metadata('downloadURL'), download);
    assert.equal(metadata('updateURL'), download);
    assert.deepEqual([...source.matchAll(/^\/\/ @grant\s+(\S+)/gm)].map(match => match[1]), ['GM_registerMenuCommand']);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.SCRIPT_UNDER_TEST || path.join(__dirname, '..', 'chatgpt-extra-high.user.js'), 'utf8');
const seam = source.lastIndexOf('\n  main().catch(');

// Deterministic DOM events and clock; the real waitFor/guard run unmodified.
function fixture(withObserver = true) {
  let now = 0, nextId = 1;
  const timers = new Map(), observers = new Set(), listeners = new Map();
  function target(name) {
    return {
      addEventListener(type, fn) {
        const key = name + ':' + type;
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key).add(fn);
      },
      removeEventListener(type, fn) { listeners.get(name + ':' + type)?.delete(fn); },
      emit(type) { for (const fn of [...(listeners.get(name + ':' + type) || [])]) fn({ type }); }
    };
  }
  const document = Object.assign(target('document'), {
    nodeType: 9, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null
  });
  const window = target('window');
  window.self = window.top = window;
  const location = new URL('https://chatgpt.com/?q=Test%20prompt');
  class ClockDate extends Date { static now() { return now; } }
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  const setTimer = (callback, delay) => {
    const id = nextId++; timers.set(id, { callback, at: now + delay }); return id;
  };
  const context = vm.createContext({
    URL, document, window, location, console, Date: ClockDate,
    setTimeout: setTimer, clearTimeout: id => timers.delete(id),
    ...(withObserver ? { MutationObserver: Observer } : {})
  });
  vm.runInContext(source.slice(0, seam) + '\n globalThis.wait = waitFor;\n})();', context);
  const baseListeners = [...listeners.values()].reduce((n, set) => n + set.size, 0);
  return {
    wait: context.wait, later: setTimer, location,
    mutate() { for (const observer of [...observers]) observer.callback([]); },
    input() { document.emit('input'); },
    navigate() { window.emit('popstate'); },
    async finish(promise) {
      let done = false, value, error;
      promise.then(v => { done = true; value = v; }, e => { done = true; error = e; });
      for (let steps = 0; !done && steps < 2000; steps++) {
        for (let i = 0; i < 12; i++) await Promise.resolve();
        if (done) break;
        const entry = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        assert.ok(entry, 'A pending wait must have a fallback timer');
        const [id, timer] = entry;
        timers.delete(id); now = timer.at; timer.callback();
      }
      assert.ok(done, 'Wait did not finish');
      if (error) throw error;
      return value;
    },
    assertClean() {
      assert.equal(observers.size, 0, 'Observer must be disconnected');
      assert.equal(timers.size, 0, 'Fallback timer must be cleared');
      assert.equal([...listeners.values()].reduce((n, set) => n + set.size, 0), baseListeners);
    },
    get now() { return now; }
  };
}

test('a DOM change wakes a pending wait before the polling interval', async () => {
  const f = fixture(); let ready = false;
  const pending = f.wait(() => ready, 'Not ready', 1000);
  f.later(() => { ready = true; f.mutate(); }, 7);
  assert.equal(await f.finish(pending), true);
  assert.equal(f.now, 7);
  f.assertClean();
});

test('input value changes wake the wait even without an attribute mutation', async () => {
  const f = fixture(); let ready = false;
  const pending = f.wait(() => ready, 'Not ready', 1000);
  f.later(() => { ready = true; f.input(); }, 9);
  await f.finish(pending);
  assert.equal(f.now, 9);
  f.assertClean();
});

test('an already satisfied predicate has no artificial delay', async () => {
  const f = fixture();
  assert.equal(await f.finish(f.wait(() => true, 'Not ready', 1000)), true);
  assert.equal(f.now, 0);
  f.assertClean();
});

test('short stability windows are not rounded up to a whole poll', async () => {
  const f = fixture();
  await f.finish(f.wait(() => true, 'Not ready', 1000, 60));
  assert.equal(f.now, 60);
  f.assertClean();
});

test('timeout is bounded and releases observers, timers and event listeners', async () => {
  const f = fixture();
  await assert.rejects(f.finish(f.wait(() => false, 'Not ready', 30)), /Not ready/);
  assert.equal(f.now, 30);
  f.assertClean();
});

test('history navigation interrupts a pending wait and cleans up', async () => {
  const f = fixture();
  const pending = f.wait(() => false, 'Not ready', 1000);
  f.later(() => f.navigate(), 11);
  await assert.rejects(f.finish(pending), /Has cambiado de página/);
  assert.equal(f.now, 11);
  f.assertClean();
});

test('a render that reverts the value restarts the stability check', async () => {
  const f = fixture(); let ready = true;
  const pending = f.wait(() => ready, 'Not ready', 1000, 60);
  f.later(() => { ready = false; f.mutate(); }, 10);
  f.later(() => { ready = true; f.mutate(); }, 20);
  await f.finish(pending);
  assert.equal(f.now, 80);
  f.assertClean();
});

test('unrelated mutations do not restart a satisfied stability window', async () => {
  const f = fixture();
  const pending = f.wait(() => true, 'Not ready', 1000, 60);
  for (const ms of [10, 20, 30, 40, 50]) f.later(() => f.mutate(), ms);
  await f.finish(pending);
  assert.equal(f.now, 60);
  f.assertClean();
});

test('without MutationObserver, timed fallback still reaches the predicate', async () => {
  const f = fixture(false); let ready = false;
  const pending = f.wait(() => ready, 'Not ready', 1000);
  f.later(() => { ready = true; }, 7);
  await f.finish(pending);
  assert.equal(f.now, 100);
  f.assertClean();
});

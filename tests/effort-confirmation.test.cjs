const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

function transition(options = {}) {
  let closedAt = null, restoredAt = null, applied = false, savedQuery;
  let current;
  const page = readyComposer(null, {
    pro: true,
    onControlEvent(env) {
      if (env.event.key !== 'Escape' || closedAt !== null) return;
      closedAt = env.now;
      savedQuery = env.document.querySelectorAll;
      if (options.kind === 'missing') {
        const queryForm = env.form.querySelectorAll;
        env.form.querySelectorAll = selector => selector.includes('model-switcher-dropdown-button')
          ? [] : queryForm(selector);
        env.document.querySelectorAll = selector => selector.includes('data-composer-navigation-target="reasoning"')
          ? [] : savedQuery(selector);
      } else if (options.kind === 'disabled') {
        env.trigger.setAttribute('aria-disabled', 'true');
      } else {
        env.trigger.innerText = '';
        env.trigger.setAttribute('data-selected-reasoning-effort', '');
      }
    },
    onTick(env) {
      if (closedAt === null) return;
      const elapsed = env.now - closedAt;
      if (!applied && elapsed >= (options.actionAt ?? Infinity)) {
        applied = true;
        options.action?.(page, env);
      }
      if (restoredAt === null && elapsed >= (options.delay ?? 9000)) {
        restoredAt = env.now;
        current = options.replace ? { ...env.trigger } : env.trigger;
        current.innerText = options.label || 'Extra High';
        current.setAttribute('data-selected-reasoning-effort', options.value ?? 'max');
        current.setAttribute('aria-disabled', 'false');
        env.document.querySelectorAll = selector => selector.includes('data-composer-navigation-target="reasoning"')
          ? [current] : savedQuery(selector);
      }
    }
  });
  return { page, closedAt: () => closedAt, restoredAt: () => restoredAt };
}

for (const kind of ['missing', 'blank', 'disabled']) {
  test(`late ${kind} selector confirms before one send, without reopening Power`, async () => {
    const t = transition({ kind, delay: 9000, replace: true });
    await t.page.run();
    assert.equal(t.page.sends, 1);
    assert.equal(t.page.createdPanels, 0);
    assert.ok(t.page.sentAt >= t.restoredAt() + 60 + 80);
    assert.equal((t.page.diagnostic().match(/Abrir selector:/g) || []).length, 1);
    assert.match(t.page.diagnostic(), /Confirmación del selector:/);
  });
}
for (const delay of [12000, 45000]) {
  test(`keeps waiting for confirmed state at ${delay} ms, within the global deadline`, async () => {
    const t = transition({ kind: 'missing', delay });
    await t.page.run();
    assert.equal(t.page.sends, 1);
    assert.ok(t.page.sentAt >= t.restoredAt() + 140);
  });
}

test('timeout with permanently missing selector never sends or resumes later', async () => {
  const t = transition({ kind: 'missing', delay: Infinity });
  await assert.rejects(t.page.run(), /El botón no confirma Extra High/);
  assert.equal(t.page.sends, 0);
  assert.ok(t.page.elapsedMs <= 90100);
  assert.match(t.page.diagnostic(), /Confirmación del selector:.*selector=ausente/);
  // The control becoming ready after the failed run must NOT revive auto-send.
  const query = t.page.document.querySelectorAll;
  t.page.document.querySelectorAll = selector => selector.includes('data-composer-navigation-target="reasoning"')
    ? [t.page.trigger] : query(selector);
  t.page.trigger.innerText = 'Extra High';
  t.page.trigger.setAttribute('data-selected-reasoning-effort', 'max');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(t.page.isExtraHigh(), true);
  assert.equal(t.page.sends, 0);
  assert.match(t.page.diagnostic(), /Confirmación del selector:.*selector=ausente/);
});

for (const label of ['Medium', 'High', 'Pro', 'Max', 'Ultra', 'Persistent']) {
  test(`a delayed ${label} is never accepted as Extra High`, async () => {
    const t = transition({ kind: 'missing', delay: 9000, label, value: label === 'Max' ? 'max' : 'medium' });
    await assert.rejects(t.page.run(), /El botón no confirma Extra High/);
    assert.equal(t.page.sends, 0);
  });
}
test('contradictory Extra High label and medium value cannot send', async () => {
  const t = transition({ kind: 'blank', delay: 9000, value: 'medium' });
  await assert.rejects(t.page.run(), /El botón no confirma Extra High/);
  assert.equal(t.page.sends, 0);
});

for (const [name, action, expected] of [
  ['Escape', page => page.interact({ type: 'keydown', key: 'Escape', isTrusted: true, target: {} }), /Cancelado con Escape/],
  ['navigation', page => { page.location.href = 'https://chatgpt.com/c/another-fixture'; }, /La dirección ha cambiado/],
  ['different query', page => { page.location.search = '?q=Different'; }, /La consulta de la dirección ha cambiado/],
  ['different draft', (_page, env) => { env.input.innerText = 'Private replacement draft'; }, /borrador distinto/]
]) {
  test(`${name} during delayed confirmation cancels without sending`, async () => {
    const t = transition({ kind: 'blank', delay: 12000, actionAt: 9000, action });
    await assert.rejects(t.page.run(), expected);
    assert.equal(t.page.sends, 0);
    assert.ok(t.page.elapsedMs < 12000);
    assert.ok(!t.page.diagnostic().includes('Private replacement draft'));
  });
}
test('already ready path still sends at 80 ms with no extra selection delay', async () => {
  const page = readyComposer(null);
  await page.run();
  assert.equal(page.sentAt, 80);
  assert.equal(page.sends, 1);
});


test('existing selector workflow changes only its final confirmation call', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const root = path.join(__dirname, '..');
  const current = fs.readFileSync(path.join(root, 'chatgpt-extra-high.user.js'), 'utf8');
  const previous = execFileSync('git', ['show', 'v1.3.12:chatgpt-extra-high.user.js'], { cwd: root, encoding: 'utf8' });
  const extract = text => text.slice(text.indexOf('  async function selectExtraHigh() {'), text.indexOf('  async function fillPrompt('));
  const expected = extract(previous).replace(
    "await waitFor(isExtraHigh, 'El botón no confirma Extra High después de cerrar Power.', MENU_TIMEOUT_MS, READY_STABLE_MS);",
    'await waitForEffortConfirmation();');
  assert.equal(extract(current), expected);
});

test('an absent menu reference does not cause empty-ID lookups while waiting', async () => {
  let emptyLookups = 0;
  const t = transition({ kind: 'missing', delay: 9000, actionAt: 100, action(_page, env) {
    const getById = env.document.getElementById;
    env.document.getElementById = id => {
      if (id === '') emptyLookups++;
      return getById(id);
    };
  } });
  await t.page.run();
  assert.equal(t.page.sends, 1);
  assert.equal(emptyLookups, 0);
});

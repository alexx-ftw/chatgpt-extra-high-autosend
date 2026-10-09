const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

for (const [label, options, budget] of [
  ['already prepared', {}, 100],
  ['empty editor with synchronous paste', { empty: true }, 350],
  ['slider with an internal keyboard handler', { pro: true }, 350]
]) {
  test('joint readiness avoids serial settling: ' + label, async () => {
    const page = readyComposer(null, options);
    await page.run();
    assert.equal(page.sends, 1);
    assert.equal(page.trigger.innerText, 'Extra High');
    assert.equal(page.input.innerText, 'Test prompt');
    assert.equal(page.createdPanels, 0);
    assert.ok(page.sentAt <= budget, `${page.sentAt} ms exceeds ${budget} ms`);
    assert.ok(page.sentAt >= 80, 'Keep the final 80 ms safety window');
  });
}

for (const kind of ['editor', 'selector', 'send']) {
  test('replacing the ' + kind + ' restarts the full final window', async () => {
    let replacedAt = null;
    const page = readyComposer(null, { onTick(env) {
      if (env.phase !== '3/3 Envío' || replacedAt !== null) return;
      replacedAt = env.now;
      const original = kind === 'editor' ? env.input : kind === 'selector' ? env.trigger : env.send;
      const replacement = { ...original };
      if (kind === 'send') {
        env.form.querySelectorAll = () => [replacement];
      } else {
        const query = env.document.querySelectorAll;
        const marker = kind === 'editor' ? 'data-composer-markdown' : 'data-composer-navigation-target="reasoning"';
        env.document.querySelectorAll = selector => selector.includes(marker) ? [replacement] : query(selector);
      }
    } });
    await page.run();
    assert.notEqual(replacedAt, null);
    assert.equal(page.sends, 1);
    assert.ok(page.sentAt >= replacedAt + 80, `${page.sentAt - replacedAt} ms after replacement`);
  });
}

test('an open selector blocks sending until it closes and settles', async () => {
  let openedAt = null, closedAt = null;
  const page = readyComposer(null, { onTick(env) {
    if (env.phase !== '3/3 Envío') return;
    if (openedAt === null) {
      openedAt = env.now;
      env.trigger.setAttribute('aria-expanded', 'true');
    } else if (closedAt === null) {
      closedAt = env.now;
      env.trigger.setAttribute('aria-expanded', 'false');
    }
  } });
  await page.run();
  assert.notEqual(closedAt, null, 'Do not send with the menu still open');
  assert.equal(page.sends, 1);
  assert.ok(page.sentAt >= closedAt + 80);
});

test('an effort change during the final window prevents sending', async () => {
  const page = readyComposer(null, { onTick(env) {
    if (env.phase !== '3/3 Envío') return;
    env.trigger.innerText = 'Pro';
    env.trigger.setAttribute('data-selected-reasoning-effort', 'medium');
  } });
  await assert.rejects(page.run(), /El texto, Extra High o el botón Enviar/);
  assert.equal(page.sends, 0);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

for (const [name, nextUrl] of [
  ['unchanged URL', null],
  ['q emptied during load', '?q='],
  ['query removed during load', '/'],
  ['q moved to prompt during load', '?prompt=Test%20prompt'],
  ['secondary empty alias added during load', '?q=Test%20prompt&prompt=']
]) {
  test('ready composer reaches one send after ' + name, async () => {
    const page = readyComposer(nextUrl);
    await page.run();
    assert.equal(page.sends, 1);
    assert.equal(page.location.search, '');
    assert.equal(page.input.innerText, 'Test prompt');
    assert.equal(page.phase, 'Envío observado');
    assert.equal(page.createdPanels, 0, 'Normal runs must never mount the panel');
  });
}

test('a different query prevents sending even when the old editor text matches', async () => {
  const page = readyComposer('?q=Other');
  await assert.rejects(page.run(), /La consulta de la dirección ha cambiado/);
  assert.equal(page.sends, 0);
  assert.equal(page.input.innerText, 'Test prompt');
});

test('a different chat path prevents sending a ready composer', async () => {
  const page = readyComposer('/c/another-thread');
  await assert.rejects(page.run(), /La dirección ha cambiado/);
  assert.equal(page.sends, 0);
});

// Exercise the actual notify(), not a spy that would mask rendering bugs.
test('successful send never creates a panel, not even transiently', async () => {
  const page = readyComposer(null);
  await page.run();
  assert.equal(page.createdPanels, 0);
  assert.equal(page.panelVisible, false);
  assert.equal(page.removals, 0);
  assert.equal(page.sends, 1);
  assert.equal(page.statuses.length, 0);
  assert.match(page.diagnostic(), /Envío observado/);
  assert.match(page.diagnostic(), /Cargando texto/);
  assert.match(page.diagnostic(), /ha iniciado el mensaje/);
});

test('waiting for delayed acknowledgement remains silent', async () => {
  const page = readyComposer(null, { delay: 600 });
  await page.run();
  assert.ok(page.pendingPanels.length >= 3);
  assert.ok(page.pendingPanels.every(visible => !visible));
  assert.equal(page.createdPanels, 0);
  assert.equal(page.panelVisible, false);
});

test('unconfirmed send shows only the warning panel and never retries', async () => {
  const page = readyComposer(null, { acknowledge: false });
  await page.run();
  assert.equal(page.phase, 'Envío sin confirmar');
  assert.ok(page.pendingPanels.every(visible => !visible));
  assert.equal(page.createdPanels, 1);
  assert.equal(page.panelVisible, true);
  assert.equal(page.removals, 0);
  assert.equal(page.sends, 1);
  assert.equal(page.statuses.length, 1);
  assert.match(page.statuses[0], /^E31:/);
});

test('successful send tolerates an absent panel', async () => {
  const page = readyComposer(null, { panelAlreadyRemoved: true });
  await page.run();
  assert.equal(page.phase, 'Envío observado');
  assert.equal(page.panelVisible, false);
  assert.equal(page.createdPanels, 0);
  assert.equal(page.sends, 1);
});

test('ordinary progress messages are logged without creating UI', () => {
  const page = readyComposer(null);
  page.notify('Normal progress');
  page.notify('More progress', false);
  assert.equal(page.createdPanels, 0);
  assert.equal(page.panelVisible, false);
  assert.match(page.diagnostic(), /Normal progress/);
  assert.match(page.diagnostic(), /More progress/);
});

for (const [kind, message] of [
  ['error', 'E21: Selector unavailable.'],
  ['failure', 'Could not confirm Extra High.'],
  ['warning', 'E00: Another script instance is already running.']
]) {
  test(kind + ' keeps a visible panel with a working diagnostic button', async () => {
    const page = readyComposer(null);
    // Existing error, cancellation and conflict call sites use the alert flag.
    page.notify(message, true);
    assert.equal(page.panelVisible, true);
    assert.equal(page.createdPanels, 1);
    assert.equal(page.statuses.at(-1), message);
    await page.copyDiagnostic();
    assert.equal(page.clipboard.length, 1);
    assert.match(page.clipboard[0], /ChatGPT Extra High/);
    assert.ok(page.clipboard[0].includes(message));
    assert.equal(page.clipboard[0].includes('Test prompt'), false);
  });
}

test('normal progress cannot overwrite or hide an existing alert', () => {
  const page = readyComposer(null);
  page.notify('Important warning', true);
  page.notify('Normal progress');
  assert.equal(page.createdPanels, 1);
  assert.equal(page.panelVisible, true);
  assert.equal(page.statuses.length, 1);
  assert.equal(page.statuses[0], 'Important warning');
  assert.match(page.diagnostic(), /Normal progress/);
});

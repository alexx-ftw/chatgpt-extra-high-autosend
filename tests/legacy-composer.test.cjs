const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readyComposer } = require('./helpers/composer.cjs');

// Synthetic controls only. Never commit a private page dump as a fixture.
function legacyComposer(options = {}) {
  const page = readyComposer(options.nextUrl || null, options);
  const { input, trigger, document, form } = page;
  const inputHas = input.hasAttribute;
  input.hasAttribute = key => key === 'data-composer-markdown' ? false : inputHas(key);
  const getAttribute = trigger.getAttribute;
  trigger.getAttribute = key => key === 'data-selected-reasoning-effort' ? null : getAttribute(key);
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.closest = selector => selector === 'form' ? form : null;
  form.matches = selector => selector === 'form[data-type="unified-composer"]' && !options.unknownForm;
  let candidates = [trigger];
  const queryForm = form.querySelectorAll;
  form.querySelectorAll = selector => {
    if (selector.includes('data-composer-transition-slot="trailing"')) return options.notTrailing ? [] : candidates;
    if (selector.includes('model-switcher-dropdown-button')) return [];
    return queryForm(selector);
  };
  const queryDocument = document.querySelectorAll;
  document.querySelectorAll = selector => selector.includes('data-composer-navigation-target="reasoning"')
    ? [] : queryDocument(selector);
  return Object.assign(page, { setCandidates(value) { candidates = value; },
    restoreModernDetection() { document.querySelectorAll = queryDocument; } });
}

for (const [name, nextUrl] of [
  ['q', null],
  ['q consumed into prompt', '?prompt=Test%20prompt'],
  ['classic and temporary parameters', '?q=Test%20prompt&oauth_return_surface=classic&temporary-chat=true']
]) {
  test('legacy pill already on Extra High sends once: ' + name, async () => {
    const page = legacyComposer({ nextUrl });
    assert.equal(page.findEffort(), page.trigger);
    assert.equal(page.isExtraHigh(), true);
    await page.run();
    assert.equal(page.sends, 1);
    assert.equal(page.createdPanels, 0);
    assert.equal(page.sentAt, 80);
    if (nextUrl?.includes('oauth_return_surface')) {
      assert.equal(page.location.searchParams.get('oauth_return_surface'), 'classic');
      assert.equal(page.location.searchParams.get('temporary-chat'), 'true');
    }
  });
}

test('legacy pill can reuse the existing power slider workflow', async () => {
  const page = legacyComposer({ pro: true });
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.trigger.innerText, 'Extra High');
  assert.equal(page.createdPanels, 0);
});

for (const label of ['Medium', 'High', 'Extra High', 'Pro', 'Max', 'Ultra', 'Persistent', 'Extra Alto']) {
  test('legacy discovery recognizes exactly one displayed effort: ' + label, () => {
    const page = legacyComposer();
    page.trigger.innerText = label;
    assert.equal(page.findEffort(), page.trigger);
    assert.equal(page.isExtraHigh(), /^(?:Extra High|Extra Alto)$/.test(label));
  });
}

for (const label of ['Add files and more', 'Search', 'Select model', 'Extra High Pro', 'Medium High Extra High', 'Choose Extra High mode']) {
  test('legacy discovery rejects an unrelated or ambiguous label: ' + label, () => {
    const page = legacyComposer();
    page.trigger.innerText = label;
    assert.equal(page.findEffort() || null, null);
  });
}

test('legacy fallback requires the identified unified composer', () => {
  const page = legacyComposer({ unknownForm: true });
  assert.equal(page.findEffort() || null, null);
});

test('legacy fallback cannot select a leading attachment menu', () => {
  const page = legacyComposer({ notTrailing: true });
  assert.equal(page.findEffort() || null, null);
});

test('legacy fallback rejects hidden controls', () => {
  const page = legacyComposer();
  page.trigger.getClientRects = () => [];
  assert.equal(page.findEffort() || null, null);
});

test('legacy fallback does not guess between two matching pills', () => {
  const page = legacyComposer();
  page.setCandidates([page.trigger, { ...page.trigger }]);
  assert.equal(page.findEffort() || null, null);
});

test('legacy fallback ignores controls owned by another form', () => {
  const page = legacyComposer();
  page.trigger.closest = selector => selector === 'form' ? {} : null;
  assert.equal(page.findEffort() || null, null);
});

test('disabled legacy pill cannot confirm Extra High', () => {
  const page = legacyComposer();
  page.trigger.setAttribute('aria-disabled', 'true');
  assert.equal(page.isExtraHigh(), false);
});

test('newer explicit selector wins without querying the legacy fallback', async () => {
  const page = readyComposer(null);
  const query = page.form.querySelectorAll;
  page.form.querySelectorAll = selector => {
    assert.ok(!selector.includes('data-composer-transition-slot="trailing"'));
    return query(selector);
  };
  assert.equal(page.findEffort(), page.trigger);
  await page.run();
  assert.equal(page.sends, 1);
  assert.equal(page.sentAt, 80);
});

test('original named model selector still wins before the legacy fallback', () => {
  const page = legacyComposer();
  const named = { ...page.trigger };
  const query = page.form.querySelectorAll;
  page.form.querySelectorAll = selector => {
    assert.ok(!selector.includes('data-composer-transition-slot="trailing"'));
    return selector.includes('model-switcher-dropdown-button') ? [named] : query(selector);
  };
  assert.equal(page.findEffort(), named);
});

test('legacy discovery, effort validation and post-send behavior stay identical to v1.3.11', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const root = path.join(__dirname, '..');
  const current = fs.readFileSync(path.join(root, 'chatgpt-extra-high.user.js'), 'utf8');
  const previous = execFileSync('git', ['show', 'v1.3.11:chatgpt-extra-high.user.js'], { cwd: root, encoding: 'utf8' });
  const extract = (text, name) => {
    const match = new RegExp('  (?:async )?function ' + name + '[(]').exec(text);
    assert.ok(match, name);
    const end = text.indexOf('\n  }\n', match.index);
    return text.slice(match.index, end + 5);
  };
  for (const name of ['legacyEffortTrigger', 'isExtraHigh', 'adjustPower',
    'fillPrompt', 'waitForReadyToSend', 'consumeQuery', 'observeSendOutcome']) {
    assert.equal(extract(current, name), extract(previous, name), name);
  }
});

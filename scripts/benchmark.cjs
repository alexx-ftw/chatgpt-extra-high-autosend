#!/usr/bin/env node
'use strict';
// Synthetic clock and DOM: measures script-imposed waits, NOT site/network speed.
// SCRIPT_UNDER_TEST can point to an older release for an identical comparison.
const { readyComposer } = require('../tests/helpers/composer.cjs');
(async () => {
  const results = [];
  for (const [scenario, options] of [
    ['ready', {}], ['empty', { empty: true }], ['slider', { pro: true }]
  ]) {
    const page = readyComposer(null, options);
    await page.run();
    results.push({ scenario, simulatedMsToClick: page.sentAt, sends: page.sends });
  }
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });

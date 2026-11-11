'use strict';

/** Wpisywanie daty w polu DD.MM.RRRR (`publiczne/js/formaty.js`). */

const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../publiczne/js/formaty.js');

test('parsujDate: format polski, same cyfry i wklejony ISO; data nieistniejąca — null', () => {
  assert.equal(f.parsujDate('12.03.2026'), '2026-03-12');
  assert.equal(f.parsujDate('2026-03-12'), '2026-03-12');
  assert.equal(f.parsujDate('12032026'), '2026-03-12');
  assert.equal(f.parsujDate('31.02.2026'), null);
});

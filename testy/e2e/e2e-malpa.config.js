'use strict';

/** `npm run e2e:malpa` — ta sama konfiguracja co `npm run e2e`, tryb „małpa” (bez zmiennych w poleceniu — działa też na Windows). */

process.env.PSA_E2E_TRYB = 'malpa';
module.exports = require('./e2e.config');

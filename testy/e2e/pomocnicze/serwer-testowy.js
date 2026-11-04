'use strict';

/**
 * Serwer dla `npm run zrzuty` i `npm run e2e`: TRYB TESTOWY na osobnej bazie i katalogu
 * (`dane-testowe/zrzuty/` albo `PSA_E2E_KATALOG` — każdy scenariusz e2e ma własny),
 * świeże dane z `test:seed`, poczta do skrzynki testowej, atrapa tpay.
 */

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const KORZEN = path.join(__dirname, '..', '..', '..');
const KATALOG = process.env.PSA_E2E_KATALOG || path.join(KORZEN, 'dane-testowe', 'zrzuty');
process.env.PSA_TRYB_TESTOWY = '1';
process.env.PSA_KATALOG_TESTOWY = KATALOG;
process.env.PSA_BAZA_TESTOWA = path.join(KATALOG, 'kancelaria-testowa.db');
const PORT = Number(process.env.PSA_ZRZUTY_PORT || 3105);
// Linki w e-mailach, w kasie tpay i adres powrotu — na ten serwer (konfiguracja buduje je z PORT / URL_PORTALU).
process.env.PORT = String(PORT);
process.env.URL_PORTALU = `http://127.0.0.1:${PORT}/portal.html`;

execFileSync(process.execPath, [path.join(KORZEN, 'narzedzia', 'test-seed.js')], { cwd: KORZEN, env: process.env, stdio: ['ignore', 'ignore', 'inherit'] });

const app = require(path.join(KORZEN, 'serwer'));
const tryb = require(path.join(KORZEN, 'server', 'tryb-testowy'));
app.listen(PORT, '127.0.0.1', () => {
  tryb.ustawAtrapeTpay(PORT);
  console.log(`[zrzuty] serwer testowy: http://127.0.0.1:${PORT}`);
});

'use strict';

/**
 * Serwer dla `npm run zrzuty`: TRYB TESTOWY na osobnej bazie i katalogu (`dane-testowe/zrzuty/`),
 * świeże dane z `test:seed`, poczta do skrzynki testowej, atrapa tpay.
 */

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const KORZEN = path.join(__dirname, '..', '..', '..');
const KATALOG = path.join(KORZEN, 'dane-testowe', 'zrzuty');
process.env.PSA_TRYB_TESTOWY = '1';
process.env.PSA_KATALOG_TESTOWY = KATALOG;
process.env.PSA_BAZA_TESTOWA = path.join(KATALOG, 'kancelaria-testowa.db');
const PORT = Number(process.env.PSA_ZRZUTY_PORT || 3105);

execFileSync(process.execPath, [path.join(KORZEN, 'narzedzia', 'test-seed.js')], { cwd: KORZEN, env: process.env, stdio: ['ignore', 'ignore', 'inherit'] });

const app = require(path.join(KORZEN, 'serwer'));
const tryb = require(path.join(KORZEN, 'server', 'tryb-testowy'));
app.listen(PORT, '127.0.0.1', () => {
  tryb.ustawAtrapeTpay(PORT);
  console.log(`[zrzuty] serwer testowy: http://127.0.0.1:${PORT}`);
});

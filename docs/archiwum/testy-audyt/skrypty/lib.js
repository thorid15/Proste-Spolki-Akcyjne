'use strict';
const { chromium } = require('/home/user/Proste-Spolki-Akcyjne/testy-audyt/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ADRES = 'http://localhost:3005';
const SHOT_DIR = '/home/user/Proste-Spolki-Akcyjne/testy-audyt/zrzuty/faza1-s1';
const SCRATCH = '/home/user/Proste-Spolki-Akcyjne/testy-audyt/skrypty/_stan';
if (!fs.existsSync(SCRATCH)) fs.mkdirSync(SCRATCH, { recursive: true });

const STATE_FILE = path.join(SCRATCH, 'stan.json');
const KLIENT_STORAGE = path.join(SCRATCH, 'klient-storage.json');
const KANC_STORAGE = path.join(SCRATCH, 'kanc-storage.json');
const PORTAL_STORAGE = path.join(SCRATCH, 'portal2-storage.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function writeState(patch) {
  const cur = readState();
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...cur, ...patch }, null, 2));
}

let shotCounter = null;
function initShotCounter() {
  if (shotCounter !== null) return;
  const existing = fs.existsSync(SHOT_DIR) ? fs.readdirSync(SHOT_DIR) : [];
  const nums = existing.map((f) => parseInt(f.slice(0, 2), 10)).filter((n) => !Number.isNaN(n));
  shotCounter = nums.length ? Math.max(...nums) : 0;
}
async function shot(page, name) {
  initShotCounter();
  shotCounter += 1;
  const fname = `${String(shotCounter).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, fname), fullPage: true });
  console.log('SHOT', fname);
  return fname;
}

async function launch() {
  return chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
}

// UWAGA (patrz ZNALEZISKA.md): w aplikacji WSPOLISTNIEJA DWIE rozne
// implementacje komponentu `Pole`:
//  - staff/kancelaria (ui.js, uzywana w spolki.js/kreator.js/osoby.js —
//    ekrany pod "/", np. "Migracja - stan otwarcia"): <div class="frow">
//    <label class="fl"> jako RODZENSTWO inputu, BEZ for/id w ogole —
//    zaden input nie jest programowo powiazany z etykieta.
//  - portal klienta (ui-rejestr.js, portal.html): <div class="pole">
//    <label class="pole-etykieta" for=...> — ale `for` jest dodawany
//    TYLKO gdy dziecko Pole to POJEDYNCZY <input>/<select>/<textarea>;
//    pola zlozone (data 3-segmentowa, kwota, KRS+przycisk, autouzupelnianie)
//    zostaja bez powiazania.
// Stad DWA warianty helpera po strukturze DOM, nie po getByLabel().
function frowByLabel(page, tekst) {
  return page.locator('div.frow').filter({ has: page.locator('label.fl', { hasText: tekst }) }).first();
}
function poleByLabel(page, tekst) {
  return page.locator('div.pole').filter({ has: page.locator('label.pole-etykieta', { hasText: tekst }) }).first();
}
async function fillPole(page, etykieta, wartosc, { staff = false } = {}) {
  const zakres = staff ? frowByLabel(page, etykieta) : poleByLabel(page, etykieta);
  const input = zakres.locator('input, textarea').first();
  await input.fill(wartosc);
}
async function selectPole(page, etykieta, wartosc, { staff = false } = {}) {
  const zakres = staff ? frowByLabel(page, etykieta) : poleByLabel(page, etykieta);
  await zakres.locator('select').first().selectOption(wartosc);
}
async function checkPrzelacznik(page, etykieta) {
  // Checkbox jest wizualnie ukryty pod niestandardowym "torem" (CSS) -
  // check() zwykly odmawia (element niewidoczny), stad force.
  const chk = page.locator('label.przelacznik-glowna', { hasText: etykieta }).locator('input[type=checkbox]');
  await chk.evaluate((el) => { el.click(); });
}
// PoleDaty (ui-rejestr.js, uzywana po OBU stronach) to TRZY osobne pola
// (dzien/miesiac/rok, aria-label "Dzień"/"Miesiąc"/"Rok"), nie jeden
// <input type=date>.
async function fillData(page, etykieta, isoDate, { staff = false } = {}) {
  const [rok, miesiac, dzien] = isoDate.split('-');
  const zakres = staff ? frowByLabel(page, etykieta) : poleByLabel(page, etykieta);
  await zakres.getByLabel('Dzień').fill(dzien);
  await zakres.getByLabel('Miesiąc').fill(miesiac);
  await zakres.getByLabel('Rok').fill(rok);
}

module.exports = {
  ADRES, SHOT_DIR, STATE_FILE, KLIENT_STORAGE, KANC_STORAGE, PORTAL_STORAGE,
  readState, writeState, shot, launch,
  frowByLabel, poleByLabel, fillPole, selectPole, checkPrzelacznik, fillData,
};

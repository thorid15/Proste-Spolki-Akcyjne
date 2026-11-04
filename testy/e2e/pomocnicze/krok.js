'use strict';

/**
 * Rejestrator kroków scenariusza (SESJA-PSA-ANALIZA-PRZEPLYWOW, Faza 2).
 *
 *   const r = rozpocznij(page, testInfo, { scenariusz, proces, szerokosc, oczekiwaneHttp: [/\/wniosek\/nowy$/] });
 *   await krok(page, 'Co się zbywa', async () => { … });
 *   await zakoncz(page);   // zapisuje testy/e2e/raport/czesci/<scenariusz>-<szerokosc>.json
 *
 * Krok liczy: kliknięcia (zdarzenia `click` od użytkownika), wypełnione pola (unikalne pola z `input`/`change`),
 * przejścia między widokami (nawigacje ramki głównej, także zmiana `#/…`), czas; po kroku: zrzut, pola widoczne,
 * błędy konsoli, `pageerror`, odpowiedzi HTTP ≥ 400 (poza oczekiwanymi), `sprawdzUklad` i axe-core (WCAG 2.1 AA).
 * Pasek trybu testowego (`#psa-pasek-testowy`) nie wchodzi do metryk ani do axe.
 */

const fs = require('node:fs');
const path = require('node:path');
const { AxeBuilder } = require('@axe-core/playwright');
const { sprawdzUklad } = require('./uklad');

const RAPORT = path.join(__dirname, '..', 'raport');
const CZESCI = path.join(RAPORT, 'czesci');
const ZRZUTY = path.join(RAPORT, 'zrzuty');

/** Liczniki w przeglądarce — w sessionStorage, żeby przetrwały przeładowanie strony. */
const SKRYPT_LICZNIKOW = () => {
  const K = '__psa_metryki';
  const czytaj = () => { try { return JSON.parse(sessionStorage.getItem(K)) || { klik: 0, pola: [], zazn: [] }; } catch { return { klik: 0, pola: [], zazn: [] }; } };
  const zapisz = (m) => { try { sessionStorage.setItem(K, JSON.stringify(m)); } catch { /* brak */ } };
  const poza = (el) => el && el.closest && el.closest('#psa-pasek-testowy');
  // Pole logiczne: `.pole` (np. PoleDaty = 3 segmenty, ale jedno pole) albo sam element.
  const klucz = (el) => {
    const p = el.closest('.pole');
    if (p) return `pole:${(p.querySelector('.pole-etykieta') || {}).textContent || ''}:${[...document.querySelectorAll('.pole')].indexOf(p)}`;
    return el.id || el.name || `${el.tagName}:${(el.getAttribute('aria-label') || el.placeholder || '').slice(0, 30)}:${[...document.querySelectorAll(el.tagName)].indexOf(el)}`;
  };
  document.addEventListener('click', (z) => {
    if (!z.isTrusted || poza(z.target)) return;
    const m = czytaj(); m.klik += 1; zapisz(m);
  }, true);
  const pole = (z) => {
    const el = z.target;
    if (!z.isTrusted || !el || poza(el) || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    const m = czytaj(); m.zazn = m.zazn || [];
    const lista = el.type === 'checkbox' || el.type === 'radio' ? m.zazn : m.pola;
    const k = el.type === 'checkbox' || el.type === 'radio' ? `${klucz(el)}:${el.id || el.value || [...document.querySelectorAll('input')].indexOf(el)}` : klucz(el);
    if (!lista.includes(k)) { lista.push(k); zapisz(m); }
  };
  document.addEventListener('input', pole, true);
  document.addEventListener('change', pole, true);
};

function rozpocznij(page, testInfo, { scenariusz, proces, szerokosc, oczekiwaneHttp = [], persona = null }) {
  const r = {
    scenariusz, proces, szerokosc, persona, kroki: [], bledy: [], oczekiwaneHttp,
    _konsola: [], _pageerror: [], _http: [], _nawigacje: 0, _dialogi: [],
  };
  page.__rejestrator = r;
  page.addInitScript(SKRYPT_LICZNIKOW);
  page.on('console', (m) => { if (m.type() === 'error') r._konsola.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => r._pageerror.push(String(e.message || e).slice(0, 300)));
  page.on('response', (o) => {
    if (o.status() < 400) return;
    const adres = o.url().replace(/^https?:\/\/[^/]+/, '');
    if (r.oczekiwaneHttp.some((w) => w.test(adres))) return;
    r._http.push(`${o.request().method()} ${adres} → ${o.status()}`);
  });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) r._nawigacje += 1; });
  page.on('dialog', async (d) => { r._dialogi.push(`${d.type()}: ${d.message().slice(0, 120)}`); await d.accept().catch(() => {}); });
  fs.mkdirSync(path.join(ZRZUTY, scenariusz), { recursive: true });
  fs.mkdirSync(CZESCI, { recursive: true });
  r.testInfo = testInfo;
  return r;
}

async function czytajLiczniki(page) {
  return page.evaluate(() => {
    try { return JSON.parse(sessionStorage.getItem('__psa_metryki')) || { klik: 0, pola: [], zazn: [] }; } catch { return { klik: 0, pola: [], zazn: [] }; }
  }).catch(() => ({ klik: 0, pola: [], zazn: [] }));
}

async function zerujLiczniki(page) {
  await page.evaluate(() => { try { sessionStorage.setItem('__psa_metryki', JSON.stringify({ klik: 0, pola: [], zazn: [] })); } catch { /* brak */ } }).catch(() => {});
}

/**
 * Pola widoczne i aktywne na ekranie — logiczne (`.pole` = jedno pole), osobno pola wyboru (checkbox/radio).
 * Bez paska testowego, wyszukiwarek list (`type=search`, placeholder „Szukaj”), przycisków i ukrytych.
 */
async function polaWidoczne(page) {
  return page.evaluate(() => {
    const widoczny = (el) => {
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1;
    };
    const el = [...document.querySelectorAll('input, select, textarea')]
      .filter((e) => !e.closest('#psa-pasek-testowy') && !e.disabled && !['hidden', 'submit', 'button', 'search'].includes(e.type)
        && !/^Szukaj/i.test(e.placeholder || '') && widoczny(e));
    const wybor = el.filter((e) => e.type === 'checkbox' || e.type === 'radio');
    const pola = new Set(el.filter((e) => !wybor.includes(e)).map((e) => e.closest('.pole') || e));
    return { pola: pola.size, wybor: wybor.length };
  }).catch(() => ({ pola: null, wybor: null }));
}

async function krok(page, nazwa, fn, { bezAxe = false } = {}) {
  const r = page.__rejestrator;
  if (!r) throw new Error('krok(): najpierw rozpocznij(page, …)');
  const nr = String(r.kroki.length + 1).padStart(2, '0');
  const k0 = { konsola: r._konsola.length, pageerror: r._pageerror.length, http: r._http.length, nawigacje: r._nawigacje, dialogi: r._dialogi.length };
  await zerujLiczniki(page);
  const start = Date.now();
  let wyjatek = null;
  try {
    await fn();
  } catch (e) {
    wyjatek = e;
  }
  const czas = Date.now() - start;
  await page.waitForTimeout(250);
  // Przy wyjątku: co ekran mówi (błędy, ostrzeżenia, nieaktywne przyciski) — do raportu zamiast oglądania zrzutu.
  const stanEkranu = wyjatek ? await page.evaluate(() => {
    const t = (el) => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 200);
    return {
      komunikaty: [...document.querySelectorAll('.komunikat-blad, .komunikat-uwaga, .pole-blad, [role="alert"]')].map(t).filter(Boolean).slice(0, 8),
      nieaktywne: [...document.querySelectorAll('button:disabled')].map(t).filter(Boolean).slice(0, 8),
      naglowki: [...document.querySelectorAll('.card-h, h1, h2, .krok-naglowek')].map(t).filter(Boolean).slice(0, 6),
      tresc: (document.querySelector('main, #tresc, .tresc') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 600),
    };
  }).catch(() => null) : null;
  const liczniki = await czytajLiczniki(page);
  const plik = `${nr}-${nazwa.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40)}-${r.szerokosc}.png`;
  const sciezka = path.join(ZRZUTY, r.scenariusz, plik);
  await page.screenshot({ path: sciezka, fullPage: true }).catch(() => {});
  let uklad = [];
  try { uklad = await sprawdzUklad(page, '.karta'); } catch { /* strona bez kart */ }
  let axe = [];
  if (!bezAxe) {
    try {
      const wynik = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('#psa-pasek-testowy').analyze();
      axe = wynik.violations.map((v) => ({ id: v.id, wplyw: v.impact, opis: v.help, wezly: v.nodes.length, przyklad: (v.nodes[0] && v.nodes[0].target.join(' ')) || '' }));
    } catch (e) {
      axe = [{ id: 'axe-blad', wplyw: null, opis: String(e.message).slice(0, 120), wezly: 0 }];
    }
  }
  const wpis = {
    nr: Number(nr),
    nazwa,
    adres: page.url().replace(/^https?:\/\/[^/]+/, ''),
    zrzut: path.relative(RAPORT, sciezka),
    klikniecia: liczniki.klik,
    pola_wypelnione: liczniki.pola.length,
    zaznaczenia: (liczniki.zazn || []).length,
    ...(await polaWidoczne(page).then((w) => ({ pola_widoczne: w.pola, wybor_widoczne: w.wybor }))),
    przejscia: r._nawigacje - k0.nawigacje,
    czas_ms: czas,
    bledy_konsoli: r._konsola.slice(k0.konsola),
    bledy_js: r._pageerror.slice(k0.pageerror),
    http: r._http.slice(k0.http),
    dialogi_natywne: r._dialogi.slice(k0.dialogi),
    uklad,
    axe,
    wyjatek: wyjatek ? String(wyjatek.message).split('\n')[0].slice(0, 300) : null,
    stan_ekranu: stanEkranu,
  };
  r.kroki.push(wpis);
  if (wyjatek) {
    await zakoncz(page);
    throw wyjatek;
  }
  return wpis;
}

async function zakoncz(page) {
  const r = page.__rejestrator;
  if (!r || r._zapisano) return;
  r._zapisano = true;
  const suma = (k) => r.kroki.reduce((s, x) => s + (x[k] || 0), 0);
  const wynik = {
    scenariusz: r.scenariusz,
    proces: r.proces,
    persona: r.persona,
    szerokosc: r.szerokosc,
    status: r.kroki.some((k) => k.wyjatek) ? 'przerwany' : 'ukonczony',
    metryki: {
      kroki: r.kroki.length,
      ekrany: new Set(r.kroki.map((k) => k.adres.replace(/\?.*$/, ''))).size,
      klikniecia: suma('klikniecia'),
      pola_wypelnione: suma('pola_wypelnione'),
      zaznaczenia: suma('zaznaczenia'),
      pola_widoczne_max: Math.max(0, ...r.kroki.map((k) => k.pola_widoczne || 0)),
      przejscia: suma('przejscia'),
      czas_ms: suma('czas_ms'),
    },
    bledy: {
      js: r.kroki.flatMap((k) => k.bledy_js),
      konsola: r.kroki.flatMap((k) => k.bledy_konsoli),
      http: r.kroki.flatMap((k) => k.http),
      dialogi_natywne: r.kroki.flatMap((k) => k.dialogi_natywne),
    },
    problemy_ukladu: r.kroki.reduce((s, k) => s + k.uklad.length, 0),
    naruszenia_axe: [...new Set(r.kroki.flatMap((k) => k.axe.map((a) => a.id)))],
    kroki: r.kroki,
  };
  fs.writeFileSync(path.join(CZESCI, `${r.scenariusz}-${r.szerokosc}.json`), JSON.stringify(wynik, null, 2));
}

module.exports = { rozpocznij, krok, zakoncz, RAPORT, CZESCI, ZRZUTY };

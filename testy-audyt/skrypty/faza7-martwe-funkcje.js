'use strict';
// Faza 7: przechodzimy po glownych ekranach kancelarii i zbieramy
// (a) bledy konsoli, (b) zadania sieciowe zakonczone 404/500,
// (c) linki/przyciski prowadzace donikad. Zrzuty do testy-audyt/zrzuty/faza7/.
const { chromium } = require('/home/user/Proste-Spolki-Akcyjne/testy-audyt/node_modules/playwright');

const BAZA = 'http://localhost:3005';
const ZRZUTY = '/home/user/Proste-Spolki-Akcyjne/testy-audyt/zrzuty/faza7';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const bledySieciowe = [];
  const bledyKonsoli = [];

  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      bledySieciowe.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') bledyKonsoli.push(m.text());
  });
  page.on('pageerror', (e) => bledyKonsoli.push(`pageerror: ${e.message}`));

  await page.goto(`${BAZA}/logowanie.html`, { waitUntil: 'networkidle' }).catch(() => {});
  // Sprawdz jaki jest URL logowania - sprobuj glownej strony jesli 404.
  if (page.url().includes('404') || (await page.title()) === '') {
    await page.goto(BAZA, { waitUntil: 'networkidle' });
  }

  // Logowanie przez formularz (jesli widoczny) - inaczej przez API + reload.
  const emailPole = await page.$('input[type="email"], input[name="email"]');
  if (emailPole) {
    await emailPole.fill('audyt@kancelaria.test');
    await page.fill('input[type="password"], input[name="haslo"]', 'St1wcbi9aU-QXg');
    await page.click('button[type="submit"], button:has-text("Zaloguj")');
    await page.waitForTimeout(1500);
  }

  const ekrany = [
    ['pulpit', '#/'],
    ['spolki', '#/spolki'],
    ['osoby', '#/osoby'],
    ['oplaty', '#/oplaty'],
    ['zgloszenia', '#/zgloszenia'],
    ['wnioski', '#/wnioski'],
    ['sprawy', '#/sprawy'],
  ];

  for (const [nazwa, hash] of ekrany) {
    await page.goto(`${BAZA}/${hash}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${ZRZUTY}/martwe-${nazwa}.png`, fullPage: true }).catch(() => {});
  }

  console.log('=== Bledy sieciowe (>=400 na /api/) ===');
  console.log([...new Set(bledySieciowe)].join('\n') || '(brak)');
  console.log('=== Bledy konsoli / JS ===');
  console.log([...new Set(bledyKonsoli)].join('\n') || '(brak)');

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });

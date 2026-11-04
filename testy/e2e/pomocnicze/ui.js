'use strict';

/** Wspólne czynności na komponentach aplikacji (`Pole`, `PoleDaty`, `WyborZKartoteki`, `PasekAkcji`). */

/** `.pole` z etykietą zaczynającą się od tekstu (etykieta bywa z dopiskiem „(opcjonalnie)”). */
function pole(page, etykieta) {
  return page.locator('.pole').filter({ has: page.locator('.pole-etykieta', { hasText: etykieta }) }).first();
}

/** Data w `PoleDaty` (segmenty DD MM RRRR) albo w natywnym `<input type="date">`. `data` — 'RRRR-MM-DD'. */
async function wpiszDate(page, etykieta, data) {
  const p = pole(page, etykieta);
  const [r, m, d] = data.split('-');
  const natywne = p.locator('input[type="date"]');
  if (await natywne.count()) { await natywne.fill(data); return; }
  await p.getByLabel('Dzień').fill(d);
  await p.getByLabel('Miesiąc').fill(m);
  await p.getByLabel('Rok').fill(r);
  await p.getByLabel('Rok').blur();
}

/** `WyborZKartoteki`: wpisuje fragment i wybiera pierwszą pasującą osobę. */
async function wybierzZKartoteki(page, etykieta, szukaj) {
  const p = pole(page, etykieta);
  const wejscie = p.getByRole('combobox');
  await wejscie.click();
  await wejscie.fill(szukaj);
  const opcja = p.getByRole('option').filter({ hasText: szukaj }).first();
  await opcja.waitFor({ timeout: 10000 });
  await opcja.click();
}

/** `<select>` w polu o etykiecie — opcja po fragmencie tekstu. */
async function wybierz(page, etykieta, tekstOpcji) {
  const lista = pole(page, etykieta).locator('select').first();
  const wartosc = await lista.evaluate((el, t) => {
    const o = [...el.options].find((x) => x.textContent.includes(t));
    return o ? o.value : null;
  }, tekstOpcji);
  if (wartosc === null) throw new Error(`brak opcji „${tekstOpcji}” w polu „${etykieta}”`);
  await lista.selectOption(wartosc);
}

async function wpisz(page, etykieta, tekst) {
  await pole(page, etykieta).locator('input, textarea').first().fill(String(tekst));
}

async function przycisk(page, nazwa, opcje = {}) {
  const b = page.getByRole('button', { name: nazwa, exact: opcje.exact !== false }).first();
  await b.click();
}

/** Ekran gotowy: brak szkieletu ładowania (`Spinner`). */
async function gotowe(page, tekst) {
  if (tekst) await page.getByText(tekst, { exact: false }).first().waitFor({ timeout: 15000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

module.exports = { pole, wpiszDate, wybierzZKartoteki, wybierz, wpisz, przycisk, gotowe };

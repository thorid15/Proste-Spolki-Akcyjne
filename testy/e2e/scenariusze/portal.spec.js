'use strict';

/**
 * Portal klienta (P1–P12). Persony: nowy klient „Delta” (delta.zarzad@example.com — fikcyjny), Zarząd Alfa
 * (zarzad@example.com), Anna Testowa (akcjonariusz ze zgodą), Gamma (wnioskodawca z dokumentami do podpisu).
 */

const fs = require('node:fs');
const path = require('node:path');
const { test, zaloguj, api } = require('../pomocnicze/srodowisko');
const { rozpocznij, krok, zakoncz } = require('../pomocnicze/krok');
const ui = require('../pomocnicze/ui');

const szer = (ti) => Number(ti.project.name);
const PDF = { name: 'dokument.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% dane fikcyjne\n%%EOF\n') };
const JPG = { name: 'dowod.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]) };

function linkZeSkrzynki(serwer, adres) {
  const kat = path.join(serwer.katalog, 'skrzynka');
  const pliki = fs.existsSync(kat) ? fs.readdirSync(kat).filter((f) => f.endsWith('.json')).sort() : [];
  for (const f of pliki.reverse()) {
    const w = JSON.parse(fs.readFileSync(path.join(kat, f), 'utf8'));
    if (!String(w.do).includes(adres)) continue;
    const m = `${w.html} ${w.tekst || w.text || ''}`.match(/#\/aktywuj\/[A-Za-z0-9_-]+/);
    if (m) return `/portal.html${m[0]}`;
  }
  return null;
}

/**
 * Numery KRS atrapy (0000990001–3) zajmuje `test:seed` — dla KRS w toku portal odpowiada jak zwykle, ale zaproszenia nie
 * wysyła. Scenariusze używają wolnych numerów spoza atrapy: zgłoszenie przechodzi bez danych z KRS (jak przy niedostępnym API KRS).
 */
async function dalejWniosku(page, nastepny) {
  await page.getByRole('button', { name: 'Dalej', exact: true }).last().click();
  if (nastepny) await page.getByText(nastepny, { exact: false }).first().waitFor({ timeout: 10000 });
}

test('P1–P3: zgłoszenie nowej spółki → zaproszenie → aktywacja → RODO → wniosek → złożenie', async ({ page, serwer }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'portal-nowa-spolka', proces: 'P1–P3 zgłoszenie, aktywacja, wniosek', szerokosc: szer(testInfo), persona: 'Delta (nowy klient)' });
  const EMAIL = 'delta.zarzad@example.com';
  await krok(page, 'Zgłoś się', async () => {
    await page.goto('/portal.html#/zglos-sie');
    await ui.wpisz(page, 'E-mail', EMAIL);
    await ui.wpisz(page, 'Numer KRS spółki', '0000990099');
    await ui.przycisk(page, 'Zgłoś spółkę');
    await page.getByText(/wysłan|Dziękujemy|sprawdź skrzynkę|zaproszen/i).first().waitFor({ timeout: 10000 });
  });
  const link = linkZeSkrzynki(serwer, EMAIL);
  await krok(page, 'Aktywacja konta (link z e-maila)', async () => {
    if (!link) throw new Error('brak linku aktywacyjnego w skrzynce testowej');
    await page.goto(link);
    await ui.wpisz(page, 'Hasło', 'Delta-Haslo-2026!');
    await ui.wpisz(page, 'Powtórz hasło', 'Delta-Haslo-2026!');
    await ui.przycisk(page, 'Aktywuj konto');
    await page.getByRole('button', { name: 'Przejdź dalej' }).waitFor({ timeout: 10000 });
  });
  await krok(page, 'Klauzula RODO', async () => {
    await page.locator('input[type="checkbox"]:visible').first().check().catch(() => {});
    await ui.przycisk(page, 'Przejdź dalej');
    await ui.gotowe(page);
  });
  await krok(page, 'Wniosek 1/4 — Spółka (z KRS)', async () => {
    await page.goto('/portal.html#/wniosek');
    await ui.gotowe(page, 'Spółka');
    const pobierz = page.getByRole('button', { name: 'Pobierz z KRS' });
    if (await pobierz.isVisible().catch(() => false)) { await pobierz.click(); await page.waitForTimeout(800); }
    // KRS spoza atrapy — bez danych z KRS: firma i siedziba ręcznie.
    await ui.wpisz(page, 'Firma (nazwa) spółki', 'Delta Testowa P.S.A.');
    await ui.wpisz(page, 'Kod pocztowy', '80-004').catch(() => {});
    await ui.wpisz(page, 'Miejscowość', 'Gdańsk').catch(() => {});
    await ui.wpisz(page, 'Ulica', 'Deltowa').catch(() => {});
    await ui.wpisz(page, 'Nr domu', '4').catch(() => {});
    await ui.wpiszDate(page, 'Data zawarcia umowy spółki', '2026-06-01').catch(() => {});
    await dalejWniosku(page, 'Reprezentant');
  });
  await krok(page, 'Wniosek 2/4 — Reprezentant', async () => {
    await ui.wpisz(page, 'Imię i nazwisko', 'Dorota Deltowa');
    await ui.wpisz(page, 'Funkcja', 'Prezes zarządu').catch(() => {});
    await ui.wpisz(page, 'PESEL', '85031502485').catch(() => {});
    await ui.wpisz(page, 'Adres e-mail', EMAIL).catch(() => {});
    await dalejWniosku(page, 'Akcjonariusze');
  });
  await krok(page, 'Wniosek 3/4 — Akcjonariusze', async () => {
    await page.getByRole('button', { name: /Dodaj akcjonariusza|Nowy akcjonariusz/ }).first().click();
    await ui.wpisz(page, 'Imię', 'Dorota');
    await ui.wpisz(page, 'Nazwisko', 'Deltowa');
    await ui.wpisz(page, 'Numer PESEL', '85031502485').catch(() => {});
    await ui.wpisz(page, 'Kod pocztowy', '80-004');
    await ui.wpisz(page, 'Miejscowość', 'Gdańsk');
    await ui.wpisz(page, 'Ulica', 'Deltowa').catch(() => {});
    await ui.wpisz(page, 'Nr domu', '4');
    // D-099: bez zgody na komunikację e-mail — adresu nie podaje się (wcześniej wymagany zawsze, A-028).
    await page.getByRole('button', { name: 'Zapisz zmiany', exact: true }).last().click();
    await page.waitForTimeout(600);
    await dalejWniosku(page, 'Podsumowanie');
  });
  await krok(page, 'Wniosek 4/4 — Podsumowanie i złożenie', async () => {
    await page.locator('input[type="checkbox"]:visible').evaluateAll((l) => l.forEach((c) => { if (!c.checked) c.click(); }));
    await ui.przycisk(page, 'Złóż wniosek');
    await page.getByText(/złożon|Wniosek przyjęty|czeka/i).first().waitFor({ timeout: 10000 });
  });
  await zakoncz(page);
});

test('P4: podpis kompletu dokumentów (Gamma) — podpis kwalifikowany pliku i oryginał pocztą', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'portal-podpis', proces: 'P4 podpis kompletu', szerokosc: szer(testInfo), persona: 'Gamma (wnioskodawca)' });
  await zaloguj(page, 'gamma.zarzad@example.com', 'portal');
  await krok(page, 'Start — baner kroku wniosku', async () => {
    await page.goto('/portal.html#/');
    await ui.gotowe(page, 'Podpisz dokumenty');
  });
  await krok(page, 'Podpisz dokumenty', async () => {
    await page.getByRole('button', { name: 'Podpisz dokumenty' }).first().click();
    await ui.gotowe(page, 'Dokumenty do podpisu');
  });
  await krok(page, 'Pierwszy dokument — wgraj podpisany plik', async () => {
    const wejscie = page.locator('input[type="file"]').first();
    await wejscie.setInputFiles(PDF);
    await page.waitForTimeout(1500);
  });
  await krok(page, 'Drugi dokument — podpiszę na papierze', async () => {
    const b = page.getByRole('button', { name: 'Podpiszę na papierze' }).first();
    if (await b.isVisible().catch(() => false)) await b.click();
    await page.waitForTimeout(800);
  });
  await zakoncz(page);
});

test('P5: opłata (Anna) — „Płatności” → atrapa kasy tpay', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'portal-oplata', proces: 'P5 opłata', szerokosc: szer(testInfo), persona: 'Anna Testowa' });
  await zaloguj(page, 'anna.zgoda@example.com', 'portal');
  await api(page, 'POST', '/api/psa/portal/informacja/zamow', { spolka_id: 1 });
  await krok(page, 'Start — „Do zapłaty”', async () => {
    await page.goto('/portal.html#/');
    await ui.gotowe(page);
  });
  await krok(page, 'Płatności', async () => {
    await page.goto('/portal.html#/platnosci');
    await ui.gotowe(page, 'Płatności');
  });
  await krok(page, 'Zapłać → atrapa kasy', async () => {
    // „Zapłać” otwiera kasę w nowej karcie (window.open).
    const przyciski = await page.getByRole('button').allInnerTexts();
    if (!przyciski.some((t) => /^Zapłać/.test(t.trim()))) throw new Error(`brak „Zapłać”; przyciski: ${przyciski.join(' | ').slice(0, 300)}`);
    const [kasa] = await Promise.all([page.waitForEvent('popup', { timeout: 15000 }), page.locator('button:visible', { hasText: /^Zapłać/ }).first().click()]);
    await kasa.waitForURL(/\/test\/tpay\/kasa\//, { timeout: 15000 });
    const tresc = (await kasa.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
    const zaplac = kasa.getByRole('button', { name: /Zapłać/ });
    if (!(await zaplac.count())) throw new Error(`atrapa kasy bez przycisku zapłaty: ${tresc}`);
    await zaplac.click();
    await kasa.waitForLoadState('networkidle');
    await kasa.close();
  });
  await krok(page, 'Powrót do portalu — opłacone', async () => {
    await page.reload();
    await ui.gotowe(page, 'Płatności');
    const { oplaty } = await api(page, 'GET', '/api/psa/portal/oplaty');
    const niezaplacone = (oplaty || []).filter((o) => !o.oplacona && o.status !== 'oplacona' && !o.zaplacono);
    if (niezaplacone.length) throw new Error(`po ITN nadal do zapłaty: ${niezaplacone.length}`);
  });
  await zakoncz(page);
});

for (const wariant of [
  { kod: 'dom', etykieta: 'dom maklerski', nazwa: 'Dom Maklerski Fikcja S.A.', krs: '0000990098' },
  { kod: 'notariusz', etykieta: 'notariusz', nazwa: 'Notariusz Fikcyjny (dane testowe)', krs: '0000990097' },
  { kod: 'rada', etykieta: 'rada izby', nazwa: 'Rada Izby Notarialnej (dane testowe)', krs: '0000990096' },
]) {
  test(`P6: zgłoszenie przeniesienia rejestru — dotychczasowy podmiot: ${wariant.etykieta}`, async ({ page }, testInfo) => {
    rozpocznij(page, testInfo, { scenariusz: `portal-przeniesienie-${wariant.kod}`, proces: 'P6 zgłoszenie przeniesienia', szerokosc: szer(testInfo), persona: `Beta — ${wariant.etykieta}` });
    await krok(page, 'Zgłoś się — przenoszę rejestr', async () => {
      await page.goto('/portal.html#/zglos-sie');
      await ui.wpisz(page, 'E-mail', `przeniesienie.${wariant.kod}@example.com`);
      await ui.wpisz(page, 'Numer KRS spółki', wariant.krs);
      await page.getByText('Przenoszę rejestr od innego podmiotu').click();
      await ui.wybierz(page, 'Kto dotąd prowadzi rejestr', wariant.etykieta);
      await ui.wpisz(page, 'Nazwa dotychczasowego podmiotu', wariant.nazwa).catch(() => {});
      await ui.wpisz(page, 'Okres wypowiedzenia', '3 miesiące').catch(() => {});
      await ui.przycisk(page, 'Zgłoś spółkę');
      await page.getByText(/wysłan|Dziękujemy|sprawdź skrzynkę|zaproszen/i).first().waitFor({ timeout: 10000 });
    });
    await zakoncz(page);
  });
}

test('P7–P9: Zarząd — Start, Spółka, zamówienie informacji, „Zgłoś błąd we wpisie”', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'portal-zarzad', proces: 'P7 Start, P8 informacja, P9 zgłoś błąd', szerokosc: szer(testInfo), persona: 'Zarząd Alfa' });
  await zaloguj(page, 'zarzad@example.com', 'portal');
  await krok(page, 'Start', async () => {
    await page.goto('/portal.html#/');
    await ui.gotowe(page);
  });
  await krok(page, 'Spółka — dane i rejestr', async () => {
    await page.goto('/portal.html#/spolka/1');
    await ui.gotowe(page, 'Dane spółki');
  });
  await krok(page, 'Zamów informację z rejestru', async () => {
    await page.getByRole('button', { name: 'Zamów informację z rejestru' }).click();
    await ui.gotowe(page, 'Stan na dzień');
    await page.getByRole('button', { name: /^(Zamów informację|Zapłać)/ }).click();
    await page.getByText(/Otwórz płatność|Przejdź do płatności|Otwórz informację/).first().waitFor({ timeout: 10000 });
  });
  await krok(page, 'Zgłoś błąd we wpisie', async () => {
    await page.goto('/portal.html#/spolka/1');
    await page.getByRole('button', { name: 'Zgłoś błąd we wpisie' }).click();
    await ui.gotowe(page, 'Czego dotyczy');
    await ui.pole(page, 'Czego dotyczy').locator('select').selectOption({ index: 1 });
    await ui.wpisz(page, 'Opisz, na czym polega błąd', 'Błędna miejscowość akcjonariusza (dane fikcyjne).');
    await ui.przycisk(page, 'Zgłoś błąd we wpisie');
    await page.getByText(/Zgłoszono|przyjęte|zapisane/i).first().waitFor({ timeout: 10000 });
  });
  await zakoncz(page);
});

test('P10: „Moje oświadczenia” — cofnięcie zgody na e-mail i ponowne złożenie', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'portal-oswiadczenia', proces: 'P10 oświadczenia', szerokosc: szer(testInfo), persona: 'Anna Testowa' });
  await zaloguj(page, 'anna.zgoda@example.com', 'portal');
  await krok(page, 'Konto — Moje oświadczenia', async () => {
    await page.goto('/portal.html#/konto');
    await ui.gotowe(page, 'Moje oświadczenia');
  });
  const zgoda = () => page.locator('.karta', { hasText: 'Moje oświadczenia' }).locator('input[type="checkbox"]').first();
  await krok(page, 'Cofnięcie zgody — okno ostrzeżenia', async () => {
    await zgoda().click();
    await page.getByRole('button', { name: 'Cofam zgodę' }).click();
    await page.waitForTimeout(600);
  });
  await krok(page, 'Ponowne złożenie zgody', async () => {
    await zgoda().click();
    const zapisz = page.getByRole('button', { name: /Zapisz|Złóż/ }).first();
    if (await zapisz.isVisible().catch(() => false)) await zapisz.click();
    await page.waitForTimeout(600);
  });
  await zakoncz(page);
});

test('P11: żądanie wpisu z portalu (Zarząd) — zgłoszenie zmiany z dokumentem → opłata', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'portal-zadanie-wpisu', proces: 'P11 żądanie wpisu z portalu', szerokosc: szer(testInfo), persona: 'Zarząd Alfa' });
  await zaloguj(page, 'zarzad@example.com', 'portal');
  await krok(page, 'Zgłoszenie zmiany w rejestrze', async () => {
    await page.goto('/portal.html#/zgloszenie/1');
    await ui.gotowe(page, 'Czego dotyczy zgłoszenie');
    await ui.pole(page, 'Czego dotyczy zgłoszenie').locator('select').selectOption({ index: 1 });
    await ui.pole(page, 'Dokument, na podstawie którego').locator('input[type="file"]').setInputFiles(PDF);
    await ui.przycisk(page, 'Zgłoś zmianę');
    await page.getByText(/Zgłoszenie zapisane/).first().waitFor({ timeout: 10000 });
  });
  await krok(page, 'Przejdź do płatności', async () => {
    await page.getByRole('button', { name: 'Przejdź do płatności' }).first().click();
    await ui.gotowe(page, 'Płatności');
  });
  await zakoncz(page);
});

test('P12: próba nowej spółki w tym samym logowaniu → 403', async ({ page }, testInfo) => {
  rozpocznij(page, testInfo, { scenariusz: 'portal-druga-spolka-403', proces: 'P12 druga spółka z konta', szerokosc: szer(testInfo), persona: 'Zarząd Alfa (konto spółki)', oczekiwaneHttp: [/\/portal\/wniosek\/nowy$/] });
  await zaloguj(page, 'zarzad@example.com', 'portal');
  let status = null;
  await krok(page, 'Nowy wniosek z konta z wnioskiem w toku', async () => {
    await page.goto('/portal.html#/');
    await ui.gotowe(page);
    const odp = await page.request.post('/api/psa/portal/wniosek/nowy', { data: {} });
    status = odp.status();
    if (status !== 403) throw new Error(`oczekiwano 403, jest ${status}`);
  });
  await zakoncz(page);
});

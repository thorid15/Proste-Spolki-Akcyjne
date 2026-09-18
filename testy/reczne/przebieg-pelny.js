/**
 * PELNY PRZEBIEG KANCELARII — od zgloszenia do wpisu, przez API,
 * tak jak robi to portal. Sprawdza, czy sciezka DA SIE przejsc w calosci
 * i gdzie sie zacina.
 */
const B = process.env.ADRES || 'http://localhost:3107';
const Database = require('better-sqlite3');
const db = new Database(process.env.WSPOLNA_BAZA || '/tmp/e2e.db');

const kroki = [];
function krok(nazwa, ok, szczegol) {
  kroki.push({ nazwa, ok, szczegol });
  console.log(`${ok ? '  OK  ' : ' BLAD '} ${nazwa}${szczegol ? ' — ' + szczegol : ''}`);
}

function mk(ciastkoRef) {
  return async (m, s, b, typ) => {
    const o = { method: m, headers: { Cookie: ciastkoRef.v } };
    if (typ === 'form') { o.body = b; } else if (b !== undefined) {
      o.headers['Content-Type'] = 'application/json';
      o.body = JSON.stringify(b);
    }
    const r = await fetch(B + s, o);
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    if (sc.length) ciastkoRef.v = sc.map((x) => x.split(';')[0]).join('; ');
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) { j = t.slice(0, 300); }
    return [r.status, j];
  };
}

const KRS = '0000' + String(Math.floor(Math.random() * 900000) + 100000);
const EMAIL = `e2e.${Date.now()}@example-test.pl`;
const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';

(async () => {
  const cAnon = { v: '' };
  const cPrac = { v: '' };
  const cKl = { v: '' };
  const anon = mk(cAnon); const prac = mk(cPrac); const kl = mk(cKl);

  // 1. Zgloszenie z publicznego formularza
  const [stZgl, zgl] = await anon('POST', '/api/psa/portal/zgloszenia', {
    nazwa_spolki: 'E2E Prosta Spółka Akcyjna', krs: KRS, email: EMAIL, osoba: 'Jan Kowalski', telefon: '',
  });
  krok('zgloszenie z formularza publicznego', stZgl === 201, `status ${stZgl}`);
  krok('zaproszenie wysylane automatycznie', Boolean(zgl.link_aktywacyjny), 'link aktywacyjny w odpowiedzi');

  const [stDubl] = await anon('POST', '/api/psa/portal/zgloszenia', {
    nazwa_spolki: 'Inna', krs: KRS, email: 'inny@example-test.pl', osoba: 'Ktos',
  });
  krok('duplikat po numerze KRS odrzucony', stDubl === 400, `status ${stDubl}`);

  // 2. Aktywacja konta
  const token = zgl.link_aktywacyjny.split('/').pop();
  const [stAkt] = await kl('POST', `/api/psa/portal/aktywacja/${token}`, { haslo: 'HasloKlienta123' });
  krok('aktywacja konta i ustawienie hasla', stAkt === 200, `status ${stAkt}`);

  // 3. Wniosek — niekompletny akcjonariusz nie przechodzi
  await kl('GET', '/api/psa/portal/wniosek');
  await kl('POST', '/api/psa/portal/rodo', {});
  await kl('PUT', '/api/psa/portal/wniosek', {
    nazwa: 'E2E Prosta Spółka Akcyjna', krs: KRS,
    reprezentant_imie_nazwisko: 'Jan Kowalski', reprezentant_funkcja: 'Prezes Zarządu',
  });
  const [, niepelny] = await kl('POST', '/api/psa/portal/wniosek/akcjonariusze', { typ: 'fizyczna', nazwisko: 'Bezdanych' });
  const [stBraki, braki] = await kl('POST', '/api/psa/portal/wniosek/zloz');
  krok('wniosek z niepelnymi danymi akcjonariusza odrzucony', stBraki === 400, braki.blad);

  await kl('PUT', `/api/psa/portal/wniosek/akcjonariusze/${niepelny.akcjonariusz.id}`, {
    typ: 'fizyczna', imie: 'Anna', nazwisko: 'Nowak', pesel: '85050512345',
    kod_pocztowy: '80-280', miejscowosc: 'Gdansk', ulica: 'Lesmiana 3',
  });
  const [stZloz] = await kl('POST', '/api/psa/portal/wniosek/zloz');
  krok('wniosek kompletny zlozony', stZloz === 200, `status ${stZloz}`);

  // 4. Kancelaria
  await prac('POST', '/api/psa/auth/login', { email: 'lukasz@kancelaria.pl', haslo: process.env.ADMIN_HASLO || 'zmien-to' });
  const [stMe] = await prac('GET', '/api/psa/meta');
  krok('logowanie pracownika', stMe === 200, `status ${stMe}`);

  const w = db.prepare('SELECT id FROM psa_wnioski WHERE krs = ?').get(KRS);
  const [stWystaw, wystaw] = await prac('POST', `/api/psa/wnioski/${w.id}/dokumenty/wystaw`, {});
  krok('kancelaria wystawia komplet dokumentow', stWystaw === 200, `${(wystaw.dokumenty || []).length} dokumentow`);
  const [stUdost, udost] = await prac('POST', `/api/psa/wnioski/${w.id}/dokumenty/udostepnij`, {});
  krok('komplet udostepniony klientowi', stUdost === 200);

  // 5. Klient zalacza skany i odsyla komplet
  const [stNiepelnyKomplet] = await kl('POST', '/api/psa/portal/wniosek/odeslij');
  krok('odeslanie niepelnego kompletu odrzucone', stNiepelnyKomplet === 400);

  for (const d of udost.dokumenty) {
    const f = new FormData();
    f.append('plik', new Blob([PDF], { type: 'application/pdf' }), `skan-${d.typ}.pdf`);
    await fetch(`${B}/api/psa/portal/wniosek/dokumenty/${d.id}/podpis`, {
      method: 'POST', headers: { Cookie: cKl.v }, body: f,
    });
  }
  const [stOdeslij] = await kl('POST', '/api/psa/portal/wniosek/odeslij');
  krok('klient odsyla KOMPLET jednym ruchem', stOdeslij === 200, `status ${stOdeslij}`);
  krok('dopiero teraz wniosek w kolejce kancelarii',
    db.prepare('SELECT status FROM psa_wnioski WHERE id = ?').get(w.id).status === 'umowa_podpisana');

  // 6. Weryfikacja i przyjecie
  const akcj = db.prepare('SELECT id FROM psa_wnioski_akcjonariusze WHERE wniosek_id = ?').all(w.id);
  const [stPrzedWeryfikacja] = await prac('POST', `/api/psa/wnioski/${w.id}/przyjmij`, {});
  krok('przyjecie przed weryfikacja pozycji odrzucone', stPrzedWeryfikacja === 400);

  for (const a of akcj) {
    await prac('POST', `/api/psa/wnioski/${w.id}/akcjonariusze/${a.id}/zweryfikuj`, { zweryfikowano: true });
  }
  for (const d of udost.dokumenty) {
    await prac('POST', `/api/psa/wnioski/${w.id}/dokumenty/${d.id}/podpis-potwierdz`, {});
  }
  const [stPrzyjmij, przyjmij] = await prac('POST', `/api/psa/wnioski/${w.id}/przyjmij`, {});
  krok('wniosek przyjety, spolka zalozona', stPrzyjmij === 200, `spolka #${przyjmij.spolka_id}`);
  // Naprawa Z-108/P-007: prowadzenie + wpis nalicza sie TERAZ dopiero przy
  // `POST /spolki/:id/otworz-rejestr` (jedna sciezka dla obu onboardingow) -
  // ten skrypt konczy sie na `/przyjmij` i nie zaklada akcji, wiec tu nie ma
  // jeszcze czego sprawdzac; patrz `otworz-rejestr-http.test.js`/`oplaty-http.test.js`.

  const spolkaId = przyjmij.spolka_id;

  // 7. Klient widzi naleznosc
  const [stOplaty, oplatyKl] = await kl('GET', '/api/psa/portal/oplaty');
  krok('klient widzi naleznosc za prowadzenie rejestru',
    stOplaty === 200 && oplatyKl.oplaty.some((o) => o.typ === 'prowadzenie'),
    `${oplatyKl.oplaty.length} pozycji, do zaplaty ${(oplatyKl.do_zaplaty_grosze / 100).toFixed(2)} zl`);

  // 8. Zgloszenie zmiany -> czeka na oplate
  const [stZadanie, zadanie] = await kl('POST', '/api/psa/portal/zadania', {
    spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', opis: '',
  });
  krok('zgloszenie zmiany przez portal', stZadanie === 201, `sprawa #${zadanie.sprawa && zadanie.sprawa.id}`);
  const sprawaId = zadanie.sprawa.id;
  const sprawaRow = db.prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawaId);
  krok('platnosci wylaczone => zadanie skuteczne od razu (nie znika)',
    sprawaRow.oczekuje_na_oplate === 0, 'oczekuje_na_oplate = ' + sprawaRow.oczekuje_na_oplate);

  const [, kolejka] = await prac('GET', '/api/psa/sprawy');
  krok('sprawa widoczna w kolejce kancelarii',
    kolejka.sprawy.some((s) => s.id === sprawaId), `${kolejka.sprawy.length} spraw w kolejce`);

  // 9. Pracownik: weryfikacja + podstawa wpisu
  const [stWeryf] = await prac('PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'weryfikuj' });
  krok('pracownik rozpoczyna weryfikacje', stWeryf === 200);
  const [stPodstawa] = await prac('PATCH', `/api/psa/sprawy/${sprawaId}`, {
    akcja: 'podstawa', dokument_rodzaj: 'umowa_zbycia', dokument_data: '2026-09-01',
  });
  krok('pracownik ustala podstawe wpisu', stPodstawa === 200);

  // 10. Rozliczenia kancelarii
  const [stWgSpolek, wgSpolek] = await prac('GET', '/api/psa/oplaty/wg-spolek');
  krok('rozliczenia grupowane po spolkach', stWgSpolek === 200, `${wgSpolek.spolki.length} spolek`);
  const oplataProw = db.prepare(`SELECT id FROM psa_oplaty WHERE spolka_id = ? AND typ = 'prowadzenie'`).get(spolkaId);
  const [stFaktura, faktura] = await prac('PATCH', `/api/psa/oplaty/${oplataProw.id}/faktura`, { wystawiona: true, numer: 'FV/2026/001' });
  krok('odhaczenie faktury z numerem', stFaktura === 200 && faktura.oplata.faktura_numer === 'FV/2026/001');
  krok('odhaczenie samo przenosi na „zafakturowana”', faktura.oplata.status === 'zafakturowana', faktura.oplata.status);

  console.log('\n─── PODSUMOWANIE ───');
  const bledy = kroki.filter((k) => !k.ok);
  console.log(`${kroki.length - bledy.length}/${kroki.length} krokow przeszlo`);
  if (bledy.length) { console.log('NIEUDANE:'); bledy.forEach((b) => console.log(' - ' + b.nazwa + (b.szczegol ? ': ' + b.szczegol : ''))); }
})();

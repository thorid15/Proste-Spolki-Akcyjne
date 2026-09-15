/** Ten sam przebieg, ale z WLACZONYMI platnosciami — bramka na zadaniu wpisu. */
const B = process.env.ADRES || 'http://localhost:3108';
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const db = new Database(process.env.WSPOLNA_BAZA || '/tmp/e2e2.db');
const SEKRET = 'sekret-itn';
const kroki = [];
function krok(n, ok, s) { kroki.push({ n, ok }); console.log(`${ok ? '  OK  ' : ' BLAD '} ${n}${s ? ' — ' + s : ''}`); }
function mk(ref) {
  return async (m, s, b) => {
    const o = { method: m, headers: { Cookie: ref.v } };
    if (b !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(b); }
    const r = await fetch(B + s, o);
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    if (sc.length) ref.v = sc.map((x) => x.split(';')[0]).join('; ');
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { j = t.slice(0, 200); }
    return [r.status, j];
  };
}
const KRS = '0000' + String(Math.floor(Math.random() * 900000) + 100000);
const PDF = '%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%EOF\n';

(async () => {
  const cA = { v: '' }, cP = { v: '' }, cK = { v: '' };
  const anon = mk(cA), prac = mk(cP), kl = mk(cK);

  const [, zgl] = await anon('POST', '/api/psa/portal/zgloszenia', {
    nazwa_spolki: 'Platnosci E2E P.S.A.', krs: KRS, email: `p.${Date.now()}@example-test.pl`, osoba: 'Jan Kowalski',
  });
  await kl('POST', `/api/psa/portal/aktywacja/${zgl.link_aktywacyjny.split('/').pop()}`, { haslo: 'HasloKlienta123' });
  await kl('GET', '/api/psa/portal/wniosek');
  await kl('POST', '/api/psa/portal/rodo', {});
  await kl('PUT', '/api/psa/portal/wniosek', { nazwa: 'Platnosci E2E P.S.A.', krs: KRS, reprezentant_imie_nazwisko: 'Jan Kowalski', reprezentant_funkcja: 'Prezes' });
  await kl('POST', '/api/psa/portal/wniosek/akcjonariusze', {
    typ: 'fizyczna', imie: 'Anna', nazwisko: 'Nowak', pesel: '85050512345',
    kod_pocztowy: '80-280', miejscowosc: 'Gdansk', ulica: 'Lesmiana 3',
  });
  await kl('POST', '/api/psa/portal/wniosek/zloz');

  await prac('POST', '/api/psa/auth/login', { email: 'lukasz@kancelaria.pl', haslo: process.env.ADMIN_HASLO });
  const w = db.prepare('SELECT id FROM psa_wnioski WHERE krs = ?').get(KRS);
  await prac('POST', `/api/psa/wnioski/${w.id}/dokumenty/wystaw`, {});
  const [, udost] = await prac('POST', `/api/psa/wnioski/${w.id}/dokumenty/udostepnij`, {});
  for (const d of udost.dokumenty) {
    const f = new FormData();
    f.append('plik', new Blob([PDF], { type: 'application/pdf' }), 'skan.pdf');
    await fetch(`${B}/api/psa/portal/wniosek/dokumenty/${d.id}/podpis`, { method: 'POST', headers: { Cookie: cK.v }, body: f });
    await prac('POST', `/api/psa/wnioski/${w.id}/dokumenty/${d.id}/podpis-potwierdz`, {});
  }
  await kl('POST', '/api/psa/portal/wniosek/odeslij');
  for (const a of db.prepare('SELECT id FROM psa_wnioski_akcjonariusze WHERE wniosek_id = ?').all(w.id)) {
    await prac('POST', `/api/psa/wnioski/${w.id}/akcjonariusze/${a.id}/zweryfikuj`, { zweryfikowano: true });
  }
  const [, przyj] = await prac('POST', `/api/psa/wnioski/${w.id}/przyjmij`, {});
  const spolkaId = przyj.spolka_id;
  krok('rejestr otwarty, pierwszy rok naliczony', Boolean(przyj.oplata_prowadzenia));

  // ── Bramka na zadaniu wpisu ──
  const [, zad] = await kl('POST', '/api/psa/portal/zadania', { spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', opis: '' });
  const sprawaId = zad.sprawa.id;
  const przed = db.prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawaId);
  krok('zadanie CZEKA na oplate', przed.oczekuje_na_oplate === 1);
  krok('oplata za wpis naliczona razem z zadaniem', Boolean(zad.oplata_id), `oplata #${zad.oplata_id}`);

  const [, kolejkaPrzed] = await prac('GET', '/api/psa/sprawy');
  krok('nieoplacone zadanie NIE STOI w kolejce kancelarii', !kolejkaPrzed.sprawy.some((s) => s.id === sprawaId));
  const [, liczniki] = await prac('GET', '/api/psa/liczniki');
  krok('nieoplacone zadanie nie podbija licznika kolejki', liczniki.liczniki.sprawy === 0, `licznik = ${liczniki.liczniki.sprawy}`);

  const [, rozl] = await prac('GET', '/api/psa/oplaty/wg-spolek');
  krok('kancelaria WIDZI zadanie czekajace na oplate',
    rozl.czekajace_zadania.some((z) => z.id === sprawaId), `${rozl.czekajace_zadania.length} czekajacych`);

  // ── Zaplata ──
  const [stLink, link] = await kl('POST', `/api/psa/portal/oplaty/${zad.oplata_id}/zaplac`, {});
  krok('klient dostaje link do zaplaty', stLink === 200 && Boolean(link.link), link.link);
  const [, tenSam] = await kl('POST', `/api/psa/portal/oplaty/${zad.oplata_id}/zaplac`, {});
  krok('drugie klikniecie oddaje TEN SAM link', tenSam.link === link.link && tenSam.nowa === false);

  const pl = db.prepare('SELECT * FROM psa_platnosci WHERE id = ?').get(link.platnosc_id);
  function itn(pola) {
    const p = { id: '1', tr_id: pl.tpay_id, tr_amount: (pl.kwota_grosze / 100).toFixed(2), tr_crc: pl.crc,
      tr_status: 'TRUE', tr_error: 'none', test_mode: '0', ...pola };
    p.md5sum = crypto.createHash('md5').update(`${p.id}${p.tr_id}${p.tr_amount}${p.tr_crc}${SEKRET}`).digest('hex');
    return p;
  }
  async function wyslijItn(p) {
    const r = await fetch(`${B}/api/psa/platnosci/tpay/itn`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(p).toString(),
    });
    return [r.status, await r.text()];
  }

  const podrobione = { ...itn({}), md5sum: 'f'.repeat(32) };
  await wyslijItn(podrobione);
  krok('sfalszowane powiadomienie NIE ksieguje',
    db.prepare('SELECT status FROM psa_oplaty WHERE id = ?').get(zad.oplata_id).status !== 'oplacona');

  const zaMalo = itn({ tr_amount: '1.00' });
  await wyslijItn(zaMalo);
  krok('zaplata zanizona NIE ksieguje',
    db.prepare('SELECT status FROM psa_oplaty WHERE id = ?').get(zad.oplata_id).status !== 'oplacona');

  const [stItn, trescItn] = await wyslijItn(itn({}));
  krok('poprawne powiadomienie: TRUE', stItn === 200 && trescItn === 'TRUE');
  krok('oplata zaksiegowana', db.prepare('SELECT status FROM psa_oplaty WHERE id = ?').get(zad.oplata_id).status === 'oplacona');

  const po = db.prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawaId);
  const dzis = new Date().toISOString().slice(0, 10);
  krok('zadanie staje sie skuteczne', po.oczekuje_na_oplate === 0);
  krok('termin ustawowy biegnie OD DNIA ZAPLATY', po.data_wplywu === dzis, `data_wplywu = ${po.data_wplywu}`);

  const [, kolejkaPo] = await prac('GET', '/api/psa/sprawy');
  krok('sprawa wchodzi do kolejki kancelarii', kolejkaPo.sprawy.some((s) => s.id === sprawaId));

  await wyslijItn(itn({}));
  krok('powtorne powiadomienie nie ksieguje drugi raz',
    db.prepare(`SELECT COUNT(*) c FROM psa_oplaty WHERE sprawa_id = ? AND status = 'oplacona'`).get(sprawaId).c === 1);

  // ── Informacja z rejestru ──
  const [, zam] = await kl('POST', '/api/psa/portal/informacja/zamow', { spolka_id: spolkaId });
  krok('zamowienie informacji oddaje link do zaplaty', Boolean(zam.link) && zam.oplacona === false);
  const [stBezZaplaty] = await kl('POST', `/api/psa/portal/informacja/${zam.oplata_id}/wydaj`, {});
  krok('nieoplacona informacja NIE wychodzi', stBezZaplaty === 400);

  const plInf = db.prepare('SELECT * FROM psa_platnosci WHERE oplata_id = ? ORDER BY id DESC').get(zam.oplata_id);
  const pInf = { id: '2', tr_id: plInf.tpay_id, tr_amount: (plInf.kwota_grosze / 100).toFixed(2), tr_crc: plInf.crc,
    tr_status: 'TRUE', tr_error: 'none', test_mode: '0' };
  pInf.md5sum = crypto.createHash('md5').update(`${pInf.id}${pInf.tr_id}${pInf.tr_amount}${pInf.tr_crc}${SEKRET}`).digest('hex');
  await wyslijItn(pInf);
  const [stWydaj, wydaj] = await kl('POST', `/api/psa/portal/informacja/${zam.oplata_id}/wydaj`, {});
  krok('po zaplacie informacja wychodzi', stWydaj === 200 && Boolean(wydaj.dokument_id));
  const [, ponownie] = await kl('POST', `/api/psa/portal/informacja/${zam.oplata_id}/wydaj`, {});
  krok('z jednej oplaty tylko JEDEN dokument', ponownie.ponownie === true && ponownie.dokument_id === wydaj.dokument_id);

  console.log('\n─── PODSUMOWANIE ───');
  const b = kroki.filter((k) => !k.ok);
  console.log(`${kroki.length - b.length}/${kroki.length} krokow przeszlo`);
  b.forEach((x) => console.log(' NIEUDANE: ' + x.n));
})();

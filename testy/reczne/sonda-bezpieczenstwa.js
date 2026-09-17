/**
 * Sonda bezpieczenstwa — probuje tego, czego probowalby ktos z zewnatrz.
 * Kazda pozycja to PYTANIE, nie zalozenie: sprawdzamy odpowiedz serwera.
 */
const B = process.env.ADRES || 'http://localhost:3108';
const Database = require('better-sqlite3');
const db = new Database(process.env.WSPOLNA_BAZA || '/tmp/e2e2.db');
const wyniki = [];
function w(nazwa, bezpieczne, szczegol) {
  wyniki.push({ nazwa, bezpieczne, szczegol });
  console.log(`${bezpieczne ? '  OK  ' : ' !!!! '} ${nazwa}${szczegol ? ' — ' + szczegol : ''}`);
}

(async () => {
  // 1. Czy bez sesji da sie cokolwiek?
  for (const [m, s] of [['GET', '/api/psa/spolki'], ['GET', '/api/psa/oplaty/wg-spolek'],
                        ['GET', '/api/psa/sprawy'], ['GET', '/api/psa/osoby'],
                        ['GET', '/api/psa/portal/oplaty'], ['GET', '/api/psa/wnioski']]) {
    const r = await fetch(B + s, { method: m });
    w(`bez sesji: ${m} ${s}`, r.status === 401 || r.status === 403, `status ${r.status}`);
  }

  // 2. Naglowki bezpieczenstwa
  const r = await fetch(`${B}/`);
  const h = (n) => r.headers.get(n);
  w('X-Content-Type-Options', h('x-content-type-options') === 'nosniff');
  w('X-Frame-Options', h('x-frame-options') === 'DENY');
  w('Content-Security-Policy', Boolean(h('content-security-policy')), h('content-security-policy') ? 'jest' : 'BRAK');
  w('CSP bez unsafe-inline w script-src?',
    !/(script-src[^;]*unsafe-inline)/.test(h('content-security-policy') || ''),
    'unsafe-inline w script-src osłabia ochronę przed XSS');
  w('Referrer-Policy', Boolean(h('referrer-policy')));

  // 3. Ciasteczka
  const logowanie = await fetch(`${B}/api/psa/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nieistnieje@x.pl', haslo: 'x' }),
  });
  void logowanie;
  const ciastka = db.prepare('SELECT 1').get();
  void ciastka;

  // 4. Enumeracja kont: czy komunikat rozroznia "nie ma konta" od "zle haslo"?
  const a = await (await fetch(`${B}/api/psa/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nieistnieje@x.pl', haslo: 'ZleHaslo123' }),
  })).json();
  const istniejacy = db.prepare("SELECT email FROM psa_konta LIMIT 1").get();
  const b = await (await fetch(`${B}/api/psa/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: istniejacy.email, haslo: 'ZleHaslo123' }),
  })).json();
  w('logowanie nie zdradza, czy konto istnieje', a.blad === b.blad, `"${a.blad}" vs "${b.blad}"`);

  // 5. Limiter logowania
  let zablokowano = false;
  for (let i = 0; i < 9; i++) {
    const odp = await fetch(`${B}/api/psa/portal/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: istniejacy.email, haslo: 'Zle' + i }),
    });
    if (odp.status === 429) { zablokowano = true; break; }
  }
  w('limiter blokuje zgadywanie hasla', zablokowano, zablokowano ? 'po kilku probach 429' : 'BRAK BLOKADY');

  // 6. Rozpylanie hasla: czy limiter liczy tez PO IP, nie tylko IP+email?
  let zablokowanoSpray = false;
  for (let i = 0; i < 25; i++) {
    const odp = await fetch(`${B}/api/psa/portal/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `ofiara${i}@x.pl`, haslo: 'Haslo123!' }),
    });
    if (odp.status === 429) { zablokowanoSpray = true; break; }
  }
  w('limiter blokuje rozpylanie hasla po wielu kontach', zablokowanoSpray,
    zablokowanoSpray ? 'zadziałał' : 'klucz to IP+e-mail, wiec 25 kont z jednego IP przechodzi');

  // 7. SQL injection w parametrach
  const inj = await fetch(`${B}/api/psa/portal/oplaty?spolka_id=1%20OR%201=1`);
  w('parametr z SQL nie wywraca serwera', inj.status !== 500, `status ${inj.status}`);

  // 8. ITN: czy bez sekretu cokolwiek ksieguje?
  const przedItn = db.prepare("SELECT COUNT(*) c FROM psa_oplaty WHERE status='oplacona'").get().c;
  const crcIstniejacy = db.prepare('SELECT crc FROM psa_platnosci LIMIT 1').get();
  await fetch(`${B}/api/psa/platnosci/tpay/itn`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id: '1', tr_id: 'X', tr_amount: '9999.00',
      tr_crc: crcIstniejacy ? crcIstniejacy.crc : 'x', tr_status: 'TRUE', tr_error: 'none', md5sum: '0'.repeat(32) }).toString(),
  });
  w('ITN bez poprawnego podpisu nie ksieguje',
    db.prepare("SELECT COUNT(*) c FROM psa_oplaty WHERE status='oplacona'").get().c === przedItn);

  // 9. Sciezka pliku — proba wyjscia z katalogu
  const trav = await fetch(`${B}/api/psa/portal/wniosek/dokumenty/..%2F..%2F..%2Fetc%2Fpasswd`);
  w('proba wyjscia z katalogu dokumentow', trav.status !== 200, `status ${trav.status}`);

  console.log('\n─── PODSUMOWANIE ───');
  const zle = wyniki.filter((x) => !x.bezpieczne);
  console.log(`${wyniki.length - zle.length}/${wyniki.length} sprawdzen bez zastrzezen`);
  zle.forEach((x) => console.log(' ZASTRZEZENIE: ' + x.nazwa + (x.szczegol ? ' — ' + x.szczegol : '')));
})();

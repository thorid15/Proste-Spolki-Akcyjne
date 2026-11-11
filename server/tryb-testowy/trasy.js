'use strict';

/**
 * Trasy trybu testowego (`/test/*`). Rejestrowane w `serwer.js` WYLACZNIE
 * przy `PSA_TRYB_TESTOWY` — poza nim kazdy adres ponizej to 404 (T6).
 *
 *   /test                       panel: symulowana data, konta, atrapy
 *   /test/skrzynka[/:id]        skrzynka testowa (T1) — bez logowania
 *   /test/konfiguracja.js       stan trybu dla ekranow (konta testowe, data)
 *   /test/pasek.js              czerwony pasek na kazdym ekranie (T6)
 *   /test/tpay/api/*            atrapa API operatora tpay (T5)
 *   /test/tpay/kasa/:id         atrapa kasy — „Zapłać” wysyla ITN na zwykly endpoint
 *
 * Strony sa renderowane po stronie serwera, bez skryptow (CSP `script-src
 * 'self'` blokuje i tak kazdy skrypt z tresci wiadomosci).
 */

const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const { db } = require('../baza');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');
const tryb = require('./index');
const skrzynka = require('./skrzynka');

const router = express.Router();
const formularz = express.urlencoded({ extended: false, limit: '16kb' });

function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stanDaty() {
  const przesuniecie = czas.przesuniecie();
  return { data: czas.dzisIso(), symulowana: przesuniecie !== 0, przesuniecie_ms: przesuniecie };
}

function pasekHtml() {
  const d = stanDaty();
  return `<div style="background:#b00020;color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:6px 16px;display:flex;flex-wrap:wrap;gap:4px 16px">
    <strong>TRYB TESTOWY — e-maile nie są wysyłane</strong>
    <span>Data: ${esc(d.data)}${d.symulowana ? ' (symulowana)' : ''}</span>
    <a style="color:#fff" href="/test/skrzynka">Skrzynka testowa</a>
    <a style="color:#fff" href="/test">Panel testowy</a>
    <a style="color:#fff" href="/">Kancelaria</a>
    <a style="color:#fff" href="/portal.html">Portal</a>
  </div>`;
}

function strona(tytul, tresc) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(tytul)} — tryb testowy</title>
<style>
body{margin:0;font:15px/1.5 system-ui,sans-serif;color:#1b1b1b;background:#fafafa}
main{max-width:960px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0 16px}h2{font-size:17px;margin:24px 0 8px}
table{border-collapse:collapse;width:100%;background:#fff}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
.karta{background:#fff;border:1px solid #ddd;border-radius:6px;padding:12px 16px;margin:12px 0}
.komunikat{padding:8px 12px;border-radius:4px;margin:8px 0}.ok{background:#e6f4ea}.blad{background:#fde7e9}
button{font:inherit;padding:6px 12px;cursor:pointer}input,select{font:inherit;padding:4px 6px}
.tresc-wiadomosci{background:#fff;border:1px solid #ddd;padding:16px;overflow-wrap:anywhere}
small{color:#555}
</style></head><body>${pasekHtml()}<main>${tresc}</main></body></html>`;
}

function komunikat(zad) {
  if (zad.query.ok) return `<div class="komunikat ok">${esc(zad.query.ok)}</div>`;
  if (zad.query.blad) return `<div class="komunikat blad">${esc(zad.query.blad)}</div>`;
  return '';
}

function kontaIstniejace() {
  return tryb.KONTA_TESTOWE.filter((k) => {
    if (k.aplikacja === 'kancelaria') {
      return Boolean(db().prepare('SELECT 1 FROM psa_uzytkownicy WHERE lower(email) = ? AND aktywny = 1').get(k.email));
    }
    return Boolean(db().prepare('SELECT 1 FROM psa_konta WHERE lower(email) = ? AND aktywne = 1').get(k.email));
  });
}

// ─────────────────────────────────────────────────────────────
// Skrypty dla ekranow aplikacji (wstrzykiwane w HTML przez serwer.js)
// ─────────────────────────────────────────────────────────────

router.get('/konfiguracja.js', (zad, odp) => {
  const stan = { ...stanDaty(), haslo: tryb.HASLO_TESTOWE, konta: kontaIstniejace() };
  odp.type('application/javascript').set('Cache-Control', 'no-store')
    .send(`window.PSA_TRYB_TESTOWY = ${JSON.stringify(stan)};\n`);
});

router.get('/pasek.js', (zad, odp) => {
  odp.set('Cache-Control', 'no-store').sendFile(path.join(__dirname, 'klient', 'pasek.js'));
});

// ─────────────────────────────────────────────────────────────
// Skrzynka testowa (T1)
// ─────────────────────────────────────────────────────────────

router.get('/skrzynka', (zad, odp) => {
  const wiersze = skrzynka.lista().map((w) => `<tr>
      <td>${esc(czas.dzienLokalny(w.czas))} ${esc(czas.godzinaLokalna(w.czas, { sekundy: true }))}</td>
      <td>${esc(w.do)}</td>
      <td><a href="/test/skrzynka/${esc(w.id)}">${esc(w.temat)}</a>${w.zalaczniki.length ? ` <small>(załączniki: ${w.zalaczniki.length})</small>` : ''}</td>
    </tr>`).join('');
  odp.type('html').send(strona('Skrzynka testowa', `
    <h1>Skrzynka testowa</h1>
    <p><small>Wiadomości zapisane zamiast wysyłki — status doręczenia: „testowa — niewysłana”. Pliki .eml: <code>${esc(konfiguracja.KATALOG_SKRZYNKI)}</code></small></p>
    ${wiersze ? `<table><thead><tr><th>Czas</th><th>Adresat</th><th>Temat</th></tr></thead><tbody>${wiersze}</tbody></table>`
    : '<div class="karta">Skrzynka jest pusta.</div>'}`));
});

router.get('/skrzynka/:id.eml', (zad, odp) => {
  const plik = skrzynka.sciezkaEml(zad.params.id);
  if (!plik) return odp.status(404).type('text/plain').send('Nie ma takiej wiadomości.');
  odp.download(plik, `${zad.params.id}.eml`);
});

router.get('/skrzynka/:id', (zad, odp) => {
  const w = skrzynka.wiadomosc(zad.params.id);
  if (!w) return odp.status(404).type('html').send(strona('Brak wiadomości', '<h1>Nie ma takiej wiadomości.</h1>'));
  odp.type('html').send(strona(w.temat, `
    <p><a href="/test/skrzynka">← Skrzynka testowa</a></p>
    <h1>${esc(w.temat)}</h1>
    <div class="karta">
      <div><strong>Do:</strong> ${esc(w.do)}</div>
      <div><strong>Od:</strong> ${esc(w.od)}</div>
      <div><strong>Czas:</strong> ${esc(czas.dzienLokalny(w.czas))} ${esc(czas.godzinaLokalna(w.czas, { sekundy: true }))}
        <small>(rzeczywisty: ${esc(w.czas_rzeczywisty)})</small></div>
      <div><strong>Status:</strong> testowa — niewysłana</div>
      ${w.zalaczniki.length ? `<div><strong>Załączniki:</strong> ${w.zalaczniki.map(esc).join(', ')} — w pliku <a href="/test/skrzynka/${esc(w.id)}.eml">.eml</a></div>`
      : `<div><a href="/test/skrzynka/${esc(w.id)}.eml">Pobierz .eml</a></div>`}
    </div>
    <div class="tresc-wiadomosci">${w.html || `<pre>${esc(w.tekst || '')}</pre>`}</div>`));
});

// ─────────────────────────────────────────────────────────────
// Panel: symulowana data (T4), atrapa walidatora (T5), atrapa tpay (T5)
// ─────────────────────────────────────────────────────────────

const transakcje = new Map();
let licznikTransakcji = 0;

router.get('/', (zad, odp) => {
  const d = stanDaty();
  const ostatnie = tryb.ostatnieZdarzenie(db());
  const wynik = tryb.wynikWalidatora(db());
  const opcje = Object.entries(tryb.WYNIKI_WALIDATORA)
    .map(([k, v]) => `<option value="${k}"${k === wynik ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const konta = kontaIstniejace()
    .map((k) => `<tr><td>${esc(k.opis)}</td><td>${esc(k.email)}</td><td>${k.aplikacja === 'kancelaria' ? '<a href="/">kancelaria</a>' : '<a href="/portal.html">portal</a>'}</td></tr>`)
    .join('');
  const oczekujace = [...transakcje.values()].filter((t) => t.status === 'pending');
  odp.type('html').send(strona('Panel testowy', `
    <h1>Panel trybu testowego</h1>${komunikat(zad)}
    <h2>Symulowana data</h2>
    <div class="karta">
      <p>Data rejestru: <strong>${esc(d.data)}</strong> ${d.symulowana ? '(symulowana)' : '(rzeczywista)'}.
      Działa na bramkę 18.02.2027, terminy (7 dni, 14 dni, 12 miesięcy) i chwile nowych zdarzeń.
      ${ostatnie ? `<br><small>Ostatnie zdarzenie w rejestrze: ${esc(czas.dzienLokalny(ostatnie))} — wcześniejszej daty nie ustawisz.</small>` : ''}</p>
      <form method="post" action="/test/data">
        <input type="date" name="data" required value="${esc(d.data)}"> <button>Ustaw datę</button>
      </form>
      <form method="post" action="/test/data" style="margin-top:8px"><input type="hidden" name="data" value="">
        <button>Wróć do daty rzeczywistej</button></form>
    </div>
    <h2>Konta testowe <small>(hasło: <code>${esc(tryb.HASLO_TESTOWE)}</code>)</small></h2>
    ${konta ? `<table><tbody>${konta}</tbody></table>` : '<div class="karta">Brak kont — uruchom <code>npm run test:seed</code>.</div>'}
    <p><small>Na ekranach logowania kancelarii i portalu jest lista tych kont — jedno kliknięcie = zalogowanie.
      Link logowania z wiersza poleceń: <code>npm run test:link -- &lt;e-mail&gt;</code>.</small></p>
    <h2>Atrapa walidatora podpisu</h2>
    <div class="karta">
      <form method="post" action="/test/walidator">
        <label>Wynik następnej walidacji: <select name="wynik">${opcje}</select></label> <button>Zapisz</button>
      </form>
      <p><small>Atrapę wywoła adapter walidacji podpisu (Faza 2) zamiast usługi DSS.</small></p>
    </div>
    <h2>Atrapa płatności tpay (ITN)</h2>
    <div class="karta">
      ${konfiguracja.TPAY.atrapa
    ? `<p>Płatności online kierowane są do atrapy w tej aplikacji. „Zapłać” w portalu otwiera atrapę kasy,
         a ona wysyła powiadomienie ITN na zwykły adres <code>/api/psa/platnosci/tpay/itn</code>.</p>
         ${oczekujace.length ? `<table><thead><tr><th>Transakcja</th><th>Opis</th><th>Kwota</th><th></th></tr></thead><tbody>${oczekujace
    .map((t) => `<tr><td>${esc(t.id)}</td><td>${esc(t.opis)}</td><td>${esc(t.kwota)} zł</td><td><a href="/test/tpay/kasa/${esc(t.id)}">Otwórz kasę</a></td></tr>`).join('')}</tbody></table>`
    : '<p><small>Brak transakcji oczekujących na zapłatę.</small></p>'}`
    : '<p>W .env są dane prawdziwego tpay — atrapa wyłączona.</p>'}
    </div>`));
});

router.post('/data', formularz, (zad, odp) => {
  try {
    tryb.ustawDate(db(), String((zad.body || {}).data || '').trim() || null);
    odp.redirect(303, `/test?ok=${encodeURIComponent(`Data rejestru: ${czas.dzisIso()}${czas.przesuniecie() ? ' (symulowana)' : ' (rzeczywista)'}.`)}`);
  } catch (e) {
    odp.redirect(303, `/test?blad=${encodeURIComponent(e.message)}`);
  }
});

router.post('/walidator', formularz, (zad, odp) => {
  try {
    tryb.ustawWynikWalidatora(db(), String((zad.body || {}).wynik || ''));
    odp.redirect(303, `/test?ok=${encodeURIComponent('Zapisano wynik atrapy walidatora.')}`);
  } catch (e) {
    odp.redirect(303, `/test?blad=${encodeURIComponent(e.message)}`);
  }
});

// ─────────────────────────────────────────────────────────────
// Atrapa tpay (T5) — API operatora + kasa z ITN
// ─────────────────────────────────────────────────────────────

const json = express.json({ limit: '64kb' });

router.post('/tpay/api/oauth/auth', formularz, (zad, odp) => {
  odp.json({ access_token: `atrapa-${crypto.randomUUID()}`, expires_in: 7200 });
});

router.post('/tpay/api/transactions', json, (zad, odp) => {
  const c = zad.body || {};
  licznikTransakcji += 1;
  const id = `TR-ATRAPA-${Date.now().toString(36)}-${licznikTransakcji}`;
  // Kase otwiera przegladarka klienta — adres publiczny portalu, nie 127.0.0.1.
  const kasa = new URL(`/test/tpay/kasa/${id}`, konfiguracja.URL_PORTALU).toString();
  transakcje.set(id, {
    id,
    kwota: Number(c.amount).toFixed(2),
    opis: c.description || '',
    crc: c.hiddenDescription,
    powrot: c.callbacks && c.callbacks.payerUrls ? c.callbacks.payerUrls.success : null,
    status: 'pending',
  });
  odp.json({ result: 'success', transactionId: id, title: id, transactionPaymentUrl: kasa });
});

router.get('/tpay/api/transactions/:id', (zad, odp) => {
  const t = transakcje.get(zad.params.id);
  if (!t) return odp.status(404).json({ result: 'failed' });
  odp.json({ result: 'success', transactionId: t.id, status: t.status });
});

router.post('/tpay/api/transactions/:id/cancel', (zad, odp) => {
  const t = transakcje.get(zad.params.id);
  if (t) t.status = 'canceled';
  odp.json({ result: 'success' });
});

router.get('/tpay/kasa/:id', (zad, odp) => {
  const t = transakcje.get(zad.params.id);
  if (!t) return odp.status(404).type('html').send(strona('Atrapa kasy', '<h1>Nie ma takiej transakcji (atrapa jest w pamięci — restart serwera ją czyści).</h1>'));
  odp.type('html').send(strona('Atrapa kasy tpay', `
    <h1>Atrapa kasy tpay</h1>${komunikat(zad)}
    <div class="karta"><div><strong>Transakcja:</strong> ${esc(t.id)}</div>
      <div><strong>Opis:</strong> ${esc(t.opis)}</div><div><strong>Kwota:</strong> ${esc(t.kwota)} zł</div>
      <div><strong>Status:</strong> ${esc(t.status)}</div></div>
    ${t.status === 'pending' ? `<form method="post" action="/test/tpay/kasa/${esc(t.id)}/itn" style="display:flex;gap:8px">
      <button name="wynik" value="TRUE">Zapłać (wyślij ITN)</button>
      <button name="wynik" value="FALSE">Odrzuć płatność</button></form>` : ''}`));
});

router.post('/tpay/kasa/:id/itn', formularz, async (zad, odp) => {
  const t = transakcje.get(zad.params.id);
  if (!t || t.status !== 'pending') return odp.redirect(303, '/test?blad=' + encodeURIComponent('Transakcja nie oczekuje na zapłatę.'));
  const zaplacono = String((zad.body || {}).wynik) === 'TRUE';
  const pola = {
    id: 'atrapa',
    tr_id: t.id,
    tr_amount: t.kwota,
    tr_paid: zaplacono ? t.kwota : '0.00',
    tr_crc: t.crc,
    tr_status: zaplacono ? 'TRUE' : 'FALSE',
    tr_error: zaplacono ? 'none' : 'declined',
    test_mode: '1',
  };
  pola.md5sum = crypto.createHash('md5')
    .update(`${pola.id}${pola.tr_id}${pola.tr_amount}${pola.tr_crc}${konfiguracja.TPAY.notification_secret}`)
    .digest('hex');
  const adresItn = new URL('/api/psa/platnosci/tpay/itn', konfiguracja.TPAY.api_url).toString();
  try {
    const r = await fetch(adresItn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(pola).toString(),
    });
    const tekst = await r.text();
    if (tekst !== 'TRUE') throw new Error(`endpoint ITN odpowiedział: ${tekst}`);
    t.status = zaplacono ? 'paid' : 'declined';
  } catch (e) {
    return odp.redirect(303, `/test/tpay/kasa/${t.id}?blad=${encodeURIComponent(`ITN nie doszło: ${e.message}`)}`);
  }
  if (t.powrot && zaplacono) return odp.redirect(303, t.powrot);
  odp.redirect(303, `/test?ok=${encodeURIComponent(`ITN wysłane: ${zaplacono ? 'zapłacono' : 'odrzucono'} (${t.id}).`)}`);
});

module.exports = router;

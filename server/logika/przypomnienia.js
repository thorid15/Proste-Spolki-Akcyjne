'use strict';

/**
 * Przypomnienia o konczacym sie roku prowadzenia rejestru.
 *
 * Rok biegnie od ROCZNICY kazdej spolki z osobna (§ 15b pkt 1 — "za kazdy
 * rozpoczety rok"), wiec nie da sie tego zalatwic jednym mailem w styczniu.
 * Ten modul znajduje spolki, ktorym okres wlasnie sie konczy, nalicza
 * kolejny i wysyla wiadomosc z linkiem do zaplaty.
 *
 * IDEMPOTENTNY po `psa_oplaty`: naliczenie kolejnego okresu nie powtarza
 * sie, a wiadomosc wychodzi tylko o naleznosciach, o ktorych jeszcze nie
 * pisalismy (slad w `psa_wydane_dokumenty`).
 */

const oplaty = require('../oplaty');
const platnosci = require('../platnosci');
const tpay = require('./tpay');
const poczta = require('../poczta');
const ustawienia = require('./ustawienia');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');

function esc(t) {
  return String(t ?? '').replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));
}

function tresc({ kancelariaNazwa, spolkaNazwa, okresDo, kwotaZl, link, adresPortalu }) {
  return `
    <p>Dzień dobry,</p>
    <p>Okres prowadzenia rejestru akcjonariuszy spółki <strong>${esc(spolkaNazwa)}</strong>
       kończy się <strong>${esc(okresDo)}</strong>.</p>
    <p>Opłata za kolejny rok wynosi <strong>${esc(kwotaZl)}</strong>.</p>
    ${link
      ? `<p><a href="${esc(link)}">Zapłać online</a></p>`
      : '<p>Należność rozliczy faktura z kancelarii.</p>'}
    <p>Stan rozliczeń widać w portalu klienta, w zakładce „Płatności”:
       <a href="${esc(adresPortalu)}">${esc(adresPortalu)}</a></p>
    <p>${esc(kancelariaNazwa)}</p>
  `;
}

/** Czy o TEJ naleznosci juz pisalismy — zeby nie slac co dzien tego samego. */
function juzPrzypomniano(db, oplataId) {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM psa_wydane_dokumenty
          WHERE typ = 'raport' AND tresc_html LIKE ? LIMIT 1`
      )
      .get(`%[przypomnienie-oplata-${oplataId}]%`)
  );
}

/**
 * Dla kazdej spolki, ktorej okres konczy sie w ciagu `dni`: nalicza kolejny
 * okres i wysyla przypomnienie na adres spolki. Zwraca liste wynikow.
 */
async function wyslijPrzypomnienia(db, { dni = 30, autor = 'automat', dzis = czas.dzisIso() } = {}) {
  const kancelaria = ustawienia.kancelaria(db);
  const adresPortalu = konfiguracja.URL_PORTALU;
  const wyniki = [];

  for (const wiersz of oplaty.okresyDoOdnowienia(db, { dni, dzis })) {
    const { utworzono, oplata } = oplaty.naliczOkresProwadzenia(db, {
      spolkaId: wiersz.spolka_id,
      okres: wiersz.nastepny,
      autor,
    });

    if (juzPrzypomniano(db, oplata.id)) {
      wyniki.push({ spolka_id: wiersz.spolka_id, oplata_id: oplata.id, wyslano: false, powod: 'już przypominano' });
      continue;
    }

    const spolka = db.prepare('SELECT nazwa, email FROM psa_spolki WHERE id = ?').get(wiersz.spolka_id);
    if (!spolka || !spolka.email) {
      wyniki.push({ spolka_id: wiersz.spolka_id, oplata_id: oplata.id, wyslano: false, powod: 'spółka nie ma adresu e-mail' });
      continue;
    }

    let link = null;
    if (tpay.skonfigurowany()) {
      try {
        const podstawa = String(adresPortalu || '').split('/portal')[0].replace(/\/$/, '');
        const zaplata = await platnosci.przygotujZaplate(db, {
          oplataId: oplata.id,
          urlPowiadomienia: `${podstawa}/api/psa/platnosci/tpay/itn`,
          urlPowrotu: konfiguracja.TPAY.url_powrotu || `${adresPortalu}#/platnosci`,
        });
        link = zaplata.platnosc.link;
      } catch (e) {
        // Brak linku nie wstrzymuje przypomnienia — termin i tak biegnie.
        link = null;
      }
    }

    const html = tresc({
      kancelariaNazwa: kancelaria.nazwa,
      spolkaNazwa: spolka.nazwa,
      okresDo: wiersz.okres_do,
      kwotaZl: `${(oplata.kwota_grosze / 100).toFixed(2)} zł`,
      link,
      adresPortalu,
    });

    const proba = await poczta.wyslij({
      do: spolka.email,
      temat: `Kończy się rok prowadzenia rejestru — ${spolka.nazwa}`,
      html,
    });

    // Slad z ZNACZNIKIEM naleznosci — po nim `juzPrzypomniano` poznaje,
    // ze o tej wlasnie oplacie juz pisalismy.
    db.prepare(
      `INSERT INTO psa_wydane_dokumenty (spolka_id, typ, kanal, tresc_html, wyslano, autor, utworzono)
       VALUES (?, 'raport', 'email', ?, ?, ?, ?)`
    ).run(
      wiersz.spolka_id,
      `[przypomnienie-oplata-${oplata.id}] ${html}`,
      proba.wyslano ? czas.terazIso() : null,
      autor,
      czas.terazIso()
    );

    wyniki.push({
      spolka_id: wiersz.spolka_id,
      spolka_nazwa: spolka.nazwa,
      oplata_id: oplata.id,
      naliczono_okres: utworzono,
      wyslano: proba.wyslano,
      powod: proba.wyslano ? null : proba.powod,
    });
  }

  return wyniki;
}

module.exports = { wyslijPrzypomnienia, tresc };

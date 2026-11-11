'use strict';

/**
 * Pulpit (§ 5): jedna lista „Do zrobienia” według pilności — sprawy po terminie albo z terminem
 * do 2 dni, nowe pliki w sprawach wstrzymanych, pisma do wysłania i błędy wysyłki, wnioski złożone
 * i podpisy do sprawdzenia, przejęcia, w których nadszedł dzień przejęcia. Wiersz wskazuje ekran,
 * który go załatwia.
 */

const czas = require('./pomocnicze/czas');
const sprawy = require('./sprawy');
const korespondencja = require('./korespondencja');
const danePliki = require('./dane/pliki');
const { dataPl } = require('./logika/pisma');

const PROG_DNI = 2;

function doZrobienia(db) {
  const dzis = czas.dzisIso();
  const pozycje = [];
  for (const s of sprawy.lista(db, { stany: ['w_toku', 'wstrzymana'] })) {
    const t = s.termin;
    if (s.stan === 'w_toku' && t && t.dni_pozostale <= PROG_DNI) {
      pozycje.push({
        rodzaj: 'sprawa',
        pilnosc: t.dni_pozostale,
        tytul: `Sprawa nr ${s.id} — ${s.spolka}`,
        opis: t.po_terminie ? `po terminie (${dataPl(t.termin_do)})` : `termin ${dataPl(t.termin_do)}`,
        sciezka: `/sprawy/${s.id}`,
      });
    } else if (s.stan === 'wstrzymana') {
      const nowy = danePliki.ostatniDzienPlikuSprawy(db, s.id, (t && t.wstrzymana_od) || dzis);
      if (nowy) {
        pozycje.push({ rodzaj: 'plik', pilnosc: 1, tytul: `Sprawa nr ${s.id} — ${s.spolka}`, opis: `nowy plik ${dataPl(nowy)} w sprawie wstrzymanej`, sciezka: `/sprawy/${s.id}` });
      }
    }
  }
  for (const [filtr, opis, pilnosc] of [['bledy', 'błąd wysyłki', 0], ['do_wyslania', 'do wysłania', 2]]) {
    for (const p of korespondencja.lista(db, { filtr })) {
      pozycje.push({
        rodzaj: 'pismo',
        pilnosc,
        tytul: `${p.pismo} ${p.numer}`,
        opis: `${opis}${p.kanal === 'list' ? ' — list' : ' — e-mail'}${p.adresat_nazwa ? ` · ${p.adresat_nazwa}` : ''}`,
        sciezka: `/korespondencja?pismo=${p.id}`,
      });
    }
  }
  const wnioski = db
    .prepare(
      `SELECT w.id, w.krs, w.stan, w.przejecie, w.data_przejecia, s.data_otwarcia,
              (SELECT COUNT(*) FROM psa_pliki p WHERE p.wniosek_id = w.id AND p.stan_podpisu = 'do_sprawdzenia') AS podpisy
         FROM psa_wnioski w LEFT JOIN psa_spolki s ON s.id = w.spolka_id
        WHERE w.stan = 'zlozony' OR (w.stan = 'przyjety' AND s.data_otwarcia IS NULL)`
    )
    .all();
  for (const w of wnioski) {
    const opis = w.stan === 'zlozony'
      ? `złożony${w.podpisy ? ` — podpisy do sprawdzenia: ${w.podpisy}` : ''}`
      : w.przejecie && w.data_przejecia && w.data_przejecia > dzis ? null : w.przejecie ? 'dzień przejęcia — otwórz rejestr' : 'przyjęty — otwórz rejestr';
    if (opis) pozycje.push({ rodzaj: 'wniosek', pilnosc: 1, tytul: `Wniosek KRS ${w.krs}`, opis, sciezka: `/wnioski/${w.id}` });
  }
  return pozycje.sort((a, b) => a.pilnosc - b.pilnosc);
}

module.exports = { doZrobienia };

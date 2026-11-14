'use strict';

/**
 * Pulpit (§ 5): jedna lista „Do zrobienia” według pilności — wszystkie otwarte wpisy (D-235; po terminie albo
 * z terminem do 2 dni — na górze), nowe zgłoszenia z portalu, nowe pliki w sprawach wstrzymanych, pisma do wysłania i błędy wysyłki, wnioski złożone
 * i podpisy do sprawdzenia, przejęcia, w których nadszedł dzień przejęcia, zawiadomienie sądu rejestrowego
 * po zamknięciu rejestru (art. 300³² § 3). Wiersz wskazuje ekran,
 * który go załatwia.
 */

const czas = require('./pomocnicze/czas');
const sprawy = require('./sprawy');
const korespondencja = require('./korespondencja');
const danePliki = require('./dane/pliki');
const daneSpolki = require('./dane/spolki');
const terminy = require('./logika/terminy');
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
    } else if (s.stan === 'w_toku' && s.z_portalu && s.krok === 1) {
      pozycje.push({ rodzaj: 'sprawa', pilnosc: 1, tytul: `Sprawa nr ${s.id} — ${s.spolka}`, opis: `nowe zgłoszenie z portalu (${dataPl(s.data_wplywu)})`, sciezka: `/sprawy/${s.id}` });
    } else if (s.stan === 'wstrzymana') {
      const nowy = danePliki.ostatniDzienPlikuSprawy(db, s.id, (t && t.wstrzymana_od) || dzis);
      if (nowy) {
        pozycje.push({ rodzaj: 'plik', pilnosc: 1, tytul: `Sprawa nr ${s.id} — ${s.spolka}`, opis: `nowy plik ${dataPl(nowy)} w sprawie wstrzymanej`, sciezka: `/sprawy/${s.id}` });
      } else {
        pozycje.push({ rodzaj: 'sprawa', pilnosc: 9, tytul: `Sprawa nr ${s.id} — ${s.spolka}`, opis: 'wstrzymana — czeka na uzupełnienie', sciezka: `/sprawy/${s.id}` });
      }
    } else if (s.stan === 'w_toku') {
      // D-235: „Sprawy” nie są pozycją menu — każdy otwarty wpis stoi na Pulpicie, pilne na górze.
      pozycje.push({
        rodzaj: 'sprawa',
        pilnosc: t ? t.dni_pozostale : PROG_DNI + 5,
        tytul: `Sprawa nr ${s.id} — ${s.spolka}`,
        opis: t ? `wpis w toku — termin ${dataPl(t.termin_do)}` : 'wpis w toku',
        sciezka: `/sprawy/${s.id}`,
      });
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
  for (const sp of db.prepare('SELECT * FROM psa_spolki WHERE data_zamkniecia IS NOT NULL').all()) {
    const z = daneSpolki.zawiadomienieSadu(db, sp);
    if (!z || z.zawiadomiono) continue;
    pozycje.push({
      rodzaj: 'zawiadomienie_sadu',
      pilnosc: terminy.dniMiedzy(dzis, z.termin),
      tytul: sp.nazwa,
      opis: `zawiadom sąd rejestrowy (system KRS) o rozwiązaniu umowy — termin ${dataPl(z.termin)}`,
      sciezka: `/spolki/${sp.id}`,
    });
  }
  return pozycje.sort((a, b) => a.pilnosc - b.pilnosc);
}

module.exports = { doZrobienia };

'use strict';

/**
 * Pulpit (§ 5): jedna lista „Do zrobienia” według pilności — sprawy po terminie albo z terminem
 * do 2 dni, nowe pliki w sprawach wstrzymanych, pisma do wysłania i błędy wysyłki. Wiersz wskazuje
 * ekran, który go załatwia. Wnioski, podpisy i przejęcia dochodzą w Fazie 4.
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
  return pozycje.sort((a, b) => a.pilnosc - b.pilnosc);
}

module.exports = { doZrobienia };

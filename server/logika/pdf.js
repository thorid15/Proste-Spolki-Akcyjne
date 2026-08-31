'use strict';

/**
 * Składanie dokumentów PDF (pdfkit).
 *
 * Po co PDF, skoro wzory pism są w `.docx`
 * ─────────────────────────────────────────
 * Umowa o prowadzenie rejestru jest dokumentem NEGOCJOWANYM — notariusz
 * edytuje jej wzór w Wordzie, a klient dostaje plik, który da się poprawić
 * przed podpisem. Dokumenty składane tym modułem są czymś innym: to
 * OŚWIADCZENIA o ustalonej treści (zgoda na komunikację elektroniczną,
 * oświadczenie RODO, oświadczenie na potrzeby ustawy o przeciwdziałaniu
 * praniu pieniędzy, żądanie wpisu). Ich treść ma pozostać taka, jaką
 * wystawiła kancelaria — stąd format, którego nie otwiera się w edytorze
 * tekstu i nie poprawia jednym kliknięciem.
 *
 * Krój jest OSADZONY w pliku (patrz `wzory/czcionki/README.md`), a autorem
 * w metadanych jest kancelaria, nie biblioteka, którą plik powstał.
 */

const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');

const KATALOG_CZCIONEK = path.join(__dirname, '..', '..', 'wzory', 'czcionki');
const CZCIONKA_ZWYKLA = path.join(KATALOG_CZCIONEK, 'LiberationSerif-Regular.ttf');
const CZCIONKA_POGRUBIONA = path.join(KATALOG_CZCIONEK, 'LiberationSerif-Bold.ttf');

/** A4 z marginesami 2,5 cm — te same, co we wzorach .docx (72 pkt = 2,54 cm). */
const MARGINES = 71;
const ROZMIAR_TEKSTU = 11;
const INTERLINIA = 1.35;

/**
 * Buduje dokument i zwraca go jako Buffer.
 *
 * @param {object} opcje
 * @param {string} opcje.tytul     tytuł dokumentu (nagłówek i metadane)
 * @param {string} opcje.autor     autor w metadanych pliku
 * @param {Function} opcje.tresc   (p) => void — wywołanie z pomocnikami niżej
 * @returns {Promise<Buffer>}
 */
function zbuduj({ tytul, autor, tresc }) {
  return new Promise((zrealizuj, odrzuc) => {
    const dokument = new PDFDocument({
      size: 'A4',
      margins: { top: MARGINES, bottom: MARGINES, left: MARGINES, right: MARGINES },
      info: {
        Title: tytul,
        Author: autor,
        // pdfkit domyślnie wpisuje tu własną nazwę — dokument wychodzi
        // z kancelarii i to ona ma być wskazana także jako wytwórca pliku.
        Creator: autor,
        Producer: autor,
      },
    });

    dokument.registerFont('zwykla', CZCIONKA_ZWYKLA);
    dokument.registerFont('pogrubiona', CZCIONKA_POGRUBIONA);
    dokument.font('zwykla').fontSize(ROZMIAR_TEKSTU).lineGap(ROZMIAR_TEKSTU * (INTERLINIA - 1));

    const czesci = [];
    dokument.on('data', (c) => czesci.push(c));
    dokument.on('end', () => zrealizuj(Buffer.concat(czesci)));
    dokument.on('error', odrzuc);

    try {
      tresc(pomocniki(dokument));
    } catch (e) {
      return odrzuc(e);
    }
    dokument.end();
  });
}

/** Wartość do wydruku — brak danych zostaje widoczną kreską, nie pustką. */
function wartosc(v) {
  return v === undefined || v === null || String(v).trim() === '' ? '—' : String(v).trim();
}

function pomocniki(d) {
  const szerokosc = d.page.width - MARGINES * 2;

  return {
    dokument: d,

    /** Tytuł pisma — wyśrodkowany, pogrubiony, z odstępem pod spodem. */
    tytul(tekst, podtytul) {
      d.font('pogrubiona').fontSize(14).text(tekst, { align: 'center' });
      if (podtytul) {
        d.moveDown(0.2);
        d.font('zwykla').fontSize(10).text(podtytul, { align: 'center' });
      }
      d.font('zwykla').fontSize(ROZMIAR_TEKSTU);
      d.moveDown(1.2);
    },

    /** Nagłówek sekcji. */
    sekcja(tekst) {
      d.moveDown(0.6);
      d.font('pogrubiona').fontSize(ROZMIAR_TEKSTU).text(tekst);
      d.font('zwykla');
      d.moveDown(0.3);
    },

    /** Akapit tekstu ciągłego, wyjustowany. */
    akapit(tekst, opcje = {}) {
      d.font(opcje.pogrubiony ? 'pogrubiona' : 'zwykla')
        .fontSize(ROZMIAR_TEKSTU)
        .text(tekst, { align: opcje.align || 'justify', ...opcje });
      d.font('zwykla');
      d.moveDown(0.5);
    },

    /**
     * Lista „etykieta: wartość” — tak wyglądają w tej aplikacji WSZYSTKIE
     * dane osobowe w pismach: w mianowniku, opisane etykietą, bez odmiany
     * przez przypadki.
     */
    pola(pary) {
      const szerokoscEtykiety = 165;
      for (const [etykieta, tresc] of pary) {
        if (tresc === false) continue;
        const y = d.y;
        d.font('zwykla').fontSize(ROZMIAR_TEKSTU);
        d.text(`${etykieta}:`, MARGINES, y, { width: szerokoscEtykiety, continued: false });
        const yEtykiety = d.y;
        d.text(wartosc(tresc), MARGINES + szerokoscEtykiety, y, {
          width: szerokosc - szerokoscEtykiety,
        });
        d.y = Math.max(yEtykiety, d.y);
        d.moveDown(0.15);
      }
      d.moveDown(0.5);
      d.x = MARGINES;
    },

    /**
     * Kratka do odhaczenia. Rysowana kwadratem, nie znakiem „☐” — krój
     * dokumentu nie ma tego znaku i w PDF-ie zostałaby po nim dziura.
     */
    /**
     * Pozycja do zaznaczenia. `zaznaczona` wypełnia kratkę krzyżykiem —
     * używamy tego, gdy odpowiedź jest już znana z formularza i nie ma
     * powodu prosić podpisującego, żeby zaznaczał ją drugi raz długopisem.
     */
    opcja(tekst, zaznaczona = false) {
      const bok = 9;
      const wciecie = 22;
      const y = d.y;
      d.rect(MARGINES + 2, y + 1.5, bok, bok).lineWidth(0.7).stroke();
      if (zaznaczona) {
        d.save().lineWidth(1.2)
          .moveTo(MARGINES + 4, y + 3.5).lineTo(MARGINES + 9, y + 8.5)
          .moveTo(MARGINES + 9, y + 3.5).lineTo(MARGINES + 4, y + 8.5)
          .stroke().restore();
      }
      d.font(zaznaczona ? 'pogrubiona' : 'zwykla').fontSize(ROZMIAR_TEKSTU)
        .text(tekst, MARGINES + wciecie, y, { width: szerokosc - wciecie, align: 'left' });
      d.font('zwykla');
      d.moveDown(0.35);
      d.x = MARGINES;
    },

    /**
     * Pola do wypełnienia ręcznie — etykieta i linia, nie kreska „—”.
     * Kreska znaczy „danych brak”; tu chodzi o „miejsce na wpisanie”.
     */
    polaDoWypelnienia(etykiety) {
      const szerokoscEtykiety = 165;
      for (const etykieta of etykiety) {
        const y = d.y;
        d.font('zwykla').fontSize(ROZMIAR_TEKSTU)
          .text(`${etykieta}:`, MARGINES, y, { width: szerokoscEtykiety });
        const yLinii = y + ROZMIAR_TEKSTU + 1;
        d.moveTo(MARGINES + szerokoscEtykiety, yLinii)
          .lineTo(d.page.width - MARGINES, yLinii)
          .lineWidth(0.5)
          .stroke();
        d.y = yLinii + 6;
      }
      d.moveDown(0.5);
      d.x = MARGINES;
    },

    /** Punkt listy numerowanej albo literowanej. */
    punkt(znacznik, tekst) {
      const wciecie = 22;
      const y = d.y;
      d.text(znacznik, MARGINES, y, { width: wciecie });
      d.text(tekst, MARGINES + wciecie, y, { width: szerokosc - wciecie, align: 'justify' });
      d.moveDown(0.3);
      d.x = MARGINES;
    },

    odstep(ile = 1) {
      d.moveDown(ile);
    },

    /** Miejsce na podpis: linia i podpis pod nią. */
    podpis(opis) {
      d.moveDown(2.5);
      const szer = 240;
      const x = d.page.width - MARGINES - szer;
      const y = d.y;
      d.moveTo(x, y).lineTo(x + szer, y).lineWidth(0.6).stroke();
      d.font('zwykla').fontSize(9).text(opis, x, y + 4, { width: szer, align: 'center' });
      d.font('zwykla').fontSize(ROZMIAR_TEKSTU);
      d.x = MARGINES;
      d.moveDown(1);
    },

    /** Miejscowość i data w prawym górnym rogu. */
    miejscowoscData(miejscowosc, data) {
      d.font('zwykla').fontSize(ROZMIAR_TEKSTU)
        .text(`${wartosc(miejscowosc)}, dnia ${wartosc(data)}`, { align: 'right' });
      d.moveDown(1);
    },
  };
}

module.exports = { zbuduj, MARGINES };

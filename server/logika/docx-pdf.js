'use strict';

/**
 * Zamiana wypełnionego wzoru `.docx` na PDF (LibreOffice headless + pdf-lib).
 *
 * Umowa o prowadzenie rejestru i uchwała o wyborze podmiotu prowadzącego
 * rejestr powstają z wzorów `.docx` (notariusz edytuje je w Wordzie), ale
 * dokument, który trafia do klienta DO PODPISU, ma być NIEEDYTOWALNY —
 * stąd konwersja na PDF tuż przed wydaniem, a nie zmiana samego wzoru.
 *
 * LibreOffice konwertuje treść (`soffice --headless --convert-to pdf`), ale
 * zostawia we właściwościach pliku siebie jako twórcę/generujące
 * oprogramowanie. `pdf-lib` nadpisuje te metadane JUŻ GOTOWEGO PDF-a — to
 * bezpieczne, bo PDF ma zwartą, zdefiniowaną strukturę obiektów; ręczna
 * edycja bajtów (jak przy `.docx`, zwykłym XML-u w ZIP-ie, w `logika/docx.js`)
 * groziłaby uszkodzeniem pliku.
 *
 * Każde wywołanie dostaje własny, jednorazowy profil LibreOffice — bez tego
 * równoległe konwersje walczyłyby o blokadę tego samego profilu domyślnego.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { PDFDocument } = require('pdf-lib');

const SCIEZKA_SOFFICE = process.env.SCIEZKA_SOFFICE || 'soffice';
const LIMIT_CZASU_MS = 30000;

/**
 * @param {Buffer} bufor  treść pliku `.docx` do przekonwertowania
 * @param {object} [opcje]
 * @param {string} [opcje.autor]  autor w metadanych wynikowego PDF-a
 * @param {string} [opcje.tytul]  tytuł w metadanych wynikowego PDF-a
 * @returns {Promise<Buffer>}
 */
async function zPdf(bufor, { autor, tytul } = {}) {
  const katalogRoboczy = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-docx-pdf-'));
  const katalogProfilu = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-lo-profil-'));
  try {
    const sciezkaDocx = path.join(katalogRoboczy, 'dokument.docx');
    fs.writeFileSync(sciezkaDocx, bufor);

    execFileSync(
      SCIEZKA_SOFFICE,
      [
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--norestore',
        `-env:UserInstallation=file://${katalogProfilu}`,
        '--convert-to',
        'pdf',
        '--outdir',
        katalogRoboczy,
        sciezkaDocx,
      ],
      { timeout: LIMIT_CZASU_MS, stdio: 'pipe' }
    );

    const sciezkaPdf = path.join(katalogRoboczy, 'dokument.pdf');
    if (!fs.existsSync(sciezkaPdf)) {
      throw new Error('LibreOffice nie utworzyło pliku PDF.');
    }

    const dokument = await PDFDocument.load(fs.readFileSync(sciezkaPdf));
    dokument.setProducer(autor || '');
    dokument.setCreator(autor || '');
    dokument.setAuthor(autor || '');
    dokument.setTitle(tytul || '');
    dokument.setSubject('');
    dokument.setKeywords([]);
    return Buffer.from(await dokument.save());
  } finally {
    fs.rmSync(katalogRoboczy, { recursive: true, force: true });
    fs.rmSync(katalogProfilu, { recursive: true, force: true });
  }
}

module.exports = { zPdf };

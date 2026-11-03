'use strict';

/**
 * Nazwa pliku do wyświetlenia (R4 zad. 6, K1): nazwa oryginalna bez identyfikatorów technicznych
 * (UUID — pełnych albo ich końcówek), a gdy nic nie zostaje: `<rodzaj>-<RRRR-MM-DD>.pdf`.
 * Czysta logika, bez JSX (kancelaria i portal; test: `testy/nazwy-plikow.test.js`).
 */

const WZOR_UUID_W_NAZWIE = /(?:[0-9a-f]{8}-)?(?:[0-9a-f]{4}-){3}[0-9a-f]{12}[-_ .]?/gi;

function nazwaPlikuDoWyswietlenia({ nazwaOryginalna, rodzaj, data } = {}) {
  const czysta = String(nazwaOryginalna || '').replace(WZOR_UUID_W_NAZWIE, '').replace(/^[-_ .]+/, '');
  if (czysta && !/^[a-z0-9]{1,5}$/i.test(czysta) && !/^\.[a-z0-9]{1,5}$/i.test(czysta)) return czysta;
  const dzien = String(data || '').slice(0, 10);
  return `${rodzaj || 'dokument'}${/^\d{4}-\d{2}-\d{2}$/.test(dzien) ? `-${dzien}` : ''}.pdf`;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { nazwaPlikuDoWyswietlenia };

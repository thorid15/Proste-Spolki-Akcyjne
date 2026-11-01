'use strict';

/**
 * Dopuszczalne formy podpisu — JEDNO miejsce dla calej aplikacji (W2.1, W2.2,
 * W2.5; DECYZJE.md D-075, D-076). Dosłownie wg tabeli § 2 wytycznych
 * „Rejestr akcjonariuszy PSA online” (1.11.2026). Widoki i trasy pytaja te
 * funkcje — nie trzymaja wlasnych list.
 *
 * | Dokument                         | Polityka kancelarii                                             |
 * |----------------------------------|-----------------------------------------------------------------|
 * | Zgoda na wpis (300(34) § 3)      | QES (mObywatel), PZ, PO; oryginał pocztą TYLKO z podpisem       |
 * |                                  | notarialnie poświadczonym; podpis w kancelarii                  |
 * | Umowa zbycia/obciążenia (300(36))| QES, PZ, PO albo oryginał pocztą; skan odrzucany                |
 * | Zgoda spółki na zbycie           | jak umowa zbycia                                                |
 * | Umowa o prowadzenie rejestru     | spółka podpisuje pierwsza, notariusz ostatni (QES);             |
 * |                                  | zarząd: własny QES, PZ albo oryginał pocztą                     |
 *
 * Skan (zdjęcie, kopia) i podpis elektroniczny zaawansowany (niekwalifikowany)
 * nie są żadną z form — nigdy nie są dopuszczalne.
 */

const przepisy = require('./przepisy');

const FORMY = {
  QES: 'qes',
  PZ: 'pz',
  PO: 'po',
  ORYGINAL: 'oryginal',
  ORYGINAL_POSWIADCZONY: 'oryginal_poswiadczony',
  W_KANCELARII: 'w_kancelarii',
  SKAN: 'skan',
  ZAAWANSOWANY: 'zaawansowany',
};

const NAZWY_FORM = {
  [FORMY.QES]: 'kwalifikowany podpis elektroniczny (np. mObywatel)',
  [FORMY.PZ]: 'podpis zaufany',
  [FORMY.PO]: 'podpis osobisty (e-dowód)',
  [FORMY.ORYGINAL]: 'oryginał pocztą (podpis własnoręczny)',
  [FORMY.ORYGINAL_POSWIADCZONY]: 'oryginał pocztą z podpisem notarialnie poświadczonym',
  [FORMY.W_KANCELARII]: 'podpis w kancelarii (w obecności osoby upoważnionej)',
  [FORMY.SKAN]: 'skan, zdjęcie albo kopia',
  [FORMY.ZAAWANSOWANY]: 'podpis elektroniczny zaawansowany (niekwalifikowany)',
};

/** Typy dokumentów z tabeli § 2. */
const DOKUMENTY = {
  ZGODA_NA_WPIS: 'zgoda_na_wpis',
  UMOWA_ZBYCIA: 'umowa_zbycia',
  ZGODA_SPOLKI: 'zgoda_spolki',
  UMOWA_REJESTRU: 'umowa_rejestru',
  OSWIADCZENIE: 'oswiadczenie',
};

const REGULY = {
  [DOKUMENTY.ZGODA_NA_WPIS]: {
    nazwa: 'Zgoda na wpis osoby, której prawa są wykreślane, zmieniane lub obciążane',
    podstawa: przepisy.PODSTAWY.FORMA_ZGODY_NA_WPIS,
    formy: [FORMY.QES, FORMY.PZ, FORMY.PO, FORMY.ORYGINAL_POSWIADCZONY, FORMY.W_KANCELARII],
    uwaga: 'Skan i zwykły oryginał pocztą = brak zgody — przed wpisem wysyła się powiadomienie (art. 300(34) § 3 zd. 1 KSH).',
    jedenPodpisujacy: true,
  },
  [DOKUMENTY.UMOWA_ZBYCIA]: {
    nazwa: 'Umowa zbycia lub obciążenia akcji',
    podstawa: przepisy.PODSTAWY.FORMA_ZBYCIA,
    formy: [FORMY.QES, FORMY.PZ, FORMY.PO, FORMY.ORYGINAL],
    uwaga: 'Skan odrzucany.',
  },
  [DOKUMENTY.ZGODA_SPOLKI]: {
    nazwa: 'Zgoda spółki na zbycie akcji',
    podstawa: przepisy.PODSTAWY.FORMA_ZGODY_SPOLKI,
    formy: [FORMY.QES, FORMY.PZ, FORMY.PO, FORMY.ORYGINAL],
    uwaga: 'Jak umowa zbycia; skan odrzucany.',
  },
  [DOKUMENTY.UMOWA_REJESTRU]: {
    nazwa: 'Umowa o prowadzenie rejestru akcjonariuszy',
    podstawa: przepisy.PODSTAWY.WYBOR_PODMIOTU,
    formy: [FORMY.QES, FORMY.PZ, FORMY.ORYGINAL],
    formyNotariusza: [FORMY.QES],
    uwaga: 'Spółka podpisuje pierwsza, notariusz ostatni (QES). Wymaga uchwały akcjonariuszy i sprawdzenia reprezentacji w KRS.',
  },
  // Oświadczenia z kompletu wniosku (RODO, AML, zgoda na komunikację) —
  // tabela § 2 ich nie wymienia; przyjmujemy formy jak dla umowy zbycia
  // (bez skanu), zgodnie z zasadą „skany odrzucane” (D-075).
  [DOKUMENTY.OSWIADCZENIE]: {
    nazwa: 'Oświadczenie',
    podstawa: null,
    formy: [FORMY.QES, FORMY.PZ, FORMY.PO, FORMY.ORYGINAL],
    uwaga: 'Skan odrzucany.',
  },
};

/** Typ dokumentu kompletu wniosku (`dokumenty-wniosku.TYPY`) → typ z tabeli § 2. */
function typDlaDokumentuWniosku(typ) {
  // Żądanie pierwszego wpisu nie wykreśla, nie zmienia ani nie obciąża
  // niczyich praw — to nie jest zgoda z art. 300(34) § 3, tylko oświadczenie.
  if (typ === 'umowa_rejestru') return DOKUMENTY.UMOWA_REJESTRU;
  return DOKUMENTY.OSWIADCZENIE;
}

function regula(typDokumentu) {
  return REGULY[typDokumentu] || REGULY[DOKUMENTY.OSWIADCZENIE];
}

/**
 * Czy forma jest dopuszczalna dla dokumentu.
 * @returns {{ dopuszczalna: boolean, przyczyna: string|null }}
 */
function ocenForme(typDokumentu, forma, { notariusz = false } = {}) {
  const r = regula(typDokumentu);
  const lista = notariusz && r.formyNotariusza ? r.formyNotariusza : r.formy;
  if (lista.includes(forma)) return { dopuszczalna: true, przyczyna: null };
  const nazwa = NAZWY_FORM[forma] || `„${forma}”`;
  return {
    dopuszczalna: false,
    przyczyna: `${r.nazwa}: ${nazwa} nie jest dopuszczalną formą`
      + `${r.podstawa ? ` (${r.podstawa}, polityka kancelarii)` : ' (polityka kancelarii)'}. `
      + `Dopuszczalne: ${lista.map((f) => NAZWY_FORM[f]).join('; ')}.`,
  };
}

/** Formy możliwe do odnotowania przy ORYGINALE papierowym (checklista kancelarii). */
function formyPapierowe(typDokumentu) {
  return regula(typDokumentu).formy.filter((f) =>
    [FORMY.ORYGINAL, FORMY.ORYGINAL_POSWIADCZONY, FORMY.W_KANCELARII].includes(f));
}

module.exports = {
  FORMY,
  NAZWY_FORM,
  DOKUMENTY,
  REGULY,
  regula,
  ocenForme,
  formyPapierowe,
  typDlaDokumentuWniosku,
};

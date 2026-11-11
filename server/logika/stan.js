'use strict';

/**
 * Odtworzenie stanu rejestru ze zdarzeń — moduł czysty (bez bazy).
 *
 * Stan akcjonariatu jest pochodną wpisów; `psa_emisje`, `psa_stan_akcji` i `psa_atrybuty` są
 * wyłącznie ich materializacją i odtwarzają się w całości przy każdym zapisie.
 *
 * Model: każdy numer akcji serii należy w danej chwili do otwartych przedziałów jednej z dwóch
 * kategorii — `akcjonariusz` (osoba, ewentualnie ułamek jednego numeru — art. 300(43) KSH) albo
 * `umorzona`. Bilans (art. 300(31) § 2 KSH): przedziały serii pokrywają ją szczelnie, a ułamki
 * każdego numeru sumują się do jedności. Obciążenia i adnotacje to `atrybuty` — przedziały numerów
 * z rodzajem i treścią, z tą samą osią czasu (`data_od` / `data_do`).
 *
 * Moduł liczy też regułę powiadomień (R2, `ktoTraci`) i checklistę wpisu (R5) — obie wynikają
 * z porównania stanu i z atrybutów akcji, nie z typu wpisu.
 */

const n = require('./numery');
const u = require('./ulamki');
const czas = require('../pomocnicze/czas');

const K = { AKCJONARIUSZ: 'akcjonariusz', UMORZONA: 'umorzona' };

/** Obciążenia, z których przysługuje prawo konkretnej osobie (zastawnik, użytkownik). */
const OBCIAZENIA_Z_UPRAWNIONYM = ['zastaw', 'uzytkowanie'];

class BladStanu extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = 'BladStanu';
  }
}

// ─────────────────────────────────────────────────────────────
// Pomocnicze
// ─────────────────────────────────────────────────────────────

/** D-R01: kolejność wpisów — chwila wpisu, potem id. */
function porownajZdarzenia(a, b) {
  const da = String(a.data_wpisu || '');
  const db = String(b.data_wpisu || '');
  if (da !== db) return da < db ? -1 : 1;
  return Number(a.id) - Number(b.id);
}

function dane(zdarzenie) {
  if (zdarzenie.dane && typeof zdarzenie.dane === 'object') return zdarzenie.dane;
  try {
    return JSON.parse(zdarzenie.dane_json || '{}');
  } catch {
    throw new BladStanu(`Wpis #${zdarzenie.id} ma uszkodzoną treść (dane_json).`);
  }
}

function pustyStan() {
  return {
    otwarty: false,
    data_otwarcia: null,
    data_zamkniecia: null,
    powod_zamkniecia: null,
    emisje: [],
    przedzialy: [],
    atrybuty: [],
    wpisy: [],
  };
}

const otwarte = (lista) => lista.filter((p) => p.data_do === null);
const zakres = (w) => ({ nr_od: w.nr_od, nr_do: w.nr_do });
const caly = (p) => p.czesc_licznik === p.czesc_mianownik;
const czescWiersza = (p) => ({ licznik: p.czesc_licznik, mianownik: p.czesc_mianownik });

function emisja(stan, seria) {
  const e = stan.emisje.find((x) => x.seria === seria);
  if (!e) throw new BladStanu(`Seria „${seria}” nie istnieje w rejestrze tej spółki.`);
  return e;
}

function akcjonariusze(stan, seria) {
  return otwarte(stan.przedzialy).filter((p) => p.seria === seria && p.kategoria === K.AKCJONARIUSZ);
}

function wierszeOsoby(stan, seria, osobaId) {
  return akcjonariusze(stan, seria).filter((p) => p.osoba_id === Number(osobaId));
}

/** Numery serii, które istnieją (nie są umorzone). */
function istniejace(stan, seria) {
  return n.normalizuj(akcjonariusze(stan, seria).map(zakres));
}

function wymagajIstniejacych(stan, seria, zakresy) {
  emisja(stan, seria);
  const brak = n.roznica(zakresy, istniejace(stan, seria));
  if (brak.length > 0) {
    throw new BladStanu(`Akcje serii ${seria} nr ${n.opisz(brak)} nie istnieją w rejestrze (umorzone albo poza serią).`);
  }
}

/** Suma ułamków osoby na jednym numerze (cały numer = 1). */
function ulamekNaNumerze(stan, seria, osobaId, nr) {
  let suma = u.ZERO;
  for (const p of wierszeOsoby(stan, seria, osobaId)) {
    if (p.nr_od <= nr && nr <= p.nr_do) suma = u.suma(suma, czescWiersza(p));
  }
  return suma;
}

/**
 * Zamyka część wierszy przecinającą się z `zakresy` (data_do = chwila wpisu), resztę zostawia
 * otwartą z pierwotną datą — rejestr pokazuje, od kiedy ktoś ma konkretny blok akcji.
 * Zwraca zamknięte fragmenty (np. do ponownego otwarcia ze zmienionym atrybutem).
 */
function wytnij(lista, wiersze, zakresy, z) {
  const zamkniete = [];
  for (const w of wiersze) {
    const czesc = n.przeciecie([zakres(w)], zakresy);
    if (czesc.length === 0) continue;
    lista.splice(lista.indexOf(w), 1);
    for (const c of czesc) {
      const zam = { ...w, ...c, data_do: z.data_wpisu, zdarzenie_do_id: Number(z.id) };
      lista.push(zam);
      zamkniete.push(zam);
    }
    for (const r of n.roznica([zakres(w)], zakresy)) lista.push({ ...w, ...r });
  }
  return zamkniete;
}

function dodajPrzedzial(stan, { seria, kategoria, osobaId = null, zakresy, czesc = null, podstawa = null }, z) {
  const e = emisja(stan, seria);
  const cz = czesc ? u.waliduj(czesc) : u.JEDEN;
  const norm = n.normalizuj(zakresy);
  const poza = n.roznica(norm, [zakres(e)]);
  if (poza.length > 0) throw new BladStanu(`Numery ${n.opisz(poza)} wykraczają poza serię ${seria} (${n.opisz([zakres(e)])}).`);
  if (!u.jestJeden(cz) && (norm.length !== 1 || norm[0].nr_od !== norm[0].nr_do)) {
    throw new BladStanu(`Ułamek ${u.opisz(cz)} akcji dotyczy dokładnie jednego numeru akcji.`);
  }
  for (const r of norm) {
    stan.przedzialy.push({
      seria,
      kategoria,
      osoba_id: kategoria === K.AKCJONARIUSZ ? Number(osobaId) : null,
      ...r,
      czesc_licznik: cz.licznik,
      czesc_mianownik: cz.mianownik,
      podstawa,
      zdarzenie_od_id: Number(z.id),
      data_od: z.data_wpisu,
      zdarzenie_do_id: null,
      data_do: null,
    });
  }
}

function dodajEmisje(stan, s) {
  if (stan.emisje.some((e) => e.seria === s.seria)) throw new BladStanu(`Seria „${s.seria}” już istnieje w tej spółce.`);
  stan.emisje.push({ seria: s.seria, nr_od: Number(s.nr_od), nr_do: Number(s.nr_do), data_wpisu_krs: s.data_wpisu_krs });
}

function dodajAtrybut(stan, z, pozycja, a) {
  for (const p of a.akcje) {
    wymagajIstniejacych(stan, p.seria, p.zakresy);
    for (const r of n.normalizuj(p.zakresy)) {
      stan.atrybuty.push({
        zdarzenie_id: Number(z.id),
        pozycja,
        rodzaj: a.rodzaj,
        seria: p.seria,
        ...r,
        osoba_id: a.osoba_id == null ? null : Number(a.osoba_id),
        tresc: a.tresc || null,
        prawo_glosu: a.prawo_glosu ? 1 : 0,
        zdarzenie_od_id: Number(z.id),
        data_od: z.data_wpisu,
        zdarzenie_do_id: null,
        data_do: null,
      });
    }
  }
}

function wierszeAtrybutu(stan, ref) {
  return otwarte(stan.atrybuty).filter(
    (a) => a.zdarzenie_id === Number(ref.zdarzenie_id) && a.pozycja === Number(ref.pozycja || 0)
  );
}

/** Wykreślenie albo zmiana atrybutu na wskazanych akcjach (`zmiana` = nowe pola; null = wykreślenie). */
function zmienAtrybut(stan, z, op, zmiana) {
  const wiersze = wierszeAtrybutu(stan, op.atrybut);
  if (wiersze.length === 0) {
    throw new BladStanu(`Wskazany atrybut (wpis #${op.atrybut.zdarzenie_id}) nie istnieje albo został już wykreślony.`);
  }
  if (wiersze[0].rodzaj !== op.rodzaj) {
    throw new BladStanu(`Wskazany atrybut jest rodzaju „${wiersze[0].rodzaj}”, a nie „${op.rodzaj}”.`);
  }
  for (const p of op.akcje) {
    const wSerii = wiersze.filter((w) => w.seria === p.seria);
    const brak = n.roznica(p.zakresy, wSerii.map(zakres));
    if (brak.length > 0) {
      throw new BladStanu(`Atrybut nie obejmuje akcji serii ${p.seria} nr ${n.opisz(brak)}.`);
    }
    for (const c of wytnij(stan.atrybuty, wSerii, p.zakresy, z)) {
      if (!zmiana) continue;
      stan.atrybuty.push({
        ...c,
        ...zmiana,
        zdarzenie_od_id: Number(z.id),
        data_od: z.data_wpisu,
        zdarzenie_do_id: null,
        data_do: null,
      });
    }
  }
}

function wymagajOtwartego(stan) {
  if (!stan.otwarty) throw new BladStanu('Rejestr tej spółki nie jest otwarty — wpis jest niemożliwy.');
}

/** Przeniesienie ułamka jednego numeru (art. 300(43) KSH). */
function przeniesUlamek(stan, z, seria, nr, zbywcaId, nabywcaId, czesc) {
  const zbywcaMa = ulamekNaNumerze(stan, seria, zbywcaId, nr);
  if (!u.mniejszyRowny(czesc, zbywcaMa)) {
    throw new BladStanu(
      `Zbywca ma ${u.opisz(zbywcaMa)} akcji serii ${seria} nr ${nr} — nie może zbyć ${u.opisz(czesc)} (rozporządzenie ponad stan posiadania).`
    );
  }
  const naNumerze = (osoba) => wierszeOsoby(stan, seria, osoba).filter((p) => p.nr_od <= nr && nr <= p.nr_do);
  wytnij(stan.przedzialy, naNumerze(zbywcaId), [{ nr_od: nr, nr_do: nr }], z);
  const zostaje = u.roznica(zbywcaMa, czesc);
  if (!u.jestZero(zostaje)) {
    dodajPrzedzial(stan, { seria, kategoria: K.AKCJONARIUSZ, osobaId: zbywcaId, zakresy: [{ nr_od: nr, nr_do: nr }], czesc: zostaje }, z);
  }
  const nabywcaMial = ulamekNaNumerze(stan, seria, nabywcaId, nr);
  wytnij(stan.przedzialy, naNumerze(nabywcaId), [{ nr_od: nr, nr_do: nr }], z);
  dodajPrzedzial(
    stan,
    { seria, kategoria: K.AKCJONARIUSZ, osobaId: nabywcaId, zakresy: [{ nr_od: nr, nr_do: nr }], czesc: u.suma(nabywcaMial, czesc) },
    z
  );
}

// ─────────────────────────────────────────────────────────────
// Handlery 8 typów
// ─────────────────────────────────────────────────────────────

const HANDLERY = {
  otwarcie(stan, z, d) {
    if (stan.otwarty || stan.emisje.length > 0) throw new BladStanu('Rejestr tej spółki został już otwarty.');
    stan.otwarty = true;
    stan.data_otwarcia = czas.dzienLokalny(z.data_wpisu);
    for (const s of d.serie) dodajEmisje(stan, s);
    for (const a of d.akcjonariusze) {
      for (const p of a.akcje) {
        dodajPrzedzial(stan, { seria: p.seria, kategoria: K.AKCJONARIUSZ, osobaId: a.osoba_id, zakresy: p.zakresy, czesc: p.czesc }, z);
      }
    }
    for (const m of d.umorzone || []) {
      dodajPrzedzial(stan, { seria: m.seria, kategoria: K.UMORZONA, zakresy: m.zakresy, podstawa: m.podstawa }, z);
    }
    (d.atrybuty || []).forEach((a, i) => dodajAtrybut(stan, z, i, a));
  },

  emisja(stan, z, d) {
    wymagajOtwartego(stan);
    dodajEmisje(stan, d);
    for (const o of d.obejmujacy) {
      dodajPrzedzial(stan, { seria: d.seria, kategoria: K.AKCJONARIUSZ, osobaId: o.osoba_id, zakresy: o.zakresy }, z);
    }
    if (d.pokryte === false) {
      dodajAtrybut(stan, z, 0, { rodzaj: 'niepokryte', akcje: [{ seria: d.seria, zakresy: [{ nr_od: d.nr_od, nr_do: d.nr_do }] }] });
    }
  },

  przeniesienie(stan, z, d) {
    wymagajOtwartego(stan);
    const zbywca = Number(d.zbywca_osoba_id);
    for (const nab of d.nabywcy) {
      if (Number(nab.osoba_id) === zbywca) throw new BladStanu('Nabywca nie może być jednocześnie zbywcą.');
      for (const p of nab.akcje) {
        emisja(stan, p.seria);
        if (p.czesc && !u.jestJeden(u.waliduj(p.czesc))) {
          przeniesUlamek(stan, z, p.seria, p.zakresy[0].nr_od, zbywca, Number(nab.osoba_id), u.waliduj(p.czesc));
          continue;
        }
        const cale = wierszeOsoby(stan, p.seria, zbywca).filter(caly);
        const brak = n.roznica(p.zakresy, cale.map(zakres));
        if (brak.length > 0) {
          throw new BladStanu(
            `Zbywca nie ma w całości akcji serii ${p.seria} nr ${n.opisz(brak)} — rozporządzenie ponad stan posiadania.`
          );
        }
        wytnij(stan.przedzialy, cale, p.zakresy, z);
        dodajPrzedzial(stan, { seria: p.seria, kategoria: K.AKCJONARIUSZ, osobaId: nab.osoba_id, zakresy: p.zakresy }, z);
      }
    }
  },

  umorzenie(stan, z, d) {
    wymagajOtwartego(stan);
    for (const p of d.akcje) {
      wymagajIstniejacych(stan, p.seria, p.zakresy);
      wytnij(stan.przedzialy, akcjonariusze(stan, p.seria), p.zakresy, z);
      dodajPrzedzial(stan, { seria: p.seria, kategoria: K.UMORZONA, zakresy: p.zakresy, podstawa: d.podstawa }, z);
      // Akcja przestaje istnieć — razem z obciążeniami i adnotacjami na niej.
      wytnij(stan.atrybuty, otwarte(stan.atrybuty).filter((a) => a.seria === p.seria), p.zakresy, z);
    }
  },

  obciazenie(stan, z, d) {
    wymagajOtwartego(stan);
    if (d.operacja === 'ustanowienie') {
      dodajAtrybut(stan, z, 0, d);
    } else if (d.operacja === 'zmiana_prawa_glosu') {
      zmienAtrybut(stan, z, d, { prawo_glosu: d.prawo_glosu ? 1 : 0 });
    } else {
      zmienAtrybut(stan, z, d, null);
    }
  },

  adnotacja(stan, z, d) {
    wymagajOtwartego(stan);
    if (d.operacja === 'dodanie') dodajAtrybut(stan, z, 0, d);
    else zmienAtrybut(stan, z, d, null);
  },

  zamkniecie(stan, z, d) {
    wymagajOtwartego(stan);
    stan.otwarty = false;
    stan.data_zamkniecia = czas.dzienLokalny(z.data_wpisu);
    stan.powod_zamkniecia = d.powod;
  },
};

/** Scala przyległe otwarte wiersze o identycznym pochodzeniu (ułamków nie scala). */
function scal(lista, kluczFn) {
  const zamkniete = lista.filter((p) => p.data_do !== null);
  const grupy = new Map();
  const pojedyncze = [];
  for (const p of otwarte(lista)) {
    const k = kluczFn(p);
    if (k === null) {
      pojedyncze.push(p);
      continue;
    }
    if (!grupy.has(k)) grupy.set(k, []);
    grupy.get(k).push(p);
  }
  const wynik = [...zamkniete, ...pojedyncze];
  for (const grupa of grupy.values()) {
    for (const r of n.normalizuj(grupa.map(zakres))) wynik.push({ ...grupa[0], ...r });
  }
  return wynik;
}

/**
 * Odtwarza stan spółki z jej wpisów. Sprostowanie zastępuje treść wpisu dokładnie w jego miejscu
 * w chronologii albo go wycofuje; przy kilku sprostowaniach jednego wpisu decyduje ostatnie.
 */
function odtworzStan(zdarzenia) {
  const stan = pustyStan();
  const lista = [...(zdarzenia || [])].sort(porownajZdarzenia);

  const sprostowania = new Map();
  for (const z of lista) {
    if (z.typ === 'sprostowanie') sprostowania.set(Number(z.zdarzenie_prostowane_id), { ...dane(z), sprostowanie_id: Number(z.id) });
  }

  for (const z of lista) {
    const wpis = { id: Number(z.id), typ: z.typ, data_wpisu: z.data_wpisu, sprawa_id: z.sprawa_id ?? null };
    if (z.typ === 'sprostowanie') {
      stan.wpisy.push({ ...wpis, zdarzenie_prostowane_id: Number(z.zdarzenie_prostowane_id), tryb: dane(z).tryb });
      continue;
    }
    const s = sprostowania.get(Number(z.id));
    if (s && s.tryb === 'wycofaj') {
      stan.wpisy.push({ ...wpis, wycofany: s.sprostowanie_id });
      continue;
    }
    const handler = HANDLERY[z.typ];
    if (!handler) throw new BladStanu(`Nieznany typ wpisu „${z.typ}” (wpis #${z.id}).`);
    handler(stan, z, s ? s.zamiast : dane(z));
    stan.wpisy.push({ ...wpis, sprostowany: s ? s.sprostowanie_id : null });
  }

  stan.przedzialy = scal(stan.przedzialy, (p) =>
    caly(p) ? [p.seria, p.kategoria, p.osoba_id, p.zdarzenie_od_id, p.podstawa].join('|') : null
  );
  stan.atrybuty = scal(stan.atrybuty, (a) =>
    [a.zdarzenie_id, a.pozycja, a.seria, a.rodzaj, a.osoba_id, a.tresc, a.prawo_glosu, a.zdarzenie_od_id].join('|')
  );
  return stan;
}

// ─────────────────────────────────────────────────────────────
// Bilans (art. 300(31) § 2 KSH)
// ─────────────────────────────────────────────────────────────

function sprawdzBilans(stan) {
  const bledy = [];
  for (const e of stan.emisje) {
    const wiersze = otwarte(stan.przedzialy).filter((p) => p.seria === e.seria);
    const akc = wiersze.filter((p) => p.kategoria === K.AKCJONARIUSZ);
    const umorzone = n.normalizuj(wiersze.filter((p) => p.kategoria === K.UMORZONA).map(zakres));
    const przypisane = n.normalizuj(akc.map(zakres));

    const oba = n.przeciecie(przypisane, umorzone);
    if (oba.length > 0) bledy.push(`Seria ${e.seria}: akcje ${n.opisz(oba)} są jednocześnie przypisane i umorzone.`);

    // Nakładanie wierszy akcjonariuszy dopuszczalne wyłącznie na pojedynczym numerze (ułamki).
    const doSprawdzenia = new Set(akc.filter((p) => !caly(p)).map((p) => p.nr_od));
    for (let i = 0; i < akc.length; i += 1) {
      for (let j = i + 1; j < akc.length; j += 1) {
        for (const w of n.przeciecie([zakres(akc[i])], [zakres(akc[j])])) {
          if (w.nr_od !== w.nr_do) {
            bledy.push(`Seria ${e.seria}: akcje ${n.opisz([w])} są przypisane więcej niż jednemu akcjonariuszowi.`);
          } else {
            doSprawdzenia.add(w.nr_od);
          }
        }
      }
    }
    for (const nr of doSprawdzenia) {
      let suma = u.ZERO;
      for (const p of akc) if (p.nr_od <= nr && nr <= p.nr_do) suma = u.suma(suma, czescWiersza(p));
      if (!u.rowne(suma, u.JEDEN)) {
        bledy.push(`Seria ${e.seria}: ułamki akcji nr ${nr} sumują się do ${u.opisz(suma)}, a powinny do całości.`);
      }
    }

    const razem = n.suma(przypisane, umorzone);
    const brak = n.roznica([zakres(e)], razem);
    if (brak.length > 0) bledy.push(`Seria ${e.seria}: akcje ${n.opisz(brak)} nie mają akcjonariusza.`);
    const nadmiar = n.roznica(razem, [zakres(e)]);
    if (nadmiar.length > 0) bledy.push(`Seria ${e.seria}: numery ${n.opisz(nadmiar)} wykraczają poza serię.`);
  }
  return bledy;
}

// ─────────────────────────────────────────────────────────────
// R2 — kogo powiadomić przed wpisem (art. 300(34) § 3 KSH)
// ─────────────────────────────────────────────────────────────

function mapaZakresow(wiersze) {
  const m = new Map();
  for (const w of wiersze) {
    if (!m.has(w.seria)) m.set(w.seria, []);
    m.get(w.seria).push(zakres(w));
  }
  for (const [k, v] of m) m.set(k, n.normalizuj(v));
  return m;
}

function roznicaMap(a, b) {
  const wynik = new Map();
  for (const [seria, zakresy] of a) {
    const r = n.roznica(zakresy, b.get(seria) || []);
    if (r.length > 0) wynik.set(seria, r);
  }
  return wynik;
}

function polaczMapy(a, b) {
  const wynik = new Map(a);
  for (const [seria, zakresy] of b) wynik.set(seria, n.suma(wynik.get(seria) || [], zakresy));
  return wynik;
}

function posiadacze(stan, mapa) {
  const osoby = new Set();
  for (const [seria, zakresy] of mapa) {
    for (const p of akcjonariusze(stan, seria)) if (n.nakladaja([zakres(p)], zakresy)) osoby.add(p.osoba_id);
  }
  return osoby;
}

function traciAkcje(przed, po, osobaId) {
  const serie = new Set(otwarte(przed.przedzialy).filter((p) => p.osoba_id === osobaId).map((p) => p.seria));
  for (const seria of serie) {
    const wPrzed = wierszeOsoby(przed, seria, osobaId);
    const wPo = wierszeOsoby(po, seria, osobaId);
    const calePo = wPo.filter(caly).map(zakres);
    if (n.roznica(wPrzed.filter(caly).map(zakres), calePo).length > 0) return true;
    for (const p of wPrzed.filter((x) => !caly(x))) {
      const ma = n.zawiera(calePo, [zakres(p)]) ? u.JEDEN : ulamekNaNumerze(po, seria, osobaId, p.nr_od);
      if (u.mniejszy(ma, czescWiersza(p))) return true;
    }
  }
  return false;
}

/**
 * Osoby, które trzeba powiadomić przed wpisem: każdy, komu ubywa akcji albo części akcji;
 * akcjonariusz, którego akcje zostają obciążone (zastaw, użytkowanie) albo z których prawo głosu
 * przechodzi na uprawnionego z obciążenia; uprawniony z obciążenia wykreślanego albo tracący prawo
 * głosu; akcjonariusz, któremu wykreśla się adnotację „uprawnienie”. Zajęcie i jego wykreślenie —
 * bez powiadomień (art. 300(34) § 2–3 KSH). Wpis otwarcia stanu nikogo nie powiadamia.
 */
function ktoTraci(przed, po) {
  if (!przed.otwarty && przed.emisje.length === 0) return [];
  const wynik = new Set();

  for (const osoba of new Set(otwarte(przed.przedzialy).filter((p) => p.kategoria === K.AKCJONARIUSZ).map((p) => p.osoba_id))) {
    if (traciAkcje(przed, po, osoba)) wynik.add(osoba);
  }

  const tozsamosci = (rodzaje) => {
    const t = new Map();
    for (const a of [...otwarte(przed.atrybuty), ...otwarte(po.atrybuty)]) {
      if (rodzaje.includes(a.rodzaj)) t.set(`${a.zdarzenie_id}.${a.pozycja}`, a);
    }
    return t;
  };
  const zakresyAtrybutu = (stan, a, tylkoGlos) =>
    mapaZakresow(
      otwarte(stan.atrybuty).filter(
        (x) => x.zdarzenie_id === a.zdarzenie_id && x.pozycja === a.pozycja && (!tylkoGlos || x.prawo_glosu === 1)
      )
    );

  for (const a of tozsamosci(OBCIAZENIA_Z_UPRAWNIONYM).values()) {
    const bP = zakresyAtrybutu(przed, a, false);
    const aP = zakresyAtrybutu(po, a, false);
    const bG = zakresyAtrybutu(przed, a, true);
    const aG = zakresyAtrybutu(po, a, true);
    for (const o of posiadacze(po, polaczMapy(roznicaMap(aP, bP), roznicaMap(aG, bG)))) wynik.add(o);
    const utracone = polaczMapy(roznicaMap(bP, aP), roznicaMap(bG, aG));
    if (utracone.size > 0 && a.osoba_id != null) wynik.add(a.osoba_id);
  }

  for (const a of tozsamosci(['uprawnienie']).values()) {
    for (const o of posiadacze(przed, roznicaMap(zakresyAtrybutu(przed, a, false), zakresyAtrybutu(po, a, false)))) wynik.add(o);
  }

  return [...wynik].sort((x, y) => x - y);
}

// ─────────────────────────────────────────────────────────────
// R5 — checklista wpisu
// ─────────────────────────────────────────────────────────────

const POZYCJE_CHECKLISTY = {
  zadajacy: { etykieta: 'Żądający jest uprawniony', podstawa: 'art. 300³⁴ § 1 KSH' },
  dokumenty: { etykieta: 'Dokumenty zbadane co do treści i formy', podstawa: 'art. 300³⁴ § 4–5 KSH' },
  identyfikacja: { etykieta: 'Identyfikacja osób i AML — wykonano albo nie dotyczy', podstawa: 'praktyka kancelarii (U-06)' },
  ograniczenie: { etykieta: 'Ograniczenie uwzględnione', podstawa: 'art. 300³⁴ § 6, art. 300³⁹ KSH' },
  zgoda_spolki: { etykieta: 'Zgoda spółki na zbycie', podstawa: 'art. 300⁴⁰ § 1 KSH' },
  zajecie: { etykieta: 'Zbycie dopuszczalne mimo zajęcia', podstawa: 'art. 300³⁴ § 2 KSH' },
  prawo_glosu: { etykieta: 'Umowa spółki nie wyłącza prawa głosu', podstawa: 'art. 300²³ § 2 KSH' },
};

function rodzajeNaAkcjach(stan, akcje) {
  const rodzaje = new Set();
  for (const p of akcje || []) {
    for (const a of otwarte(stan.atrybuty)) {
      if (a.seria === p.seria && n.nakladaja([zakres(a)], p.zakresy)) rodzaje.add(a.rodzaj);
    }
  }
  return rodzaje;
}

/**
 * Pozycje checklisty: trzy stałe + wynikające z atrybutów akcji objętych operacją. Zbycie
 * (przeniesienie) sprawdza ograniczenia, pokrycie i zajęcie; ustanowienie obciążenia —
 * ograniczenia; przyznanie prawa głosu uprawnionemu z obciążenia — umowę spółki.
 */
function checklista(operacje, stanPrzed) {
  const klucze = new Set(['zadajacy', 'dokumenty', 'identyfikacja']);
  for (const opWe of operacje || []) {
    const op = opWe.typ === 'sprostowanie' ? opWe.zamiast : opWe;
    if (!op) continue;
    if (op.typ === 'przeniesienie') {
      const r = rodzajeNaAkcjach(stanPrzed, op.nabywcy.flatMap((x) => x.akcje));
      if (r.has('ograniczenie')) klucze.add('ograniczenie');
      if (r.has('niepokryte')) klucze.add('zgoda_spolki');
      if (r.has('zajecie')) klucze.add('zajecie');
    }
    if (op.typ === 'obciazenie' && op.operacja === 'ustanowienie' && op.rodzaj !== 'zajecie') {
      if (rodzajeNaAkcjach(stanPrzed, op.akcje).has('ograniczenie')) klucze.add('ograniczenie');
    }
    if (op.typ === 'obciazenie' && op.prawo_glosu && op.operacja !== 'wykreslenie') klucze.add('prawo_glosu');
  }
  return Object.keys(POZYCJE_CHECKLISTY)
    .filter((k) => klucze.has(k))
    .map((k) => ({ klucz: k, ...POZYCJE_CHECKLISTY[k] }));
}

// ─────────────────────────────────────────────────────────────
// Widoki „stan na dzień” (U-22: dokładność do dnia)
// ─────────────────────────────────────────────────────────────

/** Wiersze obowiązujące na koniec dnia `dzien` (RRRR-MM-DD); null = stan bieżący. */
function naDzien(lista, dzien) {
  if (!dzien) return otwarte(lista);
  const g = czas.koniecDniaUtc(dzien);
  return lista.filter((p) => p.data_od <= g && (p.data_do === null || p.data_do > g));
}

/**
 * Widok rejestru na dzień: serie (z numerami umorzonymi), akcjonariusze (pozycje według serii
 * i dnia wpisu, ułamki osobno, pokrycie), obciążenia i adnotacje. Wywołujący odtwarza `stan`
 * wyłącznie z wpisów dokonanych do końca tego dnia — widok nie zależy od chwili sporządzenia.
 */
function widok(stan, dzien = null) {
  const przedzialy = naDzien(stan.przedzialy, dzien);
  const atrybuty = naDzien(stan.atrybuty, dzien);
  const niepokryte = mapaZakresow(atrybuty.filter((a) => a.rodzaj === 'niepokryte'));

  const serie = stan.emisje.map((e) => ({
    seria: e.seria,
    zakresy: [zakres(e)],
    liczba: e.nr_do - e.nr_od + 1,
    data_wpisu_krs: e.data_wpisu_krs,
    umorzone: n.normalizuj(przedzialy.filter((p) => p.seria === e.seria && p.kategoria === K.UMORZONA).map(zakres)),
    uprzywilejowane: n.normalizuj(atrybuty.filter((a) => a.seria === e.seria && a.rodzaj === 'uprawnienie').map(zakres)),
  }));

  const grupy = new Map();
  for (const p of przedzialy.filter((x) => x.kategoria === K.AKCJONARIUSZ)) {
    const dzienWpisu = czas.dzienLokalny(p.data_od);
    const k = caly(p) ? `${p.osoba_id}|${p.seria}|${dzienWpisu}` : `${p.osoba_id}|${p.seria}|${dzienWpisu}|${p.nr_od}`;
    if (!grupy.has(k)) {
      grupy.set(k, {
        osoba_id: p.osoba_id,
        seria: p.seria,
        zakresy: [],
        czesc: caly(p) ? null : czescWiersza(p),
        data_wpisu: dzienWpisu,
      });
    }
    grupy.get(k).zakresy.push(zakres(p));
  }
  const pozycje = [...grupy.values()].map((g) => {
    const zakresy = n.normalizuj(g.zakresy);
    return {
      ...g,
      zakresy,
      liczba: n.ilosc(zakresy),
      pokryte: !n.nakladaja(zakresy, niepokryte.get(g.seria) || []),
    };
  });
  pozycje.sort(
    (a, b) => a.osoba_id - b.osoba_id || a.seria.localeCompare(b.seria, 'pl') || (a.zakresy[0].nr_od - b.zakresy[0].nr_od)
  );

  const atrybutyWidok = [];
  const grupyAtr = new Map();
  for (const a of atrybuty) {
    const k = [a.zdarzenie_id, a.pozycja, a.prawo_glosu, a.seria].join('|');
    if (!grupyAtr.has(k)) {
      const w = {
        zdarzenie_id: a.zdarzenie_id,
        pozycja: a.pozycja,
        rodzaj: a.rodzaj,
        seria: a.seria,
        zakresy: [],
        osoba_id: a.osoba_id,
        tresc: a.tresc,
        prawo_glosu: a.prawo_glosu === 1,
        data_wpisu: czas.dzienLokalny(a.data_od),
      };
      grupyAtr.set(k, w);
      atrybutyWidok.push(w);
    }
    grupyAtr.get(k).zakresy.push(zakres(a));
  }
  for (const a of atrybutyWidok) a.zakresy = n.normalizuj(a.zakresy);

  return {
    otwarty: stan.otwarty,
    data_otwarcia: stan.data_otwarcia,
    data_zamkniecia: stan.data_zamkniecia,
    powod_zamkniecia: stan.powod_zamkniecia,
    serie,
    akcjonariusze: pozycje,
    atrybuty: atrybutyWidok,
  };
}

module.exports = {
  BladStanu,
  K,
  odtworzStan,
  sprawdzBilans,
  ktoTraci,
  checklista,
  widok,
  otwarte,
};

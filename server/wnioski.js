'use strict';

/**
 * Nowa spółka: wniosek → dokumenty → przyjęcie → otwarcie rejestru (Faza 4).
 *
 * Formularz publiczny od razu zakłada wniosek i konto z linkiem aktywacyjnym (U-08); odpowiedź nie
 * ujawnia, czy kancelaria prowadzi już rejestr spółki (D-079). „Złóż” tworzy dokumenty z U-03;
 * wgrany podpisany dokument przechodzi test podpisu (D-086) i czeka na sprawdzenie przez pracownika.
 * „Przyjmij” zakłada spółkę, osoby, zgody, reprezentanta i wiąże konto z osobą; „Otwórz rejestr”
 * zakłada sprawę z wpisem `otwarcie` (R1) — przy przejęciu dopiero od dnia przejęcia (U-07).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const konfiguracja = require('./konfiguracja');
const czas = require('./pomocnicze/czas');
const pomocPliki = require('./pomocnicze/pliki');
const krs = require('./krs');
const sprawy = require('./sprawy');
const W = require('./logika/wniosek');
const pisma = require('./logika/pisma');
const hasla = require('./logika/hasla');
const osobyLogika = require('./logika/osoby');
const przepisy = require('./logika/przepisy');
const walidacjaPodpisu = require('./logika/walidacja-podpisu');
const { BladWalidacji } = require('./logika/walidacje');
const daneWnioski = require('./dane/wnioski');
const danePliki = require('./dane/pliki');
const danePisma = require('./dane/pisma');
const daneOsoby = require('./dane/osoby');
const daneSpolki = require('./dane/spolki');

const WAZNOSC_LINKU_DNI = 7;
const skrot = (t) => crypto.createHash('sha256').update(t).digest('hex');
const usunPliki = (lista) => lista.forEach((p) => fs.rmSync(path.join(konfiguracja.KATALOG_DOKUMENTOW, path.basename(p)), { force: true }));

function wczytaj(db, id) {
  const w = daneWnioski.wczytaj(db, id);
  if (!w) throw new BladWalidacji(['Nie odnaleziono wniosku.']);
  return w;
}

/** Odpis KRS (bez sieci w testach — atrapa); błąd łącza to nie „brak spółki”. */
async function odpis(numer) {
  try {
    const w = await krs.pobierzZKrs(numer);
    return w.znaleziono ? { ...w.dane, dopuszczalna: w.dopuszczalna !== false } : {};
  } catch {
    return {};
  }
}

function sprawdzKrs(numer) {
  const k = String(numer || '').replace(/\D/g, '');
  if (k.length !== 10) throw new BladWalidacji([{ pole: 'krs', komunikat: 'Numer KRS to dziesięć cyfr.' }]);
  return k;
}

async function zaloz(db, { krs: numer, przejecie = false, email = null }) {
  const k = sprawdzKrs(numer);
  const krsDane = await odpis(k);
  const dane = W.PUSTE();
  Object.assign(dane.spolka, W.zKrs(krsDane));
  if (email) dane.reprezentant.email = email;
  return daneWnioski.dodaj(db, { krs: k, przejecie: Boolean(przejecie), dane, krsDane });
}

/** „Nowa spółka” w kancelarii — ten sam wniosek, wypełnia pracownik. */
function zalozPrzezPracownika(db, we) {
  return zaloz(db, we);
}

function linkAktywacji(token) {
  return `${konfiguracja.URL_PORTALU}#/aktywacja?token=${token}`;
}

/** Formularz publiczny (U-08): wniosek + konto z linkiem. Zawsze ta sama odpowiedź (D-079). */
async function zglos(db, { krs: numer, email, przejecie }, { poczta = require('./poczta') } = {}) {
  const adres = String(email || '').trim().toLowerCase();
  sprawdzKrs(numer);
  if (!osobyLogika.EMAIL.test(adres)) throw new BladWalidacji([{ pole: 'email', komunikat: 'Podaj prawidłowy adres e-mail.' }]);
  const istniejace = db.prepare('SELECT id FROM psa_konta WHERE lower(email) = ?').get(adres);
  if (istniejace) {
    await poczta.wyslij({
      do: adres,
      temat: 'Rejestr akcjonariuszy — masz już konto',
      tekst: `Dzień dobry,\n\nna ten adres jest już konto w portalu rejestru akcjonariuszy. Zaloguj się: ${konfiguracja.URL_PORTALU}\n\nKancelaria Notarialna`,
    });
    return null;
  }
  const id = await zaloz(db, { krs: numer, przejecie, email: adres });
  const kontoId = Number(db.prepare('INSERT INTO psa_konta (email, wniosek_id, utworzono) VALUES (?, ?, ?)').run(adres, id, czas.terazIso()).lastInsertRowid);
  await poczta.wyslij({
    do: adres,
    temat: 'Rejestr akcjonariuszy — dokończ zgłoszenie spółki',
    tekst: `Dzień dobry,\n\naby dokończyć zgłoszenie spółki, ustaw hasło do portalu: ${nowyLinkAktywacji(db, kontoId)}\n\nLink jest ważny ${WAZNOSC_LINKU_DNI} dni.\n\nKancelaria Notarialna`,
  });
  return id;
}

/** Nowy link aktywacji konta (w bazie tylko skrót tokenu). */
function nowyLinkAktywacji(db, kontoId) {
  const token = crypto.randomBytes(24).toString('hex');
  const wygasa = new Date(czas.teraz().getTime() + WAZNOSC_LINKU_DNI * 864e5).toISOString();
  db.prepare('UPDATE psa_konta SET token_aktywacji = ?, token_wygasa = ? WHERE id = ?').run(skrot(token), wygasa, kontoId);
  return linkAktywacji(token);
}

/** Aktywacja konta: hasło i regulamin (link z e-maila). Zwraca konto. */
async function aktywuj(db, { token, haslo, regulamin }) {
  const konto = token ? db.prepare('SELECT * FROM psa_konta WHERE token_aktywacji = ?').get(skrot(String(token))) : null;
  if (!konto || !konto.token_wygasa || konto.token_wygasa < czas.terazIso()) {
    throw new BladWalidacji([{ pole: 'token', komunikat: 'Link wygasł albo jest nieprawidłowy. Zgłoś spółkę ponownie albo napisz do kancelarii.' }]);
  }
  const ocena = hasla.ocenSile(String(haslo || ''));
  if (!ocena.ok) throw new BladWalidacji([{ pole: 'haslo', komunikat: ocena.powod }]);
  if (regulamin !== true) throw new BladWalidacji([{ pole: 'regulamin', komunikat: 'Zaakceptuj regulamin portalu.' }]);
  db.prepare('UPDATE psa_konta SET hash_hasla = ?, aktywne = 1, token_aktywacji = NULL, token_wygasa = NULL, regulamin_zaakceptowano = ? WHERE id = ?')
    .run(await hasla.hashuj(String(haslo)), czas.terazIso(), konto.id);
  return db.prepare('SELECT * FROM psa_konta WHERE id = ?').get(konto.id);
}

/** Zapis danych wniosku (autozapis). Klient — tylko wniosek roboczy; dane przejęcia uzupełnia też kancelaria. */
function zmien(db, id, we, { przez = 'klient', kto = przez } = {}) {
  return db.transaction(() => {
    const w = wczytaj(db, id);
    const pola = {};
    if (we.dane !== undefined) {
      if (w.stan !== 'roboczy') throw new BladWalidacji(['Wniosek jest złożony — dane zmienia się po zwróceniu do uzupełnienia.']);
      pola.dane = W.sprawdzDane(we.dane).dane;
    }
    if (we.uchwala !== undefined) {
      if (!['roboczy', 'zlozony'].includes(w.stan)) throw new BladWalidacji(['Wniosek jest zamknięty.']);
      pola.dane = { ...(pola.dane || w.dane), uchwala: W.sprawdzDane({ ...w.dane, uchwala: we.uchwala }).dane.uchwala };
    }
    for (const k of ['dotychczasowy_podmiot', 'data_przejecia']) {
      if (we[k] === undefined) continue;
      if (przez === 'klient' && w.stan !== 'roboczy') throw new BladWalidacji(['Wniosek jest złożony.']);
      const v = String(we[k] || '').trim() || null;
      if (k === 'data_przejecia' && v && !czas.poprawnaData(v)) throw new BladWalidacji([{ pole: k, komunikat: 'Podaj prawidłową datę przejęcia.' }]);
      pola[k] = v;
    }
    if (przez === 'kancelaria') {
      if (we.checklista !== undefined) pola.checklista = Object.fromEntries(Object.entries(we.checklista || {}).map(([k, v]) => [k, Boolean(v)]));
      if (we.notatka !== undefined) pola.notatka = String(we.notatka || '').trim() || null;
      if (we.umowe_zawarl !== undefined) pola.umowe_zawarl = String(we.umowe_zawarl || '').trim() || null;
    }
    if (Object.keys(pola).length) daneWnioski.zapisz(db, id, pola);
    // Uchwała do podpisu wybrana po złożeniu — dokument powstaje od razu.
    const po = wczytaj(db, id);
    if (po.stan === 'zlozony' && po.dane.uchwala === 'podpisana' && !danePisma.wniosku(db, id).some((p) => p.typ === 'uchwala')) utworzDokument(db, po, 'uchwala', 'uchwala', null, kto);
    return po;
  }).immediate();
}

function utworzDokument(db, w, typ, klucz, akcjonariusz, kto) {
  pisma.utworz(db, typ, {
    autor: kto,
    wniosek_id: w.id,
    adresat: 'wnioskodawca',
    adresat_opis: klucz,
    kanal: 'portal',
    kontekst: W.kontekstDokumentu(w, typ, akcjonariusz),
  });
}

/** „Złóż” (roboczy → złożony): dane kompletne, powstają dokumenty do podpisu (U-03). */
function zloz(db, id, kto) {
  const pliki = db.transaction(() => {
    const w = wczytaj(db, id);
    W.sprawdzPrzejscie(w.stan, 'zlozony');
    const { dane, bledy } = W.sprawdzDane(w.dane, { przejecie: w.przejecie, dotychczasowyPodmiot: w.dotychczasowy_podmiot });
    if (bledy.length) throw new BladWalidacji(bledy);
    const ponownie = danePisma.wniosku(db, id).some((p) => ['umowa', 'uchwala', 'zgoda_email'].includes(p.typ));
    const doUsuniecia = danePisma.usunDokumentyWniosku(db, id);
    if (ponownie) {
      for (const f of danePliki.wniosku(db, id)) {
        if (f.stan_podpisu && f.stan_podpisu !== 'odrzucony' && f.dokument !== 'umowa_notariusz') {
          danePliki.ustawStanPodpisu(db, f.id, 'odrzucony', 'Wniosek był uzupełniany — pobierz i podpisz nową wersję dokumentu.');
        }
      }
    }
    daneWnioski.zapisz(db, id, { dane, stan: 'zlozony' });
    const po = wczytaj(db, id);
    utworzDokument(db, po, 'umowa', 'umowa', null, kto);
    if (dane.uchwala === 'podpisana') utworzDokument(db, po, 'uchwala', 'uchwala', null, kto);
    for (const a of dane.akcjonariusze.filter((x) => !x.to_ja)) utworzDokument(db, po, 'zgoda_email', `zgoda:${a.klucz}`, a, kto);
    return doUsuniecia;
  }).immediate();
  usunPliki(pliki);
  return wczytaj(db, id);
}

/** Pismo wniosku do pobrania (dokument do podpisu) — tylko dokumenty tego wniosku. */
function pismoWniosku(db, id, pismoId) {
  const p = danePisma.wniosku(db, id).find((x) => x.id === Number(pismoId));
  if (!p) throw new BladWalidacji(['Nie odnaleziono dokumentu.']);
  return p;
}

/**
 * Wgranie pliku do dokumentu wniosku. Dokument do podpisu: test podpisu (D-086) — klientowi plik bez
 * podpisu albo zmieniony odrzuca się od razu; plik pracownika (np. skan oryginału z poczty) trafia do
 * sprawdzenia. „umowa_notariusz” — tylko kancelaria, z osobą zawierającą umowę.
 */
async function wgraj(db, id, plik, dokument, { przez = 'klient', kto, umoweZawarl = null }) {
  const w = wczytaj(db, id);
  const doks = W.dokumenty(w, danePisma.wniosku(db, id), danePliki.wniosku(db, id));
  const notariusz = dokument === 'umowa_notariusz';
  const dok = doks.find((x) => x.klucz === dokument);
  if (notariusz) {
    if (przez !== 'kancelaria') throw new BladWalidacji(['Nieznany dokument.']);
    if (!['zlozony'].includes(w.stan)) throw new BladWalidacji(['Umowę z podpisem notariusza wgrywa się do złożonego wniosku.']);
    if (!String(umoweZawarl || '').trim()) throw new BladWalidacji([{ pole: 'umowe_zawarl', komunikat: 'Wskaż osobę zawierającą umowę.' }]);
  } else {
    if (!dok) throw new BladWalidacji([{ pole: 'dokument', komunikat: 'Nieznany dokument.' }]);
    if (!['roboczy', 'zlozony'].includes(w.stan)) throw new BladWalidacji(['Wniosek jest zamknięty.']);
    if (dok.podpis && !dok.pismo_id) throw new BladWalidacji(['Najpierw złóż wniosek — dokument do podpisu jeszcze nie powstał.']);
  }
  let stan = null;
  if (notariusz) stan = 'potwierdzony';
  else if (dok.podpis) {
    const pismo = danePisma.wczytaj(db, dok.pismo_id);
    const sciezka = pismo.plik && path.join(konfiguracja.KATALOG_DOKUMENTOW, path.basename(pismo.plik));
    const oryginal = sciezka && fs.existsSync(sciezka) ? { sha256: pismo.sha256, dlugosc: fs.statSync(sciezka).size } : null;
    const atrapa = konfiguracja.TRYB_TESTOWY ? () => require('./tryb-testowy').wynikWalidatora(db) : null;
    const test = await walidacjaPodpisu.waliduj({ plik: plik && plik.buffer ? plik.buffer : Buffer.alloc(0), oryginal, atrapa });
    if (test.wynik === walidacjaPodpisu.WYNIKI.ODRZUCONY && przez === 'klient') throw new BladWalidacji([{ pole: 'plik', komunikat: test.komunikat }]);
    stan = 'do_sprawdzenia';
  }
  return db.transaction(() => {
    const plikId = pomocPliki.przyjmij(db, plik, { wniosek_id: w.id, dokument, stan_podpisu: stan }, kto);
    const pola = notariusz ? { umowe_zawarl: String(umoweZawarl).trim() } : {};
    daneWnioski.zapisz(db, id, pola);
    return plikId;
  })();
}

/** Pracownik: „Potwierdź podpis” / „Odrzuć plik” (z powodem). */
function ocenPlik(db, id, plikId, { stan, powod }) {
  const f = danePliki.wniosku(db, id).find((x) => x.id === Number(plikId));
  if (!f || !f.stan_podpisu) throw new BladWalidacji(['Nie odnaleziono pliku do sprawdzenia.']);
  if (!['potwierdzony', 'odrzucony'].includes(stan)) throw new BladWalidacji(['Wybierz: potwierdź albo odrzuć.']);
  const p = String(powod || '').trim();
  if (stan === 'odrzucony' && !p) throw new BladWalidacji([{ pole: 'powod', komunikat: 'Podaj powód odrzucenia — zobaczy go klient.' }]);
  danePliki.ustawStanPodpisu(db, f.id, stan, stan === 'odrzucony' ? p : null);
  daneWnioski.zapisz(db, id, {});
}

/** „Zwróć do uzupełnienia” (złożony → roboczy) z notatką dla klienta. */
async function zwroc(db, id, notatka, { poczta = require('./poczta') } = {}) {
  const t = String(notatka || '').trim();
  if (!t) throw new BladWalidacji([{ pole: 'notatka', komunikat: 'Napisz, co klient ma uzupełnić.' }]);
  const w = wczytaj(db, id);
  W.sprawdzPrzejscie(w.stan, 'roboczy');
  daneWnioski.zapisz(db, id, { stan: 'roboczy', notatka: t });
  const konto = db.prepare('SELECT email FROM psa_konta WHERE wniosek_id = ?').get(id);
  if (konto) {
    await poczta.wyslij({
      do: konto.email,
      temat: 'Rejestr akcjonariuszy — wniosek wymaga uzupełnienia',
      tekst: `Dzień dobry,\n\nwniosek o prowadzenie rejestru akcjonariuszy wymaga uzupełnienia. Szczegóły po zalogowaniu: ${konfiguracja.URL_PORTALU}\n\nKancelaria Notarialna`,
    });
  }
  return wczytaj(db, id);
}

/** „Odrzuć” (złożony → odrzucony): powiadomienie o odmowie zawarcia umowy — zawsze listem (art. 108a PrNot). */
function odrzuc(db, id, przyczyna, kto) {
  return db.transaction(() => {
    const p = String(przyczyna || '').trim();
    if (!p) throw new BladWalidacji([{ pole: 'przyczyna', komunikat: 'Podaj przyczynę odmowy.' }]);
    const w = wczytaj(db, id);
    W.sprawdzPrzejscie(w.stan, 'odrzucony');
    const s = w.dane.spolka;
    pisma.utworz(db, 'powiadomienie_odmowa', {
      wniosek_id: w.id,
      adresat: 'wnioskodawca',
      kanal: 'list',
      kontekst: { przyczyna: p, data_wniosku: pisma.dataPl(w.utworzono.slice(0, 10)), adresat_nazwa: s.nazwa, adresat_adres: s.adres, spolka_firma: s.nazwa, spolka_krs: w.krs, spolka_siedziba: s.siedziba, spolka_sad: s.sad_rejestrowy },
      autor: kto,
    });
    daneWnioski.zapisz(db, id, { stan: 'odrzucony', notatka: p });
    return wczytaj(db, id);
  }).immediate();
}

/** Osoby wniosku: reprezentant i akcjonariusze; „to ja” = ta sama osoba co reprezentant. */
function osobyWniosku(w) {
  const d = w.dane;
  const ja = d.akcjonariusze.find((a) => a.to_ja);
  const lista = [{ klucz: 'reprezentant', ...W.naOsobe(ja || d.reprezentant), rola: ja ? 'reprezentant i akcjonariusz' : 'reprezentant', pep: d.reprezentant.pep, pep_opis: d.reprezentant.pep_opis }];
  for (const a of d.akcjonariusze.filter((x) => !x.to_ja)) lista.push({ klucz: a.klucz, ...W.naOsobe(a), rola: 'akcjonariusz' });
  return lista;
}

/** Osoby z kartoteki o tym samym PESEL-u albo numerze w rejestrze — wybór: istniejąca czy nowa. */
function dopasowania(db, w) {
  return Object.fromEntries(osobyWniosku(w).map((o) => [o.klucz, daneOsoby.takieSame(db, { pesel: o.typ === 'fizyczna' ? o.pesel || null : null, numer_rejestru: o.numer_rejestru || null })]));
}

/**
 * „Przyjmij” (złożony → przyjęty): spółka, osoby (wybór przy powtórzonym PESEL/KRS), zgody na e-mail do
 * historii, reprezentant jako osoba działająca za spółkę, konto wnioskodawcy powiązane z jego osobą,
 * pliki i pisma wniosku do akt spółki. `wybory`: { klucz: osoba_id | 'nowa' }.
 */
function przyjmij(db, id, wybory = {}, kto) {
  return db.transaction(() => {
    const w = wczytaj(db, id);
    const pliki = danePliki.wniosku(db, id);
    const doks = W.dokumenty(w, danePisma.wniosku(db, id), pliki);
    const przeszkody = W.przeszkodyPrzyjecia(w, doks, W.checklista(w, doks));
    if (przeszkody.length) throw new BladWalidacji(przeszkody);
    if (db.prepare('SELECT 1 FROM psa_spolki WHERE krs = ?').get(w.krs)) throw new BladWalidacji(['Spółka o tym numerze KRS jest już w rejestrze kancelarii.']);

    const pasujace = dopasowania(db, w);
    const bledy = [];
    const idOsob = {};
    for (const o of osobyWniosku(w)) {
      const wybor = wybory[o.klucz];
      if (pasujace[o.klucz].length && wybor === undefined) {
        bledy.push({ pole: `osoby.${o.klucz}`, komunikat: `${o.nazwa}: w kartotece jest osoba z tym numerem — wybierz istniejącą albo nową.` });
        continue;
      }
      if (wybor !== undefined && wybor !== 'nowa') {
        if (!pasujace[o.klucz].some((x) => x.id === Number(wybor))) bledy.push({ pole: `osoby.${o.klucz}`, komunikat: `${o.nazwa}: wybierz osobę z listy.` });
        else idOsob[o.klucz] = Number(wybor);
        continue;
      }
      const { osoba, bledy: b } = osobyLogika.sprawdz({ ...W.naOsobe(o), pep: o.pep, pep_opis: o.pep_opis });
      if (b.length) bledy.push(...b.map((x) => ({ pole: `osoby.${o.klucz}.${x.pole}`, komunikat: `${o.nazwa}: ${x.komunikat}` })));
      else idOsob[o.klucz] = daneOsoby.dodaj(db, osoba);
    }
    if (bledy.length) throw new BladWalidacji(bledy);

    const s = w.dane.spolka;
    const spolkaId = daneSpolki.dodaj(db, {
      krs: w.krs, nazwa: s.nazwa, siedziba: s.siedziba, adres: s.adres, sad_rejestrowy: s.sad_rejestrowy, data_rejestracji: s.data_rejestracji,
      nip: s.nip ? s.nip.replace(/\D/g, '') : null, email: s.email || null, umowe_zawarl: w.umowe_zawarl, platnosc: w.dane.platnosc,
    });
    db.prepare('INSERT OR IGNORE INTO psa_reprezentanci (spolka_id, osoba_id, dodano) VALUES (?, ?, ?)').run(spolkaId, idOsob.reprezentant, czas.terazIso());

    // Zgody na e-mail: „to ja” — złożona w portalu; pozostali — podpisany i potwierdzony dokument zgody.
    const ja = w.dane.akcjonariusze.find((a) => a.to_ja);
    const osobaPliku = {};
    if (ja && ja.zgoda_email && ja.email) daneOsoby.ustawZgodeEmail(db, idOsob.reprezentant, { zgoda: true }, kto);
    for (const a of w.dane.akcjonariusze.filter((x) => !x.to_ja)) {
      const zgoda = doks.find((x) => x.klucz === `zgoda:${a.klucz}`);
      if (zgoda && zgoda.stan === 'potwierdzony' && daneOsoby.wczytaj(db, idOsob[a.klucz]).email) {
        osobaPliku[zgoda.plik.id] = idOsob[a.klucz];
        daneOsoby.ustawZgodeEmail(db, idOsob[a.klucz], { zgoda: true, plikId: zgoda.plik.id }, kto);
      }
    }
    danePliki.doSpolki(db, id, spolkaId, osobaPliku);
    danePisma.doSpolki(db, id, spolkaId);

    // Konto wnioskodawcy należy odtąd do osoby reprezentanta (U-23); gdy ta osoba ma już konto — zostaje tamto.
    const konto = db.prepare('SELECT id FROM psa_konta WHERE wniosek_id = ?').get(id);
    if (konto) {
      const zajete = db.prepare('SELECT id FROM psa_konta WHERE osoba_id = ?').get(idOsob.reprezentant);
      if (zajete) db.prepare('DELETE FROM psa_konta WHERE id = ?').run(konto.id);
      else db.prepare('UPDATE psa_konta SET osoba_id = ? WHERE id = ?').run(idOsob.reprezentant, konto.id);
    }
    daneWnioski.zapisz(db, id, { stan: 'przyjety', spolka_id: spolkaId, dane: { ...w.dane, osoby: idOsob } });
    return wczytaj(db, id);
  }).immediate();
}

/** Czy można otworzyć rejestr — przy przejęciu dopiero od dnia przejęcia (U-07). */
function otwarcieMozliwe(db, w) {
  if (w.stan !== 'przyjety') return { mozliwe: false, powod: 'Najpierw przyjmij wniosek.' };
  const s = daneSpolki.wczytaj(db, w.spolka_id);
  if (s.data_otwarcia) return { mozliwe: false, powod: 'Rejestr jest otwarty.' };
  if (w.przejecie && !w.data_przejecia) return { mozliwe: false, powod: 'Uzupełnij datę przejęcia.' };
  if (w.przejecie && w.data_przejecia > czas.dzisIso()) {
    const [r, m, d] = w.data_przejecia.split('-');
    return { mozliwe: false, powod: `Dostępne od ${d}.${m}.${r} (dzień przejęcia).` };
  }
  return { mozliwe: true, powod: null };
}

/**
 * „Otwórz rejestr”: sprawa z wpisem `otwarcie` wypełnionym akcjonariuszami z wniosku — serie i numery
 * akcji wpisuje pracownik (U-26) na ekranie sprawy. Idempotentnie: drugi raz zwraca tę samą sprawę.
 */
function otworz(db, id, kto) {
  const w = wczytaj(db, id);
  const o = otwarcieMozliwe(db, w);
  if (!o.mozliwe) throw new BladWalidacji([o.powod]);
  const ja = w.dane.akcjonariusze.find((a) => a.to_ja);
  const akcjonariusze = w.dane.akcjonariusze.map((a) => ({ osoba_id: w.dane.osoby[a === ja ? 'reprezentant' : a.klucz], akcje: [{ seria: 'A', numery: '', liczba: '' }] }));
  const wynik = sprawy.zaloz(db, {
    spolka_id: w.spolka_id,
    zadajacy: 'spolka',
    klucz_idempotencji: `otwarcie-wniosku-${w.id}`,
    podstawa: w.przejecie ? `Rejestr i dokumenty od dotychczasowego podmiotu (${w.dotychczasowy_podmiot}).` : 'Umowa spółki i dokumenty wniosku.',
    operacje: [{
      typ: 'otwarcie',
      zrodlo: w.przejecie ? 'przejecie' : 'zalozenie',
      serie: [{ seria: 'A', numery: '', liczba: '', data_wpisu_krs: w.dane.spolka.data_rejestracji }],
      akcjonariusze,
      atrybuty: [],
      umorzone: [],
    }],
  }, kto);
  return wynik.id;
}

/** Opłata za prowadzenie brutto (U-30) — do wyboru we wniosku. */
const kwoty = () => ({
  roczna: przepisy.obliczBrutto(przepisy.STAWKI_GROSZE.PROWADZENIE_ROCZNIE),
  miesieczna: przepisy.obliczBrutto(przepisy.STAWKI_GROSZE.PROWADZENIE_MIESIECZNIE),
});

/** Widok wniosku dla kancelarii: dane, różnice wobec KRS, dokumenty, checklista, przeszkody, przyjęcie, otwarcie. */
function widok(db, id) {
  const w = wczytaj(db, id);
  const pismaW = danePisma.wniosku(db, id);
  const pliki = danePliki.wniosku(db, id);
  const doks = W.dokumenty(w, pismaW, pliki);
  const lista = W.checklista(w, doks);
  const kz = W.zKrs(w.krs_dane);
  const roznice = Object.keys(kz).filter((k) => kz[k] && String(kz[k]).trim() !== String(w.dane.spolka[k] || '').trim());
  const sprawaOtwarcia = db.prepare('SELECT id, stan FROM psa_sprawy WHERE klucz_idempotencji = ?').get(`otwarcie-wniosku-${id}`) || null;
  return {
    wniosek: { ...w, dane_json: undefined, krs_json: undefined, checklista_json: undefined },
    bledy: w.stan === 'roboczy' ? W.sprawdzDane(w.dane, { przejecie: w.przejecie, dotychczasowyPodmiot: w.dotychczasowy_podmiot }).bledy : [],
    krs: { dane: kz, reprezentacja: (w.krs_dane || {}).reprezentant_reprezentacja || null, sklad: (w.krs_dane || {}).sklad_organu || [], dopuszczalna: (w.krs_dane || {}).dopuszczalna !== false, roznice },
    dokumenty: doks,
    checklista: lista,
    przeszkody: w.stan === 'zlozony' ? W.przeszkodyPrzyjecia(w, doks, lista) : [],
    osoby: w.stan === 'zlozony' ? osobyWniosku(w).map((o) => ({ klucz: o.klucz, nazwa: o.nazwa, rola: o.rola, pasujace: dopasowania(db, w)[o.klucz] })) : [],
    pisma: pismaW.map((p) => ({ id: p.id, typ: p.typ, numer: p.numer, kanal: p.kanal, stan: p.stan, adresat_opis: p.adresat_opis })),
    konto: db.prepare('SELECT email, aktywne FROM psa_konta WHERE wniosek_id = ?').get(id) || null,
    spolka_w_rejestrze: Boolean(db.prepare('SELECT 1 FROM psa_spolki WHERE krs = ? AND id IS NOT ?').get(w.krs, w.spolka_id)),
    otwarcie: { ...otwarcieMozliwe(db, w), sprawa: sprawaOtwarcia },
    osoby_zawierajace_umowy: require('./logika/ustawienia').osobyZawierajaceUmowy(db),
    kwoty: kwoty(),
  };
}

/** Widok wniosku w portalu (bez checklisty i danych z KRS). */
function widokPortalu(db, id) {
  const w = wczytaj(db, id);
  const doks = W.dokumenty(w, danePisma.wniosku(db, id), danePliki.wniosku(db, id)).map((d) => ({
    klucz: d.klucz, nazwa: d.nazwa, podpis: d.podpis, stan: d.stan, pismo_id: d.pismo_id,
    plik: d.plik ? { nazwa: d.plik.nazwa, wgrano: d.plik.wgrano, powod: d.plik.powod_odrzucenia } : null,
  }));
  const k = require('./logika/ustawienia').kancelaria(db);
  return {
    wniosek: { id: w.id, stan: w.stan, krs: w.krs, przejecie: w.przejecie, dotychczasowy_podmiot: w.dotychczasowy_podmiot, data_przejecia: w.data_przejecia, notatka: w.stan === 'roboczy' ? w.notatka : null, dane: w.dane },
    bledy: w.stan === 'roboczy' ? W.sprawdzDane(w.dane, { przejecie: w.przejecie, dotychczasowyPodmiot: w.dotychczasowy_podmiot }).bledy : [],
    dokumenty: w.stan === 'roboczy' && !doks.some((d) => d.pismo_id) ? [] : doks,
    kwoty: kwoty(),
    adres_kancelarii: `${k.nazwa || 'Kancelaria Notarialna'}, ${k.kancelaria_ulica || ''}, ${k.kancelaria_kod || ''} ${k.kancelaria_miasto || ''}`.replace(/\s+,/g, ','),
  };
}

module.exports = {
  zglos, aktywuj, nowyLinkAktywacji, zalozPrzezPracownika, zmien, zloz, pismoWniosku, wgraj, ocenPlik, zwroc, odrzuc, przyjmij, otworz, widok, widokPortalu,
  lista: (db, f) => daneWnioski.lista(db, f),
  wczytaj,
};

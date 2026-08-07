/* kokpit.js — kokpit spółki: JEDEN EKRAN (sekcja 9 specyfikacji). */

/** Liczba dni między dwiema datami ISO. */
function dniMiedzy(od, doDnia) {
  const a = Date.parse(`${od}T00:00:00Z`);
  const b = Date.parse(`${doDnia}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function dodajDni(iso, dni) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dni);
  return d.toISOString().slice(0, 10);
}

/**
 * Suwak „stan na dzień/chwilę” — przełącza cały ekran wstecz.
 *
 * Domyślnie porusza się po dniach (kompatybilność wsteczna — format
 * `RRRR-MM-DD`, koniec dnia). „+ godzina" odsłania kontrolkę godziny;
 * gdy jest ustawiona, `data` niesie `RRRR-MM-DDTGG:MM` i porównanie po
 * stronie serwera idzie po `data_wpisu`, nie `data_zdarzenia` (sekcja 2.3
 * SESJA-PSA-5-INTERFEJS.md) — jedyny sposób odróżnienia dwóch wpisów
 * z tego samego dnia.
 */
function SuwakDnia({ odDnia, data, ustawDate }) {
  const dzis = fmt.dzisIso();
  const maCzas = data.includes('T');
  const dzien = data.slice(0, 10);
  const godzina = maCzas ? data.slice(11, 16) : '';
  const zakres = Math.max(dniMiedzy(odDnia, dzis), 0);
  const pozycja = Math.min(Math.max(dniMiedzy(odDnia, dzien), 0), zakres);
  // Wskazanie konkretnej godziny jest z definicji zamrożeniem jednej,
  // przeszłej chwili — nawet gdy dzień to dziś, to już nie jest „teraz".
  const wstecz = dzien < dzis || maCzas;

  function zmienDzien(nowyDzien) {
    ustawDate(maCzas ? `${nowyDzien}T${godzina}` : nowyDzien);
  }
  function zmienGodzine(nowaGodzina) {
    ustawDate(nowaGodzina ? `${dzien}T${nowaGodzina}` : dzien);
  }

  return (
    <div className={`suwak-dnia ${wstecz ? 'wstecz' : ''} bez-druku`}>
      <span className="fl" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
        Stan na dzień
      </span>
      <input
        type="range"
        min={0}
        max={zakres}
        value={pozycja}
        disabled={zakres === 0}
        onChange={(z) => zmienDzien(dodajDni(odDnia, Number(z.target.value)))}
      />
      <input
        type="date"
        value={dzien}
        min={odDnia}
        max={dzis}
        onChange={(z) => z.target.value && zmienDzien(z.target.value)}
      />
      {maCzas ? (
        <input
          type="time"
          value={godzina}
          onChange={(z) => zmienGodzine(z.target.value || '23:59')}
          title="Godzina wpisu — rozróżnia wpisy z tego samego dnia"
        />
      ) : (
        <button className="btn btn-sm" onClick={() => zmienGodzine('23:59')}>
          + godzina
        </button>
      )}
      {wstecz ? (
        <>
          <Znacznik odmiana="lupek">stan historyczny</Znacznik>
          <button className="btn btn-sm" onClick={() => ustawDate(dzis)}>
            Wróć do dzisiaj
          </button>
        </>
      ) : (
        <span className="podstawa-prawna">stan bieżący</span>
      )}
    </div>
  );
}

/* ── Pasek serii (faza 2.1) ───────────────────────────────────────────
   Element sygnaturowy kokpitu: jeden pasek na emisję, segmenty w kolejności
   NUMERÓW akcji (nie nazwisk) — pasek odwzorowuje rzeczywisty układ
   numeracji serii. Czysty CSS/flex, bez bibliotek wykresów (żadnej nowej
   zależności). Klikalny (przewija do wiersza w tabeli), z podpowiedzią na
   hover — sama tabela pod paskiem jest ścieżką dostępną (stąd aria-hidden
   na całym pasku: to wyłącznie skrót wzrokowy do danych, które i tak są
   w tabeli). Ukryty w druku i bez animacji przy prefers-reduced-motion —
   oba w design.css. */

const PALETA_PASKA_SERII = ['kolor-1', 'kolor-2', 'kolor-3', 'kolor-4', 'kolor-5'];

/** Ten sam akcjonariusz = ten sam kolor na każdym pasku tej spółki. */
function przypiszKoloryAkcjonariuszy(akcjonariusze) {
  const mapa = new Map();
  for (const a of akcjonariusze) {
    if (!mapa.has(a.osoba_id)) {
      mapa.set(a.osoba_id, PALETA_PASKA_SERII[mapa.size % PALETA_PASKA_SERII.length]);
    }
  }
  return mapa;
}

function przewinDoAkcjonariusza(osobaId, emisjaKlucz) {
  const el = document.getElementById(`akcjonariusz-${osobaId}-${emisjaKlucz}`);
  if (!el) return;
  const bezRuchu = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: bezRuchu ? 'auto' : 'smooth', block: 'center' });
}

/**
 * Odcinki jednej emisji uporządkowane wg numeru — nieobjęte/umorzone z
 * bilansu (`bilansEmisji.nieobjete_zakresy`/`umorzone_zakresy`, już
 * policzone przez `stan.js`), objęte z pozycji akcjonariatu. Numer
 * przypisany więcej niż jednemu akcjonariuszowi to współwłasność ułamkowa
 * (reguła domenowa: ułamek zawsze dotyczy dokładnie jednego numeru) —
 * dostajemy to za darmo z samych zakresów, bez dodatkowego pola z API.
 */
function segmentyEmisji(emisja, bilansEmisji, akcjonariuszeEmisji) {
  const pierwszy = emisja.nr_pierwszy;
  const ostatni = emisja.nr_pierwszy + emisja.ilosc - 1;

  const wlasciciele = new Map();
  for (const a of akcjonariuszeEmisji) {
    for (const z of a.zakresy) {
      for (let nr = z.nr_od; nr <= z.nr_do; nr += 1) {
        const lista = wlasciciele.get(nr);
        if (lista) lista.push(a);
        else wlasciciele.set(nr, [a]);
      }
    }
  }
  const kategoria = new Map();
  for (const z of (bilansEmisji && bilansEmisji.nieobjete_zakresy) || []) {
    for (let nr = z.nr_od; nr <= z.nr_do; nr += 1) kategoria.set(nr, 'nieobjete');
  }
  for (const z of (bilansEmisji && bilansEmisji.umorzone_zakresy) || []) {
    for (let nr = z.nr_od; nr <= z.nr_do; nr += 1) kategoria.set(nr, 'umorzone');
  }

  const segmenty = [];
  let biezacy = null;
  for (let nr = pierwszy; nr <= ostatni; nr += 1) {
    const wlasc = wlasciciele.get(nr);
    let rodzaj;
    let osobyOdcinka;
    if (wlasc && wlasc.length > 1) {
      rodzaj = 'wspolwlasnosc';
      osobyOdcinka = wlasc;
    } else if (wlasc && wlasc.length === 1) {
      rodzaj = 'akcjonariusz';
      osobyOdcinka = wlasc;
    } else {
      rodzaj = kategoria.get(nr) || 'nieobjete';
      osobyOdcinka = [];
    }
    // Sklejamy sąsiednie numery WYŁĄCZNIE gdy to ten sam pojedynczy
    // właściciel albo ta sama kategoria bez właściciela — współwłasność
    // zawsze zostaje osobnym, jednonumerowym odcinkiem (inna lista osób).
    const mozliwaSklejka =
      biezacy &&
      biezacy.rodzaj === rodzaj &&
      rodzaj !== 'wspolwlasnosc' &&
      (rodzaj !== 'akcjonariusz' || biezacy.osoby[0].osoba_id === osobyOdcinka[0].osoba_id);
    if (mozliwaSklejka) {
      biezacy.nr_do = nr;
    } else {
      if (biezacy) segmenty.push(biezacy);
      biezacy = { rodzaj, nr_od: nr, nr_do: nr, osoby: osobyOdcinka };
    }
  }
  if (biezacy) segmenty.push(biezacy);
  return segmenty;
}

function nazwaOsoby(a) {
  return a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`;
}

/* ── Widok uproszczony/szczegółowy (faza 2.4) ─────────────────────────
   Uproszczony (domyślny) — bez zmian, jeden wiersz na (osoba, emisja),
   dokładnie jak dotychczas. Szczegółowy — jeden wiersz na PRZEDZIAŁ
   numeryczny: pozycja o kilku rozłącznych zakresach (np. po częściowym
   przeniesieniu) rozbija się na tyle wierszy, ile ma zakresów, a każdy
   pokazuje WYŁĄCZNIE obciążenia nakładające się na ten konkretny przedział
   — nie całą pozycję. Zakres obciążenia czytamy z jego własnego pola
   `numery` (ten sam ciąg, który tabela już wyświetla) — czysto prezentacyjne
   odczytanie już dostarczonych danych, bez zmiany kontraktu endpointu. */
function parsujNumery(tekst) {
  return String(tekst || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const czesci = c.split(/[-–]/).map((x) => Number(x.trim()));
      return { nr_od: czesci[0], nr_do: czesci.length > 1 ? czesci[1] : czesci[0] };
    });
}

function zakresyNakladajaSie(a, b) {
  return a.nr_od <= b.nr_do && b.nr_od <= a.nr_do;
}

function opiszZakres(z) {
  return z.nr_od === z.nr_do ? String(z.nr_od) : `${z.nr_od}–${z.nr_do}`;
}

function rozbijNaSzczegoly(akcjonariusze) {
  const wiersze = [];
  for (const a of akcjonariusze) {
    for (const z of a.zakresy) {
      const ilosc = z.nr_do - z.nr_od + 1;
      wiersze.push({
        ...a,
        zakresy: [z],
        ilosc,
        numery: opiszZakres(z),
        procent: a.ilosc ? (a.procent * ilosc) / a.ilosc : a.procent,
        obciazenia: a.obciazenia.filter((o) =>
          parsujNumery(o.numery).some((zo) => zakresyNakladajaSie(zo, z))
        ),
      });
    }
  }
  return wiersze;
}

function PasekSerii({ emisja, bilansEmisji, akcjonariuszeEmisji, kolorOsoby }) {
  const segmenty = useMemo(
    () => segmentyEmisji(emisja, bilansEmisji, akcjonariuszeEmisji),
    [emisja, bilansEmisji, akcjonariuszeEmisji]
  );
  const razem = emisja.ilosc;
  const wspolwlasnosci = segmenty.filter((s) => s.rodzaj === 'wspolwlasnosc');

  return (
    <div className="pasek-serii" aria-hidden="true">
      <div className="pasek-serii-etykieta">
        <strong>Seria {emisja.seria}</strong>
        <span>
          nr {emisja.nr_pierwszy}–{emisja.nr_pierwszy + emisja.ilosc - 1} · {fmt.liczba(razem)} akcji
        </span>
      </div>
      <div className="pasek-serii-wstega">
        {segmenty.map((s, i) => {
          const jeden = s.rodzaj === 'akcjonariusz' ? s.osoby[0] : null;
          const obciazona = Boolean(jeden && jeden.obciazenia && jeden.obciazenia.length > 0);
          const zakresTekst = s.nr_od === s.nr_do ? `nr ${s.nr_od}` : `nr ${s.nr_od}–${s.nr_do}`;
          let podpowiedz;
          if (s.rodzaj === 'akcjonariusz') {
            podpowiedz = `${nazwaOsoby(jeden)} — ${zakresTekst}${obciazona ? ' · obciążone' : ''}`;
          } else if (s.rodzaj === 'wspolwlasnosc') {
            podpowiedz = `${zakresTekst} — współwłasność: ${s.osoby.map(nazwaOsoby).join(', ')}`;
          } else if (s.rodzaj === 'umorzone') {
            podpowiedz = `${zakresTekst} — umorzone`;
          } else {
            podpowiedz = `${zakresTekst} — nieobjęte`;
          }
          const klasa = [
            'pasek-serii-segment',
            s.rodzaj === 'nieobjete' && 'nieobjete',
            s.rodzaj === 'umorzone' && 'umorzone',
            s.rodzaj === 'wspolwlasnosc' && 'wspolwlasnosc',
            jeden && kolorOsoby.get(jeden.osoba_id),
            obciazona && 'obciazona',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={i}
              className={klasa}
              style={{ flexBasis: `${((s.nr_do - s.nr_od + 1) / razem) * 100}%` }}
              title={podpowiedz}
              onClick={jeden ? () => przewinDoAkcjonariusza(jeden.osoba_id, emisja.klucz) : undefined}
            >
              {s.rodzaj === 'wspolwlasnosc' && (
                <>
                  <span className="pasek-serii-podzial lewa" />
                  <span className="pasek-serii-podzial prawa" />
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="pasek-serii-skala">
        <span>nr {emisja.nr_pierwszy}</span>
        <span>nr {emisja.nr_pierwszy + emisja.ilosc - 1}</span>
      </div>
      {wspolwlasnosci.length > 0 && (
        <div className="pasek-serii-lista-wspolwlasnosci">
          {wspolwlasnosci.map((s, i) => (
            <div key={i}>
              nr {s.nr_od} — współwłasność: {s.osoby.map(nazwaOsoby).join(', ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabelaAkcjonariatu({ akcjonariusze, razem }) {
  if (akcjonariusze.length === 0) {
    return (
      <Pusto
        tytul="Brak akcjonariuszy na wskazany dzień"
        opis="Zarejestruj emisję akcji, a następnie ich objęcie."
      />
    );
  }
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Akcjonariusz</th>
          <th>Seria</th>
          <th className="prawo">Liczba akcji</th>
          <th>Numery</th>
          <th className="prawo">% akcji</th>
          <th>Obciążenia</th>
        </tr>
      </thead>
      <tbody>
        {akcjonariusze.map((a, i) => {
          // Tryb szczegółowy (faza 2.4) rozbija jedną pozycję na kilka
          // wierszy (po zakresie) — `id` do przewijania z paska serii
          // nadajemy TYLKO pierwszemu, żeby nie duplikować identyfikatora.
          const pierwszaDlaPozycji =
            akcjonariusze.findIndex((x) => x.osoba_id === a.osoba_id && x.emisja_klucz === a.emisja_klucz) === i;
          return (
          <tr
            key={`${a.osoba_id}-${a.emisja_klucz}-${i}`}
            id={pierwszaDlaPozycji ? `akcjonariusz-${a.osoba_id}-${a.emisja_klucz}` : undefined}
          >
            <td>
              <div style={{ fontWeight: 500 }}>{a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`}</div>
              <div className="podpowiedz" style={{ marginTop: 2 }}>
                akcjonariusz od {fmt.data(a.data_nabycia)}
                {a.osoba && a.osoba.jawny_identyfikator ? ` · ${a.osoba.jawny_identyfikator}` : ''}
              </div>
            </td>
            <td>{a.seria}</td>
            <td className="prawo" style={{ fontWeight: 600 }}>{fmt.liczba(a.ilosc)}</td>
            <td className="numery">{a.numery}</td>
            <td className="prawo">{fmt.procent(a.procent)}</td>
            <td>
              {a.obciazenia.length === 0 ? (
                <span className="przyciemnione">—</span>
              ) : (
                <div className="row-g" style={{ flexWrap: 'wrap', gap: 5 }}>
                  {a.obciazenia.map((o, j) => (
                    <Znacznik key={j} odmiana={o.blokuje_rozporzadzanie ? 'bordo' : 'oliwka'}>
                      {o.typ === 'zajecie' ? 'zajęcie' : o.typ} {o.numery}
                    </Znacznik>
                  ))}
                </div>
              )}
            </td>
          </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2} style={{ fontWeight: 600 }}>Razem</td>
          <td className="prawo" style={{ fontWeight: 600 }}>{fmt.liczba(razem)}</td>
          <td />
          <td className="prawo" style={{ fontWeight: 600 }}>100%</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

/** Sprostowanie jako czysta adnotacja — pełne wycofanie zdarzenia jest gestem
    wyjątkowym, więc UI oferuje wyłącznie ścieżkę „uzasadnienie” (bez `zamiast`,
    dla zdarzeń bez zależnych) — patrz README, sekcja o zakresie sprintu 2. */
function ModalSprostowania({ zdarzenie, przyZamknieciu, przyZapisie }) {
  const [uzasadnienie, ustawUzasadnienie] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/zdarzenia/${zdarzenie.id}/sprostuj`, { uzasadnienie });
      przyZapisie();
    } catch (e) {
      ustawBlad(e.message);
      ustawZapisywanie(false);
    }
  }

  return (
    <Modal
      tytul={`Sprostowanie zdarzenia #${zdarzenie.id}`}
      przyZamknieciu={przyZamknieciu}
      szerokosc={560}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-primary" disabled={!uzasadnienie.trim() || zapisywanie} onClick={zapisz}>
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz sprostowanie'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      <Komunikat
        odmiana="info"
        tresc={
          'Rejestr jest niezmienialny — sprostowanie jest NOWYM zdarzeniem wskazującym ' +
          'zdarzenie prostowane. Bez treści zastępczej jest to pełne wycofanie tego zdarzenia ' +
          '(nie ma czym go zastąpić) — możliwe tylko, gdy nic innego już od niego nie zależy.'
        }
      />
      <Pole etykieta={`Prostowane zdarzenie: ${zdarzenie.podsumowanie || zdarzenie.typ}`} />
      <Pole etykieta="Uzasadnienie" wymagane>
        <textarea value={uzasadnienie} onChange={(z) => ustawUzasadnienie(z.target.value)} autoFocus />
      </Pole>
    </Modal>
  );
}

function EkranKokpitu({ spolkaId, ustawArchiwalny }) {
  const [data, ustawDate] = useState(fmt.dzisIso());
  const [szczegolowy, ustawSzczegolowy] = useState(false);
  const [przeliczanie, ustawPrzeliczanie] = useState(null);
  const [sprostowanie, ustawSprostowanie] = useState(null);
  const { dane, ladowanie, blad, odswiez } = useDane(
    `/api/psa/spolki/${spolkaId}?data=${encodeURIComponent(data)}`,
    [data]
  );

  const dzis = fmt.dzisIso();
  const maCzas = data.includes('T');
  const wstecz = data.slice(0, 10) < dzis || maCzas;

  // Tryb archiwalny jako stan calego ekranu (faza 2.2) - zglaszamy do Aplikacji
  // (topbar + tlo main-wrap), sprzatamy przy zejsciu z ekranu albo zmianie daty.
  useEffect(() => {
    if (!ustawArchiwalny) return undefined;
    ustawArchiwalny(
      wstecz
        ? { opis: maCzas ? fmt.dataCzas(data) : fmt.data(data), powrot: () => ustawDate(dzis) }
        : null
    );
    return () => ustawArchiwalny(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, wstecz]);

  async function przelicz() {
    ustawPrzeliczanie(null);
    try {
      const wynik = await API.post(`/api/psa/spolki/${spolkaId}/przelicz`);
      ustawPrzeliczanie(wynik);
      odswiez();
    } catch (e) {
      ustawPrzeliczanie({ ok: false, komunikat: e.message, niezgodnosci: e.bledy || [] });
    }
  }

  if (ladowanie && !dane) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tytul="Nie udało się wczytać spółki" tresc={blad.message} />;
  if (!dane) return null;

  const { spolka, emisje, bilans, akcjonariusze, obciazenia, uprawnienia, ograniczenia, zdarzenia } = dane;
  const najwczesniejsze = zdarzenia.length
    ? zdarzenia[zdarzenia.length - 1].data_zdarzenia
    : spolka.data_otwarcia_rejestru || spolka.data_umowy || fmt.dzisIso();
  const nieobjete = bilans.reduce((s, b) => s + b.nieobjete, 0);
  const kolorOsoby = przypiszKoloryAkcjonariuszy(akcjonariusze);

  return (
    <>
      <div className="okruszki bez-druku">
        <button onClick={() => idz('/spolki')}>Spółki</button> → {spolka.nazwa}
      </div>

      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">{spolka.nazwa}</div>
          <div className="podtytul-strony">
            {spolka.krs ? `KRS ${spolka.krs}` : 'bez numeru KRS'}
            {spolka.nip ? ` · NIP ${spolka.nip}` : ''}
            {spolka.miejscowosc ? ` · ${spolka.miejscowosc}` : ''}
            {spolka.data_umowy ? ` · umowa o prowadzenie rejestru z ${fmt.data(spolka.data_umowy)}` : ''}
          </div>
          <div className="row-g" style={{ marginTop: 10 }}>
            <StatusSpolki status={spolka.status} />
            <span className="podstawa-prawna">
              rejestr prowadzi {spolka.organ_prowadzacy || 'Kancelaria Notarialna Łukasz Kozon'} —
              art. 300(31) § 1 KSH
            </span>
          </div>
        </div>
        <div className="row-g bez-druku">
          <button className="btn" onClick={() => idz(`/spolki/${spolkaId}/wydruk/raport?data=${data}`)}>
            Raport spółki
          </button>
          <button className="btn" onClick={() => idz(`/spolki/${spolkaId}/wydruk/informacja?data=${data}`)}>
            Informacja z rejestru
          </button>
          {/* Tryb archiwalny (faza 2.2): przyciski akcji ZNIKAJĄ Z DOM, nie disabled —
              wydruki zostają, bo to odczyt stanu na wskazany dzień, nie jego zmiana. */}
          {!wstecz && dane.liczba_zdarzen === 0 && (
            <button
              className="btn"
              onClick={() => idz(`/spolki/${spolkaId}/migracja`)}
              title="Wprowadzenie stanu przeniesionego z innego rejestru (np. Rejestrów Notarialnych), z datami historycznymi."
            >
              Migracja — stan otwarcia
            </button>
          )}
          {!wstecz && (
            <button className="btn btn-primary btn-lg" onClick={() => idz(`/spolki/${spolkaId}/zdarzenie`)}>
              Nowe zdarzenie
            </button>
          )}
        </div>
      </div>

      {dane.niezgodnosci && dane.niezgodnosci.length > 0 && (
        <Komunikat
          odmiana="blad"
          tytul="Bilans akcji się nie zgadza"
          lista={dane.niezgodnosci}
        />
      )}

      {przeliczanie && (
        <Komunikat
          odmiana={przeliczanie.ok ? 'ok' : 'blad'}
          tresc={przeliczanie.komunikat}
          lista={przeliczanie.niezgodnosci}
        />
      )}

      {nieobjete > 0 && (
        <Komunikat
          odmiana="uwaga"
          tytul="Akcje wyemitowane, a jeszcze nieobjęte"
          tresc={
            `${fmt.AKCJE(nieobjete)} czeka na wpis objęcia. Zadaniem podmiotu prowadzącego ` +
            'rejestr jest zapewnienie zgodności liczby akcji zarejestrowanych z liczbą ' +
            'wyemitowanych (art. 300(31) § 3 KSH).'
          }
        />
      )}

      <SuwakDnia odDnia={najwczesniejsze} data={data} ustawDate={ustawDate} />

      <Karta
        tight
        tytul={`Akcjonariat na dzień ${fmt.data(data)}`}
        akcje={
          <div className="row-g bez-druku" role="group" aria-label="Widok tabeli akcjonariatu">
            <button
              className={`btn btn-sm ${!szczegolowy ? 'btn-primary' : ''}`}
              onClick={() => ustawSzczegolowy(false)}
              title="Jeden wiersz na akcjonariusza"
            >
              Uproszczony
            </button>
            <button
              className={`btn btn-sm ${szczegolowy ? 'btn-primary' : ''}`}
              onClick={() => ustawSzczegolowy(true)}
              title="Jeden wiersz na przedział numeryczny — widać obciążenia i współwłasność co do numeru"
            >
              Szczegółowy
            </button>
          </div>
        }
      >
        {emisje.length > 0 && (
          <div style={{ padding: '16px 24px 0' }}>
            {emisje.map((e) => (
              <PasekSerii
                key={e.klucz}
                emisja={e}
                bilansEmisji={bilans.find((b) => b.emisja_klucz === e.klucz)}
                akcjonariuszeEmisji={akcjonariusze.filter((a) => a.emisja_klucz === e.klucz)}
                kolorOsoby={kolorOsoby}
              />
            ))}
          </div>
        )}
        <TabelaAkcjonariatu
          akcjonariusze={szczegolowy ? rozbijNaSzczegoly(akcjonariusze) : akcjonariusze}
          razem={dane.razem_akcji}
        />
      </Karta>

      <Sekcja tytul="Emisje" licznik={emisje.length}>
        {emisje.length === 0 ? (
          <Pusto tytul="Brak emisji" opis="Pierwszym zdarzeniem w rejestrze jest emisja akcji." />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Seria</th>
                <th>Tytuł</th>
                <th>Numery</th>
                <th className="prawo">Wyemitowane</th>
                <th className="prawo">Nieobjęte</th>
                <th className="prawo">Umorzone</th>
                <th className="prawo">Cena emisyjna</th>
                <th>Data emisji</th>
              </tr>
            </thead>
            <tbody>
              {emisje.map((e) => {
                const b = bilans.find((x) => x.emisja_klucz === e.klucz) || {};
                return (
                  <tr key={e.klucz}>
                    <td style={{ fontWeight: 600 }}>{e.seria}</td>
                    <td>{e.tytul || '—'}</td>
                    <td className="numery">{e.zakres}</td>
                    <td className="prawo">{fmt.liczba(e.ilosc)}</td>
                    <td className="prawo">
                      {b.nieobjete ? (
                        <span style={{ color: 'var(--olive)' }}>{fmt.liczba(b.nieobjete)}</span>
                      ) : '—'}
                    </td>
                    <td className="prawo">{b.umorzone ? fmt.liczba(b.umorzone) : '—'}</td>
                    <td className="prawo">{fmt.zlote(e.cena_emisyjna_grosze)}</td>
                    <td className="przyciemnione">{fmt.data(e.data_emisji)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Sekcja>

      <Sekcja tytul="Uprawnienia i przywileje" licznik={uprawnienia.length}>
        {uprawnienia.length === 0 ? (
          <Pusto
            tytul="Brak zarejestrowanych uprawnień"
            opis="Uprawnienia, przywileje i obowiązki akcjonariuszy zakładasz przez zdarzenie „Uprawnienie”."
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Rodzaj</th><th>Zakres</th><th>Tytuł</th><th>Treść</th><th>Od</th></tr>
            </thead>
            <tbody>
              {uprawnienia.map((u) => (
                <tr key={u.klucz}>
                  <td>{u.rodzaj}</td>
                  <td>{u.osoba ? u.osoba.oznaczenie : u.seria || 'cała spółka'}</td>
                  <td>{u.tytul || '—'}</td>
                  <td className="zawijaj">{u.tresc || '—'}</td>
                  <td className="przyciemnione">{fmt.data(u.data_ustanowienia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sekcja>

      <Sekcja tytul="Obciążenia i zajęcia" licznik={obciazenia.length}>
        {obciazenia.length === 0 ? (
          <Pusto
            tytul="Brak obciążeń i zajęć"
            opis="Zastawy, użytkowanie i zajęcia egzekucyjne zakładasz przez odpowiednie zdarzenie w kreatorze."
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Typ</th><th>Seria</th><th>Numery</th><th>Uprawniony</th>
                <th>Prawo głosu</th><th>Blokuje rozporządzanie</th><th>Od</th>
              </tr>
            </thead>
            <tbody>
              {obciazenia.map((o) => (
                <tr key={o.klucz}>
                  <td>{o.typ === 'zajecie' ? 'zajęcie' : o.typ}</td>
                  <td>{o.seria}</td>
                  <td className="numery">{o.numery}</td>
                  <td>{o.uprawniony ? o.uprawniony.oznaczenie : '—'}</td>
                  <td>{o.prawo_glosu ? 'tak' : 'nie'}</td>
                  <td>{o.blokuje_rozporzadzanie ? 'tak' : 'nie'}</td>
                  <td className="przyciemnione">{fmt.data(o.data_od)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sekcja>

      <Sekcja tytul="Ograniczenia w rozporządzaniu" licznik={ograniczenia.length}>
        {ograniczenia.length === 0 ? (
          <Pusto
            tytul="Brak ograniczeń"
            opis="Ograniczenia z art. 300(33) § 1 pkt 10 KSH zakładasz przez zdarzenie „Ograniczenie”."
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Zakres</th><th>Numery</th><th>Zgoda spółki</th><th>Prawo pierwszeństwa</th><th>Opis</th></tr>
            </thead>
            <tbody>
              {ograniczenia.map((o) => (
                <tr key={o.klucz}>
                  <td>{o.seria || o.zakres}</td>
                  <td className="numery">{o.numery || '—'}</td>
                  <td>{o.wymaga_zgody_spolki ? 'wymagana' : 'nie'}</td>
                  <td>{o.prawo_pierwszenstwa ? 'tak' : 'nie'}</td>
                  <td className="zawijaj">{o.opis || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sekcja>

      <Sekcja
        tytul="Historia zdarzeń"
        licznik={dane.liczba_zdarzen}
        domyslnieOtwarta
        akcje={
          !wstecz && (
            <button className="btn btn-sm" onClick={przelicz} title="Odbudowa stanu ze zdarzeń">
              Przelicz stan
            </button>
          )
        }
      >
        <div style={{ padding: '20px 24px 8px' }}>
          {zdarzenia.length === 0 ? (
            <Pusto tytul="Brak zdarzeń" opis="Rejestr jeszcze się nie zaczął." />
          ) : (
            <div className="os">
              {zdarzenia.map((z) => (
                <div key={z.id} className="os-poz">
                  <div className="row-b">
                    <div className="os-data">
                      {fmt.data(z.data_zdarzenia)} · zdarzenie #{z.id}
                    </div>
                    {!wstecz && z.typ !== 'sprostowanie' && (
                      <button className="btn btn-sm bez-druku" onClick={() => ustawSprostowanie(z)}>
                        Sprostuj
                      </button>
                    )}
                  </div>
                  <div className="os-tresc">
                    {z.podsumowanie || `Zdarzenie typu „${z.typ}”.`}
                  </div>
                  <div className="os-meta">
                    wpisano {fmt.dataCzas(z.data_wpisu)} · {z.autor} · skrót {z.hash_skrocony}…
                  </div>
                </div>
              ))}
              {dane.liczba_zdarzen > zdarzenia.length && (
                <div className="podpowiedz">
                  Pokazano {zdarzenia.length} z {dane.liczba_zdarzen} zdarzeń.
                </div>
              )}
            </div>
          )}
        </div>
      </Sekcja>

      <div className="podstawa-prawna" style={{ marginTop: 18 }}>
        Rejestru nie da się edytować ani skasować. Pomyłkę prostuje się zdarzeniem
        „sprostowanie”, które wskazuje zdarzenie prostowane — oba pozostają w łańcuchu.
      </div>

      {sprostowanie && (
        <ModalSprostowania
          zdarzenie={sprostowanie}
          przyZamknieciu={() => ustawSprostowanie(null)}
          przyZapisie={() => {
            ustawSprostowanie(null);
            odswiez();
          }}
        />
      )}
    </>
  );
}

window.EkranKokpitu = EkranKokpitu;
window.SuwakDnia = SuwakDnia;
window.TabelaAkcjonariatu = TabelaAkcjonariatu;

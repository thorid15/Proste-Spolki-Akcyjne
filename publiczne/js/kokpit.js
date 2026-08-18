/* kokpit.js — kokpit spółki: JEDEN EKRAN (sekcja 9 specyfikacji).
   Sesja SESJA-PSA-6-INTERFEJS.md, faza 2.

   Układ dwukolumnowy (2 — Plan projektu, FAZA 2): oś akcji i tabela
   akcjonariatu po lewej, przyklejona metryka rejestru po prawej.
   Oś akcji zastępuje dawny „pasek serii" i suwak dnia jako element
   sygnaturowy — wykres numer akcji × czas z playheadem zatrzaskującym
   się na zdarzeniach (2.5), nie na dniach kalendarzowych. */

/* ═════════════════════════════════════════════════════
   OŚ AKCJI (2.1, 2.4, 2.5)
   ═════════════════════════════════════════════════════ */

// Warianty jasności zieleni rejestru (patrz rejestr.css) — WYŁĄCZNIE ta
// jedna barwa w różnych jasnościach, nigdy tęcza kolorów (2.1).
const ODCIENIE_AKCJONARIUSZY = [
  '--rejestr', '--rejestr-2', '--rejestr-3',
  '--rejestr-cien-4', '--rejestr-cien-5', '--rejestr-cien-6',
];

const WYSOKOSC_SEKCJI = 72;
const WYSOKOSC_ETYKIETY = 18;
const ODSTEP_SEKCJI = 20;
const WYSOKOSC_OSI_CZASU = 30;
const VB_SZEROKOSC = 1000;

function nazwaOsoby(o) {
  return o && o.osoba ? o.osoba.oznaczenie : o && o.osoba_id != null ? `osoba #${o.osoba_id}` : 'nieobjęte';
}

/** Ten sam akcjonariusz = ten sam odcień na całym wykresie (wszystkie emisje). */
function przypiszOdcienie(pasma) {
  const mapa = new Map();
  for (const p of pasma) {
    if (p.kategoria !== 'akcjonariusz' || p.osoba_id == null) continue;
    if (!mapa.has(p.osoba_id)) {
      mapa.set(p.osoba_id, ODCIENIE_AKCJONARIUSZY[mapa.size % ODCIENIE_AKCJONARIUSZY.length]);
    }
  }
  return mapa;
}

/** Odcinki jednej emisji uporządkowane wg numeru (nakładka nieobjęte/umorzone/akcjonariusz). */
function pasmaEmisji(pasma, emisjaKlucz) {
  return pasma.filter((p) => p.emisja_klucz === emisjaKlucz);
}

/** Pozycja ordynalna zdarzenia na wspólnej osi czasu — nie kalendarz (2.5). */
function polozenieCzasowe(zdarzenieOdId, zdarzenieDoId, indeksZdarzenia, pozycjaDzis) {
  const start = indeksZdarzenia.has(zdarzenieOdId) ? indeksZdarzenia.get(zdarzenieOdId) : 0;
  const koniec =
    zdarzenieDoId != null && indeksZdarzenia.has(zdarzenieDoId) ? indeksZdarzenia.get(zdarzenieDoId) : pozycjaDzis;
  return [start, koniec];
}

/** Przecięcie dwóch przedziałów liczbowych zamkniętych — null, gdy rozłączne. */
function przetnij(aOd, aDo, bOd, bDo) {
  const od = Math.max(aOd, bOd);
  const doo = Math.min(aDo, bDo);
  return od <= doo ? [od, doo] : null;
}

function SekcjaEmisji({
  emisja, y, pasma, obciazenia, indeksZdarzenia, pozycjaDzis, xSkala, ySkala,
  kolorOsoby, naKlikniecie, wspolwlasnoscDoListy,
}) {
  const odcinki = pasmaEmisji(pasma, emisja.klucz);
  const obciazeniaEmisji = obciazenia.filter((o) => o.emisja_klucz === emisja.klucz);

  return (
    <g>
      <text x={0} y={y - 6} className="os-akcji-etykieta-seria">
        Seria {emisja.seria}
        <tspan className="przyciemniona"> · nr {emisja.nr_pierwszy}–{emisja.nr_pierwszy + emisja.ilosc - 1} · {emisja.ilosc} akcji</tspan>
      </text>

      {odcinki.map((p, i) => {
        const [xOd, xDo] = polozenieCzasowe(p.zdarzenie_od_id, p.zdarzenie_do_id, indeksZdarzenia, pozycjaDzis);
        const x1 = xSkala(xOd);
        const x2 = Math.max(xSkala(xDo), x1 + 1.5);
        const yTop = y + ySkala(emisja, p.nr_do + 1);
        const yBottom = y + ySkala(emisja, p.nr_od);
        const wys = Math.max(yBottom - yTop, p.nr_od === p.nr_do ? 2.5 : 1);

        const wspolna = p.kategoria === 'akcjonariusz' ? null : null; // placeholder dla czytelności ponizej
        const ulamkowa = p.kategoria === 'akcjonariusz' && (p.czesc_mianownik || 1) !== 1;
        // Numer objety wspolwlasnoscia: wiecej niz jedno pasmo akcjonariusza
        // na TYM SAMYM numerze i w NAKLADAJACYM sie czasie. Wykrywane z
        // samych pasm (bez zmiany kontraktu) — jak dawny pasek serii.
        if (ulamkowa) {
          wspolwlasnoscDoListy.push({ ...p, emisja });
        }

        const klasy = ['os-akcji-pasmo'];
        let fill;
        let tytul;
        if (p.kategoria === 'nieobjeta') {
          fill = 'url(#siatka-nieobjete)';
          tytul = `nr ${opiszZakresNr(p)} — nieobjęte`;
          klasy.push('niekliknieta');
        } else if (p.kategoria === 'umorzona') {
          fill = 'url(#siatka-umorzone)';
          tytul = `nr ${opiszZakresNr(p)} — umorzone`;
          klasy.push('niekliknieta');
        } else {
          fill = ulamkowa ? 'url(#kreska-ulamek)' : `var(${kolorOsoby.get(p.osoba_id) || '--rejestr'})`;
          tytul = ulamkowa
            ? `nr ${p.nr_od} — ${u.opisz({ licznik: p.czesc_licznik, mianownik: p.czesc_mianownik })} akcji, ${nazwaOsoby(p)}`
            : `${nazwaOsoby(p)} — nr ${opiszZakresNr(p)}`;
        }

        return (
          <rect
            key={i}
            className={klasy.join(' ')}
            x={x1}
            y={yTop}
            width={x2 - x1}
            height={wys}
            fill={fill}
            rx={1}
          >
            <title>{tytul}</title>
            {p.kategoria === 'akcjonariusz' && (
              <animate attributeName="opacity" begin="0s" dur="0.01s" values="1" fill="freeze" />
            )}
          </rect>
        );
      })}

      {/* Kreskowanie obciążeń NAKŁADA się na pasmo (2.1) — osobne prostokąty
          na przecięciu czasu obciążenia i czasu pasma, numeru obciążenia
          i numeru pasma; jedno obciążenie może dotykać kilku pasm. */}
      {obciazeniaEmisji.map((o, i) =>
        o.zakresy.map((z, j) => {
          const [oxOd, oxDo] = polozenieCzasowe(o.zdarzenie_od_id, o.zdarzenie_do_id, indeksZdarzenia, pozycjaDzis);
          return odcinki
            .filter((p) => p.kategoria === 'akcjonariusz')
            .map((p, k) => {
              const przetCzas = przetnij(oxOd, oxDo, ...polozenieCzasowe(p.zdarzenie_od_id, p.zdarzenie_do_id, indeksZdarzenia, pozycjaDzis));
              const przetNr = przetnij(z.nr_od, z.nr_do, p.nr_od, p.nr_do);
              if (!przetCzas || !przetNr) return null;
              const x1 = xSkala(przetCzas[0]);
              const x2 = Math.max(xSkala(przetCzas[1]), x1 + 1.5);
              const yTop = y + ySkala(emisja, przetNr[1] + 1);
              const yBottom = y + ySkala(emisja, przetNr[0]);
              return (
                <rect
                  key={`${i}-${j}-${k}`}
                  className="os-akcji-pasmo niekliknieta"
                  x={x1}
                  y={yTop}
                  width={x2 - x1}
                  height={Math.max(yBottom - yTop, 2)}
                  fill="url(#kreska-obciazenie)"
                >
                  <title>{`${o.typ === 'zajecie' ? 'zajęcie' : o.typ} — nr ${n.opisz([przetNr.length ? { nr_od: przetNr[0], nr_do: przetNr[1] } : z])} — ${o.uprawniony ? nazwaOsoby({ osoba: o.uprawniony }) : 'brak wskazanego uprawnionego'}`}</title>
                </rect>
              );
            });
        })
      )}
    </g>
  );

  function opiszZakresNr(p) {
    return p.nr_od === p.nr_do ? String(p.nr_od) : `${p.nr_od}–${p.nr_do}`;
  }
}

/**
 * Oś akcji — wykres numer akcji (pionowo) × czas (poziomo), 2.1/2.4.
 * Jeden SVG, sekcja na emisję, wspólna oś czasu ordynalna (pozycje = tyle,
 * ile spółka ma zdarzeń, plus „dziś"). Playhead to natywny `input[range]`
 * pod wykresem — dostaje ←/→/Home/End i przeciąganie za darmo, a wykres
 * tylko odczytuje jego pozycję.
 */
function OsAkcji({ os, pozycja, ustawPozycje, naKlikniecieAkcjonariusza }) {
  const zdarzenia = os.zdarzenia;
  const pozycjaDzis = zdarzenia.length;
  const indeksZdarzenia = useMemo(() => new Map(zdarzenia.map((z, i) => [z.id, i])), [zdarzenia]);
  const kolorOsoby = useMemo(() => przypiszOdcienie(os.pasma), [os.pasma]);
  const pozycjaLiczbowa = pozycja === 'dzis' ? pozycjaDzis : pozycja;

  if (zdarzenia.length === 0) {
    return (
      <div className="os-akcji">
        <div className="os-akcji-pusto">Rejestr jeszcze się nie zaczął — pierwszym zdarzeniem jest emisja akcji.</div>
      </div>
    );
  }

  const szerokoscWykresu = VB_SZEROKOSC - 8;
  const xSkala = (poz) => 4 + (poz / pozycjaDzis) * szerokoscWykresu;
  const ySkala = (emisja, nr) => WYSOKOSC_SEKCJI - ((nr - emisja.nr_pierwszy) / emisja.ilosc) * WYSOKOSC_SEKCJI;

  let y = WYSOKOSC_ETYKIETY;
  const wspolwlasnoscDoListy = [];
  const sekcje = os.emisje.map((e) => {
    const el = (
      <SekcjaEmisji
        key={e.klucz}
        emisja={e}
        y={y}
        pasma={os.pasma}
        obciazenia={os.obciazenia}
        indeksZdarzenia={indeksZdarzenia}
        pozycjaDzis={pozycjaDzis}
        xSkala={xSkala}
        ySkala={ySkala}
        kolorOsoby={kolorOsoby}
        wspolwlasnoscDoListy={wspolwlasnoscDoListy}
      />
    );
    y += WYSOKOSC_SEKCJI + WYSOKOSC_ETYKIETY + ODSTEP_SEKCJI;
    return el;
  });
  const wysokoscBandow = y - ODSTEP_SEKCJI;
  const yOsCzasu = wysokoscBandow + 10;
  const vbWysokosc = yOsCzasu + WYSOKOSC_OSI_CZASU;

  function klikniecieTla(zdarzenie) {
    // Klik na pasmo akcjonariusza przewija do wiersza w tabeli TYLKO gdy
    // ten akcjonariusz jest widoczny w bieżącym przekroju (2.4) — inaczej
    // przenosi playhead na początek tego pasma, żeby dało się je obejrzeć.
  }

  return (
    <div className="os-akcji">
      <svg
        className="os-akcji-svg"
        viewBox={`0 0 ${VB_SZEROKOSC} ${vbWysokosc}`}
        preserveAspectRatio="none"
        style={{ height: vbWysokosc * 0.6 }}
        role="img"
        aria-hidden="true"
        onClick={(z) => {
          const cel = z.target.closest('rect.os-akcji-pasmo');
          if (!cel || cel.classList.contains('niekliknieta')) return;
          const osobaId = cel.getAttribute('data-osoba');
          const emisjaKlucz = cel.getAttribute('data-emisja');
          if (osobaId) naKlikniecieAkcjonariusza(Number(osobaId), Number(emisjaKlucz));
        }}
      >
        <defs>
          <pattern id="siatka-nieobjete" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--papier)" />
            <path d="M0 0V6M0 0H6" stroke="var(--linia)" strokeWidth="1" />
          </pattern>
          <pattern id="siatka-umorzone" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--papier)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--atrament-3)" strokeWidth="1.5" />
          </pattern>
          <pattern id="kreska-obciazenie" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="6" height="6" fill="var(--mosiadz)" fillOpacity="0.22" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--mosiadz)" strokeWidth="1.6" />
          </pattern>
          <pattern id="kreska-ulamek" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--atrament-3)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--atrament-2)" strokeWidth="1.4" />
          </pattern>
        </defs>

        {sekcje}

        {/* Wspólna oś czasu: linia + znaczniki zdarzeń (mosiężne kropki) + „dziś". */}
        <line
          className="os-akcji-oś-czasu-linia"
          x1={xSkala(0)} y1={yOsCzasu} x2={xSkala(pozycjaDzis)} y2={yOsCzasu}
        />
        {zdarzenia.map((z, i) => (
          <circle
            key={z.id}
            className="os-akcji-znacznik"
            cx={xSkala(i)} cy={yOsCzasu} r={i === pozycjaLiczbowa ? 4.5 : 3}
            onClick={() => ustawPozycje(i === pozycjaDzis ? 'dzis' : i)}
            style={{ cursor: 'pointer' }}
          >
            <title>{`${fmt.data(z.data_zdarzenia)} — ${z.podsumowanie}`}</title>
          </circle>
        ))}
        <circle
          className="os-akcji-znacznik-obwodka"
          cx={xSkala(pozycjaDzis)} cy={yOsCzasu} r={pozycjaLiczbowa === pozycjaDzis ? 5.5 : 4}
          onClick={() => ustawPozycje('dzis')}
          style={{ cursor: 'pointer' }}
        >
          <title>dziś — stan bieżący</title>
        </circle>

        <line
          className="os-akcji-playhead-linia"
          x1={xSkala(pozycjaLiczbowa)} y1={0} x2={xSkala(pozycjaLiczbowa)} y2={yOsCzasu}
        />
      </svg>

      <SterowaniePlayheadem
        zdarzenia={zdarzenia}
        pozycjaDzis={pozycjaDzis}
        pozycjaLiczbowa={pozycjaLiczbowa}
        pozycja={pozycja}
        ustawPozycje={ustawPozycje}
      />

      {wspolwlasnoscDoListy.length > 0 && (
        <div className="os-akcji-wspolwlasnosc">
          <strong className="male">Współwłasność ułamkowa w tym przekroju czasu</strong>
          {wspolwlasnoscDoListy.map((p, i) => (
            <div key={i} className="male">
              nr {p.nr_od} (seria {p.emisja.seria}) — {u.opisz({ licznik: p.czesc_licznik, mianownik: p.czesc_mianownik })} akcji: {nazwaOsoby(p)}
              {p.przedstawiciel && <> · przedstawiciel: {nazwaOsoby({ osoba: p.przedstawiciel })}</>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Rozwinięcie ułamka na czytelny tekst „1/3", bez importu logiki serwerowej. */
const u = {
  opisz({ licznik, mianownik }) {
    if (!mianownik || mianownik === 1) return String(licznik);
    return `${licznik}/${mianownik}`;
  },
};
/** Zapis zakresu numerów — lokalna kopia formatu z półpauzą (2.2), bez zależności od serwera. */
const n = {
  opisz(zakresy) {
    return zakresy
      .map((z) => (z.nr_od === z.nr_do ? String(z.nr_od) : `${z.nr_od}–${z.nr_do}`))
      .join(', ');
  },
};

/**
 * Playhead (2.5): natywny `input[range]` o tylu położeniach, ile spółka ma
 * zdarzeń (+1 na „dziś") — bez migotania, bo stan przelicza się dopiero po
 * zatrzaśnięciu na pozycji, nie przy każdym pikselu. ←/→/Home/End działają
 * przez sam input (fokus + klawiatura), przyciski obok są dla myszy.
 */
function SterowaniePlayheadem({ zdarzenia, pozycjaDzis, pozycjaLiczbowa, pozycja, ustawPozycje }) {
  const [skokDoDaty, ustawSkokDoDaty] = useState('');

  function idzDo(i) {
    ustawPozycje(i >= pozycjaDzis ? 'dzis' : Math.max(i, 0));
  }

  function skocz(data) {
    ustawSkokDoDaty(data);
    if (!data) return;
    // Ostatnie zdarzenie NIE PÓŹNIEJSZE niż wskazana data (po data_zdarzenia —
    // ta sama semantyka, co dawny suwak dnia); brak takiego = pierwsze zdarzenie.
    let znaleziono = 0;
    for (let i = 0; i < zdarzenia.length; i += 1) {
      if (zdarzenia[i].data_zdarzenia <= data) znaleziono = i;
    }
    const dzis = fmt.dzisIso();
    idzDo(data >= dzis ? pozycjaDzis : znaleziono);
  }

  const etykieta =
    pozycja === 'dzis'
      ? 'stan bieżący'
      : `stan po zdarzeniu z ${fmt.data(zdarzenia[pozycjaLiczbowa].data_zdarzenia)}`;

  return (
    <div className="os-akcji-sterowanie bez-druku">
      <button className="btn btn-maly" onClick={() => idzDo(0)} title="Początek (Home)" aria-label="Pierwsze zdarzenie">
        <Ikona nazwa="strzalkaLewo" rozmiar={14} />
      </button>
      <button
        className="btn btn-maly"
        onClick={() => idzDo(pozycjaLiczbowa - 1)}
        disabled={pozycjaLiczbowa === 0}
        aria-label="Poprzednie zdarzenie"
      >
        ‹
      </button>
      <input
        className="os-akcji-suwak"
        type="range"
        min={0}
        max={pozycjaDzis}
        step={1}
        value={pozycjaLiczbowa}
        onChange={(z) => idzDo(Number(z.target.value))}
        aria-label="Stan na zdarzenie"
      />
      <button
        className="btn btn-maly"
        onClick={() => idzDo(pozycjaLiczbowa + 1)}
        disabled={pozycjaLiczbowa === pozycjaDzis}
        aria-label="Następne zdarzenie"
      >
        ›
      </button>
      <button className="btn btn-maly" onClick={() => idzDo(pozycjaDzis)} title="Dziś (End)" aria-label="Stan bieżący">
        <Ikona nazwa="strzalkaPrawo" rozmiar={14} />
      </button>

      <span className="os-akcji-etykieta-chwili">{etykieta}</span>

      <PoleDaty
        wartosc={skokDoDaty}
        przyZmianie={skocz}
        max={fmt.dzisIso()}
      />
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   TABELA AKCJONARIATU + PRZEŁĄCZNIK UPROSZCZONY/SZCZEGÓŁOWY (2.4)
   ═════════════════════════════════════════════════════ */

/* Tryb szczegółowy: jeden wiersz na PRZEDZIAŁ numeryczny zamiast łączenia
   wszystkich zakresów pozycji w jedną komórkę — każdy wiersz pokazuje
   WYŁĄCZNIE obciążenia nakładające się na TEN konkretny przedział. Zakres
   obciążenia czytamy z jego własnego pola `numery` (ten sam ciąg, który
   tabela i tak wyświetla) — czysto prezentacyjne, bez zmiany kontraktu. */
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
        obciazenia: a.obciazenia.filter((o) => parsujNumery(o.numery).some((zo) => zakresyNakladajaSie(zo, z))),
      });
    }
  }
  return wiersze;
}

function TabelaAkcjonariatu({ akcjonariusze, razem }) {
  if (akcjonariusze.length === 0) {
    return (
      <Pusto
        ikona="osoby"
        tytul="Brak akcjonariuszy na wskazany dzień"
        opis="Zarejestruj emisję akcji, a następnie ich objęcie."
      />
    );
  }
  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>Akcjonariusz</th>
          <th>Seria</th>
          <th className="do-prawej">Liczba akcji</th>
          <th>Numery</th>
          <th className="do-prawej">% akcji</th>
          <th>Obciążenia</th>
        </tr>
      </thead>
      <tbody>
        {akcjonariusze.map((a, i) => {
          // Tryb szczegółowy rozbija jedną pozycję na kilka wierszy — `id`
          // do przewijania z osi akcji nadajemy TYLKO pierwszemu.
          const pierwszaDlaPozycji =
            akcjonariusze.findIndex((x) => x.osoba_id === a.osoba_id && x.emisja_klucz === a.emisja_klucz) === i;
          return (
            <tr
              key={`${a.osoba_id}-${a.emisja_klucz}-${i}`}
              id={pierwszaDlaPozycji ? `akcjonariusz-${a.osoba_id}-${a.emisja_klucz}` : undefined}
            >
              <td>
                <div style={{ fontWeight: 500 }}>{a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`}</div>
                <div className="wiersz-podtytul">
                  akcjonariusz od {fmt.data(a.data_nabycia)}
                  {a.osoba && a.osoba.jawny_identyfikator ? ` · ${a.osoba.jawny_identyfikator}` : ''}
                </div>
              </td>
              <td>{a.seria}</td>
              <td className="do-prawej" style={{ fontWeight: 600 }}>{fmt.liczba(a.ilosc)}</td>
              <td className="kol-dane">{a.numery}</td>
              <td className="do-prawej">{fmt.procent(a.procent)}</td>
              <td>
                {a.obciazenia.length === 0 ? (
                  <span className="wyciszony">—</span>
                ) : (
                  <div className="rzad" style={{ flexWrap: 'wrap', gap: 5 }}>
                    {a.obciazenia.map((o, j) => (
                      <Pigulka key={j} odmiana={o.blokuje_rozporzadzanie ? 'sygnal' : 'mosiadz'}>
                        {o.typ === 'zajecie' ? 'zajęcie' : o.typ} {o.numery}
                      </Pigulka>
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
          <td colSpan={2}>Razem</td>
          <td className="do-prawej">{fmt.liczba(razem)}</td>
          <td />
          <td className="do-prawej">100%</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

/* ═════════════════════════════════════════════════════
   SPROSTOWANIE
   ═════════════════════════════════════════════════════ */

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
          <button className="btn btn-glowny" disabled={!uzasadnienie.trim() || zapisywanie} onClick={zapisz}>
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz sprostowanie'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="info" tresc={
        'Rejestr jest niezmienialny — sprostowanie jest NOWYM zdarzeniem wskazującym ' +
        'zdarzenie prostowane. Bez treści zastępczej jest to pełne wycofanie tego zdarzenia ' +
        '(nie ma czym go zastąpić) — możliwe tylko, gdy nic innego już od niego nie zależy.'
      } />
      <Komunikat odmiana="blad" tresc={blad} />
      <Pole etykieta={`Prostowane zdarzenie: ${zdarzenie.podsumowanie || zdarzenie.typ}`} />
      <Pole etykieta="Uzasadnienie" wymagane>
        <textarea value={uzasadnienie} onChange={(z) => ustawUzasadnienie(z.target.value)} autoFocus />
      </Pole>
    </Modal>
  );
}

/* ═════════════════════════════════════════════════════
   METRYKA REJESTRU (prawa, przyklejona kolumna — 2 „Plan projektu")
   ═════════════════════════════════════════════════════ */

const NAZWY_UMOWE_ZAWARL = {
  notariusz: 'notariusz',
  zastepca: 'zastępca notarialny',
  osoba_upowazniona: 'osoba upoważniona',
};

/**
 * Przelacznik "stosuje procedure AML" (etap 3.1) - wylaczony domyslnie.
 * Wlacza go zbieranie skanow dokumentow, oswiadczenia PEP i beneficjenta
 * rzeczywistego przy edycji akcjonariuszy TEJ spolki (patrz FormularzOsoby
 * w osoby.js) - domyslnie (wylaczony) kartoteka zbiera wylacznie dane Z
 * dokumentu, bez pliku.
 */
function KartaProceduryAml({ spolka, spolkaId, odswiez }) {
  const [zapisywanie, ustawZapisywanie] = useState(false);

  async function przelacz() {
    ustawZapisywanie(true);
    try {
      await API.put(`/api/psa/spolki/${spolkaId}`, { stosuje_procedure_aml: !spolka.stosuje_procedure_aml });
      odswiez();
    } catch (e) {
      window.alert(e instanceof BladApi ? e.message : 'Nie udało się zmienić ustawienia procedury AML.');
    } finally {
      ustawZapisywanie(false);
    }
  }

  const wlaczona = Boolean(Number(spolka.stosuje_procedure_aml));

  return (
    <Karta tytul="Procedura AML">
      <div className="metryka-pion">
        <label className="chk" style={{ padding: '4px 0' }}>
          <input type="checkbox" checked={wlaczona} onChange={przelacz} disabled={zapisywanie} />
          <span className="chk-tresc">Stosuje procedurę AML dla tej spółki</span>
        </label>
        <div className="podpowiedz">
          {wlaczona
            ? 'Włączona: przy edycji akcjonariuszy tej spółki można dodać skan dokumentu tożsamości, oświadczenie PEP i wskazać beneficjenta rzeczywistego.'
            : 'Wyłączona (domyślnie): kartoteka zbiera wyłącznie dane z dokumentu tożsamości (status, data weryfikacji, notatka) — bez pliku.'}
        </div>
      </div>
    </Karta>
  );
}

function MetrykaBoczna({ spolka, dane, spolkaId, odswiez }) {
  const integralnosc = useDane('/api/psa/integralnosc');
  const terminy = useDane(`/api/psa/sprawy?spolka_id=${spolkaId}`);
  const sprawyWToku = terminy.dane ? terminy.dane.sprawy : [];
  const najpilniejsza = sprawyWToku
    .filter((s) => s.termin && s.termin.dni_pozostale != null)
    .sort((a, b) => a.termin.dni_pozostale - b.termin.dni_pozostale)[0];
  const [wystawianie, ustawWystawianie] = useState(false);

  return (
    <aside className="siatka-tresc-prawa bez-druku">
      <Karta tytul="Dane rejestrowe">
        <div className="metryka-pion">
          <MetrykaPoz etykieta="Numer KRS" wartosc={spolka.krs} dane />
          <MetrykaPoz etykieta="NIP" wartosc={spolka.nip} dane />
          <MetrykaPoz etykieta="Sąd rejestrowy" wartosc={[spolka.sad_rejestrowy, spolka.wydzial].filter(Boolean).join(', ')} />
        </div>
      </Karta>

      <Karta tytul="Umowa o prowadzenie rejestru">
        <div className="metryka-pion">
          <MetrykaPoz etykieta="Data uchwały o wyborze" wartosc={fmt.data(spolka.data_uchwaly_wyboru)} dane podpowiedz="art. 300³² § 1 KSH" />
          <MetrykaPoz etykieta="Data umowy" wartosc={fmt.data(spolka.data_umowy)} dane />
          <MetrykaPoz
            etykieta="Zawarł"
            wartosc={
              spolka.umowe_zawarl
                ? `${NAZWY_UMOWE_ZAWARL[spolka.umowe_zawarl] || spolka.umowe_zawarl}${
                    spolka.umowe_zawarl_imie_nazwisko ? ` — ${spolka.umowe_zawarl_imie_nazwisko}` : ''
                  }`
                : null
            }
          />
          <MetrykaPoz etykieta="Data otwarcia rejestru" wartosc={fmt.data(spolka.data_otwarcia_rejestru)} dane />
        </div>
      </Karta>

      <Karta tytul="Stan rejestru">
        <div className="metryka-pion">
          <MetrykaPoz etykieta="Akcje w obrocie" wartosc={fmt.liczba(dane.razem_akcji)} />
          <MetrykaPoz etykieta="Zdarzenia tej spółki" wartosc={fmt.liczba(dane.liczba_zdarzen)} />
          <div className="metryka-pion-poz">
            <div className="metryka-pion-etykieta">Łańcuch skrótów rejestru</div>
            {integralnosc.ladowanie ? (
              <div className="metryka-pion-wartosc wyciszony">sprawdzanie…</div>
            ) : integralnosc.dane && integralnosc.dane.ok ? (
              <Pigulka odmiana="rejestr">nieprzerwany</Pigulka>
            ) : integralnosc.dane ? (
              <Pigulka odmiana="sygnal">zerwany przy #{integralnosc.dane.blad && integralnosc.dane.blad.id}</Pigulka>
            ) : (
              <span className="wyciszony male">niedostępne</span>
            )}
          </div>
        </div>
      </Karta>

      <Karta tytul="Terminy">
        {sprawyWToku.length === 0 ? (
          <div className="male wyciszony">Brak spraw w toku dla tej spółki.</div>
        ) : (
          <div className="metryka-pion">
            <MetrykaPoz etykieta="Sprawy w toku" wartosc={String(sprawyWToku.length)} />
            {najpilniejsza && (
              <div className="metryka-pion-poz">
                <div className="metryka-pion-etykieta">Najbliższy termin</div>
                <Pigulka odmiana={najpilniejsza.termin.po_terminie ? 'sygnal' : najpilniejsza.termin.pilny ? 'mosiadz' : undefined}>
                  {najpilniejsza.termin.po_terminie ? 'po terminie' : `${najpilniejsza.termin.dni_pozostale} dz.`}
                </Pigulka>
              </div>
            )}
            <button className="btn btn-maly" onClick={() => idz(`/sprawy?spolka_id=${spolkaId}`)}>
              Zobacz sprawy
            </button>
          </div>
        )}
      </Karta>

      <KartaProceduryAml spolka={spolka} spolkaId={spolkaId} odswiez={odswiez} />

      <Karta tytul="Dokumenty">
        <div className="metryka-pion">
          <div className="male wyciszony">Umowa, RODO, uchwała, lista dla sądu, klauzula zbycia.</div>
          <button className="btn btn-maly" onClick={() => ustawWystawianie(true)}>
            Wystaw dokument
          </button>
        </div>
      </Karta>
      {wystawianie && (
        <ModalWystawDokumentu spolkaId={spolkaId} przyZamknieciu={() => ustawWystawianie(false)} />
      )}
    </aside>
  );
}

function MetrykaPoz({ etykieta, wartosc, dane, podpowiedz }) {
  return (
    <div className="metryka-pion-poz">
      <div className="metryka-pion-etykieta">{etykieta}</div>
      <div className={`metryka-pion-wartosc ${dane ? 'dane' : ''}`}>{wartosc || '—'}</div>
      {podpowiedz && <div className="podstawa-prawna">{podpowiedz}</div>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   EKRAN KOKPITU
   ═════════════════════════════════════════════════════ */

function EkranKokpitu({ spolkaId }) {
  // Pozycja playheada: liczba = indeks zdarzenia w `os.zdarzenia` (ordynalnie,
  // nie kalendarzowo — 2.5), albo literał 'dzis'. Nie zależy od `os` w chwili
  // startu, więc nie ma wyścigu z jego wczytaniem.
  const [pozycja, ustawPozycje] = useState('dzis');
  const [szczegolowy, ustawSzczegolowy] = useState(false);
  const [przeliczanie, ustawPrzeliczanie] = useState(null);
  const [sprostowanie, ustawSprostowanie] = useState(null);

  const os = useDane(`/api/psa/spolki/${spolkaId}/os-akcji`);

  const wstecz = pozycja !== 'dzis';
  // Chwila zdarzenia po data_wpisu (sekcja 2.3) — dokładność do minuty
  // odróżnia dwa wpisy tego samego dnia, dokładnie jak dawny suwak z godziną.
  const data =
    pozycja === 'dzis' || !os.dane
      ? fmt.dzisIso()
      : os.dane.zdarzenia[pozycja].data_wpisu.slice(0, 19);

  const { dane, ladowanie, blad, odswiez } = useDane(
    `/api/psa/spolki/${spolkaId}?data=${encodeURIComponent(data)}`,
    [data]
  );

  function naKlikniecieAkcjonariusza(osobaId, emisjaKlucz) {
    const el = document.getElementById(`akcjonariusz-${osobaId}-${emisjaKlucz}`);
    if (!el) return;
    const bezRuchu = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: bezRuchu ? 'auto' : 'smooth', block: 'center' });
  }

  /** Etap 5.1: skok miedzy zdarzeniem prostowanym a prostujacym - link dziala w OBIE strony. */
  function skoczDoZdarzenia(id) {
    const el = document.getElementById(`zdarzenie-${id}`);
    if (!el) return;
    const bezRuchu = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: bezRuchu ? 'auto' : 'smooth', block: 'center' });
    el.classList.add('podswietlone');
    setTimeout(() => el.classList.remove('podswietlone'), 1600);
  }

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
  const nieobjete = bilans.reduce((s, b) => s + b.nieobjete, 0);

  return (
    <>
      <div className="okruszki bez-druku">
        <button onClick={() => idz('/spolki')}>Spółki</button>
        <Ikona nazwa="strzalkaPrawo" rozmiar={13} />
        <span>{spolka.nazwa}</span>
      </div>

      <div className="naglowek-strony">
        <div style={{ minWidth: 0 }}>
          <div className="rzad" style={{ gap: 'var(--od-12)', flexWrap: 'wrap' }}>
            <h1 className="tytul-ekranu">{spolka.nazwa}</h1>
            <StatusSpolki status={spolka.status} />
            {wstecz && (
              <span className="pigulka-archiwalna">
                <Ikona nazwa="zegar" rozmiar={13} />
                Stan na {fmt.dataCzas(data)}
                <button className="btn btn-maly" onClick={() => ustawPozycje('dzis')} style={{ marginLeft: 4 }}>
                  Wróć do dziś
                </button>
              </span>
            )}
          </div>
          <div className="naglowek-strony-kontekst">
            Rejestr prowadzi {spolka.organ_prowadzacy || 'Kancelaria Notarialna Łukasz Kozon'} —
            art. 300³¹ § 1 KSH
          </div>
        </div>
        <div className="naglowek-strony-akcje">
          <button className="btn" onClick={() => idz(`/spolki/${spolkaId}/wydruk/raport?data=${data}`)}>
            <Ikona nazwa="dokument" rozmiar={16} /> Raport
          </button>
          <button className="btn" onClick={() => idz(`/spolki/${spolkaId}/wydruk/informacja?data=${data}`)}>
            Informacja z rejestru
          </button>
          {/* Tryb archiwalny (2.5): przyciski akcji ZNIKAJĄ Z DOM, nie disabled —
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
            <button className="btn btn-glowny" onClick={() => idz(`/spolki/${spolkaId}/zdarzenie`)}>
              <Ikona nazwa="plus" rozmiar={16} /> Nowe zdarzenie
            </button>
          )}
        </div>
      </div>

      <div className={`siatka-tresc ${wstecz ? 'archiwalny' : ''}`}>
        <div style={{ minWidth: 0 }}>
          {dane.niezgodnosci && dane.niezgodnosci.length > 0 && (
            <Komunikat odmiana="blad" tytul="Bilans akcji się nie zgadza" lista={dane.niezgodnosci} />
          )}
          {przeliczanie && (
            <Komunikat
              odmiana={przeliczanie.ok ? 'rejestr' : 'blad'}
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
                'wyemitowanych (art. 300(31) § 2 KSH).'
              }
            />
          )}

          <Karta scisla tytul="Oś akcji">
            <div style={{ padding: 'var(--od-16) var(--od-24)' }}>
              {os.ladowanie ? (
                <Spinner />
              ) : os.dane ? (
                <OsAkcji
                  os={os.dane}
                  pozycja={pozycja}
                  ustawPozycje={ustawPozycje}
                  naKlikniecieAkcjonariusza={naKlikniecieAkcjonariusza}
                />
              ) : (
                <div className="os-akcji-pusto">Nie udało się wczytać osi akcji.</div>
              )}
            </div>
          </Karta>

          <Karta
            scisla
            tytul={`Akcjonariat na ${fmt.dataCzas(data)}`}
            akcje={
              <div className="rzad bez-druku" role="group" aria-label="Widok tabeli akcjonariatu">
                <button
                  className={`btn btn-maly ${!szczegolowy ? 'btn-glowny' : ''}`}
                  onClick={() => ustawSzczegolowy(false)}
                  title="Jeden wiersz na akcjonariusza"
                >
                  Uproszczony
                </button>
                <button
                  className={`btn btn-maly ${szczegolowy ? 'btn-glowny' : ''}`}
                  onClick={() => ustawSzczegolowy(true)}
                  title="Jeden wiersz na przedział numeryczny — widać obciążenia i współwłasność co do numeru"
                >
                  Szczegółowy
                </button>
              </div>
            }
          >
            <TabelaAkcjonariatu
              akcjonariusze={szczegolowy ? rozbijNaSzczegoly(akcjonariusze) : akcjonariusze}
              razem={dane.razem_akcji}
            />
          </Karta>

          <Sekcja tytul="Emisje" licznik={emisje.length}>
            {emisje.length === 0 ? (
              <Pusto tytul="Brak emisji" opis="Pierwszym zdarzeniem w rejestrze jest emisja akcji." />
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Seria</th><th>Tytuł</th><th>Numery</th>
                    <th className="do-prawej">Wyemitowane</th>
                    <th className="do-prawej">Nieobjęte</th>
                    <th className="do-prawej">Umorzone</th>
                    <th className="do-prawej">Cena emisyjna</th>
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
                        <td className="kol-dane">{e.zakres}</td>
                        <td className="do-prawej">{fmt.liczba(e.ilosc)}</td>
                        <td className="do-prawej">
                          {b.nieobjete ? <span style={{ color: 'var(--mosiadz)' }}>{fmt.liczba(b.nieobjete)}</span> : '—'}
                        </td>
                        <td className="do-prawej">{b.umorzone ? fmt.liczba(b.umorzone) : '—'}</td>
                        <td className="do-prawej">{fmt.zlote(e.cena_emisyjna_grosze)}</td>
                        <td className="wyciszony">{fmt.data(e.data_emisji)}</td>
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
              <table className="tabela">
                <thead>
                  <tr><th>Rodzaj</th><th>Zakres</th><th>Tytuł</th><th>Treść</th><th>Od</th></tr>
                </thead>
                <tbody>
                  {uprawnienia.map((u2) => (
                    <tr key={u2.klucz}>
                      <td>{u2.rodzaj}</td>
                      <td>{u2.osoba ? u2.osoba.oznaczenie : u2.seria || 'cała spółka'}</td>
                      <td>{u2.tytul || '—'}</td>
                      <td className="zawijaj">{u2.tresc || '—'}</td>
                      <td className="wyciszony">{fmt.data(u2.data_ustanowienia)}</td>
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
              <table className="tabela">
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
                      <td className="kol-dane">{o.numery}</td>
                      <td>{o.uprawniony ? o.uprawniony.oznaczenie : '—'}</td>
                      <td>{o.prawo_glosu ? 'tak' : 'nie'}</td>
                      <td>{o.blokuje_rozporzadzanie ? 'tak' : 'nie'}</td>
                      <td className="wyciszony">{fmt.data(o.data_od)}</td>
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
              <table className="tabela">
                <thead>
                  <tr><th>Zakres</th><th>Numery</th><th>Zgoda spółki</th><th>Prawo pierwszeństwa</th><th>Opis</th></tr>
                </thead>
                <tbody>
                  {ograniczenia.map((o) => (
                    <tr key={o.klucz}>
                      <td>{o.seria || o.zakres}</td>
                      <td className="kol-dane">{o.numery || '—'}</td>
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
                <button className="btn btn-maly" onClick={przelicz} title="Odbudowa stanu ze zdarzeń">
                  Przelicz stan
                </button>
              )
            }
          >
            <div style={{ padding: '20px 24px 8px' }}>
              {zdarzenia.length === 0 ? (
                <Pusto tytul="Brak zdarzeń" opis="Rejestr jeszcze się nie zaczął." />
              ) : (
                <div className="zdarzenia-czas">
                  {zdarzenia.map((z) => (
                    <div
                      key={z.id}
                      id={`zdarzenie-${z.id}`}
                      className={`zdarzenie-poz ${z.typ === 'sprostowanie' || z.sprostowane_przez_id ? 'sprostowane' : ''}`}
                    >
                      <div className="rzad-rozdzielony">
                        <div className="zdarzenie-data">
                          {fmt.data(z.data_zdarzenia)} · zdarzenie #{z.id}
                        </div>
                        {!wstecz && z.typ !== 'sprostowanie' && !z.sprostowane_przez_id && (
                          <button className="btn btn-maly bez-druku" onClick={() => ustawSprostowanie(z)}>
                            Sprostuj
                          </button>
                        )}
                      </div>
                      <div className="zdarzenie-tresc">{z.podsumowanie || `Zdarzenie typu „${z.typ}”.`}</div>
                      {z.typ === 'sprostowanie' && z.zdarzenie_prostowane_id != null && (
                        <button
                          className="btn-tekstowy bez-druku"
                          onClick={() => skoczDoZdarzenia(z.zdarzenie_prostowane_id)}
                        >
                          → zobacz zdarzenie prostowane #{z.zdarzenie_prostowane_id}
                        </button>
                      )}
                      {z.sprostowane_przez_id != null && (
                        <button
                          className="btn-tekstowy bez-druku"
                          onClick={() => skoczDoZdarzenia(z.sprostowane_przez_id)}
                        >
                          Sprostowane zdarzeniem #{z.sprostowane_przez_id} →
                        </button>
                      )}
                      <div className="zdarzenie-meta">
                        wpisano {fmt.dataCzas(z.data_wpisu)} · {z.autor} · skrót {z.hash_skrocony}…
                      </div>
                    </div>
                  ))}
                  {dane.liczba_zdarzen > zdarzenia.length && (
                    <div className="podstawa-prawna">
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
        </div>

        <MetrykaBoczna spolka={spolka} dane={dane} spolkaId={spolkaId} odswiez={odswiez} />
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
window.TabelaAkcjonariatu = TabelaAkcjonariatu;

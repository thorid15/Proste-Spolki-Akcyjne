/* kreator.js — kreator zdarzenia, 4 kroki, ten sam schemat dla każdego typu.

   Zasady z sekcji 9 specyfikacji: jedna kolumna, duże pola, „Dalej” zawsze
   w tym samym miejscu, brak modali w modalach, każdy krok da się cofnąć bez
   utraty danych, Esc nie zamyka kreatora bez pytania.

   Reguła domenowa nr 4: użytkownik NIGDY nie wpisuje numerów akcji w ścieżce
   podstawowej — podaje wyłącznie ilość, a aplikacja pokazuje wyliczony zakres
   do potwierdzenia. Ręczne wskazanie numerów jest schowane pod przełącznikiem. */

const KROKI_ZDARZENIA = ['Co się stało', 'Podstawa', 'Co się zmienia', 'Weryfikacja i podgląd'];

/** Jedna pozycja: osoba + ilość (+ opcjonalnie ręczny zakres numerów). */
function PozycjaKreatora({
  pozycja, ustawPozycje, usun, mozna_usunac, etykietaOsoby, kluczOsoby, dostepne, wyklucz,
}) {
  const [reczne, ustawReczne] = useState(Boolean(pozycja.zakresy_tekst));

  return (
    <div className="pozycja">
      <Pole etykieta={etykietaOsoby} wymagane>
        <WyborOsoby
          wartosc={pozycja[kluczOsoby]}
          wyklucz={wyklucz}
          przyZmianie={(id) => ustawPozycje({ ...pozycja, [kluczOsoby]: id })}
        />
      </Pole>

      <Pole etykieta="Liczba akcji" wymagane>
        <input
          type="number"
          min="1"
          value={pozycja.ilosc ?? ''}
          onChange={(z) => ustawPozycje({ ...pozycja, ilosc: z.target.value })}
        />
      </Pole>

      {mozna_usunac ? (
        <button className="btn btn-sm btn-danger" onClick={usun} style={{ marginBottom: 16 }}>
          Usuń
        </button>
      ) : (
        <span />
      )}

      <div style={{ gridColumn: '1 / -1', marginTop: -6 }}>
        {!reczne ? (
          <button
            className="btn btn-sm"
            onClick={() => ustawReczne(true)}
            title="Ścieżka wyjątkowa — np. przeniesienie konkretnych akcji obciążonych"
          >
            Wskaż konkretne numery akcji
          </button>
        ) : (
          <Pole
            etykieta="Numery akcji (ścieżka wyjątkowa)"
            podpowiedz={
              'Zapis w postaci „1-100, 150-160, 200”. Używaj tylko wtedy, gdy przenoszone ' +
              'są konkretne akcje — np. obciążone zastawem. ' +
              (dostepne ? `Dostępne: ${dostepne}` : '')
            }
          >
            <div className="row-g">
              <input
                type="text"
                className="mono"
                value={pozycja.zakresy_tekst || ''}
                onChange={(z) => ustawPozycje({ ...pozycja, zakresy_tekst: z.target.value })}
                placeholder="1-100"
              />
              <button
                className="btn btn-sm"
                onClick={() => {
                  ustawReczne(false);
                  ustawPozycje({ ...pozycja, zakresy_tekst: '' });
                }}
              >
                Wróć do przydziału automatycznego
              </button>
            </div>
          </Pole>
        )}
      </div>
    </div>
  );
}

/** Zamienia zapis „1-100, 150-160” na zakresy dla API. */
function parsujZakresy(tekst) {
  const czesci = String(tekst || '').split(',').map((c) => c.trim()).filter(Boolean);
  return czesci.map((czesc) => {
    const m = czesc.match(/^(\d+)\s*(?:[-–—]\s*(\d+))?$/);
    if (!m) throw new Error(`Nie rozumiem zapisu numerów: „${czesc}”. Poprawny format: „1-100, 150-160”.`);
    const od = Number(m[1]);
    return { nr_od: od, nr_do: m[2] === undefined ? od : Number(m[2]) };
  });
}

function przygotujPozycje(pozycje) {
  return pozycje.map((p) => {
    const wynik = { ...p };
    delete wynik.zakresy_tekst;
    if (p.zakresy_tekst && p.zakresy_tekst.trim()) {
      wynik.zakresy = parsujZakresy(p.zakresy_tekst);
      if (!wynik.ilosc) {
        wynik.ilosc = wynik.zakresy.reduce((s, z) => s + (z.nr_do - z.nr_od + 1), 0);
      }
    }
    if (wynik.ilosc !== undefined && wynik.ilosc !== null && wynik.ilosc !== '') {
      wynik.ilosc = Number(wynik.ilosc);
    }
    return wynik;
  });
}

/** Wybór emisji + podsumowanie tego, co w niej zostało. */
function WyborEmisji({ emisje, bilans, wartosc, przyZmianie, tylkoZNieobjetymi }) {
  const lista = emisje.filter((e) => {
    if (!tylkoZNieobjetymi) return true;
    const b = bilans.find((x) => x.emisja_klucz === e.klucz);
    return b && b.nieobjete > 0;
  });

  if (lista.length === 0) {
    return (
      <Komunikat
        odmiana="uwaga"
        tresc={
          tylkoZNieobjetymi
            ? 'Żadna emisja nie ma akcji czekających na objęcie.'
            : 'W rejestrze nie ma jeszcze żadnej emisji. Zacznij od zdarzenia „Emisja akcji”.'
        }
      />
    );
  }

  const wybrana = lista.find((e) => e.klucz === Number(wartosc));
  const b = wybrana && bilans.find((x) => x.emisja_klucz === wybrana.klucz);

  return (
    <Pole etykieta="Seria akcji" wymagane>
      <select value={wartosc || ''} onChange={(z) => przyZmianie(Number(z.target.value))}>
        <option value="">— wybierz serię —</option>
        {lista.map((e) => (
          <option key={e.klucz} value={e.klucz}>
            Seria {e.seria}
            {e.tytul ? ` — ${e.tytul}` : ''} ({fmt.liczba(e.ilosc)} akcji, numery {e.zakres})
          </option>
        ))}
      </select>
      {b && (
        <div className="podpowiedz">
          W obrocie: {fmt.liczba(b.w_obrocie)} · przypisane akcjonariuszom: {fmt.liczba(b.przypisane)}
          {b.nieobjete > 0 ? ` · nieobjęte: ${fmt.liczba(b.nieobjete)} (${b.nieobjete_zakresy.map((z) => (z.nr_od === z.nr_do ? z.nr_od : `${z.nr_od}–${z.nr_do}`)).join(', ')})` : ''}
          {b.umorzone > 0 ? ` · umorzone: ${fmt.liczba(b.umorzone)}` : ''}
        </div>
      )}
    </Pole>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 3 — formularze per typ
   ───────────────────────────────────────────────────── */

function KrokEmisja({ dane, ustawDane }) {
  const pole = (k) => ({
    value: dane[k] ?? '',
    onChange: (z) => ustawDane({ ...dane, [k]: z.target.value }),
  });
  return (
    <>
      <div className="siatka-2">
        <Pole etykieta="Oznaczenie serii" wymagane podpowiedz="Musi być niepowtarzalne w tej spółce.">
          <input type="text" {...pole('seria')} placeholder="A" />
        </Pole>
        <Pole etykieta="Liczba akcji" wymagane>
          <input type="number" min="1" {...pole('ilosc')} />
        </Pole>
      </div>
      <div className="siatka-2">
        <Pole
          etykieta="Numer pierwszej akcji"
          podpowiedz="Domyślnie 1. Numeracja biegnie osobno w każdej serii."
        >
          <input type="number" min="1" {...pole('nr_pierwszy')} placeholder="1" />
        </Pole>
        <Pole etykieta="Cena emisyjna jednej akcji (zł)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={dane.cena_zl ?? ''}
            onChange={(z) => ustawDane({ ...dane, cena_zl: z.target.value })}
          />
        </Pole>
      </div>
      <Pole etykieta="Tytuł emisji"><input type="text" {...pole('tytul')} placeholder="Emisja założycielska" /></Pole>
      <Pole etykieta="Podstawa prawna emisji" podpowiedz="Np. umowa spółki, uchwała walnego zgromadzenia z dnia…">
        <input type="text" {...pole('podstawa_prawna')} />
      </Pole>
      <Pole etykieta="Opis"><textarea {...pole('opis')} /></Pole>

      <Komunikat
        odmiana="info"
        tresc={
          'Emisja tworzy pulę akcji nieobjętych. Przypisanie akcji akcjonariuszom to osobne ' +
          'zdarzenie „Objęcie akcji” — kokpit przypomni o nim od razu po zapisaniu emisji.'
        }
      />
    </>
  );
}

function KrokObjecie({ dane, ustawDane, spolka }) {
  const pozycje = dane.pozycje || [{}];
  const ustawPozycje = (p) => ustawDane({ ...dane, pozycje: p });
  const b = spolka.bilans.find((x) => x.emisja_klucz === Number(dane.emisja_zdarzenie_id));

  return (
    <>
      <WyborEmisji
        emisje={spolka.emisje}
        bilans={spolka.bilans}
        wartosc={dane.emisja_zdarzenie_id}
        przyZmianie={(k) => ustawDane({ ...dane, emisja_zdarzenie_id: k })}
        tylkoZNieobjetymi
      />

      {dane.emisja_zdarzenie_id && (
        <>
          <div className="fl" style={{ marginTop: 22 }}>Kto obejmuje akcje</div>
          {pozycje.map((p, i) => (
            <PozycjaKreatora
              key={i}
              pozycja={p}
              kluczOsoby="osoba_id"
              etykietaOsoby="Obejmujący"
              dostepne={b && b.nieobjete_zakresy.map((z) => (z.nr_od === z.nr_do ? z.nr_od : `${z.nr_od}–${z.nr_do}`)).join(', ')}
              wyklucz={pozycje.filter((_, j) => j !== i).map((x) => x.osoba_id).filter(Boolean)}
              ustawPozycje={(nowa) => ustawPozycje(pozycje.map((x, j) => (j === i ? nowa : x)))}
              usun={() => ustawPozycje(pozycje.filter((_, j) => j !== i))}
              mozna_usunac={pozycje.length > 1}
            />
          ))}
          <button className="btn btn-sm odstep-g" onClick={() => ustawPozycje([...pozycje, {}])}>
            + Kolejny obejmujący
          </button>
        </>
      )}
    </>
  );
}

function KrokPrzeniesienie({ dane, ustawDane, spolka }) {
  const pozycje = dane.pozycje || [{}];
  const ustawPozycje = (p) => ustawDane({ ...dane, pozycje: p });

  // Zbywcą może być wyłącznie ktoś, kto ma akcje w wybranej serii na dzień zdarzenia.
  const wSerii = spolka.akcjonariusze.filter(
    (a) => a.emisja_klucz === Number(dane.emisja_zdarzenie_id)
  );
  const zbywca = wSerii.find((a) => a.osoba_id === Number(dane.zbywca_osoba_id));

  return (
    <>
      <WyborEmisji
        emisje={spolka.emisje}
        bilans={spolka.bilans}
        wartosc={dane.emisja_zdarzenie_id}
        przyZmianie={(k) => ustawDane({ ...dane, emisja_zdarzenie_id: k, zbywca_osoba_id: null })}
      />

      {dane.emisja_zdarzenie_id && (
        <>
          <Pole etykieta="Zbywca" wymagane>
            {wSerii.length === 0 ? (
              <Komunikat odmiana="uwaga" tresc="W tej serii nikt nie ma jeszcze akcji." />
            ) : (
              <select
                value={dane.zbywca_osoba_id || ''}
                onChange={(z) => ustawDane({ ...dane, zbywca_osoba_id: Number(z.target.value) })}
              >
                <option value="">— wybierz akcjonariusza —</option>
                {wSerii.map((a) => (
                  <option key={a.osoba_id} value={a.osoba_id}>
                    {a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`} — {fmt.liczba(a.ilosc)} akcji
                    (numery {a.numery})
                  </option>
                ))}
              </select>
            )}
          </Pole>

          {zbywca && (
            <Komunikat
              odmiana="info"
              tresc={`Zbywca posiada ${fmt.AKCJE(zbywca.ilosc)} serii ${zbywca.seria}, numery ${zbywca.numery}.`}
            />
          )}

          <Pole etykieta="Tytuł przejścia akcji">
            <select
              value={dane.tytul_prawny || 'sprzedaż'}
              onChange={(z) => ustawDane({ ...dane, tytul_prawny: z.target.value })}
            >
              <option value="sprzedaż">sprzedaż</option>
              <option value="darowizna">darowizna</option>
              <option value="dziedziczenie">dziedziczenie</option>
              <option value="wniesienie aportem">wniesienie aportem</option>
              <option value="inne przejście">inne przejście</option>
            </select>
          </Pole>

          <div className="fl" style={{ marginTop: 22 }}>Kto nabywa akcje</div>
          {pozycje.map((p, i) => (
            <PozycjaKreatora
              key={i}
              pozycja={p}
              kluczOsoby="nabywca_osoba_id"
              etykietaOsoby="Nabywca"
              dostepne={zbywca && zbywca.numery}
              wyklucz={[
                Number(dane.zbywca_osoba_id),
                ...pozycje.filter((_, j) => j !== i).map((x) => x.nabywca_osoba_id),
              ].filter(Boolean)}
              ustawPozycje={(nowa) => ustawPozycje(pozycje.map((x, j) => (j === i ? nowa : x)))}
              usun={() => ustawPozycje(pozycje.filter((_, j) => j !== i))}
              mozna_usunac={pozycje.length > 1}
            />
          ))}
          <button className="btn btn-sm odstep-g" onClick={() => ustawPozycje([...pozycje, {}])}>
            + Kolejny nabywca
          </button>

          <div className="rozdzielacz" />
          <label className="chk">
            <input
              type="checkbox"
              checked={Boolean(dane.zgoda_spolki)}
              onChange={(z) => ustawDane({ ...dane, zgoda_spolki: z.target.checked })}
            />
            <span className="chk-tresc">
              Uzyskano zgodę spółki na rozporządzenie akcjami
              <div className="podstawa-prawna">Wymagane, gdy w rejestrze jest takie ograniczenie — art. 300(34) § 6 KSH.</div>
            </span>
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={Boolean(dane.pierwszenstwo_wyczerpane)}
              onChange={(z) => ustawDane({ ...dane, pierwszenstwo_wyczerpane: z.target.checked })}
            />
            <span className="chk-tresc">Prawo pierwszeństwa nabycia akcji zostało wyczerpane</span>
          </label>
        </>
      )}
    </>
  );
}

function KrokUmorzenie({ dane, ustawDane, spolka }) {
  const pozycje = dane.pozycje || [{}];
  const ustawPozycje = (p) => ustawDane({ ...dane, pozycje: p });
  const wSerii = spolka.akcjonariusze.filter(
    (a) => a.emisja_klucz === Number(dane.emisja_zdarzenie_id)
  );

  return (
    <>
      <WyborEmisji
        emisje={spolka.emisje}
        bilans={spolka.bilans}
        wartosc={dane.emisja_zdarzenie_id}
        przyZmianie={(k) => ustawDane({ ...dane, emisja_zdarzenie_id: k, pozycje: [{}] })}
      />

      {dane.emisja_zdarzenie_id && (
        <>
          <Pole etykieta="Tryb umorzenia">
            <select
              value={dane.tryb || 'dobrowolne'}
              onChange={(z) => ustawDane({ ...dane, tryb: z.target.value })}
            >
              <option value="dobrowolne">dobrowolne (za zgodą akcjonariusza)</option>
              <option value="przymusowe">przymusowe</option>
              <option value="automatyczne">automatyczne</option>
            </select>
          </Pole>

          <div className="fl" style={{ marginTop: 22 }}>Czyje akcje są umarzane</div>
          {pozycje.map((p, i) => (
            <div className="pozycja" key={i}>
              <Pole etykieta="Akcjonariusz" wymagane>
                <select
                  value={p.osoba_id ?? ''}
                  onChange={(z) =>
                    ustawPozycje(
                      pozycje.map((x, j) =>
                        j === i
                          ? { ...x, osoba_id: z.target.value === '' ? null : Number(z.target.value) }
                          : x
                      )
                    )
                  }
                >
                  <option value="">— wybierz —</option>
                  {wSerii.map((a) => (
                    <option key={a.osoba_id} value={a.osoba_id}>
                      {a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`} — {fmt.liczba(a.ilosc)} akcji
                    </option>
                  ))}
                </select>
              </Pole>
              <Pole etykieta="Liczba akcji" wymagane>
                <input
                  type="number"
                  min="1"
                  value={p.ilosc ?? ''}
                  onChange={(z) =>
                    ustawPozycje(pozycje.map((x, j) => (j === i ? { ...x, ilosc: z.target.value } : x)))
                  }
                />
              </Pole>
              {pozycje.length > 1 ? (
                <button
                  className="btn btn-sm btn-danger"
                  style={{ marginBottom: 16 }}
                  onClick={() => ustawPozycje(pozycje.filter((_, j) => j !== i))}
                >
                  Usuń
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <button className="btn btn-sm odstep-g" onClick={() => ustawPozycje([...pozycje, {}])}>
            + Kolejna pozycja
          </button>
        </>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 4 — porównanie przed/po
   ───────────────────────────────────────────────────── */

function TabelaPorownania({ tytul, tabela, odniesienie, wariant }) {
  if (!tabela) return null;
  const klucz = (p) => `${p.osoba_id}|${p.seria}`;
  const mapaOdniesienia = new Map((odniesienie ? odniesienie.pozycje : []).map((p) => [klucz(p), p]));

  return (
    <div>
      <div className="przed-po-tytul">{tytul}</div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Akcjonariusz</th>
            <th>Seria</th>
            <th className="prawo">Akcje</th>
            <th>Numery</th>
          </tr>
        </thead>
        <tbody>
          {tabela.pozycje.map((p) => {
            const inny = mapaOdniesienia.get(klucz(p));
            let klasa = '';
            if (!inny) klasa = wariant === 'po' ? 'nowy' : 'usuwany';
            else if (inny.ilosc !== p.ilosc) klasa = 'zmieniony';
            return (
              <tr key={klucz(p)} className={klasa}>
                <td>{p.oznaczenie}</td>
                <td>{p.seria}</td>
                <td className="prawo">{fmt.liczba(p.ilosc)}</td>
                <td className="numery">{p.numery}</td>
              </tr>
            );
          })}
          {tabela.pozycje.length === 0 && (
            <tr>
              <td colSpan={4} className="przyciemnione">Brak akcjonariuszy.</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={{ fontWeight: 600 }}>Razem</td>
            <td className="prawo" style={{ fontWeight: 600 }}>{fmt.liczba(tabela.razem_akcji)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   KREATOR
   ───────────────────────────────────────────────────── */

function EkranKreatora({ spolkaId }) {
  const [krok, ustawKrok] = useState(0);
  const [typ, ustawTyp] = useState(null);
  const [dataZdarzenia, ustawDateZdarzenia] = useState(fmt.dzisIso());
  const [podstawaOpis, ustawPodstawaOpis] = useState('');
  const [zadajacy, ustawZadajacy] = useState('');
  const [dane, ustawDane] = useState({});
  const [odhaczone, ustawOdhaczone] = useState({});
  const [notatkaWatpliwosci, ustawNotatkeWatpliwosci] = useState('');
  const [podglad, ustawPodglad] = useState(null);
  const [ladowaniePodgladu, ustawLadowaniePodgladu] = useState(false);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [wynik, ustawWynik] = useState(null);
  const [bladLokalny, ustawBladLokalny] = useState(null);

  const meta = useDane('/api/psa/meta');
  const spolka = useDane(`/api/psa/spolki/${spolkaId}?data=${dataZdarzenia}`, [dataZdarzenia]);

  const cokolwiekWpisano = Boolean(typ) || Object.keys(dane).length > 0;

  useEscape(() => {
    if (wynik) return;
    if (!cokolwiekWpisano || window.confirm('Przerwać tworzenie zdarzenia? Wprowadzone dane przepadną.')) {
      idz(`/spolki/${spolkaId}`);
    }
  });

  const definicjaTypu = useMemo(() => {
    if (!meta.dane || !typ) return null;
    return meta.dane.typy_zdarzen.find((t) => t.kod === typ) || null;
  }, [meta.dane, typ]);

  /** Buduje treść żądania dla API z tego, co zebrał kreator. */
  function zbudujDane() {
    const wynikDanych = { ...dane, podstawa_opis: podstawaOpis || null };
    delete wynikDanych.cena_zl;

    if (typ === 'emisja') {
      wynikDanych.ilosc = Number(dane.ilosc);
      wynikDanych.nr_pierwszy = dane.nr_pierwszy ? Number(dane.nr_pierwszy) : 1;
      // Kwoty trzymamy w groszach — reguła domenowa nr 5.
      wynikDanych.cena_emisyjna_grosze =
        dane.cena_zl === '' || dane.cena_zl === undefined
          ? null
          : Math.round(Number(dane.cena_zl) * 100);
    }
    if (dane.pozycje) wynikDanych.pozycje = przygotujPozycje(dane.pozycje);
    return wynikDanych;
  }

  async function wczytajPodglad() {
    ustawLadowaniePodgladu(true);
    ustawBladLokalny(null);
    try {
      const odpowiedz = await API.post(`/api/psa/spolki/${spolkaId}/zdarzenia/podglad`, {
        typ,
        data_zdarzenia: dataZdarzenia,
        dane: zbudujDane(),
      });
      ustawPodglad(odpowiedz);
    } catch (e) {
      ustawBladLokalny(e.message);
      ustawPodglad(null);
    } finally {
      ustawLadowaniePodgladu(false);
    }
  }

  async function dokonajWpisu() {
    ustawZapisywanie(true);
    ustawBladLokalny(null);
    try {
      const odpowiedz = await API.post(`/api/psa/spolki/${spolkaId}/zdarzenia`, {
        typ,
        data_zdarzenia: dataZdarzenia,
        dane: zbudujDane(),
        uzasadnienie: notatkaWatpliwosci || null,
      });
      ustawWynik(odpowiedz);
    } catch (e) {
      ustawBladLokalny(null);
      ustawPodglad((p) => ({ ...(p || {}), dopuszczalne: false, bledy: e.bledy, ostrzezenia: e.ostrzezenia }));
    } finally {
      ustawZapisywanie(false);
    }
  }

  function idzDoKroku(nowy) {
    ustawBladLokalny(null);
    if (nowy === 3) {
      try {
        zbudujDane();
      } catch (e) {
        ustawBladLokalny(e.message);
        return;
      }
      ustawKrok(3);
      wczytajPodglad();
      return;
    }
    ustawKrok(nowy);
  }

  if (meta.ladowanie || spolka.ladowanie) return <Spinner />;
  if (spolka.blad) return <Komunikat odmiana="blad" tresc={spolka.blad.message} />;

  /* ── Ekran po dokonaniu wpisu ─────────────────────────────────────── */
  if (wynik) {
    return (
      <>
        <div className="pasek-gorny">
          <div>
            <div className="tytul-strony">Wpis dokonany</div>
            <div className="podtytul-strony">
              Zdarzenie #{wynik.zdarzenie.id} · wpisano {fmt.dataCzas(wynik.zdarzenie.data_wpisu)} ·
              autor: {wynik.zdarzenie.autor}
            </div>
          </div>
        </div>

        <Karta>
          <Komunikat
            odmiana="ok"
            tytul={`${definicjaTypu.nazwa} — zdarzenie zapisane w rejestrze`}
            tresc={`Skrót zdarzenia w łańcuchu: ${wynik.zdarzenie.hash_skrocony}…`}
          />
          <Komunikat odmiana="uwaga" tytul="Do sprawdzenia:" lista={wynik.ostrzezenia} />

          <Komunikat
            odmiana="info"
            tytul="Co dalej"
            lista={[
              ...(wynik.dokumenty_do_wygenerowania.length
                ? [
                    'Zawiadomienie o wpisie do żądającego i do spółki (art. 300(34) § 7 KSH) — ' +
                      'generowanie i wysyłka wchodzą w sprincie 2.',
                  ]
                : []),
              ...(wynik.odplatne
                ? ['Opłata za wpis do naliczenia — moduł rozliczeń wchodzi w sprincie 4.']
                : ['Wpis wolny od opłat.']),
            ]}
          />

          <div className="kreator-stopka">
            <button className="btn" onClick={() => idz(`/spolki/${spolkaId}`)}>
              Wróć do kokpitu spółki
            </button>
            <div className="kreator-stopka-prawa">
              <button
                className="btn btn-primary"
                onClick={() => {
                  ustawWynik(null);
                  ustawTyp(null);
                  ustawDane({});
                  ustawOdhaczone({});
                  ustawPodglad(null);
                  ustawKrok(0);
                }}
              >
                Kolejne zdarzenie
              </button>
            </div>
          </div>
        </Karta>
      </>
    );
  }

  /* ── Checklista ───────────────────────────────────────────────────── */
  const checklista = definicjaTypu ? definicjaTypu.checklista : [];
  const wymagane = checklista.filter((p) => p.wymagana && !p.watpliwosci);
  const wszystkoOdhaczone = wymagane.every((p) => odhaczone[p.kod]);
  const sawatpliwosci = checklista.some((p) => p.watpliwosci && odhaczone[p.kod]);
  const mozeWpisac =
    podglad && podglad.dopuszczalne && wszystkoOdhaczone && (!sawatpliwosci || notatkaWatpliwosci.trim());

  const mozeDalej =
    krok === 0 ? Boolean(typ)
      : krok === 1 ? Boolean(dataZdarzenia)
        : krok === 2 ? true
          : false;

  return (
    <>
      <div className="okruszki">
        <button onClick={() => idz('/spolki')}>Spółki</button> →{' '}
        <button onClick={() => idz(`/spolki/${spolkaId}`)}>{spolka.dane.spolka.nazwa}</button> → nowe zdarzenie
      </div>

      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Nowe zdarzenie</div>
          <div className="podtytul-strony">
            {definicjaTypu ? definicjaTypu.nazwa : 'Wybierz, co się wydarzyło.'}
          </div>
        </div>
      </div>

      <Kroki kroki={KROKI_ZDARZENIA} biezacy={krok} />
      <Komunikat odmiana="blad" tresc={bladLokalny} />

      <Karta>
        {/* KROK 1 — wybór typu */}
        {krok === 0 && (
          <>
            <div className="card-h">Co się wydarzyło?</div>
            <div className="kafelki">
              {meta.dane.typy_zdarzen
                .filter((t) => meta.dane.typy_w_kreatorze.includes(t.kod))
                .map((t) => (
                  <button
                    key={t.kod}
                    className={`kafelek ${typ === t.kod ? 'wybrany' : ''}`}
                    onClick={() => {
                      ustawTyp(t.kod);
                      ustawDane({});
                      ustawOdhaczone({});
                      ustawPodglad(null);
                    }}
                  >
                    <span className="kafelek-symbol">{t.symbol}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="kafelek-nazwa">{t.opis_zdarzeniem}</span>
                      <span className="kafelek-opis">{t.podpowiedz || t.nazwa}</span>
                    </span>
                  </button>
                ))}
            </div>
            <Komunikat
              odmiana="info"
              tresc={
                'Pozostałe typy zdarzeń — obciążenia, zajęcia egzekucyjne, uprawnienia, ' +
                'ograniczenia, zmiana danych akcjonariusza i sprostowanie — wchodzą w sprincie 2.'
              }
            />
          </>
        )}

        {/* KROK 2 — podstawa */}
        {krok === 1 && (
          <>
            <div className="card-h">Podstawa wpisu</div>
            <Pole
              etykieta="Data zdarzenia"
              wymagane
              podpowiedz="Data z dokumentu — nie mylić z datą wpisu, którą ustawia system co do sekundy."
            >
              <input
                type="date"
                max={fmt.dzisIso()}
                value={dataZdarzenia}
                onChange={(z) => z.target.value && ustawDateZdarzenia(z.target.value)}
              />
            </Pole>

            <Pole
              etykieta="Dokument stanowiący podstawę"
              podpowiedz="Np. „umowa sprzedaży akcji z 12 marca 2026 r., podpisy notarialnie poświadczone”."
            >
              <textarea
                value={podstawaOpis}
                onChange={(z) => ustawPodstawaOpis(z.target.value)}
                style={{ minHeight: 80 }}
              />
            </Pole>

            <Pole etykieta="Żądający wpisu" podpowiedz="Spółka albo inna osoba mająca interes prawny — art. 300(34) § 1 KSH.">
              <input type="text" value={zadajacy} onChange={(z) => ustawZadajacy(z.target.value)} />
            </Pole>

            <Komunikat
              odmiana="info"
              tytul="Wgrywanie plików wchodzi w sprincie 2"
              tresc={
                'Wraz z obiegiem spraw pojawi się tu przeciąganie dokumentów, podgląd PDF ' +
                'i powiązanie sprawy z terminem 7 dni. Na razie opisz podstawę słownie — ' +
                'opis trafi do treści zdarzenia.'
              }
            />
          </>
        )}

        {/* KROK 3 — co się zmienia */}
        {krok === 2 && (
          <>
            <div className="card-h">Co się zmienia</div>
            {typ === 'emisja' && <KrokEmisja dane={dane} ustawDane={ustawDane} />}
            {typ === 'objecie' && <KrokObjecie dane={dane} ustawDane={ustawDane} spolka={spolka.dane} />}
            {typ === 'przeniesienie' && (
              <KrokPrzeniesienie dane={dane} ustawDane={ustawDane} spolka={spolka.dane} />
            )}
            {typ === 'umorzenie' && (
              <KrokUmorzenie dane={dane} ustawDane={ustawDane} spolka={spolka.dane} />
            )}
            {typ !== 'emisja' && (
              <div className="podstawa-prawna odstep-g">
                Numery akcji przydziela aplikacja — podajesz wyłącznie ilość. Wyliczony zakres
                zobaczysz do potwierdzenia w następnym kroku.
              </div>
            )}
          </>
        )}

        {/* KROK 4 — weryfikacja i podgląd */}
        {krok === 3 && (
          <>
            <div className="card-h">Weryfikacja i podgląd</div>

            {ladowaniePodgladu ? (
              <Spinner />
            ) : !podglad ? (
              <Komunikat odmiana="blad" tresc="Nie udało się przygotować podglądu." />
            ) : (
              <>
                <Wyniki bledy={podglad.bledy} ostrzezenia={podglad.ostrzezenia} />

                {podglad.po && (
                  <>
                    <div className="przed-po odstep-g">
                      <TabelaPorownania
                        tytul={`Przed — stan na ${fmt.data(dataZdarzenia)}`}
                        tabela={podglad.przed}
                        odniesienie={podglad.po}
                        wariant="przed"
                      />
                      <TabelaPorownania
                        tytul="Po dokonaniu wpisu"
                        tabela={podglad.po}
                        odniesienie={podglad.przed}
                        wariant="po"
                      />
                    </div>
                    <div className="podstawa-prawna" style={{ marginTop: 10 }}>
                      Zielony — pozycja nowa · oliwkowy — zmieniona liczba akcji · bordowy — pozycja
                      znika z rejestru.
                    </div>
                  </>
                )}

                <div className="rozdzielacz" />

                <div className="fl">Checklista weryfikacji</div>
                <div className="checklista">
                  {checklista.map((p) => (
                    <label key={p.kod} className={`chk ${p.watpliwosci ? 'chk-watpliwosci' : ''}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(odhaczone[p.kod])}
                        onChange={(z) =>
                          ustawOdhaczone((o) => ({ ...o, [p.kod]: z.target.checked }))
                        }
                      />
                      <span className="chk-tresc">
                        {p.tresc}
                        {!p.wymagana && !p.watpliwosci && (
                          <span className="przyciemnione"> (jeśli dotyczy)</span>
                        )}
                        {p.podstawa && <div className="podstawa-prawna">{p.podstawa}</div>}
                      </span>
                    </label>
                  ))}
                </div>

                {sawatpliwosci && (
                  <Pole
                    etykieta="Notatka o uzasadnionych wątpliwościach"
                    wymagane
                    podpowiedz="Wymagana. W sprincie 2 przełącznik skieruje sprawę na ścieżkę pogłębioną."
                  >
                    <textarea
                      value={notatkaWatpliwosci}
                      onChange={(z) => ustawNotatkeWatpliwosci(z.target.value)}
                    />
                  </Pole>
                )}

                {definicjaTypu.wymaga_powiadomienia === true && (
                  <Komunikat
                    odmiana="uwaga"
                    tytul="Wymagane uprzednie powiadomienie"
                    tresc={
                      `Przed wpisem należy powiadomić ${definicjaTypu.kogo_powiadomic || 'zainteresowanego'} ` +
                      'o treści zamierzonego wpisu — chyba że wyraził zgodę (art. 300(34) § 3 KSH). ' +
                      'Generowanie i wysyłka powiadomienia wchodzą w sprincie 2; teraz potwierdzasz to na checkliście.'
                    }
                  />
                )}

                {definicjaTypu.dokumenty && definicjaTypu.dokumenty.length > 0 && (
                  <Komunikat
                    odmiana="info"
                    tytul="Dokumenty do wygenerowania po wpisie"
                    lista={['Zawiadomienie o wpisie — do żądającego i do spółki (sprint 2).']}
                  />
                )}

                {!wszystkoOdhaczone && (
                  <div className="podstawa-prawna">
                    Przycisk „Dokonaj wpisu” pozostaje nieaktywny do czasu odhaczenia całej
                    checklisty weryfikacji.
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="kreator-stopka">
          <button
            className="btn"
            onClick={() => {
              if (krok === 0) {
                if (!cokolwiekWpisano || window.confirm('Przerwać tworzenie zdarzenia?')) {
                  idz(`/spolki/${spolkaId}`);
                }
              } else {
                idzDoKroku(krok - 1);
              }
            }}
          >
            {krok === 0 ? 'Anuluj' : 'Wstecz'}
          </button>

          <div className="kreator-stopka-prawa">
            {krok < 3 ? (
              <button className="btn btn-primary" disabled={!mozeDalej} onClick={() => idzDoKroku(krok + 1)}>
                Dalej
              </button>
            ) : (
              <>
                <button className="btn" onClick={wczytajPodglad} disabled={ladowaniePodgladu}>
                  Przelicz podgląd
                </button>
                <button
                  className="btn btn-primary btn-lg"
                  disabled={!mozeWpisac || zapisywanie}
                  onClick={dokonajWpisu}
                >
                  {zapisywanie ? 'Zapisywanie…' : 'Dokonaj wpisu'}
                </button>
              </>
            )}
          </div>
        </div>
      </Karta>
    </>
  );
}

window.EkranKreatora = EkranKreatora;

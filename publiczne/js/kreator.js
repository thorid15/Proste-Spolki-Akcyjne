/* kreator.js — kreator zdarzenia, 4 kroki, ten sam schemat dla każdego typu.

   Zasady z sekcji 9 specyfikacji: jedna kolumna, duże pola, „Dalej” zawsze
   w tym samym miejscu, brak modali w modalach, każdy krok da się cofnąć bez
   utraty danych, Esc nie zamyka kreatora bez pytania.

   Reguła domenowa nr 4: użytkownik NIGDY nie wpisuje numerów akcji w ścieżce
   podstawowej — podaje wyłącznie ilość, a aplikacja pokazuje wyliczony zakres
   do potwierdzenia. Ręczne wskazanie numerów jest schowane pod przełącznikiem.

   Sprint 2: kreator jest teraz SPRAWA-BOUND. Kroki 1–2 (`EkranNowejSprawy`)
   zakładają sprawę — start licznika 7 dni. Kroki 3–4 (`KreatorSprawy`,
   w sprawy.js) działają na już istniejącej sprawie i są WSPÓLNE ze ścieżką
   wznowienia sprawy z kolejki — stąd formularze krok 3 i tabela przed/po są
   eksportowane do współdzielenia, a nie zamknięte w jednym komponencie ekranu. */

const KROKI_ZDARZENIA = ['Co się stało', 'Podstawa', 'Co się zmienia', 'Weryfikacja i podgląd'];

const NAZWY_GRUP = { akcje: 'Akcje', obciazenia: 'Obciążenia i zajęcia', prawa: 'Prawa i ograniczenia', dane: 'Dane', inne: 'Inne' };

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

/** Zamienia pojedynczą pozycję (nie tablicę `pozycje`) z ewentualnym ręcznym zakresem. */
function przygotujPojedyncza(dane) {
  const wynik = { ...dane };
  delete wynik.zakresy_tekst;
  if (dane.zakresy_tekst && dane.zakresy_tekst.trim()) {
    wynik.zakresy = parsujZakresy(dane.zakresy_tekst);
    if (!wynik.ilosc) wynik.ilosc = wynik.zakresy.reduce((s, z) => s + (z.nr_do - z.nr_od + 1), 0);
  }
  if (wynik.ilosc !== undefined && wynik.ilosc !== null && wynik.ilosc !== '') {
    wynik.ilosc = Number(wynik.ilosc);
  }
  return wynik;
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

/** Wybór aktywnego obciążenia/zajęcia spółki (do wykreślenia albo zmiany prawa głosu). */
function WyborObciazenia({ obciazenia, wartosc, przyZmianie, tylkoTyp }) {
  const lista = tylkoTyp ? obciazenia.filter((o) => o.typ === tylkoTyp) : obciazenia.filter((o) => o.typ !== 'zajecie');
  if (lista.length === 0) {
    return (
      <Komunikat
        odmiana="uwaga"
        tresc={
          tylkoTyp === 'zajecie'
            ? 'Spółka nie ma zarejestrowanych aktywnych zajęć.'
            : 'Spółka nie ma zarejestrowanych aktywnych obciążeń.'
        }
      />
    );
  }
  return (
    <Pole etykieta={tylkoTyp === 'zajecie' ? 'Zajęcie' : 'Obciążenie'} wymagane>
      <select value={wartosc || ''} onChange={(z) => przyZmianie(Number(z.target.value))}>
        <option value="">— wybierz —</option>
        {lista.map((o) => (
          <option key={o.klucz} value={o.klucz}>
            {o.typ === 'zajecie' ? 'zajęcie' : o.typ} — seria {o.seria}, numery {o.numery}
            {o.uprawniony ? ` — ${o.uprawniony.oznaczenie}` : ''}
            {o.akcjonariusz ? ` (akcjonariusz: ${o.akcjonariusz.oznaczenie})` : ''}
          </option>
        ))}
      </select>
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
      <div className="siatka-2">
        <Pole etykieta="Rodzaj akcji" podpowiedz="art. 300(33) § 1 pkt 4 KSH">
          <select value={dane.rodzaj_akcji || 'zwykla'} onChange={(z) => ustawDane({ ...dane, rodzaj_akcji: z.target.value })}>
            <option value="zwykla">zwykła</option>
            <option value="uprzywilejowana">uprzywilejowana</option>
            <option value="zalozycielska">założycielska</option>
            <option value="niema">niema</option>
          </select>
        </Pole>
        <Pole
          etykieta="Data wpisu emisji do KRS"
          podpowiedz="Zostaw puste, jeśli spółka/emisja jeszcze nie ma wpisu do KRS — objęcie akcji będzie zablokowane do czasu uzupełnienia tej daty (art. 300(30) § 2 KSH)."
        >
          <PoleDaty wartosc={dane.data_wpisu_krs || ''} przyZmianie={(v) => ustawDane({ ...dane, data_wpisu_krs: v })} />
        </Pole>
      </div>
      <Pole etykieta="Tytuł emisji"><input type="text" {...pole('tytul')} placeholder="Emisja założycielska" /></Pole>
      <Pole etykieta="Podstawa prawna emisji" podpowiedz="Np. umowa spółki, uchwała walnego zgromadzenia z dnia…">
        <input type="text" {...pole('podstawa_prawna')} />
      </Pole>
      <Pole etykieta="Obowiązki wobec spółki związane z akcją" podpowiedz="art. 300(33) § 1 pkt 11 KSH — opcjonalne.">
        <textarea {...pole('obowiazki_wobec_spolki')} />
      </Pole>
      <Pole etykieta="Opis"><textarea {...pole('opis')} /></Pole>

      <Komunikat
        odmiana="info"
        tresc={
          'Emisja tworzy pulę akcji nieobjętych. Przypisanie akcji akcjonariuszom to osobne ' +
          'zdarzenie „Objęcie akcji” — kokpit przypomni o nim od razu po zapisaniu emisji.'
        }
      />
      {!dane.data_wpisu_krs && (
        <Komunikat
          odmiana="uwaga"
          tresc="Bez daty wpisu do KRS akcje z tej emisji formalnie nie istnieją — objęcie akcji będzie zablokowane (art. 300(30) § 2 KSH, sankcja art. 592 § 3 KSH). Datę można uzupełnić później sprostowaniem tego zdarzenia."
        />
      )}
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

/** Ustanowienie zastawu / użytkowania. */
function KrokObciazenie({ dane, ustawDane, spolka }) {
  const pole = (k) => ({ value: dane[k] ?? '', onChange: (z) => ustawDane({ ...dane, [k]: z.target.value }) });
  return (
    <>
      <WyborEmisji
        emisje={spolka.emisje} bilans={spolka.bilans} wartosc={dane.emisja_zdarzenie_id}
        przyZmianie={(k) => ustawDane({ ...dane, emisja_zdarzenie_id: k })}
      />
      {dane.emisja_zdarzenie_id && (
        <>
          <Pole etykieta="Rodzaj obciążenia">
            <select value={dane.typ_obciazenia || 'zastaw'} onChange={(z) => ustawDane({ ...dane, typ_obciazenia: z.target.value })}>
              <option value="zastaw">zastaw</option>
              <option value="uzytkowanie">użytkowanie</option>
            </select>
          </Pole>
          <Pole etykieta="Akcjonariusz, którego akcje są obciążane" wymagane>
            <WyborOsoby wartosc={dane.akcjonariusz_osoba_id} przyZmianie={(id) => ustawDane({ ...dane, akcjonariusz_osoba_id: id })} />
          </Pole>
          <Pole etykieta="Zastawnik / użytkownik" wymagane>
            <WyborOsoby
              wartosc={dane.osoba_id}
              wyklucz={dane.akcjonariusz_osoba_id ? [Number(dane.akcjonariusz_osoba_id)] : []}
              przyZmianie={(id) => ustawDane({ ...dane, osoba_id: id })}
            />
          </Pole>
          <Pole etykieta="Liczba akcji" wymagane>
            <input type="number" min="1" {...pole('ilosc')} />
          </Pole>
          <label className="chk">
            <input type="checkbox" checked={dane.blokuje_rozporzadzanie !== false} onChange={(z) => ustawDane({ ...dane, blokuje_rozporzadzanie: z.target.checked })} />
            <span className="chk-tresc">Obciążenie blokuje rozporządzanie akcjami (typowe dla zastawu)</span>
          </label>
          <label className="chk">
            <input type="checkbox" checked={Boolean(dane.prawo_glosu)} onChange={(z) => ustawDane({ ...dane, prawo_glosu: z.target.checked })} />
            <span className="chk-tresc">Zastawnikowi / użytkownikowi przysługuje od razu prawo głosu</span>
          </label>
          <Pole etykieta="Opis"><textarea {...pole('opis')} /></Pole>
        </>
      )}
    </>
  );
}

function KrokWykreslenieObciazenia({ dane, ustawDane, spolka }) {
  return (
    <WyborObciazenia
      obciazenia={spolka.obciazenia}
      wartosc={dane.obciazenie_zdarzenie_id}
      przyZmianie={(k) => ustawDane({ ...dane, obciazenie_zdarzenie_id: k })}
    />
  );
}

function KrokPrawoGlosuZastawnika({ dane, ustawDane, spolka }) {
  return (
    <>
      <WyborObciazenia
        obciazenia={spolka.obciazenia}
        wartosc={dane.obciazenie_zdarzenie_id}
        przyZmianie={(k) => ustawDane({ ...dane, obciazenie_zdarzenie_id: k })}
      />
      <Pole etykieta="Prawo głosu">
        <select
          value={dane.prawo_glosu ? '1' : '0'}
          onChange={(z) => ustawDane({ ...dane, prawo_glosu: z.target.value === '1' })}
        >
          <option value="1">przyznane</option>
          <option value="0">cofnięte</option>
        </select>
      </Pole>
    </>
  );
}

function KrokZajecie({ dane, ustawDane, spolka }) {
  const [reczne, ustawReczne] = useState(false);
  return (
    <>
      <WyborEmisji
        emisje={spolka.emisje} bilans={spolka.bilans} wartosc={dane.emisja_zdarzenie_id}
        przyZmianie={(k) => ustawDane({ ...dane, emisja_zdarzenie_id: k })}
      />
      {dane.emisja_zdarzenie_id && (
        <>
          <Pole etykieta="Organ egzekucyjny" podpowiedz="Komornik sądowy albo administracyjny organ egzekucyjny — z kartoteki.">
            <WyborOsoby wartosc={dane.osoba_id} przyZmianie={(id) => ustawDane({ ...dane, osoba_id: id })} />
          </Pole>
          <Pole etykieta="Akcjonariusz (dłużnik)" podpowiedz="Jeśli znany — numery dobiorą się automatycznie z jego pakietu.">
            <WyborOsoby wartosc={dane.akcjonariusz_osoba_id} przyZmianie={(id) => ustawDane({ ...dane, akcjonariusz_osoba_id: id, zakresy_tekst: '' })} />
          </Pole>
          {dane.akcjonariusz_osoba_id ? (
            <Pole etykieta="Liczba akcji objętych zajęciem" wymagane>
              <input type="number" min="1" value={dane.ilosc ?? ''} onChange={(z) => ustawDane({ ...dane, ilosc: z.target.value })} />
            </Pole>
          ) : (
            <Pole etykieta="Numery zajmowanych akcji" wymagane podpowiedz='Zapis w postaci „1-100, 150-160”.'>
              <input
                type="text" className="mono" value={dane.zakresy_tekst || ''}
                onChange={(z) => ustawDane({ ...dane, zakresy_tekst: z.target.value })}
                placeholder="1-100"
              />
            </Pole>
          )}
          <Pole etykieta="Opis"><textarea value={dane.opis ?? ''} onChange={(z) => ustawDane({ ...dane, opis: z.target.value })} /></Pole>
          <Komunikat odmiana="info" tresc="Zajęcie jest czynnością z urzędu — wolne od opłat, bez uprzedniego powiadomienia." />
        </>
      )}
    </>
  );
}

function KrokWykreslenieZajecia({ dane, ustawDane, spolka }) {
  return (
    <WyborObciazenia
      obciazenia={spolka.obciazenia} tylkoTyp="zajecie"
      wartosc={dane.obciazenie_zdarzenie_id}
      przyZmianie={(k) => ustawDane({ ...dane, obciazenie_zdarzenie_id: k })}
    />
  );
}

function KrokUprawnienie({ dane, ustawDane, spolka }) {
  const pole = (k) => ({ value: dane[k] ?? '', onChange: (z) => ustawDane({ ...dane, [k]: z.target.value }) });
  const [wykresl, ustawWykresl] = useState(false);

  if (wykresl || (spolka.uprawnienia.length > 0 && dane.wykresla_zdarzenie_id)) {
    return (
      <>
        <Pole etykieta="Wykreślane uprawnienie" wymagane>
          <select value={dane.wykresla_zdarzenie_id || ''} onChange={(z) => ustawDane({ ...dane, wykresla_zdarzenie_id: Number(z.target.value) })}>
            <option value="">— wybierz —</option>
            {spolka.uprawnienia.map((u) => (
              <option key={u.klucz} value={u.klucz}>{u.tytul || u.rodzaj} — {u.osoba ? u.osoba.oznaczenie : (u.seria || 'cała spółka')}</option>
            ))}
          </select>
        </Pole>
        <button className="btn btn-sm" onClick={() => { ustawWykresl(false); ustawDane({ ...dane, wykresla_zdarzenie_id: null }); }}>
          Zamiast tego ustanów nowe uprawnienie
        </button>
      </>
    );
  }

  return (
    <>
      {spolka.uprawnienia.length > 0 && (
        <button className="btn btn-sm" style={{ marginBottom: 16 }} onClick={() => ustawWykresl(true)}>
          Zamiast tego wykreśl istniejące uprawnienie
        </button>
      )}
      <div className="siatka-2">
        <Pole etykieta="Rodzaj">
          <select value={dane.rodzaj || 'uprawnienie'} onChange={(z) => ustawDane({ ...dane, rodzaj: z.target.value })}>
            <option value="uprawnienie">uprawnienie</option>
            <option value="przywilej">przywilej</option>
            <option value="obowiazek">obowiązek</option>
          </select>
        </Pole>
        <Pole etykieta="Zakres">
          <select value={dane.zakres || 'spolka'} onChange={(z) => ustawDane({ ...dane, zakres: z.target.value, osoba_id: null, emisja_zdarzenie_id: null })}>
            <option value="spolka">cała spółka</option>
            <option value="emisja">seria akcji</option>
            <option value="akcjonariusz">konkretny akcjonariusz</option>
          </select>
        </Pole>
      </div>
      {dane.zakres === 'emisja' && (
        <WyborEmisji emisje={spolka.emisje} bilans={spolka.bilans} wartosc={dane.emisja_zdarzenie_id} przyZmianie={(k) => ustawDane({ ...dane, emisja_zdarzenie_id: k })} />
      )}
      {dane.zakres === 'akcjonariusz' && (
        <Pole etykieta="Akcjonariusz" wymagane>
          <WyborOsoby wartosc={dane.osoba_id} przyZmianie={(id) => ustawDane({ ...dane, osoba_id: id })} />
        </Pole>
      )}
      <Pole etykieta="Tytuł"><input type="text" {...pole('tytul')} /></Pole>
      <Pole etykieta="Treść" podpowiedz="Podaj tytuł albo treść.">
        <textarea {...pole('tresc')} />
      </Pole>
    </>
  );
}

function KrokOgraniczenie({ dane, ustawDane, spolka }) {
  const pole = (k) => ({ value: dane[k] ?? '', onChange: (z) => ustawDane({ ...dane, [k]: z.target.value }) });
  const [wykresl, ustawWykresl] = useState(false);

  if (wykresl) {
    return (
      <>
        <Pole etykieta="Wykreślane ograniczenie" wymagane>
          <select value={dane.wykresla_zdarzenie_id || ''} onChange={(z) => ustawDane({ ...dane, wykresla_zdarzenie_id: Number(z.target.value) })}>
            <option value="">— wybierz —</option>
            {spolka.ograniczenia.map((o) => (
              <option key={o.klucz} value={o.klucz}>{o.opis || o.zakres} — {o.seria || 'cała spółka'}</option>
            ))}
          </select>
        </Pole>
        <button className="btn btn-sm" onClick={() => { ustawWykresl(false); ustawDane({ ...dane, wykresla_zdarzenie_id: null }); }}>
          Zamiast tego ustanów nowe ograniczenie
        </button>
      </>
    );
  }

  return (
    <>
      {spolka.ograniczenia.length > 0 && (
        <button className="btn btn-sm" style={{ marginBottom: 16 }} onClick={() => ustawWykresl(true)}>
          Zamiast tego wykreśl istniejące ograniczenie
        </button>
      )}
      <Pole etykieta="Zakres">
        <select value={dane.zakres || 'wszystkie'} onChange={(z) => ustawDane({ ...dane, zakres: z.target.value, emisja_zdarzenie_id: null, zakresy_tekst: '' })}>
          <option value="wszystkie">wszystkie akcje spółki</option>
          <option value="emisja">cała seria</option>
          <option value="zakres_numerow">konkretny zakres numerów</option>
        </select>
      </Pole>
      {(dane.zakres === 'emisja' || dane.zakres === 'zakres_numerow') && (
        <WyborEmisji emisje={spolka.emisje} bilans={spolka.bilans} wartosc={dane.emisja_zdarzenie_id} przyZmianie={(k) => ustawDane({ ...dane, emisja_zdarzenie_id: k })} />
      )}
      {dane.zakres === 'zakres_numerow' && (
        <Pole etykieta="Numery akcji" wymagane podpowiedz='Zapis w postaci „1-100, 150-160”.'>
          <input type="text" className="mono" value={dane.zakresy_tekst || ''} onChange={(z) => ustawDane({ ...dane, zakresy_tekst: z.target.value })} placeholder="1-100" />
        </Pole>
      )}
      <label className="chk">
        <input type="checkbox" checked={Boolean(dane.wymaga_zgody_spolki)} onChange={(z) => ustawDane({ ...dane, wymaga_zgody_spolki: z.target.checked })} />
        <span className="chk-tresc">Rozporządzenie akcjami wymaga zgody spółki</span>
      </label>
      <label className="chk">
        <input type="checkbox" checked={Boolean(dane.prawo_pierwszenstwa)} onChange={(z) => ustawDane({ ...dane, prawo_pierwszenstwa: z.target.checked })} />
        <span className="chk-tresc">Pozostali akcjonariusze mają prawo pierwszeństwa nabycia</span>
      </label>
      <Pole etykieta="Opis"><textarea {...pole('opis')} /></Pole>
    </>
  );
}

function KrokZmianaDanychAkcjonariusza({ dane, ustawDane }) {
  const [osoba, ustawOsobe] = useState(null);
  useEffect(() => {
    if (dane.osoba_id) API.get(`/api/psa/osoby/${dane.osoba_id}`).then((o) => ustawOsobe(o.osoba)).catch(() => {});
  }, [dane.osoba_id]);

  const po = dane.po || {};
  const ustawPo = (klucz, wartosc) => ustawDane({ ...dane, po: { ...po, [klucz]: wartosc } });
  const POLA = [
    ['email', 'E-mail'], ['telefon', 'Telefon'],
    ['kod_pocztowy', 'Kod pocztowy'], ['miejscowosc', 'Miejscowość'],
    ['ulica', 'Ulica'], ['nr_domu', 'Nr domu'], ['nr_lokalu', 'Nr lokalu'],
    ['adres_doreczen', 'Adres do doręczeń'], ['adres_edoreczen', 'Adres do e-doręczeń'],
  ];

  return (
    <>
      <Pole etykieta="Akcjonariusz" wymagane>
        <WyborOsoby wartosc={dane.osoba_id} przyZmianie={(id) => ustawDane({ ...dane, osoba_id: id, po: {} })} />
      </Pole>
      {osoba && (
        <>
          <div className="fl" style={{ marginTop: 22 }}>Nowe dane</div>
          <div className="siatka-2">
            {POLA.map(([klucz, etykieta]) => (
              <Pole key={klucz} etykieta={etykieta}>
                <input
                  type="text"
                  value={po[klucz] ?? osoba[klucz] ?? ''}
                  onChange={(z) => ustawPo(klucz, z.target.value)}
                />
              </Pole>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function KrokZobowiazanie({ dane, ustawDane, spolka }) {
  const pole = (k) => ({ value: dane[k] ?? '', onChange: (z) => ustawDane({ ...dane, [k]: z.target.value }) });
  return (
    <>
      <Pole etykieta="Akcjonariusz składający oświadczenie" wymagane>
        <WyborOsoby wartosc={dane.akcjonariusz_osoba_id} przyZmianie={(id) => ustawDane({ ...dane, akcjonariusz_osoba_id: id })} />
      </Pole>
      <Pole etykieta="Rodzaj zobowiązania">
        <select value={dane.rodzaj || 'przeniesienie'} onChange={(z) => ustawDane({ ...dane, rodzaj: z.target.value })}>
          <option value="przeniesienie">zobowiązanie do przeniesienia akcji</option>
          <option value="obciążenie">zobowiązanie do obciążenia akcji</option>
        </select>
      </Pole>
      <Pole etykieta="Której serii dotyczy (opcjonalnie)">
        <select value={dane.emisja_zdarzenie_id || ''} onChange={(z) => ustawDane({ ...dane, emisja_zdarzenie_id: z.target.value ? Number(z.target.value) : null })}>
          <option value="">— nie dotyczy konkretnej serii —</option>
          {spolka.emisje.map((e) => <option key={e.klucz} value={e.klucz}>Seria {e.seria}</option>)}
        </select>
      </Pole>
      <Pole etykieta="Treść oświadczenia"><textarea {...pole('tresc')} /></Pole>
    </>
  );
}

function KrokZdarzenieInne({ dane, ustawDane }) {
  return (
    <Pole etykieta="Opis zdarzenia" wymagane podpowiedz="Np. walne zgromadzenie, zmiana umowy spółki.">
      <textarea value={dane.opis ?? ''} onChange={(z) => ustawDane({ ...dane, opis: z.target.value })} />
    </Pole>
  );
}

/**
 * Przeniesienie ułamkowej części OZNACZONEJ akcji (art. 300(43) KSH) —
 * regula domenowa 4a: przy ułamku użytkownik wskazuje KONKRETNY numer akcji
 * i ułamek, nie ilość (wyjątek od reguły 4 obowiązującej resztę kreatora).
 */
function KrokPrzeniesienieUlamka({ dane, ustawDane, spolka }) {
  const wSerii = spolka.akcjonariusze.filter((a) => a.emisja_klucz === Number(dane.emisja_zdarzenie_id));
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
                <option value="">— wybierz uprawnionego —</option>
                {wSerii.map((a) => (
                  <option key={a.osoba_id} value={a.osoba_id}>
                    {a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`} — numery {a.numery}
                  </option>
                ))}
              </select>
            )}
          </Pole>
          {zbywca && (
            <Komunikat odmiana="info" tresc={`Zbywca posiada akcje serii ${zbywca.seria}, numery ${zbywca.numery}.`} />
          )}

          <div className="siatka-2">
            <Pole etykieta="Numer akcji" wymagane podpowiedz="Ułamek zawsze dotyczy dokładnie jednego, oznaczonego numeru akcji.">
              <input
                type="number"
                min="1"
                value={dane.nr ?? ''}
                onChange={(z) => ustawDane({ ...dane, nr: z.target.value })}
              />
            </Pole>
            <Pole etykieta="Ułamek zbywanej części" wymagane>
              <div className="row-g">
                <input
                  type="number"
                  min="1"
                  style={{ width: 80 }}
                  value={dane.czesc_licznik ?? ''}
                  onChange={(z) => ustawDane({ ...dane, czesc_licznik: z.target.value })}
                  placeholder="1"
                />
                <span>/</span>
                <input
                  type="number"
                  min="1"
                  style={{ width: 80 }}
                  value={dane.czesc_mianownik ?? ''}
                  onChange={(z) => ustawDane({ ...dane, czesc_mianownik: z.target.value })}
                  placeholder="3"
                />
              </div>
            </Pole>
          </div>

          <Pole etykieta="Tytuł przejścia">
            <select
              value={dane.tytul_prawny || 'sprzedaż'}
              onChange={(z) => ustawDane({ ...dane, tytul_prawny: z.target.value })}
            >
              <option value="sprzedaż">sprzedaż</option>
              <option value="darowizna">darowizna</option>
              <option value="dziedziczenie">dziedziczenie</option>
              <option value="inne przejście">inne przejście</option>
            </select>
          </Pole>

          <Pole etykieta="Nabywca" wymagane>
            <WyborOsoby
              wartosc={dane.nabywca_osoba_id}
              przyZmianie={(id) => ustawDane({ ...dane, nabywca_osoba_id: id })}
              wyklucz={[Number(dane.zbywca_osoba_id)].filter(Boolean)}
            />
          </Pole>

          <label className="chk">
            <input
              type="checkbox"
              checked={Boolean(dane.zgoda_spolki_niepelne_pokrycie)}
              onChange={(z) => ustawDane({ ...dane, zgoda_spolki_niepelne_pokrycie: z.target.checked })}
            />
            <span className="chk-tresc">
              Uzyskano zgodę spółki na zbycie akcji nie w pełni pokrytej
              <div className="podstawa-prawna">Wymagane wyłącznie, gdy akcja nie jest w pełni pokryta — art. 300(40) § 1 KSH.</div>
            </span>
          </label>
        </>
      )}
    </>
  );
}

/** Wskazanie/zmiana wspólnego przedstawiciela współuprawnionych (art. 300(38) § 3 KSH). */
function KrokPrzedstawiciel({ dane, ustawDane, spolka }) {
  return (
    <>
      <WyborEmisji
        emisje={spolka.emisje}
        bilans={spolka.bilans}
        wartosc={dane.emisja_zdarzenie_id}
        przyZmianie={(k) => ustawDane({ ...dane, emisja_zdarzenie_id: k })}
      />
      {dane.emisja_zdarzenie_id && (
        <>
          <Pole etykieta="Numer akcji" wymagane podpowiedz="Akcja objęta współwłasnością, dla której wskazywany jest przedstawiciel.">
            <input type="number" min="1" value={dane.nr ?? ''} onChange={(z) => ustawDane({ ...dane, nr: z.target.value })} />
          </Pole>
          <Pole etykieta="Wspólny przedstawiciel" podpowiedz="Musi być jednym ze współuprawnionych z tej akcji. Zostaw puste, by usunąć wskazanie.">
            <WyborOsoby
              wartosc={dane.przedstawiciel_osoba_id}
              przyZmianie={(id) => ustawDane({ ...dane, przedstawiciel_osoba_id: id })}
            />
          </Pole>
          <Komunikat
            odmiana="info"
            tresc="Brak wspólnego przedstawiciela nie blokuje wpisu — spółka może wtedy składać oświadczenia wobec któregokolwiek ze współuprawnionych (art. 300(38) § 4 KSH)."
          />
        </>
      )}
    </>
  );
}

/** Wzmianka o pokryciu (art. 300(33) § 1 pkt 9 KSH) — podstawa: uchwała zarządu (art. 300(9) § 2 KSH). */
function KrokPokrycieAkcji({ dane, ustawDane, spolka }) {
  return (
    <>
      <WyborEmisji
        emisje={spolka.emisje}
        bilans={spolka.bilans}
        wartosc={dane.emisja_zdarzenie_id}
        przyZmianie={(k) => ustawDane({ ...dane, emisja_zdarzenie_id: k })}
      />
      {dane.emisja_zdarzenie_id && (
        <>
          <Pole etykieta="Akcjonariusz" wymagane>
            <WyborOsoby wartosc={dane.osoba_id} przyZmianie={(id) => ustawDane({ ...dane, osoba_id: id })} />
          </Pole>
          <Pole etykieta="Wzmianka o pokryciu" wymagane>
            <select value={dane.pokryta || ''} onChange={(z) => ustawDane({ ...dane, pokryta: z.target.value })}>
              <option value="">— wybierz —</option>
              <option value="tak">w całości pokryta</option>
              <option value="czesciowo">pokryta częściowo</option>
              <option value="nie">nie pokryta</option>
            </select>
          </Pole>
          <Komunikat
            odmiana="info"
            tresc="Wkłady zalicza się równomiernie na pokrycie wszystkich akcji akcjonariusza w tej emisji (art. 300(9) § 3 KSH), chyba że umowa spółki stanowi inaczej."
          />
        </>
      )}
    </>
  );
}

/** Dispatcher kroku 3 — jeden na typ zdarzenia. */
const KROKI_TRESCI = {
  emisja: KrokEmisja,
  objecie: KrokObjecie,
  przeniesienie: KrokPrzeniesienie,
  umorzenie: KrokUmorzenie,
  obciazenie: KrokObciazenie,
  wykreslenie_obciazenia: KrokWykreslenieObciazenia,
  prawo_glosu_zastawnika: KrokPrawoGlosuZastawnika,
  zajecie: KrokZajecie,
  wykreslenie_zajecia: KrokWykreslenieZajecia,
  uprawnienie: KrokUprawnienie,
  ograniczenie: KrokOgraniczenie,
  zmiana_danych_akcjonariusza: KrokZmianaDanychAkcjonariusza,
  zobowiazanie: KrokZobowiazanie,
  zdarzenie_inne: KrokZdarzenieInne,
  przeniesienie_ulamka: KrokPrzeniesienieUlamka,
  przedstawiciel: KrokPrzedstawiciel,
  pokrycie_akcji: KrokPokrycieAkcji,
};

/** Zamienia stan formularza (`dane`) na treść żądania do API, per typ. */
function zbudujDaneZdarzenia(typ, dane) {
  const wynik = { ...dane, podstawa_opis: dane.podstawa_opis || null };
  delete wynik.cena_zl;

  if (typ === 'emisja') {
    wynik.ilosc = Number(dane.ilosc);
    wynik.nr_pierwszy = dane.nr_pierwszy ? Number(dane.nr_pierwszy) : 1;
    wynik.cena_emisyjna_grosze =
      dane.cena_zl === '' || dane.cena_zl === undefined ? null : Math.round(Number(dane.cena_zl) * 100);
  }
  if (dane.pozycje) wynik.pozycje = przygotujPozycje(dane.pozycje);
  if (['obciazenie', 'zajecie'].includes(typ)) {
    const pojedyncza = przygotujPojedyncza(dane);
    Object.assign(wynik, pojedyncza);
  }
  if (typ === 'przeniesienie_ulamka') {
    wynik.nr = Number(dane.nr);
    wynik.czesc_licznik = Number(dane.czesc_licznik);
    wynik.czesc_mianownik = Number(dane.czesc_mianownik);
  }
  if (typ === 'przedstawiciel') {
    wynik.nr = Number(dane.nr);
    wynik.przedstawiciel_osoba_id = dane.przedstawiciel_osoba_id || null;
  }
  return wynik;
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
      <table className="tabela">
        <thead>
          <tr>
            <th>Akcjonariusz</th>
            <th>Seria</th>
            <th className="do-prawej">Akcje</th>
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
                <td className="do-prawej kol-dane">{fmt.liczba(p.ilosc)}</td>
                <td className="kol-dane wyciszony">{p.numery}</td>
              </tr>
            );
          })}
          {tabela.pozycje.length === 0 && (
            <tr>
              <td colSpan={4} className="wyciszony">Brak akcjonariuszy.</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={{ fontWeight: 600 }}>Razem</td>
            <td className="do-prawej kol-dane" style={{ fontWeight: 600 }}>{fmt.liczba(tabela.razem_akcji)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   KROKI 1–2 — nowa sprawa (zakłada sprawę, start licznika 7 dni)
   ───────────────────────────────────────────────────── */

function EkranNowejSprawy({ spolkaId }) {
  const [krok, ustawKrok] = useState(0);
  const [typ, ustawTyp] = useState(null);
  const [zrodlo, ustawZrodlo] = useState('papier');
  const [zadajacyOsobaId, ustawZadajacegoOsobaId] = useState(null);
  const [zadajacyOpis, ustawZadajacegoOpis] = useState('');
  const [dataWplywu, ustawDateWplywu] = useState(fmt.dzisIso());
  const [podstawaOpis, ustawPodstawaOpis] = useState('');
  const [pliki, ustawPliki] = useState([]);
  const [typDokumentu, ustawTypDokumentu] = useState('inny');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  const meta = useDane('/api/psa/meta');
  const spolkaDane = useDane(`/api/psa/spolki/${spolkaId}`);

  const cokolwiekWpisano = Boolean(typ);
  useEscape(() => {
    if (!cokolwiekWpisano || window.confirm('Przerwać zakładanie sprawy? Wprowadzone dane przepadną.')) {
      idz(`/spolki/${spolkaId}`);
    }
  });

  const definicjaTypu = useMemo(() => {
    if (!meta.dane || !typ) return null;
    return meta.dane.typy_zdarzen.find((t) => t.kod === typ) || null;
  }, [meta.dane, typ]);

  useEffect(() => {
    if (definicjaTypu && definicjaTypu.z_urzedu) ustawZrodlo('z_urzedu');
    else if (definicjaTypu && zrodlo === 'z_urzedu') ustawZrodlo('papier');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typ]);

  async function zalozSprawe() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const odpowiedz = await API.post('/api/psa/sprawy', {
        spolka_id: spolkaId,
        typ_zdarzenia: typ,
        zrodlo,
        zadajacy_osoba_id: zadajacyOsobaId,
        zadajacy_opis: zadajacyOpis || null,
        data_wplywu: dataWplywu,
        notatka: podstawaOpis || null,
      });
      const sprawaId = odpowiedz.sprawa.id;

      if (pliki.length > 0) {
        const formularz = new FormData();
        formularz.append('typ_dokumentu', typDokumentu);
        for (const plik of pliki) formularz.append('pliki', plik);
        await fetch(`/api/psa/sprawy/${sprawaId}/dokumenty`, { method: 'POST', body: formularz });
      }

      // Kreator prowadzi wprost do weryfikacji — kroki 3–4 (w EkranSprawy)
      // wymagają tego stanu, żeby dokonać wpisu.
      if (odpowiedz.sprawa.stan === 'nowa') {
        await API.patch(`/api/psa/sprawy/${sprawaId}`, { akcja: 'weryfikuj' });
      }

      idz(`/sprawy/${sprawaId}`);
    } catch (e) {
      ustawBlad(e.message);
      ustawZapisywanie(false);
    }
  }

  if (meta.ladowanie || spolkaDane.ladowanie) return <Spinner />;

  const mozeDalej = krok === 0 ? Boolean(typ) : krok === 1 ? Boolean(zrodlo && dataWplywu) : false;

  return (
    <>
      <div className="okruszki">
        <button onClick={() => idz('/spolki')}>Spółki</button> →{' '}
        <button onClick={() => idz(`/spolki/${spolkaId}`)}>{spolkaDane.dane.spolka.nazwa}</button> → nowa sprawa
      </div>

      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Nowa sprawa</div>
          <div className="podtytul-strony">
            {definicjaTypu ? definicjaTypu.nazwa : 'Wybierz, co się wydarzyło.'}
          </div>
        </div>
      </div>

      <Kroki kroki={KROKI_ZDARZENIA} biezacy={krok} />
      <Komunikat odmiana="blad" tresc={blad} />

      <Karta>
        {krok === 0 && (
          <>
            <div className="card-h">Co się wydarzyło?</div>
            {Object.entries(NAZWY_GRUP).map(([grupa, nazwaGrupy]) => {
              const typyGrupy = meta.dane.typy_zdarzen.filter(
                (t) => t.grupa === grupa && meta.dane.typy_w_kreatorze.includes(t.kod)
              );
              if (typyGrupy.length === 0) return null;
              return (
                <div key={grupa} style={{ marginBottom: 22 }}>
                  <div className="fl">{nazwaGrupy}</div>
                  <div className="kafelki-wyboru">
                    {typyGrupy.map((t) => (
                      <button
                        key={t.kod}
                        className={`kafelek-wyboru ${typ === t.kod ? 'wybrany' : ''}`}
                        onClick={() => ustawTyp(t.kod)}
                      >
                        <Ikona nazwa={IKONY_ZDARZEN[t.kod] || 'zdarzenie'} rozmiar={20} />
                        <span className="kafelek-wyboru-tytul">{t.opis_zdarzeniem}</span>
                        <span className="kafelek-wyboru-opis">{t.podpowiedz || t.nazwa}</span>
                        <span className="kafelek-wyboru-kategoria"><Pigulka>{nazwaGrupy}</Pigulka></span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {krok === 1 && (
          <>
            <div className="card-h">Podstawa wpisu</div>
            <div className="siatka-2">
              <Pole
                etykieta="Źródło żądania"
                wymagane
                podpowiedz={definicjaTypu && definicjaTypu.z_urzedu ? 'To zdarzenie zakłada się wyłącznie z urzędu.' : null}
              >
                <select value={zrodlo} onChange={(z) => ustawZrodlo(z.target.value)} disabled={Boolean(definicjaTypu && definicjaTypu.z_urzedu)}>
                  {!definicjaTypu?.z_urzedu && <option value="papier">papierowo</option>}
                  {!definicjaTypu?.z_urzedu && <option value="email">e-mail</option>}
                  {!definicjaTypu?.z_urzedu && <option value="portal">portal (przyszły kanał)</option>}
                  {definicjaTypu?.z_urzedu && <option value="z_urzedu">z urzędu</option>}
                </select>
              </Pole>
              <Pole etykieta="Data wpływu" wymagane>
                <PoleDaty wartosc={dataWplywu} max={fmt.dzisIso()} przyZmianie={(v) => v && ustawDateWplywu(v)} skroty />
              </Pole>
            </div>

            {zrodlo !== 'z_urzedu' && (
              <>
                <Pole etykieta="Żądający wpisu" podpowiedz="Spółka albo inna osoba mająca interes prawny — art. 300(34) § 1 KSH.">
                  <WyborOsoby wartosc={zadajacyOsobaId} przyZmianie={ustawZadajacegoOsobaId} />
                </Pole>
                <Pole etykieta="Opis żądającego" podpowiedz="Jeśli żądający nie jest wpisany do kartoteki.">
                  <input type="text" value={zadajacyOpis} onChange={(z) => ustawZadajacegoOpis(z.target.value)} />
                </Pole>
              </>
            )}

            <Pole etykieta="Dokument stanowiący podstawę" podpowiedz="Np. „umowa sprzedaży akcji z 12 marca 2026 r., podpisy notarialnie poświadczone”.">
              <textarea value={podstawaOpis} onChange={(z) => ustawPodstawaOpis(z.target.value)} style={{ minHeight: 80 }} />
            </Pole>

            <Pole etykieta="Dokumenty (opcjonalnie)">
              <div className="row-g" style={{ flexWrap: 'wrap' }}>
                <select value={typDokumentu} onChange={(z) => ustawTypDokumentu(z.target.value)} style={{ width: 'auto' }}>
                  <option value="umowa_zbycia">umowa zbycia</option>
                  <option value="uchwala">uchwała</option>
                  <option value="zgoda">zgoda</option>
                  <option value="postanowienie">postanowienie</option>
                  <option value="pelnomocnictwo">pełnomocnictwo</option>
                  <option value="inny">inny</option>
                </select>
                <input
                  type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(z) => ustawPliki([...z.target.files])}
                />
              </div>
              {pliki.length > 0 && (
                <div className="podpowiedz">{pliki.length} plik(ów): {pliki.map((p) => p.name).join(', ')}</div>
              )}
            </Pole>
          </>
        )}

        <div className="kreator-stopka">
          <button
            className="btn"
            onClick={() => {
              if (krok === 0) {
                if (!cokolwiekWpisano || window.confirm('Przerwać zakładanie sprawy?')) idz(`/spolki/${spolkaId}`);
              } else {
                ustawKrok((k) => k - 1);
              }
            }}
          >
            {krok === 0 ? 'Anuluj' : 'Wstecz'}
          </button>
          <div className="kreator-stopka-prawa">
            {krok < 1 ? (
              <button className="btn btn-primary" disabled={!mozeDalej} onClick={() => ustawKrok((k) => k + 1)}>
                Dalej
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" disabled={!mozeDalej || zapisywanie} onClick={zalozSprawe}>
                {zapisywanie ? 'Zakładanie sprawy…' : 'Załóż sprawę i przejdź dalej'}
              </button>
            )}
          </div>
        </div>
      </Karta>
    </>
  );
}

window.KROKI_ZDARZENIA = KROKI_ZDARZENIA;
window.KROKI_TRESCI = KROKI_TRESCI;
window.zbudujDaneZdarzenia = zbudujDaneZdarzenia;
window.TabelaPorownania = TabelaPorownania;
window.WyborEmisji = WyborEmisji;
window.WyborObciazenia = WyborObciazenia;
window.EkranNowejSprawy = EkranNowejSprawy;

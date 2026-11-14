/* spolki.js — lista rejestrów i rejestr spółki (D-230). Ekran spółki ma układ informacji z rejestru:
   I. Spółka → II. Akcje („Nowa emisja”) → III. Akcjonariusze („Nowy wpis” przy osobie) → IV. Obciążenia,
   ograniczenia, obowiązki („Zmień prawo głosu”, „Wykreśl”) → Historia wpisów („Sprostuj”). Otwarte sprawy
   spółki stoją na górze jako „W toku”. Przycisk główny: „Informacja z rejestru”. */

function EkranSpolek() {
  const [q, ustawQ] = useParametrAdresu('q', '');
  const [nowa, ustawNowa] = useState(false);
  const { dane, blad } = useDane(`/api/psa/spolki?q=${encodeURIComponent(q)}`);
  const { dane: wnioski } = useDane('/api/psa/wnioski?stan=roboczy,zlozony');
  return (
    <>
      {nowa && <NowaSpolka przyAnulowaniu={() => ustawNowa(false)} />}
      {wnioski && wnioski.length > 0 && (
        <Karta tytul="W przygotowaniu">
          <table className="tabela">
            <thead><tr><th>Firma</th><th>KRS</th><th>Stan</th><th>Zmiana</th></tr></thead>
            <tbody>
              {wnioski.map((w) => (
                <tr key={w.id} className="klikalna" onClick={() => idz(`/wnioski/${w.id}`)}>
                  <td><a href={`#/wnioski/${w.id}`}>{w.firma || `Wniosek KRS ${w.krs}`}</a>{w.przejecie ? <div className="male drugorzedny">przejęcie rejestru</div> : null}</td>
                  <td className="dane">{w.krs}</td>
                  <td><Pigulka odmiana={ODMIANY_WNIOSKU[w.stan]}>{w.stan === 'zlozony' ? 'Do rozpatrzenia' : 'W trakcie wypełniania'}</Pigulka></td>
                  <td>{fmt.data(w.zmieniono)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Karta>
      )}
      <Karta tytul="Rejestry" akcje={!nowa && <button type="button" className="btn btn-glowny" onClick={() => ustawNowa(true)}>Nowa spółka</button>}>
        <Szukajka wartosc={q} przyZmianie={ustawQ} placeholder="Firma albo KRS…" />
        {blad && <Bledy blad={blad} />}
        {!dane && !blad && <Spinner />}
        {dane && !dane.length && <Pusto tytul="Brak rejestrów" opis={q ? 'Żadna spółka nie pasuje do wyszukiwania.' : 'Rejestr pojawi się tu po otwarciu.'} />}
        {dane && dane.length > 0 && (
          <table className="tabela">
            <thead><tr><th>Firma</th><th>KRS</th><th>Siedziba</th><th>Rejestr</th></tr></thead>
            <tbody>
              {dane.map((s) => (
                <tr key={s.id} className="klikalna" onClick={() => idz(`/spolki/${s.id}`)}>
                  <td><a href={`#/spolki/${s.id}`}>{s.nazwa}</a></td>
                  <td className="dane">{s.krs}</td>
                  <td>{s.siedziba}</td>
                  <td>{s.data_zamkniecia ? `zamknięty ${fmt.data(s.data_zamkniecia)}` : s.data_otwarcia ? `otwarty ${fmt.data(s.data_otwarcia)}` : 'nieotwarty'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Karta>
    </>
  );
}

/* Dane rejestru (art. 300³³ § 1 pkt 1–3 KSH) i — osobno — dane do rozliczeń i korespondencji. */
const POLA_REJESTRU = [['nazwa', 'Firma'], ['siedziba', 'Siedziba'], ['adres', 'Adres'], ['sad_rejestrowy', 'Sąd rejestrowy'], ['krs', 'Numer KRS', true], ['data_rejestracji', 'Data rejestracji spółki']];
const POLA_ROZLICZEN = [['nip', 'NIP (do faktur)'], ['email', 'E-mail spółki (korespondencja)'], ['umowe_zawarl', 'Umowę zawarł'], ['platnosc', 'Opłata za prowadzenie']];
const POLA_SPOLKI = [...POLA_REJESTRU, ...POLA_ROZLICZEN];
const PLATNOSC = { roczna: 'raz w roku', miesieczna: 'co miesiąc' };

function DaneSpolki({ spolka, poZapisie, edycjaDozwolona }) {
  const [edycja, ustawEdycje] = useState(null);
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const zapisz = () => c.wykonaj(async () => {
    const zmiany = Object.fromEntries(POLA_SPOLKI.filter(([k, , staly]) => !staly && edycja[k] !== spolka[k]).map(([k]) => [k, edycja[k]]));
    await API.put(`/api/psa/spolki/${spolka.id}`, zmiany);
    ustawEdycje(null);
    poZapisie();
  });
  const wartosc = (k) => (k === 'data_rejestracji' ? fmt.data(spolka[k]) : k === 'platnosc' ? PLATNOSC[spolka[k]] : spolka[k]) || '—';
  const tytul = <><span className="numer-sekcji">I.</span> Spółka</>;
  if (!edycja) {
    return (
      <Karta tytul={tytul} akcje={edycjaDozwolona && <button type="button" className="btn btn-maly" onClick={() => ustawEdycje({ ...spolka })}>Zmień dane</button>}>
        <ListaDanych pary={POLA_REJESTRU.map(([k, nazwa]) => [nazwa, wartosc(k)])} />
        <div className="dane-pomocnicze">
          <div className="etykieta">Rozliczenia i korespondencja — poza rejestrem</div>
          <ListaDanych pary={POLA_ROZLICZEN.map(([k, nazwa]) => [nazwa, wartosc(k)])} />
        </div>
      </Karta>
    );
  }
  return (
    <Karta tytul={tytul}>
      <div className="siatka-2">
        {POLA_SPOLKI.filter(([, , staly]) => !staly).map(([k, nazwa]) => (
          <Pole key={k} etykieta={nazwa} blad={pola[k]} opcjonalne={['nip', 'email', 'umowe_zawarl'].includes(k)}>
            {k === 'data_rejestracji' ? <PoleDaty wartosc={edycja[k] || ''} przyZmianie={(v) => ustawEdycje({ ...edycja, [k]: v })} max={fmt.dzisIso()} />
              : k === 'platnosc' ? (
                <select value={edycja[k]} onChange={(e) => ustawEdycje({ ...edycja, [k]: e.target.value })}>
                  <option value="roczna">raz w roku</option>
                  <option value="miesieczna">co miesiąc</option>
                </select>
              ) : <input type="text" value={edycja[k] || ''} onChange={(e) => ustawEdycje({ ...edycja, [k]: e.target.value })} />}
          </Pole>
        ))}
      </div>
      {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
      <p className="male drugorzedny">Zmiana danych nie jest wpisem — zapisuje się w historii zmian danych.</p>
      <div className="rzad">
        <button type="button" className="btn btn-glowny" onClick={zapisz} disabled={c.trwa}>Zapisz</button>
        <button type="button" className="btn" onClick={() => ustawEdycje(null)}>Anuluj</button>
      </div>
    </Karta>
  );
}

/** „Informacja z rejestru” (U-24): odbiorca, dzień (także dziś), opłata 50 zł albo bez (organ — bez). */
function FormularzInformacji({ spolka, widok, osoby, przyZamknieciu }) {
  const [f, ustawF] = useState({ odbiorca: 'spolka', osoba_id: null, organ: '', sygnatura: '', dzien: fmt.dzisIso(), oplata: null });
  const [wynik, ustawWynik] = useState(null);
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  // Odbiorcą może być akcjonariusz — nie uprawniony z obciążenia (zastawnik, użytkownik).
  const akcjonariusze = [...new Set(((widok && widok.akcjonariusze) || []).map((p) => p.osoba_id))];
  const wydaj = () => c.wykonaj(async () => ustawWynik(await API.post(`/api/psa/spolki/${spolka.id}/informacja`, f)));
  return (
    <Karta tytul="Informacja z rejestru">
      {wynik ? (
        <>
          <Komunikat odmiana="rejestr" tresc={`Wydano informację ${wynik.numer}. Wysyłka — w Korespondencji.`} />
          <div className="rzad">
            <a className="btn btn-glowny" href={adresPdf(wynik.pismo_id)} target="_blank" rel="noopener">Pobierz PDF</a>
            <a className="btn" href="#/korespondencja">Korespondencja</a>
            <button type="button" className="btn" onClick={przyZamknieciu}>Zamknij</button>
          </div>
        </>
      ) : (
        <>
          <div className="siatka-2">
            <Pole etykieta="Odbiorca" blad={pola.odbiorca}>
              <select value={f.odbiorca} onChange={(e) => ustawF({ ...f, odbiorca: e.target.value })}>
                <option value="spolka">spółka</option>
                <option value="osoba">akcjonariusz</option>
                <option value="organ">sąd, prokurator, komornik, organ egzekucyjny</option>
              </select>
            </Pole>
            <Pole etykieta="Stan na koniec dnia" blad={pola.dzien}>
              <PoleDaty wartosc={f.dzien} przyZmianie={(d) => ustawF({ ...f, dzien: d })} min={spolka.data_otwarcia ? spolka.data_otwarcia.slice(0, 10) : undefined} max={fmt.dzisIso()} />
            </Pole>
          </div>
          {f.odbiorca === 'osoba' && (
            <Pole etykieta="Akcjonariusz" blad={pola.odbiorca}>
              <select value={f.osoba_id || ''} onChange={(e) => ustawF({ ...f, osoba_id: Number(e.target.value) || null })}>
                <option value="">— wybierz —</option>
                {akcjonariusze.map((id) => <option key={id} value={id}>{nazwaOsoby(osoby, id)}</option>)}
              </select>
            </Pole>
          )}
          {f.odbiorca === 'organ' && (
            <div className="siatka-2">
              <Pole etykieta="Organ" blad={pola.odbiorca}><input type="text" value={f.organ} onChange={(e) => ustawF({ ...f, organ: e.target.value })} /></Pole>
              <Pole etykieta="Sygnatura" blad={pola.sygnatura}><input type="text" value={f.sygnatura} onChange={(e) => ustawF({ ...f, sygnatura: e.target.value })} /></Pole>
            </div>
          )}
          {f.odbiorca !== 'organ' && (
            <Pole etykieta="Opłata" blad={pola.oplata}>
              <div className="rzad" role="group">
                {[['tak', 'Opłata 50 zł netto'], ['nie', 'Bez opłaty']].map(([v, n]) => (
                  <button key={v} type="button" className={`btn ${f.oplata === v ? 'btn-wybrany' : ''}`} aria-pressed={f.oplata === v} onClick={() => ustawF({ ...f, oplata: v })}>{n}</button>
                ))}
              </div>
            </Pole>
          )}
          {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
          <div className="rzad">
            <button type="button" className="btn btn-glowny" onClick={wydaj} disabled={c.trwa}>Wydaj informację</button>
            <button type="button" className="btn" onClick={przyZamknieciu}>Anuluj</button>
          </div>
        </>
      )}
    </Karta>
  );
}

/** Operacja zmiany albo wykreślenia obciążenia/adnotacji — wypełniona danymi wiersza. */
function zmianaAtrybutu(a, operacja) {
  const obciazenie = ['zastaw', 'uzytkowanie', 'zajecie'].includes(a.rodzaj);
  return {
    typ: obciazenie ? 'obciazenie' : 'adnotacja',
    operacja,
    atrybut: { zdarzenie_id: a.zdarzenie_id, pozycja: a.pozycja },
    akcje: [{ seria: a.seria, numery: numeryDoPola(a.zakresy), liczba: String(a.zakresy.reduce((s, z) => s + z.nr_do - z.nr_od + 1, 0)) }],
    ...(operacja === 'zmiana_prawa_glosu' ? { prawo_glosu: !a.prawo_glosu } : {}),
  };
}

const POWODY_ZAMKNIECIA = [['przekazanie', 'przekazanie rejestru innemu podmiotowi'], ['wykreslenie_spolki', 'wykreślenie spółki z KRS'], ['rozwiazanie_umowy', 'rozwiązanie umowy']];

function EkranKokpitu({ spolkaId }) {
  const [dzien, ustawDzien] = useParametrAdresu('dzien', '');
  const { dane, blad, odswiez } = useDane(`/api/psa/spolki/${spolkaId}${dzien ? `?dzien=${dzien}` : ''}`);
  const [informacja, ustawInformacje] = useState(false);
  const [zamkniecie, ustawZamkniecie] = useState(false);
  const [powod, ustawPowod] = useState('');
  const c = useCzynnosc();
  if (blad) return <Bledy blad={blad} />;
  if (!dane) return <Spinner />;
  const { spolka, rejestr: w, osoby } = dane;
  const otwarty = Boolean(spolka.data_otwarcia) && !spolka.data_zamkniecia;
  // Czynności tylko w stanie bieżącym otwartego rejestru — „stan na dzień” w przeszłości jest do czytania.
  const czynny = otwarty && !dzien;
  const nowa = (d) => c.wykonaj(() => zalozSprawe(spolka.id, d));
  const liczbaAkcji = w.serie.reduce((s, x) => s + x.liczba - x.umorzone.reduce((u, z) => u + z.nr_do - z.nr_od + 1, 0), 0);
  const liczbaOsob = new Set(w.akcjonariusze.map((p) => p.osoba_id)).size;
  const stanRejestru = spolka.data_zamkniecia ? `rejestr zamknięty ${fmt.data(spolka.data_zamkniecia)}` : spolka.data_otwarcia ? `rejestr otwarty ${fmt.data(spolka.data_otwarcia)}` : 'rejestr nieotwarty';
  const wToku = dzien ? [] : dane.w_toku || [];

  return (
    <div className="ekran-rejestru">
      <NaglowekStrony
        tytul={spolka.nazwa}
        kontekst={(
          <span className="rzad">
            <span>KRS <span className="dane">{spolka.krs}</span></span>
            <span>{stanRejestru}</span>
            {spolka.data_otwarcia && <span>{fmt.AKCJE(liczbaAkcji)} · {fmt.liczba(w.serie.length)} {fmt.odmien(w.serie.length, 'seria', 'serie', 'serii')}</span>}
            {spolka.data_otwarcia && <span>{fmt.liczba(liczbaOsob)} {fmt.odmien(liczbaOsob, 'akcjonariusz', 'akcjonariuszy', 'akcjonariuszy')}</span>}
          </span>
        )}
        akcje={(
          <span className="rzad">
            <label className="stan-na">
              <span>Stan na dzień</span>
              <PoleDaty wartosc={dzien} przyZmianie={ustawDzien} max={fmt.dzisIso()} />
            </label>
            <button type="button" className="btn btn-glowny" onClick={() => ustawInformacje(true)} disabled={!spolka.data_otwarcia}>Informacja z rejestru</button>
            <Wiecej akcje={[
              { etykieta: 'Eksport rejestru (ZIP)', przyKlik: () => { window.location.href = `/api/psa/spolki/${spolka.id}/eksport`; } },
              czynny && { etykieta: 'Zamknij rejestr', przyKlik: () => ustawZamkniecie(true), niebezpieczna: true },
            ]}
            />
          </span>
        )}
      />
      <Bledy blad={c.blad} />
      {dzien && <Komunikat tresc={`Stan rejestru na koniec dnia ${fmt.data(dzien)} — tylko do odczytu.`} />}
      {dane.zawiadomienie_sadu && !dane.zawiadomienie_sadu.zawiadomiono && (
        <div className="komunikat komunikat-uwaga rzad-rozdzielony">
          <span>Zawiadom sąd rejestrowy (system KRS) o rozwiązaniu umowy — termin {fmt.data(dane.zawiadomienie_sadu.termin)}.</span>
          <button type="button" className="btn btn-maly" disabled={c.trwa} onClick={() => c.wykonaj(async () => { await API.post(`/api/psa/spolki/${spolka.id}/zawiadomienie-sadu`, {}); odswiez(); })}>Zawiadomiono sąd</button>
        </div>
      )}
      {zamkniecie && (
        <Modal
          tytul="Zamknięcie rejestru"
          przyZamknieciu={() => ustawZamkniecie(false)}
          stopka={(
            <>
              <button type="button" className="btn" onClick={() => ustawZamkniecie(false)}>Anuluj</button>
              <button type="button" className="btn btn-danger" disabled={!powod || c.trwa} onClick={() => nowa({ zadajacy: 'spolka', operacje: [{ typ: 'zamkniecie', powod }] })}>Przygotuj wpis zamknięcia</button>
            </>
          )}
        >
          <Pole etykieta="Powód">
            <select value={powod} onChange={(e) => ustawPowod(e.target.value)}>
              <option value="">— wybierz —</option>
              {POWODY_ZAMKNIECIA.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </Pole>
          <p className="male drugorzedny">Zamknięcie jest wpisem — na następnym ekranie sprawdzisz je i dokonasz wpisu.</p>
        </Modal>
      )}
      {informacja && <FormularzInformacji spolka={spolka} widok={w} osoby={osoby} przyZamknieciu={() => ustawInformacje(false)} />}

      {!spolka.data_otwarcia && (
        <div className="komunikat komunikat-uwaga rzad-rozdzielony">
          <span>Rejestr nie jest jeszcze otwarty — pierwszym wpisem jest otwarcie ze stanem początkowym.</span>
          <button
            type="button"
            className="btn btn-glowny"
            disabled={c.trwa}
            onClick={() => nowa({ operacje: [{ typ: 'otwarcie', zrodlo: 'zalozenie', serie: [{ seria: 'A', numery: '', liczba: '', data_wpisu_krs: spolka.data_rejestracji }], akcjonariusze: [{ osoba_id: null, akcje: [{ seria: 'A', numery: '', liczba: '' }] }], atrybuty: [], umorzone: [] }] })}
          >
            Otwórz rejestr
          </button>
        </div>
      )}

      {wToku.length > 0 && (
        <section className="w-toku" aria-label="Wpisy w toku">
          <div className="etykieta">W toku · {wToku.length}</div>
          {wToku.map((s) => (
            <div className="w-toku-wiersz" key={s.id}>
              <div className="w-toku-opis">
                <strong>{s.opis}</strong>
                <div className="male">
                  {s.stan === 'wstrzymana' ? 'Wstrzymana — czeka na uzupełnienie.' : s.braki.length ? `Zostało: ${s.braki[0]}` : 'Gotowe do wpisu.'}
                  {s.termin && !s.termin.zamrozony ? ` Termin wpisu: ${fmt.data(s.termin.termin_do)}.` : ''}
                </div>
              </div>
              <a className="btn" href={`#/sprawy/${s.id}`}>Dokończ</a>
            </div>
          ))}
        </section>
      )}

      <DaneSpolki spolka={spolka} poZapisie={odswiez} edycjaDozwolona={!dzien} />

      <Karta
        tytul={<><span className="numer-sekcji">II.</span> Akcje</>}
        akcje={czynny && <a className="btn btn-maly" href={`#/spolki/${spolka.id}/wpis?typ=emisja`}>Nowa emisja</a>}
      >
        <TabelaSerii widok={w} />
      </Karta>

      <Karta tytul={<><span className="numer-sekcji">III.</span> Akcjonariusze</>}>
        <TabelaAkcjonariuszy
          widok={w}
          osoby={osoby}
          akcja={czynny ? (id) => <a className="btn btn-maly" href={`#/spolki/${spolka.id}/wpis?osoba=${id}`}>Nowy wpis</a> : null}
        />
      </Karta>

      <Karta tytul={<><span className="numer-sekcji">IV.</span> Obciążenia, ograniczenia, obowiązki</>}>
        <TabelaAtrybutow
          widok={w}
          osoby={osoby}
          akcje={czynny ? (a) => (
            <>
              {['zastaw', 'uzytkowanie'].includes(a.rodzaj) && <button type="button" className="btn btn-maly" disabled={c.trwa} onClick={() => nowa({ operacje: [zmianaAtrybutu(a, 'zmiana_prawa_glosu')] })}>Zmień prawo głosu</button>}
              <button type="button" className="btn btn-maly" disabled={c.trwa} onClick={() => nowa({ zadajacy: a.rodzaj === 'zajecie' ? 'organ' : 'spolka', operacje: [zmianaAtrybutu(a, 'wykreslenie')] })}>Wykreśl</button>
            </>
          ) : null}
        />
      </Karta>

      <Karta tytul="Historia wpisów" akcje={<span className="male drugorzedny">Wpisów nie usuwa się — błąd poprawia sprostowanie.</span>}>
        {!dane.wpisy.length && <p className="male drugorzedny">Brak wpisów.</p>}
        <ol className="historia-wpisow">
          {[...dane.wpisy].reverse().map((z) => (
            <li key={z.id} className={z.wycofany ? 'wycofany' : ''}>
              <div className="historia-kiedy">
                <div>{fmt.data(z.data_wpisu)}</div>
                <div className="dane">wpis nr {z.id}</div>
              </div>
              <div className="historia-co">
                <div>{z.opis || NAZWY_TYPOW[z.typ] || z.typ}</div>
                <div className="male drugorzedny">
                  {z.wycofany ? `Wycofany wpisem nr ${z.wycofany}. ` : z.sprostowany ? `Sprostowany wpisem nr ${z.sprostowany}. ` : ''}
                  {z.podstawa ? `Podstawa: ${z.podstawa.replace(/\.+$/, '')}. ` : ''}
                  {z.sprawa_id ? <a href={`#/sprawy/${z.sprawa_id}`}>dokumenty i pisma</a> : null}
                </div>
              </div>
              {czynny && !['sprostowanie', 'zamkniecie'].includes(z.typ) && !z.wycofany && (
                <button type="button" className="btn btn-maly" disabled={c.trwa} onClick={() => nowa({ zadajacy: 'brak', operacje: [{ typ: 'sprostowanie', zdarzenie_id: z.id, tryb: 'zastap' }] })}>Sprostuj</button>
              )}
            </li>
          ))}
        </ol>
      </Karta>

      <Sekcja tytul="Dostęp klienta do portalu" licznik={dane.reprezentanci.length}>
        <DzialajaZaSpolke spolkaId={spolka.id} osoby={dane.reprezentanci} poZmianie={odswiez} />
      </Sekcja>
      <Sekcja tytul="Dokumenty i pisma" licznik={dane.pliki.length + dane.pisma.length}>
        <ListaPlikow pliki={dane.pliki} />
        <TabelaPism pisma={dane.pisma.map((x) => ({ ...x, pismo: NAZWY_PISM[x.typ], adresat_nazwa: (x.kontekst || {}).adresat_nazwa }))} poZmianie={odswiez} />
      </Sekcja>
      <Sekcja tytul="Opłaty" licznik={dane.oplaty.length}>
        <TabelaOplat oplaty={dane.oplaty} poZmianie={odswiez} />
      </Sekcja>
      <Sekcja tytul="Żądania wpisu" licznik={dane.sprawy.length}>
        <table className="tabela">
          <thead><tr><th>Nr</th><th>Wpływ</th><th>Stan</th></tr></thead>
          <tbody>
            {dane.sprawy.map((s) => (
              <tr key={s.id}><td><a href={`#/sprawy/${s.id}`}>{s.id}</a></td><td>{fmt.data(s.data_wplywu)}</td><td>{STANY_SPRAWY[s.stan]}</td></tr>
            ))}
          </tbody>
        </table>
      </Sekcja>
      <Sekcja tytul="Historia zmian danych" licznik={dane.historia.length}>
        <HistoriaZmian historia={dane.historia} />
      </Sekcja>
    </div>
  );
}

/** „Działają za spółkę” (U-23): dodanie daje dostęp do spółki w portalu, usunięcie od razu go zamyka. */
function DzialajaZaSpolke({ spolkaId, osoby, poZmianie }) {
  const [dodaj, ustawDodaj] = useState(false);
  const c = useCzynnosc();
  const zmien = (fn) => c.wykonaj(async () => { await fn(); ustawDodaj(false); poZmianie(); });
  const adres = `/api/psa/spolki/${spolkaId}/reprezentanci`;
  return (
    <div className="dostep-klienta">
      {!osoby.length && <p className="male drugorzedny">Nikt nie działa za spółkę w portalu.</p>}
      {osoby.map((o) => (
        <div key={o.id} className="rzad-rozdzielony">
          <span><a href={`#/osoby/${o.id}`}>{o.nazwa}</a> <span className="male drugorzedny">{o.konto_aktywne === 1 ? 'konto w portalu' : o.konto_aktywne === 0 ? 'zaproszona' : 'bez konta'}</span></span>
          <button type="button" className="btn btn-maly" disabled={c.trwa} onClick={() => zmien(() => API.delete(`${adres}/${o.id}`))}>Odbierz dostęp</button>
        </div>
      ))}
      {dodaj ? (
        <Pole etykieta="Osoba z kartoteki albo nowa">
          <WyborOsoby wartosc={null} wyklucz={osoby.map((o) => o.id)} przyZmianie={(id) => id && zmien(() => API.post(adres, { osoba_id: id }))} />
        </Pole>
      ) : <button type="button" className="btn btn-maly" onClick={() => ustawDodaj(true)}>Dodaj osobę</button>}
      <Bledy blad={c.blad} />
      <p className="male drugorzedny">Odebranie dostępu (np. po odwołaniu z zarządu) działa od razu.</p>
    </div>
  );
}

const NAZWY_POL_HISTORII = { zawiadomienie_sadu: 'zawiadomienie sądu rejestrowego', dzialaja_za_spolke: 'działają za spółkę', zaproszenie_do_portalu: 'zaproszenie do portalu', zgoda_email: 'zgoda na e-mail' };

function HistoriaZmian({ historia }) {
  if (!historia.length) return <p className="male drugorzedny">Brak zmian.</p>;
  return (
    <table className="tabela">
      <thead><tr><th>Kiedy</th><th>Pole</th><th>Było</th><th>Jest</th><th>Kto</th></tr></thead>
      <tbody>
        {historia.map((h) => (
          <tr key={h.id}><td>{fmt.data(h.kiedy)}</td><td>{NAZWY_POL_HISTORII[h.pole] || h.pole}</td><td>{h.stara ?? '—'}</td><td>{h.nowa ?? '—'}</td><td>{h.kto}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

Object.assign(window, { EkranSpolek, EkranKokpitu, HistoriaZmian });

/* spolki.js — lista spółek i kokpit spółki (§ 5): „stan na” dzień, dane spółki („Edytuj” w miejscu,
   U-25), akcjonariusze, akcje z obciążeniami i adnotacjami („Zmień” / „Wykreśl” — nowa sprawa),
   historia wpisów („Sprostuj”), akta, opłaty. Przycisk główny „Nowy wpis”, obok „Informacja z rejestru”. */

function EkranSpolek() {
  const [q, ustawQ] = useParametrAdresu('q', '');
  const [nowa, ustawNowa] = useState(false);
  const { dane, blad } = useDane(`/api/psa/spolki?q=${encodeURIComponent(q)}`);
  return (
    <>
    {nowa && <NowaSpolka przyAnulowaniu={() => ustawNowa(false)} />}
    <Karta akcje={!nowa && <button type="button" className="btn btn-glowny" onClick={() => ustawNowa(true)}>Nowa spółka</button>}>
      <Szukajka wartosc={q} przyZmianie={ustawQ} placeholder="Firma albo KRS…" />
      {blad && <Bledy blad={blad} />}
      {!dane && !blad && <Spinner />}
      {dane && !dane.length && <Pusto tytul="Brak spółek" opis={q ? 'Żadna spółka nie pasuje do wyszukiwania.' : 'Spółki pojawią się po otwarciu rejestru z wniosku.'} />}
      {dane && dane.length > 0 && (
        <table className="tabela">
          <thead><tr><th>Firma</th><th>KRS</th><th>Siedziba</th><th>Rejestr</th></tr></thead>
          <tbody>
            {dane.map((s) => (
              <tr key={s.id} className="klikalna" onClick={() => idz(`/spolki/${s.id}`)}>
                <td><a href={`#/spolki/${s.id}`}>{s.nazwa}</a></td>
                <td>{s.krs}</td>
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

const POLA_SPOLKI = [
  ['nazwa', 'Firma'], ['krs', 'KRS', true], ['siedziba', 'Siedziba'], ['adres', 'Adres'], ['sad_rejestrowy', 'Sąd rejestrowy'],
  ['data_rejestracji', 'Data rejestracji spółki'], ['nip', 'NIP (do faktur)'], ['email', 'E-mail spółki (korespondencja)'],
  ['umowe_zawarl', 'Umowę zawarł'], ['platnosc', 'Opłata za prowadzenie'],
];
const PLATNOSC = { roczna: 'raz w roku', miesieczna: 'co miesiąc' };

function DaneSpolki({ spolka, poZapisie }) {
  const [edycja, ustawEdycje] = useState(null);
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const zapisz = () => c.wykonaj(async () => {
    const zmiany = Object.fromEntries(POLA_SPOLKI.filter(([k, , staly]) => !staly && edycja[k] !== spolka[k]).map(([k]) => [k, edycja[k]]));
    await API.put(`/api/psa/spolki/${spolka.id}`, zmiany);
    ustawEdycje(null);
    poZapisie();
  });
  if (!edycja) {
    return (
      <Karta tytul="Dane spółki" akcje={<button type="button" className="btn btn-maly" onClick={() => ustawEdycje({ ...spolka })}>Edytuj</button>}>
        <ListaDanych pary={POLA_SPOLKI.map(([k, nazwa]) => [nazwa, k === 'data_rejestracji' ? fmt.data(spolka[k]) : k === 'platnosc' ? PLATNOSC[spolka[k]] : spolka[k]])} />
      </Karta>
    );
  }
  return (
    <Karta tytul="Dane spółki">
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
      <div className="rzad">
        <button type="button" className="btn btn-glowny" onClick={zapisz} disabled={c.trwa}>Zapisz</button>
        <button type="button" className="btn" onClick={() => ustawEdycje(null)}>Anuluj</button>
      </div>
    </Karta>
  );
}

/** „Informacja z rejestru” (§ 4, U-24): odbiorca, dzień (także dziś), opłata 50 zł albo bez (organ — bez). */
function FormularzInformacji({ spolka, osoby, przyZamknieciu }) {
  const [f, ustawF] = useState({ odbiorca: 'spolka', osoba_id: null, organ: '', sygnatura: '', dzien: fmt.dzisIso(), oplata: null });
  const [wynik, ustawWynik] = useState(null);
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const akcjonariusze = [...new Set(Object.keys(osoby || {}).map(Number))];
  const wydaj = () => c.wykonaj(async () => ustawWynik(await API.post(`/api/psa/spolki/${spolka.id}/informacja`, f)));
  return (
    <Karta tytul="Informacja z rejestru">
      {wynik ? (
        <>
          <Komunikat odmiana="rejestr" tresc={`Wydano informację ${wynik.numer}. Pismo jest w Korespondencji.`} />
          <div className="rzad">
            <a className="btn btn-glowny" href={adresPdf(wynik.pismo_id)} target="_blank" rel="noopener">Pobierz PDF</a>
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
                  <button key={v} type="button" className={`btn btn-maly ${f.oplata === v ? 'btn-glowny' : ''}`} aria-pressed={f.oplata === v} onClick={() => ustawF({ ...f, oplata: v })}>{n}</button>
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
  const nowa = (d) => c.wykonaj(() => zalozSprawe(spolka.id, d));

  return (
    <div className="ekran-kokpitu">
      <NaglowekStrony
        tytul={spolka.nazwa}
        kontekst={(
          <span className="rzad">
            <span>KRS {spolka.krs}</span>
            <span>{spolka.data_zamkniecia ? `rejestr zamknięty ${fmt.data(spolka.data_zamkniecia)}` : spolka.data_otwarcia ? `rejestr otwarty ${fmt.data(spolka.data_otwarcia)}` : 'rejestr nieotwarty'}</span>
          </span>
        )}
        akcje={(
          <span className="rzad">
            <button type="button" className="btn" onClick={() => ustawInformacje(true)} disabled={!spolka.data_otwarcia}>Informacja z rejestru</button>
            <PrzyciskGlowny etykieta="Nowy wpis" przyKlik={() => nowa({})} powod={otwarty ? null : 'Rejestr nie jest otwarty.'} trwa={c.trwa} />
            <Wiecej akcje={[
              { etykieta: 'Eksport rejestru (ZIP)', przyKlik: () => { window.location.href = `/api/psa/spolki/${spolka.id}/eksport`; } },
              otwarty && { etykieta: 'Zamknij rejestr', przyKlik: () => ustawZamkniecie(true), niebezpieczna: true },
            ]}
            />
          </span>
        )}
      />
      <Bledy blad={c.blad} />
      {zamkniecie && (
        <Modal
          tytul="Zamknięcie rejestru"
          przyZamknieciu={() => ustawZamkniecie(false)}
          stopka={(
            <>
              <button type="button" className="btn" onClick={() => ustawZamkniecie(false)}>Anuluj</button>
              <button type="button" className="btn btn-danger" disabled={!powod || c.trwa} onClick={() => nowa({ zadajacy: 'spolka', operacje: [{ typ: 'zamkniecie', powod }] })}>Załóż sprawę zamknięcia</button>
            </>
          )}
        >
          <Pole etykieta="Powód">
            <select value={powod} onChange={(e) => ustawPowod(e.target.value)}>
              <option value="">— wybierz —</option>
              <option value="przekazanie">przekazanie rejestru innemu podmiotowi</option>
              <option value="wykreslenie_spolki">wykreślenie spółki z KRS</option>
              <option value="rozwiazanie_umowy">rozwiązanie umowy</option>
            </select>
          </Pole>
          <p className="male drugorzedny">Zamknięcie jest wpisem — przejdzie przez sprawę (checklista, „Dokonaj wpisu”).</p>
        </Modal>
      )}
      {informacja && <FormularzInformacji spolka={spolka} osoby={osoby} przyZamknieciu={() => ustawInformacje(false)} />}

      <div className="stan-na-dzien">
        <Pole etykieta="Stan na dzień" podpowiedz={dzien ? undefined : 'Puste — stan bieżący.'}>
          <PoleDaty wartosc={dzien} przyZmianie={ustawDzien} max={fmt.dzisIso()} />
        </Pole>
      </div>

      <Karta tytul="Akcjonariusze"><TabelaAkcjonariuszy widok={w} osoby={osoby} /></Karta>
      <Karta tytul="Akcje">
        <TabelaSerii widok={w} />
        <h4>Obciążenia i adnotacje</h4>
        <TabelaAtrybutow
          widok={w}
          osoby={osoby}
          akcje={otwarty && !dzien ? (a) => (
            <>
              {['zastaw', 'uzytkowanie'].includes(a.rodzaj) && <button type="button" className="btn btn-maly btn-cichy" onClick={() => nowa({ operacje: [zmianaAtrybutu(a, 'zmiana_prawa_glosu')] })}>Zmień</button>}
              <button type="button" className="btn btn-maly btn-cichy" onClick={() => nowa({ zadajacy: a.rodzaj === 'zajecie' ? 'organ' : 'spolka', operacje: [zmianaAtrybutu(a, 'wykreslenie')] })}>Wykreśl</button>
            </>
          ) : null}
        />
      </Karta>
      <DaneSpolki spolka={spolka} poZapisie={odswiez} />
      <DzialajaZaSpolke spolkaId={spolka.id} osoby={dane.reprezentanci} poZmianie={odswiez} />

      <Sekcja tytul="Historia wpisów" licznik={dane.wpisy.length}>
        <table className="tabela">
          <thead><tr><th>Nr</th><th>Wpis</th><th>Data</th><th>Sprawa</th><th><span className="sr-only">Czynności</span></th></tr></thead>
          <tbody>
            {[...dane.wpisy].reverse().map((z) => (
              <tr key={z.id}>
                <td>{z.id}</td>
                <td>{NAZWY_TYPOW[z.typ] || z.typ}{z.wycofany ? ' (wycofany)' : z.sprostowany ? ' (sprostowany)' : ''}</td>
                <td>{fmt.data(z.data_wpisu)}</td>
                <td>{z.sprawa_id ? <a href={`#/sprawy/${z.sprawa_id}`}>{z.sprawa_id}</a> : '—'}</td>
                <td>{otwarty && !['sprostowanie', 'zamkniecie'].includes(z.typ) && !z.wycofany && (
                  <button type="button" className="btn btn-maly btn-cichy" onClick={() => nowa({ zadajacy: 'brak', operacje: [{ typ: 'sprostowanie', zdarzenie_id: z.id, tryb: 'zastap' }] })}>Sprostuj</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sekcja>
      <Sekcja tytul="Sprawy" licznik={dane.sprawy.length}>
        <table className="tabela">
          <thead><tr><th>Nr</th><th>Wpływ</th><th>Stan</th></tr></thead>
          <tbody>
            {dane.sprawy.map((s) => (
              <tr key={s.id}><td><a href={`#/sprawy/${s.id}`}>{s.id}</a></td><td>{fmt.data(s.data_wplywu)}</td><td>{STANY_SPRAWY[s.stan]}</td></tr>
            ))}
          </tbody>
        </table>
      </Sekcja>
      <Sekcja tytul="Akta — pliki i pisma" licznik={dane.pliki.length + dane.pisma.length}>
        <ListaPlikow pliki={dane.pliki} />
        <TabelaPism pisma={dane.pisma.map((x) => ({ ...x, pismo: NAZWY_PISM[x.typ], adresat_nazwa: (x.kontekst || {}).adresat_nazwa }))} poZmianie={odswiez} />
      </Sekcja>
      <Sekcja tytul="Opłaty" licznik={dane.oplaty.length}>
        <TabelaOplat oplaty={dane.oplaty} poZmianie={odswiez} />
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
    <Karta tytul="Działają za spółkę" akcje={!dodaj && <button type="button" className="btn btn-maly" onClick={() => ustawDodaj(true)}>Dodaj</button>}>
      {!osoby.length && <p className="male drugorzedny">Nikt nie działa za spółkę w portalu.</p>}
      {osoby.map((o) => (
        <div key={o.id} className="rzad-rozdzielony">
          <span><a href={`#/osoby/${o.id}`}>{o.nazwa}</a> <span className="male drugorzedny">{o.konto_aktywne === 1 ? 'konto w portalu' : o.konto_aktywne === 0 ? 'zaproszona' : 'bez konta'}</span></span>
          <button type="button" className="btn btn-maly btn-cichy" disabled={c.trwa} onClick={() => zmien(() => API.delete(`${adres}/${o.id}`))}>Usuń</button>
        </div>
      ))}
      {dodaj && (
        <Pole etykieta="Osoba z kartoteki albo nowa">
          <WyborOsoby wartosc={null} wyklucz={osoby.map((o) => o.id)} przyZmianie={(id) => id && zmien(() => API.post(adres, { osoba_id: id }))} />
        </Pole>
      )}
      <Bledy blad={c.blad} />
      <p className="male drugorzedny">Usunięcie (np. po odwołaniu z zarządu) od razu zamyka tej osobie dostęp do spółki w portalu.</p>
    </Karta>
  );
}

const NAZWY_POL_HISTORII = { dzialaja_za_spolke: 'działają za spółkę', zaproszenie_do_portalu: 'zaproszenie do portalu', zgoda_email: 'zgoda na e-mail' };

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

/* osoby.js — kartoteka osób i karta osoby (§ 5): „Edytuj” w miejscu z historią (U-25), bez sprawy;
   zgoda na e-mail — przełącznik (włączenie: plik podpisanej zgody, wyłączenie: data — U-11),
   „Dokument zgody do podpisu”; PEP, AML; akcje w spółkach; sprawy; konto w portalu; historia. */

function EkranOsob() {
  const [q, ustawQ] = useParametrAdresu('q', '');
  const [nowa, ustawNowa] = useState(false);
  const [ostrzezenia, ustawOstrzezenia] = useState([]);
  const { dane, blad } = useDane(`/api/psa/osoby?q=${encodeURIComponent(q)}&limit=100`);
  return (
    <Karta
      akcje={!nowa && <button type="button" className="btn btn-glowny" onClick={() => ustawNowa(true)}>Nowa osoba</button>}
    >
      {nowa && (
        <Karta tytul="Nowa osoba">
          <NowaOsoba
            przyZapisie={(o, ostrz) => { ustawNowa(false); if (ostrz.length) ustawOstrzezenia(ostrz); else idz(`/osoby/${o.id}`); }}
            przyAnulowaniu={() => ustawNowa(false)}
          />
        </Karta>
      )}
      {ostrzezenia.length > 0 && <Komunikat odmiana="uwaga" tytul="Zapisano — sprawdź" lista={ostrzezenia} />}
      <Szukajka wartosc={q} przyZmianie={ustawQ} placeholder="Nazwisko, firma, PESEL, KRS albo e-mail…" />
      {blad && <Bledy blad={blad} />}
      {!dane && !blad && <Spinner />}
      {dane && !dane.length && <Pusto tytul="Brak osób" opis={q ? 'Nikt nie pasuje do wyszukiwania.' : 'Kartoteka jest pusta.'} />}
      {dane && dane.length > 0 && (
        <table className="tabela">
          <thead><tr><th>Osoba</th><th>Identyfikator i adres</th><th>E-mail</th></tr></thead>
          <tbody>
            {dane.map((o) => (
              <tr key={o.id} className="klikalna" onClick={() => idz(`/osoby/${o.id}`)}>
                <td><a href={`#/osoby/${o.id}`}>{o.nazwa}</a></td>
                <td>{opisOsoby(o)}</td>
                <td>{o.email ? `${o.email}${o.zgoda_email ? ' (zgoda)' : ''}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Karta>
  );
}

const POLA_KARTY = ['typ', 'nazwa', 'pesel', 'data_urodzenia', 'numer_rejestru', 'adres', 'rodzaj_adresu', 'email', 'pep', 'pep_opis', 'aml_data', 'uwagi'];

function ZgodaEmail({ osoba, pliki, spolki, poZmianie }) {
  const [tryb, ustawTryb] = useState(null);
  const [plik, ustawPlik] = useState('');
  const [data, ustawDate] = useState(fmt.dzisIso());
  const [spolka, ustawSpolke] = useState(spolki[0] ? spolki[0].spolka_id : '');
  const c = useCzynnosc();
  const zmien = (zgoda) => c.wykonaj(async () => { await API.put(`/api/psa/osoby/${osoba.id}`, { zgoda_email: zgoda }); ustawTryb(null); poZmianie(); });
  const dokument = () => c.wykonaj(async () => {
    const w = await API.post(`/api/psa/osoby/${osoba.id}/dokument-zgody`, { spolka_id: spolka });
    window.open(adresPdf(w.pismo_id), '_blank', 'noopener');
    poZmianie();
  });
  return (
    <Karta tytul="Korespondencja e-mail">
      <Przelacznik
        wlaczony={Boolean(osoba.zgoda_email) || tryb === 'wlacz'}
        przyZmianie={(w) => ustawTryb(w === Boolean(osoba.zgoda_email) ? null : w ? 'wlacz' : 'wylacz')}
        etykieta="Zgoda na korespondencję e-mail"
        opis="Zgoda obejmuje też powiadomienia z rejestru e-mailem."
      />
      {tryb === 'wlacz' && (
        <div className="podsekcja">
          <Pole etykieta="Plik podpisanej zgody" podpowiedz="Najpierw dodaj plik do karty osoby (Pliki).">
            <select value={plik} onChange={(e) => ustawPlik(e.target.value)}>
              <option value="">— wybierz —</option>
              {pliki.map((f) => <option key={f.id} value={f.id}>{f.nazwa}</option>)}
            </select>
          </Pole>
          <div className="rzad">
            <button type="button" className="btn btn-glowny btn-maly" disabled={c.trwa} onClick={() => zmien({ zgoda: true, plik_id: Number(plik) || null })}>Włącz zgodę</button>
            <button type="button" className="btn btn-maly" onClick={() => ustawTryb(null)}>Anuluj</button>
          </div>
        </div>
      )}
      {tryb === 'wylacz' && (
        <div className="podsekcja">
          <Pole etykieta="Data wycofania zgody"><PoleDaty wartosc={data} przyZmianie={ustawDate} max={fmt.dzisIso()} /></Pole>
          <div className="rzad">
            <button type="button" className="btn btn-glowny btn-maly" disabled={c.trwa} onClick={() => zmien({ zgoda: false, data })}>Wyłącz zgodę</button>
            <button type="button" className="btn btn-maly" onClick={() => ustawTryb(null)}>Anuluj</button>
          </div>
        </div>
      )}
      {!osoba.zgoda_email && spolki.length > 0 && (
        <div className="rzad">
          {spolki.length > 1 && (
            <select aria-label="Spółka" value={spolka} onChange={(e) => ustawSpolke(Number(e.target.value))}>
              {spolki.map((s) => <option key={s.spolka_id} value={s.spolka_id}>{s.nazwa}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-maly" disabled={c.trwa} onClick={dokument}>Dokument zgody do podpisu</button>
        </div>
      )}
      <Bledy blad={c.blad} />
    </Karta>
  );
}

/** Konto w portalu (U-23): stan i zakres; „Zaproś do portalu” — także nowy link do hasła dla istniejącego konta. */
function KontoWPortalu({ osoba, konto, poZmianie }) {
  const [wyslano, ustawWyslano] = useState(false);
  const c = useCzynnosc();
  const zapros = () => c.wykonaj(async () => { await API.post(`/api/psa/osoby/${osoba.id}/zaproszenie`, {}); ustawWyslano(true); poZmianie(); });
  const zakres = (s) => [s.pelny && 'działa za spółkę', s.akcjonariusz && 'akcjonariusz'].filter(Boolean).join(', ');
  return (
    <Karta tytul="Konto w portalu" akcje={<button type="button" className="btn btn-maly" disabled={c.trwa} onClick={zapros}>{konto ? 'Wyślij nowy link' : 'Zaproś do portalu'}</button>}>
      {!konto ? <p className="male drugorzedny">Brak konta.</p> : (
        <>
          <p>{konto.email} — {konto.aktywne ? `konto aktywne${konto.ostatnie_logowanie ? `, ostatnie logowanie ${fmt.data(konto.ostatnie_logowanie)}` : ''}` : 'czeka na ustawienie hasła'}.</p>
          {konto.spolki.length ? (
            <ul>{konto.spolki.map((s) => <li key={s.id}><a href={`#/spolki/${s.id}`}>{s.nazwa}</a> — {zakres(s)}</li>)}</ul>
          ) : <p className="male drugorzedny">Brak dostępu do spółek (nie działa za spółkę, nie ma akcji albo zgody na e-mail).</p>}
        </>
      )}
      {wyslano && <Komunikat odmiana="rejestr" tresc={`Wysłano link na ${osoba.email}.`} />}
      <Bledy blad={c.blad} />
    </Karta>
  );
}

function EkranOsoby({ osobaId }) {
  const { dane, blad, odswiez } = useDane(`/api/psa/osoby/${osobaId}`);
  const [edycja, ustawEdycje] = useState(null);
  const [ostrzezenia, ustawOstrzezenia] = useState([]);
  const c = useCzynnosc();
  useBlokadaWyjscia(() => Boolean(edycja && dane) && POLA_KARTY.some((k) => (edycja[k] ?? null) !== (dane.osoba[k] ?? null)));
  if (blad) return <Bledy blad={blad} />;
  if (!dane) return <Spinner />;
  const o = dane.osoba;
  const { pola } = bledyApi(c.blad);
  const spolki = [...new Map(dane.akcje.map((a) => [a.spolka_id, a])).values()];
  const zapisz = () => c.wykonaj(async () => {
    const w = await API.put(`/api/psa/osoby/${o.id}`, Object.fromEntries(POLA_KARTY.map((k) => [k, edycja[k] ?? null])));
    ustawOstrzezenia(w.ostrzezenia || []);
    ustawEdycje(null);
    odswiez();
  });

  return (
    <div className="ekran-osoby">
      <NaglowekStrony
        tytul={o.nazwa}
        kontekst={opisOsoby(o)}
        akcje={!edycja && <button type="button" className="btn btn-glowny" onClick={() => ustawEdycje({ ...o })}>Edytuj</button>}
      />
      {ostrzezenia.length > 0 && <Komunikat odmiana="uwaga" lista={ostrzezenia} />}
      {edycja ? (
        <Karta tytul="Dane osoby">
          <PolaOsoby osoba={edycja} przyZmianie={ustawEdycje} bledy={pola} pelne />
          {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
          <div className="rzad">
            <button type="button" className="btn btn-glowny" onClick={zapisz} disabled={c.trwa}>Zapisz</button>
            <button type="button" className="btn" onClick={() => ustawEdycje(null)}>Anuluj</button>
          </div>
        </Karta>
      ) : (
        <Karta tytul="Dane osoby">
          <ListaDanych pary={[
            ['Rodzaj', o.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'],
            o.typ === 'prawna' ? ['Numer w rejestrze', o.numer_rejestru] : o.pesel ? ['PESEL', o.pesel] : ['Data urodzenia', fmt.data(o.data_urodzenia)],
            [o.rodzaj_adresu === 'doreczen' ? 'Adres do doręczeń' : o.typ === 'prawna' ? 'Siedziba' : 'Adres zamieszkania', o.adres],
            ['E-mail', o.email],
            ['PEP', o.pep ? `tak — ${o.pep_opis || 'bez opisu'}` : 'nie'],
            ['Weryfikacja AML', o.aml_data ? fmt.data(o.aml_data) : 'brak'],
            o.uwagi && ['Uwagi', o.uwagi],
          ]}
          />
        </Karta>
      )}
      <ZgodaEmail osoba={o} pliki={dane.pliki} spolki={spolki} poZmianie={odswiez} />
      <Karta tytul="Pliki (AML, zgody)">
        <ListaPlikow pliki={dane.pliki} />
        <DodajPlik adres={`/api/psa/osoby/${o.id}/pliki`} przyDodaniu={odswiez} />
      </Karta>
      <Karta tytul="Akcje w spółkach">
        {!dane.akcje.length ? <p className="male drugorzedny">Brak akcji.</p> : (
          <table className="tabela">
            <thead><tr><th>Spółka</th><th>Seria</th><th>Numery</th></tr></thead>
            <tbody>
              {dane.akcje.map((a, i) => (
                <tr key={i}>
                  <td><a href={`#/spolki/${a.spolka_id}`}>{a.nazwa}</a></td>
                  <td>{a.seria}</td>
                  <td>{a.nr_od === a.nr_do ? a.nr_od : `${a.nr_od}–${a.nr_do}`}{a.czesc_licznik ? ` (${a.czesc_licznik}/${a.czesc_mianownik})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Karta>
      <Karta tytul="Sprawy">
        {!dane.sprawy.length ? <p className="male drugorzedny">Brak spraw z żądania tej osoby.</p> : (
          <ul>
            {dane.sprawy.map((s) => <li key={s.id}><a href={`#/sprawy/${s.id}`}>Sprawa nr {s.id}</a> — {s.spolka}, {STANY_SPRAWY[s.stan]}</li>)}
          </ul>
        )}
      </Karta>
      <KontoWPortalu osoba={o} konto={dane.konto} poZmianie={odswiez} />
      <Sekcja tytul="Historia zmian" licznik={dane.historia.length}>
        <HistoriaZmian historia={dane.historia} />
      </Sekcja>
    </div>
  );
}

Object.assign(window, { EkranOsob, EkranOsoby });

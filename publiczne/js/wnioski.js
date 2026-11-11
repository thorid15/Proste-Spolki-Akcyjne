/* wnioski.js — wnioski w kancelarii (§ 5): lista, „Nowa spółka” (ten sam wniosek co klienta), ekran
   wniosku — dane (różnice wobec KRS podświetlone), dokumenty („Potwierdź podpis” / „Odrzuć plik”,
   podpis notariusza z osobą zawierającą umowę), checklista, notatka; „Przyjmij” → „Otwórz rejestr”. */

const STANY_WNIOSKU = { roboczy: 'Roboczy', zlozony: 'Złożony', przyjety: 'Przyjęty', odrzucony: 'Odrzucony' };
const ODMIANY_WNIOSKU = { zlozony: 'mosiadz', przyjety: 'rejestr', odrzucony: 'sygnal' };
const FILTRY_WNIOSKOW = [['zlozony', 'Złożone'], ['roboczy', 'Robocze'], ['przyjety', 'Przyjęte'], ['odrzucony', 'Odrzucone'], ['wszystkie', 'Wszystkie']];

function NowaSpolka({ przyAnulowaniu }) {
  const [f, ustawF] = useState({ krs: '', przejecie: false });
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const zaloz = () => c.wykonaj(async () => idz(`/wnioski/${(await API.post('/api/psa/wnioski', f)).wniosek.id}`));
  return (
    <Karta tytul="Nowa spółka">
      <Pole etykieta="Numer KRS" blad={pola.krs}><input type="text" inputMode="numeric" maxLength={10} value={f.krs} onChange={(e) => ustawF({ ...f, krs: e.target.value })} /></Pole>
      <label className="chk"><input type="checkbox" checked={f.przejecie} onChange={(e) => ustawF({ ...f, przejecie: e.target.checked })} /> Przejęcie rejestru od innego podmiotu</label>
      {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
      <div className="rzad">
        <button type="button" className="btn btn-glowny" onClick={zaloz} disabled={c.trwa}>Załóż wniosek</button>
        <button type="button" className="btn" onClick={przyAnulowaniu}>Anuluj</button>
      </div>
    </Karta>
  );
}

function EkranWnioskow() {
  const [filtr, ustawFiltr] = useParametrAdresu('filtr', 'zlozony');
  const [nowa, ustawNowa] = useState(false);
  const { dane, blad } = useDane(`/api/psa/wnioski${filtr === 'wszystkie' ? '' : `?stan=${filtr}`}`);
  return (
    <>
      {nowa && <NowaSpolka przyAnulowaniu={() => ustawNowa(false)} />}
      <Karta akcje={!nowa && <button type="button" className="btn btn-glowny" onClick={() => ustawNowa(true)}>Nowa spółka</button>}>
        <Filtr opcje={FILTRY_WNIOSKOW} wartosc={filtr} przyZmianie={ustawFiltr} />
        {blad && <Bledy blad={blad} />}
        {!dane && !blad && <Spinner />}
        {dane && !dane.length && <Pusto tytul="Brak wniosków" opis="Wnioski składane w portalu pojawią się tutaj." />}
        {dane && dane.length > 0 && (
          <table className="tabela">
            <thead><tr><th>KRS</th><th>Firma</th><th>Stan</th><th>Zmiana</th></tr></thead>
            <tbody>
              {dane.map((w) => (
                <tr key={w.id} className="klikalna" onClick={() => idz(`/wnioski/${w.id}`)}>
                  <td><a href={`#/wnioski/${w.id}`}>{w.krs}</a></td>
                  <td>{w.firma || '—'}{w.przejecie ? <div className="male drugorzedny">przejęcie rejestru</div> : null}</td>
                  <td><Pigulka odmiana={ODMIANY_WNIOSKU[w.stan]}>{STANY_WNIOSKU[w.stan]}</Pigulka></td>
                  <td>{fmt.data(w.zmieniono)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Karta>
    </>
  );
}

/** Wiersz dokumentu: stan, pliki, pobranie, sprawdzenie podpisu, wgranie przez pracownika. */
function DokumentKancelarii({ id, d, osobyUmow, ustawP, edycja }) {
  const [odrzuc, ustawOdrzuc] = useState(null);
  const [zawarl, ustawZawarl] = useState(osobyUmow[0] || '');
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const ocen = (stan, powod) => c.wykonaj(async () => { ustawP(await API.post(`/api/psa/wnioski/${id}/pliki/${d.plik.id}`, { stan, powod })); ustawOdrzuc(null); });
  const przeladuj = () => API.get(`/api/psa/wnioski/${id}`).then(ustawP);
  return (
    <li className="dokument-wniosku">
      <div className="rzad-rozdzielony">
        <strong>{d.nazwa}</strong>
        <Pigulka odmiana={ODMIANY_DOKUMENTU[d.stan]}>{STANY_DOKUMENTU[d.stan]}</Pigulka>
      </div>
      <div className="rzad">
        {d.pismo_id && <a className="btn btn-maly" href={`/api/psa/wnioski/${id}/dokumenty/${d.pismo_id}`} download>Pobierz dokument</a>}
        {d.plik && <a className="btn btn-maly btn-cichy" href={`/api/psa/wnioski/${id}/pliki/${d.plik.id}`} download>{d.plik.nazwa}</a>}
        {d.stan === 'do_sprawdzenia' && edycja && (
          <>
            <button type="button" className="btn btn-maly btn-glowny" onClick={() => ocen('potwierdzony')} disabled={c.trwa}>Potwierdź podpis</button>
            <button type="button" className="btn btn-maly" onClick={() => ustawOdrzuc('')}>Odrzuć plik</button>
          </>
        )}
        {edycja && d.stan !== 'potwierdzony' && <DodajPlik adres={`/api/psa/wnioski/${id}/pliki`} pola={{ dokument: d.klucz }} przyDodaniu={przeladuj} />}
      </div>
      {d.plik && d.plik.powod_odrzucenia && d.stan === 'odrzucony' && <p className="male drugorzedny">Powód: {d.plik.powod_odrzucenia}</p>}
      {odrzuc !== null && (
        <div className="rzad">
          <Pole etykieta="Powód (zobaczy go klient)" blad={pola.powod}><input type="text" value={odrzuc} onChange={(e) => ustawOdrzuc(e.target.value)} /></Pole>
          <button type="button" className="btn btn-maly btn-glowny" onClick={() => ocen('odrzucony', odrzuc)}>Odrzuć</button>
          <button type="button" className="btn btn-maly" onClick={() => ustawOdrzuc(null)}>Anuluj</button>
        </div>
      )}
      {d.klucz === 'umowa' && (
        <div className="podsekcja">
          {d.notariusz ? (
            <p>Umowa z podpisem notariusza: <a href={`/api/psa/wnioski/${id}/pliki/${d.notariusz.id}`} download>{d.notariusz.nazwa}</a></p>
          ) : edycja && d.stan === 'potwierdzony' && (
            <div className="rzad">
              <Pole etykieta="Umowę zawiera">
                <select value={zawarl} onChange={(e) => ustawZawarl(e.target.value)}>
                  {osobyUmow.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Pole>
              <DodajPlik adres={`/api/psa/wnioski/${id}/pliki`} pola={{ dokument: 'umowa_notariusz', umowe_zawarl: zawarl }} etykieta="Wgraj podpis notariusza" przyDodaniu={przeladuj} />
            </div>
          )}
        </div>
      )}
      {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
    </li>
  );
}

function EkranWnioskuKancelarii({ wniosekId }) {
  const { dane, blad } = useDane(`/api/psa/wnioski/${wniosekId}`);
  const [p, ustawP] = useState(null);
  useEffect(() => { if (dane) ustawP(dane); }, [dane]);
  if (blad) return <Bledy blad={blad} />;
  if (!p) return <Spinner />;
  return <Wniosek key={`${p.wniosek.id}-${p.wniosek.stan}`} p={p} ustawP={ustawP} />;
}

function Wniosek({ p, ustawP }) {
  const w = p.wniosek;
  const id = w.id;
  const roboczy = w.stan === 'roboczy';
  const [wartosci, ustawWartosci] = useState(() => ({ dane: w.dane, dotychczasowy_podmiot: w.dotychczasowy_podmiot || '', data_przejecia: w.data_przejecia || '' }));
  const [dodatkowe, ustawDodatkowe] = useState(() => ({ notatka: w.notatka || '', dotychczasowy_podmiot: w.dotychczasowy_podmiot || '', data_przejecia: w.data_przejecia || '' }));
  const [wybory, ustawWybory] = useState({});
  const [zwrot, ustawZwrot] = useState(null);
  const [odmowa, ustawOdmowe] = useState(null);
  const zapis = useZapisWniosku(`/api/psa/wnioski/${id}`, roboczy ? { ...wartosci, notatka: dodatkowe.notatka } : dodatkowe, ustawP);
  // Stan wniosku zmienia się tylko przez czynność — ekran składa się wtedy od nowa (klucz komponentu ze stanem).
  const c = useCzynnosc();
  const pola = { ...bledyApi({ bledy: p.bledy }).pola, ...bledyApi(c.blad).pola };
  const krs = Object.fromEntries(p.krs.roznice.map((k) => [k, p.krs.dane[k]]));
  const stan = (s, dane = {}) => c.wykonaj(async () => {
    if (!(await zapis.teraz())) return;
    ustawP(await API.post(`/api/psa/wnioski/${id}/stan`, { stan: s, ...dane }));
    ustawZwrot(null);
    ustawOdmowe(null);
  });
  const otworz = () => c.wykonaj(async () => idz(`/sprawy/${(await API.post(`/api/psa/wnioski/${id}/otworz`, {})).sprawa_id}`));
  // Zaznaczenie widać od razu; zapis w tle.
  const [zaznaczone, ustawZaznaczone] = useState(() => ({ ...w.checklista }));
  const zaznacz = (klucz, v) => {
    const nowe = { ...zaznaczone, [klucz]: v };
    ustawZaznaczone(nowe);
    c.wykonaj(async () => ustawP(await API.put(`/api/psa/wnioski/${id}`, { checklista: nowe })));
  };

  let glowny = null;
  if (roboczy) glowny = { etykieta: 'Złóż — przygotuj dokumenty', przyKlik: () => stan('zlozony'), powod: p.bledy.length ? 'Uzupełnij dane wniosku.' : null };
  else if (w.stan === 'zlozony') glowny = { etykieta: 'Przyjmij', przyKlik: () => stan('przyjety', { osoby: wybory }), powod: p.przeszkody.length ? 'Najpierw załatw punkty „Przed przyjęciem”.' : null };
  else if (w.stan === 'przyjety' && p.otwarcie.sprawa) glowny = { etykieta: 'Sprawa otwarcia rejestru', przyKlik: () => idz(`/sprawy/${p.otwarcie.sprawa.id}`) };
  else if (w.stan === 'przyjety') glowny = { etykieta: 'Otwórz rejestr', przyKlik: otworz, powod: p.otwarcie.powod };

  return (
    <div className="ekran-wniosku">
      <NaglowekStrony
        tytul={w.dane.spolka && w.dane.spolka.nazwa ? w.dane.spolka.nazwa : `Wniosek KRS ${w.krs}`}
        kontekst={(
          <span className="rzad">
            <span>KRS {w.krs}</span>
            {w.przejecie && <span>przejęcie rejestru</span>}
            {p.konto && <span>konto: {p.konto.email}{p.konto.aktywne ? '' : ' (nieaktywne)'}</span>}
            <Pigulka odmiana={ODMIANY_WNIOSKU[w.stan]}>{STANY_WNIOSKU[w.stan]}</Pigulka>
            {w.spolka_id && <a href={`#/spolki/${w.spolka_id}`}>kokpit spółki</a>}
          </span>
        )}
        akcje={(
          <span className="rzad">
            <StanZapisu stan={zapis} />
            {glowny && <PrzyciskGlowny {...glowny} trwa={c.trwa} />}
            <Wiecej akcje={[
              w.stan === 'zlozony' && { etykieta: 'Zwróć do uzupełnienia', przyKlik: () => ustawZwrot('') },
              w.stan === 'zlozony' && { etykieta: 'Odrzuć', przyKlik: () => ustawOdmowe(''), niebezpieczna: true },
            ]}
            />
          </span>
        )}
      />
      <Bledy blad={c.blad} />
      {p.spolka_w_rejestrze && <Komunikat odmiana="uwaga" tresc="Spółka o tym numerze KRS jest już w rejestrze kancelarii." />}
      {!p.krs.dopuszczalna && <Komunikat odmiana="uwaga" tresc="Według KRS podmiot nie jest prostą spółką akcyjną." />}
      {p.krs.roznice.length > 0 && <Komunikat tresc="Pola różniące się od KRS mają pod spodem wartość z KRS." />}

      {zwrot !== null && (
        <Karta tytul="Zwróć do uzupełnienia">
          <Pole etykieta="Co klient ma uzupełnić" blad={pola.notatka}><textarea rows={3} value={zwrot} onChange={(e) => ustawZwrot(e.target.value)} /></Pole>
          <div className="rzad">
            <button type="button" className="btn btn-glowny" onClick={() => stan('roboczy', { notatka: zwrot })}>Zwróć wniosek</button>
            <button type="button" className="btn" onClick={() => ustawZwrot(null)}>Anuluj</button>
          </div>
        </Karta>
      )}
      {odmowa !== null && (
        <Modal
          tytul="Odrzucenie wniosku"
          przyZamknieciu={() => ustawOdmowe(null)}
          stopka={(
            <>
              <button type="button" className="btn" onClick={() => ustawOdmowe(null)}>Anuluj</button>
              <button type="button" className="btn btn-danger" onClick={() => stan('odrzucony', { przyczyna: odmowa })} disabled={c.trwa}>Odrzuć wniosek</button>
            </>
          )}
        >
          <Pole etykieta="Przyczyna odmowy zawarcia umowy" blad={pola.przyczyna}><textarea rows={3} value={odmowa} onChange={(e) => ustawOdmowe(e.target.value)} /></Pole>
          <p className="male drugorzedny">Powiadomienie o odmowie pójdzie listem (Korespondencja). Odrzucenia nie można cofnąć.</p>
        </Modal>
      )}

      {w.stan === 'zlozony' && p.przeszkody.length > 0 && <Komunikat odmiana="uwaga" tytul="Przed przyjęciem" lista={p.przeszkody} />}
      {p.osoby.some((o) => o.pasujace.length) && (
        <Karta tytul="Osoby już w kartotece">
          {p.osoby.filter((o) => o.pasujace.length).map((o) => (
            <Pole key={o.klucz} etykieta={`${o.nazwa} (${o.rola})`} blad={pola[`osoby.${o.klucz}`]}>
              <div className="rzad" role="group">
                {o.pasujace.map((x) => (
                  <button key={x.id} type="button" className={`btn btn-maly ${wybory[o.klucz] === x.id ? 'btn-glowny' : ''}`} aria-pressed={wybory[o.klucz] === x.id} onClick={() => ustawWybory({ ...wybory, [o.klucz]: x.id })}>Istniejąca: {x.nazwa}</button>
                ))}
                <button type="button" className={`btn btn-maly ${wybory[o.klucz] === 'nowa' ? 'btn-glowny' : ''}`} aria-pressed={wybory[o.klucz] === 'nowa'} onClick={() => ustawWybory({ ...wybory, [o.klucz]: 'nowa' })}>Nowa osoba</button>
              </div>
            </Pole>
          ))}
        </Karta>
      )}

      {w.stan !== 'roboczy' && (
        <Karta tytul="Dokumenty">
          <ul className="dokumenty-wniosku">
            {p.dokumenty.map((d) => <DokumentKancelarii key={d.klucz} id={id} d={d} osobyUmow={p.osoby_zawierajace_umowy} ustawP={ustawP} edycja={w.stan === 'zlozony'} />)}
          </ul>
        </Karta>
      )}
      {['zlozony', 'przyjety'].includes(w.stan) && (
        <Karta tytul="Checklista">
          <div className="checklista">
            {p.checklista.map((x) => (
              <label key={x.klucz} className="chk">
                <input type="checkbox" checked={Boolean(zaznaczone[x.klucz])} disabled={w.stan !== 'zlozony'} onChange={(e) => zaznacz(x.klucz, e.target.checked)} />
                <span className="chk-tresc">{x.etykieta}</span>
              </label>
            ))}
          </div>
        </Karta>
      )}
      {w.przejecie && !roboczy && w.stan !== 'odrzucony' && (
        <Karta tytul="Przejęcie rejestru">
          <div className="siatka-2">
            <Pole etykieta="Dotychczasowy podmiot" blad={pola.dotychczasowy_podmiot}><input type="text" value={dodatkowe.dotychczasowy_podmiot} onChange={(e) => ustawDodatkowe({ ...dodatkowe, dotychczasowy_podmiot: e.target.value })} /></Pole>
            <Pole etykieta="Data przejęcia" opcjonalne blad={pola.data_przejecia}><PoleDaty wartosc={dodatkowe.data_przejecia} przyZmianie={(v) => ustawDodatkowe({ ...dodatkowe, data_przejecia: v })} /></Pole>
          </div>
        </Karta>
      )}

      <fieldset className="krok-tresci" disabled={!roboczy}>
        <FormularzWniosku
          dane={wartosci.dane}
          ustawDane={(d) => ustawWartosci({ ...wartosci, dane: d })}
          pola={pola}
          kwoty={p.kwoty}
          krs={krs}
          przejecie={roboczy ? { dotyczy: w.przejecie, dotychczasowy_podmiot: wartosci.dotychczasowy_podmiot, data_przejecia: wartosci.data_przejecia, ustaw: (z) => ustawWartosci({ ...wartosci, ...z }) } : null}
        />
      </fieldset>
      {p.krs.reprezentacja && <Karta tytul="Reprezentacja według KRS"><p>{p.krs.reprezentacja}</p></Karta>}
      <Karta tytul="Notatka">
        <Pole etykieta="Notatka (widzi ją klient przy zwrocie do uzupełnienia)" opcjonalne>
          <textarea rows={2} value={dodatkowe.notatka} onChange={(e) => ustawDodatkowe({ ...dodatkowe, notatka: e.target.value })} disabled={!['roboczy', 'zlozony'].includes(w.stan)} />
        </Pole>
      </Karta>
      {p.pisma.some((x) => x.typ === 'powiadomienie_odmowa') && (
        <Karta tytul="Pisma"><p>Powiadomienie o odmowie zawarcia umowy — w <a href="#/korespondencja?filtr=listy">Korespondencji</a>.</p></Karta>
      )}
    </div>
  );
}

Object.assign(window, { EkranWnioskow, EkranWnioskuKancelarii, NowaSpolka });

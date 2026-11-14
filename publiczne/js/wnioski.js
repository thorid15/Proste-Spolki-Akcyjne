/* wnioski.js — nowy rejestr w kancelarii (D-233): wniosek klienta z portalu albo „Nowa spółka” to jedna strona —
   1. Spółka → 2. Akcje i akcjonariusze (numery wpisuje pracownik) → 3. Dokumenty → 4. Otwarcie rejestru.
   „Otwórz rejestr” przyjmuje wniosek i dokonuje wpisu otwarcia jedną czynnością. */

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

const projektZWidoku = (pr, spolka) => ({
  serie: pr.serie.length ? pr.serie : [{ seria: 'A', numery: '', liczba: '', data_wpisu_krs: (spolka && spolka.data_rejestracji) || '' }],
  akcje: pr.akcje || {},
  atrybuty: pr.atrybuty || [],
  umorzone: pr.umorzone || [],
  checklista: pr.checklista || { dokumenty: false, identyfikacja: false },
});

const liczbaZPola = (v) => (/^\d+$/.test(String(v || '').trim()) ? Number(v) : 0);

function SekcjaRejestru({ numer, tytul, stan, children }) {
  return (
    <section className="karta sekcja-wpisu">
      <div className="rzad-rozdzielony sekcja-wpisu-naglowek">
        <h2 className="karta-tytul"><span className="numer-sekcji">{numer}.</span> {tytul}</h2>
        {stan}
      </div>
      {children}
    </section>
  );
}

function Wniosek({ p, ustawP }) {
  const w = p.wniosek;
  const id = w.id;
  const roboczy = w.stan === 'roboczy';
  const zlozony = w.stan === 'zlozony';
  const edycjaProjektu = roboczy || zlozony;
  const [wartosci, ustawWartosci] = useState(() => ({ dane: w.dane, dotychczasowy_podmiot: w.dotychczasowy_podmiot || '', data_przejecia: w.data_przejecia || '' }));
  const [dodatkowe, ustawDodatkowe] = useState(() => ({ notatka: w.notatka || '', dotychczasowy_podmiot: w.dotychczasowy_podmiot || '', data_przejecia: w.data_przejecia || '' }));
  const [projekt, ustawProjekt] = useState(() => projektZWidoku(p.projekt, w.dane.spolka));
  const [wybory, ustawWybory] = useState({});
  const [potwierdzKonto, ustawPotwierdzKonto] = useState(false);
  const [zwrot, ustawZwrot] = useState(null);
  const [odmowa, ustawOdmowe] = useState(null);
  const [proba, ustawProbe] = useState(false);
  const doZapisu = !edycjaProjektu ? {} : roboczy ? { ...wartosci, notatka: dodatkowe.notatka, otwarcie: projekt } : { ...dodatkowe, otwarcie: projekt };
  const zapis = useZapisWniosku(`/api/psa/wnioski/${id}`, doZapisu, ustawP);
  // Stan wniosku zmienia się tylko przez czynność — ekran składa się wtedy od nowa (klucz komponentu ze stanem).
  const c = useCzynnosc();
  const polaSerwera = { ...bledyApi({ bledy: roboczy && proba ? p.bledy : [] }).pola, ...bledyApi(c.blad).pola };
  const b = (sciezka) => polaSerwera[`otwarcie.${sciezka}`];
  const krs = Object.fromEntries(p.krs.roznice.map((k) => [k, p.krs.dane[k]]));
  const stan = (st, dane = {}) => c.wykonaj(async () => {
    if (!(await zapis.teraz())) return;
    ustawP(await API.post(`/api/psa/wnioski/${id}/stan`, { stan: st, ...dane }));
    ustawZwrot(null);
    ustawOdmowe(null);
  });
  const zloz = () => { ustawProbe(true); if (!p.bledy.length) stan('zlozony'); else window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const otworz = () => c.wykonaj(async () => {
    ustawProbe(true);
    if (!(await zapis.teraz())) return;
    const wynik = await API.post(`/api/psa/wnioski/${id}/otworz-rejestr`, { osoby: wybory, potwierdz_konto: potwierdzKonto });
    idz(`/spolki/${wynik.spolka_id}`);
  });
  // Zaznaczenie widać od razu; zapis w tle.
  const [zaznaczone, ustawZaznaczone] = useState(() => ({ ...w.checklista }));
  const zaznacz = (klucz, v) => {
    const nowe = { ...zaznaczone, [klucz]: v };
    ustawZaznaczone(nowe);
    c.wykonaj(async () => ustawP(await API.put(`/api/psa/wnioski/${id}`, { checklista: nowe })));
  };

  const akcjonariusze = p.projekt.akcjonariusze;
  const pakiety = (klucz) => (projekt.akcje[klucz] && projekt.akcje[klucz].length ? projekt.akcje[klucz] : [{ seria: projekt.serie.length === 1 ? projekt.serie[0].seria : '', numery: '', liczba: '' }]);
  const ustawPakiety = (klucz, akcje) => ustawProjekt({ ...projekt, akcje: { ...projekt.akcje, [klucz]: akcje } });
  const wyemitowane = projekt.serie.reduce((suma, x) => suma + liczbaZPola(x.liczba), 0) - projekt.umorzone.reduce((suma, x) => suma + liczbaZPola(x.liczba), 0);
  const calePakiety = akcjonariusze.flatMap((a) => pakiety(a.klucz)).filter((x) => !String(x.ulamek || '').trim());
  const rozdzielone = calePakiety.reduce((suma, x) => suma + liczbaZPola(x.liczba), 0);
  const saUlamki = akcjonariusze.some((a) => pakiety(a.klucz).some((x) => String(x.ulamek || '').trim()));
  const akcjeGotowe = wyemitowane > 0 && (saUlamki || rozdzielone === wyemitowane);

  const otwarty = w.stan === 'przyjety' && !p.otwarcie.mozliwe && /otwarty/.test(p.otwarcie.powod || '');
  const brakiOtwarcia = [
    ...(zlozony ? p.przeszkody : []),
    p.projekt.przeszkoda,
    !akcjeGotowe && (wyemitowane > 0 ? `Rozdziel wszystkie akcje między akcjonariuszy (${fmt.liczba(rozdzielone)} z ${fmt.liczba(wyemitowane)}).` : 'Wpisz serie i numery akcji.'),
    !(projekt.checklista.dokumenty && projekt.checklista.identyfikacja) && 'Odhacz: dokumenty zbadane oraz identyfikacja osób i AML.',
    ...p.osoby.filter((o) => o.pasujace.length && wybory[o.klucz] === undefined).map((o) => `${o.nazwa}: wybierz osobę z kartoteki albo nową.`),
  ].filter(Boolean);

  const s = wartosci.dane.spolka;
  const r = wartosci.dane.reprezentant;
  const wybranyReprezentant = (p.osoby.find((o) => o.klucz === 'reprezentant') || { pasujace: [] }).pasujace.find((x) => x.id === wybory.reprezentant);

  return (
    <div className="ekran-wniosku ekran-wpisu">
      <NaglowekStrony
        tytul={s && s.nazwa ? s.nazwa : `Wniosek KRS ${w.krs}`}
        kontekst={(
          <span className="rzad">
            <span>KRS <span className="dane">{w.krs}</span></span>
            <Pigulka odmiana={otwarty ? 'rejestr' : 'mosiadz'}>{otwarty ? 'rejestr otwarty' : w.stan === 'odrzucony' ? 'wniosek odrzucony' : 'projekt rejestru'}</Pigulka>
            {w.przejecie && <span>przejęcie rejestru</span>}
            {p.konto && <span>wniosek klienta: {p.konto.email}{p.konto.aktywne ? '' : ' (konto nieaktywne)'}</span>}
            {w.spolka_id && <a href={`#/spolki/${w.spolka_id}`}>rejestr spółki</a>}
          </span>
        )}
        akcje={(
          <span className="rzad">
            <StanZapisu stan={zapis} />
            <Wiecej akcje={[
              zlozony && { etykieta: 'Zwróć do uzupełnienia', przyKlik: () => ustawZwrot('') },
              zlozony && { etykieta: 'Odrzuć wniosek', przyKlik: () => ustawOdmowe(''), niebezpieczna: true },
            ]}
            />
          </span>
        )}
      />
      <Bledy blad={c.blad} />
      {p.spolka_w_rejestrze && <Komunikat odmiana="uwaga" tresc="Spółka o tym numerze KRS jest już w rejestrze kancelarii." />}
      {!p.krs.dopuszczalna && <Komunikat odmiana="uwaga" tresc="Według KRS podmiot nie jest prostą spółką akcyjną." />}
      {otwarty && <Komunikat odmiana="rejestr" tresc="Rejestr tej spółki jest otwarty — dalsze wpisy w rejestrze spółki." />}

      {zwrot !== null && (
        <Karta tytul="Zwróć do uzupełnienia">
          <Pole etykieta="Co klient ma uzupełnić" blad={polaSerwera.notatka}><textarea rows={3} value={zwrot} onChange={(e) => ustawZwrot(e.target.value)} /></Pole>
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
          <Pole etykieta="Przyczyna odmowy zawarcia umowy" blad={polaSerwera.przyczyna}><textarea rows={3} value={odmowa} onChange={(e) => ustawOdmowe(e.target.value)} /></Pole>
          <p className="male drugorzedny">Powiadomienie o odmowie pójdzie listem (Korespondencja). Odrzucenia nie można cofnąć.</p>
        </Modal>
      )}

      <SekcjaRejestru numer={1} tytul="Spółka" stan={p.krs.roznice.length > 0 ? <span className="male drugorzedny">pola różne od KRS mają pod spodem wartość z KRS</span> : <span className="male bedzie">zgodne z KRS</span>}>
        {roboczy ? (
          <FormularzWniosku
            kancelaria
            dane={wartosci.dane}
            ustawDane={(d) => ustawWartosci({ ...wartosci, dane: d })}
            pola={polaSerwera}
            kwoty={p.kwoty}
            krs={krs}
            sekcje={['spolka', 'platnosc', 'przejecie', 'reprezentant']}
            przejecie={{ dotyczy: w.przejecie, dotychczasowy_podmiot: wartosci.dotychczasowy_podmiot, data_przejecia: wartosci.data_przejecia, ustaw: (z) => ustawWartosci({ ...wartosci, ...z }) }}
          />
        ) : (
          <>
            <ListaDanych pary={[
              ['Firma', s.nazwa], ['Siedziba i adres', [s.siedziba, s.adres].filter(Boolean).join(', ')], ['Sąd rejestrowy', s.sad_rejestrowy],
              ['Data rejestracji spółki', s.data_rejestracji ? fmt.data(s.data_rejestracji) : '—'], ['NIP', s.nip || '—'], ['E-mail spółki', s.email || '—'],
              ['Opłata za prowadzenie', wartosci.dane.platnosc === 'miesieczna' ? 'co miesiąc' : 'raz w roku'],
              ['Umowę podpisuje', [r.nazwa, r.funkcja].filter(Boolean).join(', ')],
            ]}
            />
            {p.krs.reprezentacja && <p className="male drugorzedny">Reprezentacja według KRS: {p.krs.reprezentacja}</p>}
            {w.przejecie && w.stan !== 'odrzucony' && (
              <fieldset className="pola-wpisu dane-pomocnicze" disabled={!zlozony}>
                <div className="siatka-2">
                  <Pole etykieta="Dotychczasowy podmiot prowadzący rejestr" blad={polaSerwera.dotychczasowy_podmiot}><input type="text" value={dodatkowe.dotychczasowy_podmiot} onChange={(e) => ustawDodatkowe({ ...dodatkowe, dotychczasowy_podmiot: e.target.value })} /></Pole>
                  <Pole etykieta="Dzień przejęcia" blad={polaSerwera.data_przejecia} podpowiedz="Rejestr można otworzyć od tego dnia."><PoleDaty wartosc={dodatkowe.data_przejecia} przyZmianie={(v) => ustawDodatkowe({ ...dodatkowe, data_przejecia: v })} /></Pole>
                </div>
              </fieldset>
            )}
          </>
        )}
      </SekcjaRejestru>

      <SekcjaRejestru
        numer={2}
        tytul="Akcje i akcjonariusze"
        stan={wyemitowane > 0 && <span className={`male ${akcjeGotowe ? 'bedzie' : 'drugorzedny'}`}>rozdzielono {fmt.liczba(rozdzielone)} z {fmt.liczba(wyemitowane)}{saUlamki ? ' oraz ułamki' : ''}</span>}
      >
        {roboczy && (
          <FormularzWniosku kancelaria dane={wartosci.dane} ustawDane={(d) => ustawWartosci({ ...wartosci, dane: d })} pola={polaSerwera} kwoty={p.kwoty} krs={krs} sekcje={['akcjonariusze']} />
        )}
        <fieldset className="pola-wpisu" disabled={!edycjaProjektu}>
          <h3 className="tytul-zmiany">Serie</h3>
          <SerieOtwarcia serie={projekt.serie} przyZmianie={(serie) => ustawProjekt({ ...projekt, serie })} b={b} />
          <h3 className="tytul-zmiany">Akcje akcjonariuszy</h3>
          {!akcjonariusze.length && <p className="male drugorzedny">Dodaj akcjonariuszy — pola na numery akcji pojawią się przy każdym z nich.</p>}
          {akcjonariusze.map((a) => (
            <div className="zmiana" key={a.klucz}>
              <div><strong>{a.nazwa || 'Akcjonariusz bez nazwy'}</strong> <span className="male drugorzedny">{a.opis}</span></div>
              <EdytorAkcji akcje={pakiety(a.klucz)} przyZmianie={(akcje) => ustawPakiety(a.klucz, akcje)} b={(sciezka) => b(`akcje.${a.klucz}${sciezka ? `.${sciezka}` : ''}`)} ulamek />
            </div>
          ))}
          <Sekcja tytul="Obciążenia, ograniczenia, uprawnienia i akcje umorzone" licznik={projekt.atrybuty.length + projekt.umorzone.length || undefined}>
            <AtrybutyOtwarcia atrybuty={projekt.atrybuty} przyZmianie={(atrybuty) => ustawProjekt({ ...projekt, atrybuty })} b={b} />
            <UmorzoneOtwarcia umorzone={projekt.umorzone} przyZmianie={(umorzone) => ustawProjekt({ ...projekt, umorzone })} b={b} />
          </Sekcja>
        </fieldset>
      </SekcjaRejestru>

      <SekcjaRejestru numer={3} tytul="Dokumenty">
        {roboczy ? (
          <p className="male drugorzedny">Umowa o prowadzenie rejestru, uchwała i zgody powstaną z danych wyżej po złożeniu wniosku.</p>
        ) : (
          <ul className="dokumenty-wniosku">
            {p.dokumenty.map((d) => <DokumentKancelarii key={d.klucz} id={id} d={d} osobyUmow={p.osoby_zawierajace_umowy} ustawP={ustawP} edycja={zlozony} />)}
          </ul>
        )}
        {p.pisma.some((x) => x.typ === 'powiadomienie_odmowa') && <p>Powiadomienie o odmowie zawarcia umowy — w <a href="#/korespondencja?filtr=listy">Korespondencji</a>.</p>}
      </SekcjaRejestru>

      {roboczy && (
        <div className="pasek-wpisu">
          <div className="pasek-wpisu-braki" aria-live="polite">
            {proba && p.bledy.length > 0 ? (
              <>
                <strong>Uzupełnij dane</strong>
                <ul>{[...new Set(p.bledy.map((x) => x.komunikat))].slice(0, 6).map((k) => <li key={k}>{k}</li>)}</ul>
              </>
            ) : <span>Po złożeniu powstaną dokumenty do podpisu. Dane spółki i akcjonariuszy będzie można zmienić tylko przez zwrot do uzupełnienia.</span>}
          </div>
          <button type="button" className="btn btn-glowny btn-duzy" onClick={zloz} disabled={c.trwa}>Złóż — przygotuj dokumenty</button>
        </div>
      )}

      {zlozony && (
        <SekcjaRejestru numer={4} tytul="Otwarcie rejestru">
          {p.osoby.some((o) => o.pasujace.length) && (
            <>
              <h3 className="tytul-zmiany">Osoby już w kartotece</h3>
              {p.osoby.filter((o) => o.pasujace.length).map((o) => (
                <Pole key={o.klucz} etykieta={`${o.nazwa} (${o.rola})`} blad={polaSerwera[`osoby.${o.klucz}`]}>
                  <div className="rzad" role="group">
                    {o.pasujace.map((x) => (
                      <button key={x.id} type="button" className={`btn btn-maly ${wybory[o.klucz] === x.id ? 'btn-wybrany' : ''}`} aria-pressed={wybory[o.klucz] === x.id} onClick={() => ustawWybory({ ...wybory, [o.klucz]: x.id })}>Ta sama co w kartotece: {x.nazwa}</button>
                    ))}
                    <button type="button" className={`btn btn-maly ${wybory[o.klucz] === 'nowa' ? 'btn-wybrany' : ''}`} aria-pressed={wybory[o.klucz] === 'nowa'} onClick={() => ustawWybory({ ...wybory, [o.klucz]: 'nowa' })}>Nowa osoba</button>
                  </div>
                </Pole>
              ))}
              {wybranyReprezentant && wybranyReprezentant.ostrzezenie && (
                <label className="chk">
                  <input type="checkbox" checked={potwierdzKonto} onChange={(e) => ustawPotwierdzKonto(e.target.checked)} />
                  <span className="chk-tresc">{wybranyReprezentant.ostrzezenie}</span>
                </label>
              )}
              {polaSerwera.potwierdz_konto && !potwierdzKonto && <p className="pole-blad">{polaSerwera.potwierdz_konto}</p>}
            </>
          )}

          <h3 className="tytul-zmiany">Sprawdzone</h3>
          <div className="checklista">
            {p.checklista.map((x) => (
              <label key={x.klucz} className="chk">
                <input type="checkbox" checked={Boolean(zaznaczone[x.klucz])} onChange={(e) => zaznacz(x.klucz, e.target.checked)} />
                <span className="chk-tresc">{x.etykieta}</span>
              </label>
            ))}
            {[['dokumenty', 'Dokumenty zbadane co do treści i formy'], ['identyfikacja', 'Identyfikacja osób i AML — wykonano albo nie dotyczy']].map(([klucz, etykieta]) => (
              <label key={klucz} className="chk">
                <input type="checkbox" checked={Boolean(projekt.checklista[klucz])} onChange={(e) => ustawProjekt({ ...projekt, checklista: { ...projekt.checklista, [klucz]: e.target.checked } })} />
                <span className="chk-tresc">{etykieta}</span>
              </label>
            ))}
          </div>

          <Pole etykieta="Notatka (klient zobaczy ją przy zwrocie do uzupełnienia)" opcjonalne>
            <textarea rows={2} value={dodatkowe.notatka} onChange={(e) => ustawDodatkowe({ ...dodatkowe, notatka: e.target.value })} />
          </Pole>
        </SekcjaRejestru>
      )}

      {zlozony && (
        <div className="pasek-wpisu">
          <div className="pasek-wpisu-braki" aria-live="polite">
            {brakiOtwarcia.length > 0 ? (
              <>
                <strong>Zostało do zrobienia</strong>
                <ul>{[...new Set(brakiOtwarcia)].map((k) => <li key={k}>{k}</li>)}</ul>
              </>
            ) : <span>Wszystko gotowe. Otwarcie przyjmuje wniosek, dokonuje pierwszego wpisu i nalicza pierwszą opłatę za prowadzenie.</span>}
          </div>
          <button type="button" className="btn btn-glowny btn-duzy" onClick={otworz} disabled={c.trwa || brakiOtwarcia.length > 0}>{c.trwa ? 'Chwileczkę…' : 'Otwórz rejestr'}</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { EkranWnioskow, EkranWnioskuKancelarii, NowaSpolka, ODMIANY_WNIOSKU });

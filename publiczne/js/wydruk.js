/* wydruk.js — ekran informacji z rejestru akcjonariuszy.

   Sam DOKUMENT składa serwer (server/logika/dokumenty-tresc.js); ten plik
   daje tylko pasek wyboru odbiorcy i dnia oraz ramkę z podglądem. Czego NIE
   umieszczamy na pismach dla klienta (sekcja 10 specyfikacji): pola `uwagi`,
   checklist weryfikacji, notatek AML, danych kontaktowych innych akcjonariuszy
   ani skrótów — maskowanie robi API, nie warstwa widoku. */

/* ─────────────────────────────────────────────────────
   INFORMACJA Z REJESTRU (art. 300(35) § 3 KSH)

   JEDYNY dokument, jaki aplikacja wystawia ze stanu rejestru. Wcześniej stał
   obok niego „raport" — dokument roboczy kancelarii o tej samej treści, bez
   maskowania i bez podpisu. Ustawa czegoś takiego nie zna: art. 300(35) zna
   prawo dostępu do danych (§ 2) i prawo żądania INFORMACJI z rejestru (§ 3),
   nic ponadto. Zostaje więc jedno pismo, a różnicę „dla kogo" niesie wybór
   odbiorcy, od którego zależy maskowanie z § 1(1).

   TREŚĆ pisma powstaje wyłącznie na serwerze
   (`server/logika/dokumenty-tresc.js: informacjaZRejestru`). Ten plik składał
   ją wcześniej po raz drugi, w Reakcie — czyli ten sam dokument ustawowy miał
   dwa niezależne rendery i poprawka musiała trafić w oba, inaczej notariusz
   podpisywał co innego, niż widział klient w portalu. Ekran kancelarii jest
   teraz podglądem tego samego pliku, który dostaje klient.
   ───────────────────────────────────────────────────── */

const ROLE_INFORMACJI = [
  { wartosc: 'spolka', nazwa: 'spółka' },
  { wartosc: 'akcjonariusz', nazwa: 'akcjonariusz' },
  { wartosc: 'organ', nazwa: 'sąd, prokurator, komornik, organ egzekucyjny' },
  { wartosc: 'kancelaria', nazwa: 'na potrzeby wewnętrzne kancelarii' },
];

const ORGANY_INFORMACJI = ['sąd', 'prokurator', 'komornik sądowy', 'administracyjny organ egzekucyjny'];

function EkranInformacji({ spolkaId, dataPoczatkowa }) {
  const [data, ustawDate] = useState(dataPoczatkowa || fmt.dzisIso());
  const [rola, ustawRole] = useState('spolka');
  const [odbiorca, ustawOdbiorce] = useState('');
  const [organ, ustawOrgan] = useState('sąd');
  const ramka = useRef(null);

  // Lista akcjonariuszy potrzebna WYŁĄCZNIE do wyboru odbiorcy w pasku —
  // treść dokumentu bierze się z serwera, nie stąd.
  const stan = useDane(`/api/psa/spolki/${spolkaId}/stan?data=${data}`, [data]);
  const nazwaSpolki = stan.dane && stan.dane.spolka ? stan.dane.spolka.nazwa : null;

  const adres =
    `/api/psa/spolki/${spolkaId}/informacja.html?data=${encodeURIComponent(data)}`
    + `&rola=${encodeURIComponent(rola)}`
    + (rola === 'akcjonariusz' && odbiorca ? `&odbiorca=${encodeURIComponent(odbiorca)}` : '')
    + (rola === 'organ' ? `&organ=${encodeURIComponent(organ)}` : '');

  /* Nazwa pliku PDF proponowana przez przeglądarkę bierze się z `document.title`
     — bez tego zapisany dokument nazywałby się „Rejestr akcjonariuszy P.S.A.". */
  useEffect(() => {
    if (!nazwaSpolki) return undefined;
    const poprzedni = document.title;
    document.title = `Informacja z rejestru ${nazwaSpolki} ${data}`;
    return () => { document.title = poprzedni; };
  }, [nazwaSpolki, data]);

  /* Drukujemy RAMKĘ, nie stronę wokół niej: `window.print()` na stronie
     nadrzędnej wydrukowałby pasek narzędzi i nagłówek aplikacji. */
  function drukuj() {
    const okno = ramka.current && ramka.current.contentWindow;
    if (!okno) return;
    okno.focus();
    okno.print();
  }

  return (
    <>
      <div className="pasek-gorny bez-druku">
        <div className="row-g" style={{ flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => idz(`/spolki/${spolkaId}`)}>← Kokpit spółki</button>

          {/* Etykieta i jej pole w jednym pudełku, żeby zawijały się razem:
              luzem „Odbiorca" zostawało na końcu jednego wiersza, a lista
              wyboru schodziła do następnego. */}
          <span className="pasek-pole">
            <span className="fl" style={{ marginBottom: 0 }}>Stan na dzień</span>
            <PoleDaty wartosc={data} max={fmt.dzisIso()} przyZmianie={(v) => v && ustawDate(v)} />
          </span>

          <span className="pasek-pole">
            <span className="fl" style={{ marginBottom: 0 }}>Odbiorca</span>
            <select value={rola} onChange={(z) => ustawRole(z.target.value)} style={{ width: 'auto' }}>
              {ROLE_INFORMACJI.map((r) => (
                <option key={r.wartosc} value={r.wartosc}>{r.nazwa}</option>
              ))}
            </select>

            {rola === 'akcjonariusz' && (
              <select value={odbiorca} onChange={(z) => ustawOdbiorce(z.target.value)} style={{ width: 'auto' }}>
                <option value="">— który akcjonariusz —</option>
                {((stan.dane && stan.dane.akcjonariusze) || []).map((a) => (
                  <option key={a.osoba_id} value={a.osoba_id}>
                    {a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`}
                  </option>
                ))}
              </select>
            )}

            {rola === 'organ' && (
              <select value={organ} onChange={(z) => ustawOrgan(z.target.value)} style={{ width: 'auto' }}>
                {ORGANY_INFORMACJI.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </span>

          {/* Eksport surowych danych do dalszej obróbki — narzędzie, nie
              dokument: nic nie podpisuje i niczego nie zaświadcza. */}
          <a className="btn" href={`/api/psa/spolki/${spolkaId}/stan.csv?data=${data}`}>Eksport CSV</a>
        </div>
        <button className="btn btn-glowny" onClick={drukuj}>Drukuj</button>
      </div>

      {rola === 'akcjonariusz' && (
        <div className="bez-druku">
          <Komunikat
            odmiana="info"
            tytul="Maskowanie danych wrażliwych"
            tresc={
              'Pozostali akcjonariusze nie mają dostępu do numeru PESEL, daty urodzenia ani adresu '
              + 'zamieszkania — art. 300(35) § 1(1) KSH. Dane własne odbiorcy pokazujemy w całości.'
            }
          />
        </div>
      )}

      <iframe ref={ramka} className="podglad-dokumentu" src={adres} title="Informacja z rejestru akcjonariuszy" />
    </>
  );
}

window.EkranInformacji = EkranInformacji;

/**
 * Kolejka zawiadomień o wpisie (art. 300(34) § 7 KSH).
 *
 * Wpis nie wysyła już zawiadomienia sam. Jedna czynność to często kilka
 * zdarzeń — emisja, potem objęcie tych samych akcji — a pismo po każdym
 * z osobna opisywało stan przejściowy, w którym akcje nie mają jeszcze
 * akcjonariusza. Pracownik domyka robotę przy spółce i wysyła komplet
 * jednym ruchem.
 *
 * Grupowanie po spółce, nie płaska lista spraw: adresatem jest spółka
 * i żądający, więc to spółka jest jednostką decyzji „wysyłam czy czekam".
 */
/**
 * Polska liczba mnoga: 1 sprawa, 2 sprawy, 5 spraw. Bez tego komunikaty
 * wychodziły w rodzaju „Wystawiono 3 pism do 1 spraw".
 */
function liczebnik(ile, pojedyncza, malaMnoga, duzaMnoga) {
  if (ile === 1) return `${ile} ${pojedyncza}`;
  const dziesiatki = ile % 100;
  const jednosci = ile % 10;
  const mala = jednosci >= 2 && jednosci <= 4 && !(dziesiatki >= 12 && dziesiatki <= 14);
  return `${ile} ${mala ? malaMnoga : duzaMnoga}`;
}

function EkranZawiadomien() {
  const { dane, ladowanie, blad, odswiez } = useDane('/api/psa/zawiadomienia');
  const meta = useDane('/api/psa/meta');
  const [zaznaczone, ustawZaznaczone] = useState({});
  const [wysylanie, ustawWysylanie] = useState(false);
  const [bladWysylki, ustawBladWysylki] = useState(null);
  const [podsumowanie, ustawPodsumowanie] = useState(null);

  if (ladowanie || meta.ladowanie) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tresc={blad.message} />;

  const nazwaTypu = (kod) => {
    const t = meta.dane.typy_zdarzen.find((x) => x.kod === kod);
    return t ? t.nazwa : kod;
  };

  const wybrane = Object.entries(zaznaczone).filter(([, v]) => v).map(([k]) => Number(k));

  function przelaczSpolke(spolka, wlacz) {
    ustawZaznaczone((p) => {
      const nowe = { ...p };
      for (const s of spolka.sprawy) nowe[s.id] = wlacz;
      return nowe;
    });
  }

  async function wyslij(idy) {
    if (idy.length === 0) return;
    ustawWysylanie(true);
    ustawBladWysylki(null);
    ustawPodsumowanie(null);
    try {
      const wynik = await API.post('/api/psa/zawiadomienia/wyslij', { sprawa_ids: idy });
      // Poczta może być nieskonfigurowana — pismo i tak powstaje i zostaje
      // w aktach sprawy do pobrania. Mówimy o tym wprost, zamiast udawać,
      // że wysłano.
      const pisma = wynik.wyniki.flatMap((w) => w.pisma || []);
      const niewyslane = pisma.filter((p) => p && p.wyslano === false);
      ustawPodsumowanie({
        spraw: wynik.wyniki.length,
        pism: pisma.length,
        niewyslane: niewyslane.length,
        bledy: wynik.wyniki.filter((w) => w.blad).map((w) => `Sprawa #${w.sprawa_id}: ${w.blad}`),
      });
      ustawZaznaczone({});
      odswiez();
    } catch (e) {
      ustawBladWysylki(e.message);
    } finally {
      ustawWysylanie(false);
    }
  }

  return (
    <>
      {/* Tytuł i podtytuł niesie pasek górny (`app.js: opisTrasy`) — tu
          zostaje sama akcja, żeby nagłówek nie stał dwa razy pod rząd. */}
      {wybrane.length > 0 && (
        <div className="pasek-gorny">
          <div />
          <button className="btn btn-glowny" disabled={wysylanie} onClick={() => wyslij(wybrane)}>
            {wysylanie ? 'Wysyłanie…' : `Wyślij zaznaczone (${wybrane.length})`}
          </button>
        </div>
      )}

      <Komunikat odmiana="blad" tresc={bladWysylki} />
      {podsumowanie && (
        <Komunikat
          odmiana={podsumowanie.bledy.length > 0 ? 'uwaga' : 'ok'}
          tytul={`Wystawiono ${liczebnik(podsumowanie.pism, 'pismo', 'pisma', 'pism')}`
            + ` do ${liczebnik(podsumowanie.spraw, 'sprawy', 'spraw', 'spraw')}`}
          tresc={podsumowanie.niewyslane > 0
            ? `${liczebnik(podsumowanie.niewyslane, 'pismo nie poszło', 'pisma nie poszły', 'pism nie poszło')}`
              + ' e-mailem — czekają w aktach sprawy do pobrania.'
            : 'Wszystkie pisma poszły e-mailem.'}
          lista={podsumowanie.bledy}
        />
      )}

      {dane.spolki.length === 0 ? (
        <Karta>
          <Pusto
            tytul="Nic nie czeka na zawiadomienie"
            opis="Każdy dokonany wpis ma już wystawione zawiadomienie."
          />
        </Karta>
      ) : (
        dane.spolki.map((s) => {
          const idy = s.sprawy.map((x) => x.id);
          const wszystkieZaznaczone = idy.every((id) => zaznaczone[id]);
          return (
            <Karta key={s.spolka_id} tytul={s.spolka_nazwa}>
              <div className="pion" style={{ padding: '0 24px 20px', gap: 12 }}>
                <div className="male wyciszony">
                  {s.spolka_email
                    ? `Adres spółki: ${s.spolka_email}`
                    : 'Spółka nie ma adresu e-mail — pismo powstanie, ale nie zostanie wysłane.'}
                </div>
                <div className="pion" style={{ gap: 6 }}>
                  {s.sprawy.map((sp) => (
                    <label key={sp.id} className="row-g" style={{ gap: 8, alignItems: 'baseline' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(zaznaczone[sp.id])}
                        onChange={(z) => ustawZaznaczone((p) => ({ ...p, [sp.id]: z.target.checked }))}
                      />
                      <button className="btn-tekstowy" onClick={() => idz(`/sprawy/${sp.id}`)}>
                        sprawa #{sp.id}
                      </button>
                      <span>{nazwaTypu(sp.typ_zdarzenia)}</span>
                      <span className="male wyciszony">wpłynęła {fmt.data(sp.data_wplywu)}</span>
                    </label>
                  ))}
                </div>
                <div className="row-g">
                  <button
                    className="btn btn-glowny btn-maly"
                    disabled={wysylanie}
                    onClick={() => wyslij(idy)}
                  >
                    {`Wyślij zawiadomienie (${liczebnik(idy.length, 'sprawa', 'sprawy', 'spraw')})`}
                  </button>
                  <button
                    className="btn btn-maly"
                    onClick={() => przelaczSpolke(s, !wszystkieZaznaczone)}
                  >
                    {wszystkieZaznaczone ? 'Odznacz' : 'Zaznacz do wysyłki zbiorczej'}
                  </button>
                </div>
              </div>
            </Karta>
          );
        })
      )}
    </>
  );
}

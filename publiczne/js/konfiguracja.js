/* konfiguracja.js — podgląd stawek i terminów.

   Front NIE powiela stawek ani terminów — wszystko wczytywane z API, żeby
   zmiana prawa po stronie serwera od razu znalazła odbicie tutaj. */

function EkranStawek() {
  const { dane, ladowanie } = useDane('/api/psa/meta');
  if (ladowanie) return <Spinner />;
  if (!dane) return null;

  const s = dane.stawki_grosze;
  const maks = dane.stawki_maksymalne_grosze;

  const pozycje = [
    { kod: 'prowadzenie', nazwa: 'Prowadzenie rejestru', jednostka: 'za każdy rozpoczęty rok', stawka: s.PROWADZENIE_ROCZNIE, maks: maks.PROWADZENIE_ROCZNIE },
    { kod: 'wpis', nazwa: 'Wpis w rejestrze', jednostka: 'za wpis', stawka: s.WPIS, maks: maks.WPIS },
    { kod: 'informacja', nazwa: 'Informacja z rejestru', jednostka: 'za informację', stawka: s.INFORMACJA, maks: maks.INFORMACJA },
  ];

  return (
    <>
      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Stawki i terminy</div>
          <div className="podtytul-strony">
            Wysokość taksy notarialnej i terminy ustawowe stosowane w rejestrze — bez ingerencji w treść.
          </div>
        </div>
      </div>

      <Karta scisla tytul="Taksa notarialna">
        <table className="tabela">
          <thead>
            <tr>
              <th>Czynność</th>
              <th>Jednostka</th>
              <th className="do-prawej">Stawka kancelarii</th>
              <th className="do-prawej">Maksimum z rozporządzenia</th>
            </tr>
          </thead>
          <tbody>
            {pozycje.map((p) => (
              <tr key={p.kod}>
                <td style={{ fontWeight: 500 }}>{p.nazwa}</td>
                <td className="wyciszony">{p.jednostka}</td>
                <td className="do-prawej kol-dane">{fmt.zlote(p.stawka)}</td>
                <td className="do-prawej kol-dane wyciszony">
                  {fmt.zlote(p.maks)}
                  {p.stawka < p.maks && (
                    <div className="podpowiedz" style={{ color: 'var(--rejestr)' }}>
                      stawka obniżona
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '14px 20px' }} className="podstawa-prawna">
          {dane.podstawy.TAKSA}. Kwoty przechowywane w groszach — reguła domenowa nr 5.
          Naliczanie opłat: ekran „Opłaty”.
        </div>
      </Karta>

      <div className="siatka-2">
        <Karta tytul="Terminy ustawowe">
          <dl className="pary">
            <Para etykieta="Wpis na żądanie">
              {dane.terminy.WPIS_DNI} dni — {dane.podstawy.TRYB_WPISU}
            </Para>
            <Para etykieta="Wpis po usunięciu przeszkody">
              {dane.terminy.WPIS_PO_USUNIECIU_PRZESZKODY_DNI} dni od dnia usunięcia
            </Para>
            <Para etykieta="Wypowiedzenie umowy przez notariusza">
              min. {dane.terminy.WYPOWIEDZENIE_MIESIACE} miesiące, tylko z ważnych powodów
            </Para>
            <Para etykieta="Zawiadomienie sądu o rozwiązaniu umowy">
              {dane.terminy.ZAWIADOMIENIE_SADU_DNI} dni od wygaśnięcia albo rozwiązania umowy
            </Para>
            <Para etykieta="Zgłoszenie zmiany danych przez zarząd">
              {dane.terminy.ZGLOSZENIE_ZMIANY_PRZEZ_ZARZAD_DNI} dni od zdarzenia
            </Para>
          </dl>
          <div className="podstawa-prawna odstep-g">
            Termin 7 dni zamrożony w stanie „wstrzymana” — po wznowieniu biegnie od nowa w pełnym wymiarze.
          </div>

          <div className="rozdzielacz" />

          <dl className="pary">
            <Para etykieta="Cel wewnętrzny kancelarii">
              {dane.cel_wewnetrzny.WPIS_DNI} dni kalendarzowe od wpływu żądania
            </Para>
          </dl>
          <div className="podstawa-prawna">
            Nie jest terminem ustawowym. Art. 300(34) § 1 KSH nakazuje działać „niezwłocznie”, a siedem
            dni tylko domyka ten obowiązek od góry — cel wyprzedza termin ustawowy i to on uruchamia
            wyróżnienie w kolejce. Jego przekroczenie nie narusza ustawy.
          </div>
        </Karta>

        <Karta tytul="Dostęp do danych rejestru">
          <dl className="pary">
            <Para etykieta="Maskowane pozostałym akcjonariuszom">
              PESEL, data urodzenia, adres zamieszkania — {dane.podstawy.MASKOWANIE}
            </Para>
            <Para etykieta="Pełny dostęp">{dane.organy_uprawnione.join(', ')}</Para>
          </dl>
          <div className="podstawa-prawna odstep-g">
            Maskowanie działa w każdym widoku i wydruku o roli innej niż spółka albo organ
            uprawniony — także w podglądzie rejestru w portalu klienta.
          </div>
        </Karta>
      </div>

      <Karta tytul="Katalog typów zdarzeń" scisla>
        <table className="tabela">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Opis</th>
              <th>Odpłatny</th>
              <th>Uprzednie powiadomienie</th>
              <th>Dostępny</th>
            </tr>
          </thead>
          <tbody>
            {dane.typy_zdarzen.map((t) => (
              <tr key={t.kod}>
                <td>
                  <span className="row-g">
                    <Ikona nazwa={IKONY_ZDARZEN[t.kod] || 'zdarzenie'} rozmiar={18} />
                    <span style={{ fontWeight: 500 }}>{t.nazwa}</span>
                  </span>
                </td>
                <td className="zawijaj wyciszony">{t.opis_zdarzeniem}</td>
                <td>{t.odplatne ? 'tak' : <Znacznik odmiana="zielony">wolny od opłat</Znacznik>}</td>
                <td>
                  {t.wymaga_powiadomienia === true
                    ? `tak — ${t.kogo_powiadomic || 'zainteresowanego'}`
                    : t.wymaga_powiadomienia === 'zaleznie'
                      ? 'zależnie od treści'
                      : 'nie'}
                </td>
                <td>
                  {dane.typy_w_kreatorze.includes(t.kod) ? (
                    <Znacznik odmiana="zielony">w kreatorze</Znacznik>
                  ) : (
                    <Znacznik odmiana="neutralny">przez edycję danych spółki</Znacznik>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Karta>
    </>
  );
}

window.EkranStawek = EkranStawek;
/* ─────────────────────────────────────────────────────
   DANE KANCELARII

   Metryka, która trafia do KAŻDEJ wystawianej umowy i do każdego pisma.
   Dotąd dało się ją zmienić wyłącznie w pliku `.env` na serwerze — więc
   w praktyce nikt tego nie robił i w umowach zostawały kreski w miejscu
   NIP-u i adresu.

   Wartość „z pliku konfiguracyjnego" znaczy: nikt jej tu nie ustawił,
   obowiązuje domyślna z `.env`. Zapisanie czegokolwiek przestawia źródło
   na bazę; wyczyszczenie pola wraca do domyślnej.
   ───────────────────────────────────────────────────── */

function PodgladNaglowka({ pola }) {
  const w = (k) => {
    const p = pola.find((x) => x.klucz === k);
    return p && String(p.wartosc || '').trim();
  };
  const adres = [w('kancelaria_ulica'), [w('kancelaria_kod'), w('kancelaria_miasto')]
    .filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const brak = (tekst) => <span className="podglad-brak">{tekst}</span>;

  return (
    <div className="dok-strona" style={{ padding: 'var(--od-24)' }}>
      <div style={{ textAlign: 'center', fontWeight: 600 }}>
        {w('nazwa') || brak('(nazwa kancelarii)')}
      </div>
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        {adres || brak('(adres kancelarii)')}
      </div>
      <div style={{ textAlign: 'center', marginTop: 2 }}>
        NIP {w('kancelaria_nip') || brak('(brak)')}
        {' · '}REGON {w('kancelaria_regon') || brak('(brak)')}
      </div>
      <div style={{ textAlign: 'center', marginTop: 2 }}>
        {[w('telefon'), w('email')].filter(Boolean).join(' · ')
          || brak('(telefon i e-mail)')}
      </div>
      <div style={{ marginTop: 'var(--od-24)', textAlign: 'right' }}>
        {w('podpisujacy_funkcja') || 'Notariusz'}{' '}
        {w('podpisujacy_mianownik') || w('notariusz_mianownik') || brak('(podpisujący)')}
      </div>
    </div>
  );
}

function EkranDaneKancelarii() {
  const { dane, ladowanie, blad, odswiez } = useDane('/api/psa/ustawienia');
  const [robocze, ustawRobocze] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [bledy, ustawBledy] = useState([]);
  const [zapisano, ustawZapisano] = useState(false);

  useEffect(() => {
    if (dane) ustawRobocze(dane.kancelaria.map((p) => ({ ...p })));
  }, [dane]);

  if (ladowanie || !robocze) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tytul="Nie udało się wczytać ustawień" tresc={blad.message} />;

  const zmien = (klucz, wartosc) =>
    ustawRobocze((p) => p.map((x) => (x.klucz === klucz ? { ...x, wartosc } : x)));

  const zmienione = robocze.filter((p) => {
    const pierwotne = dane.kancelaria.find((x) => x.klucz === p.klucz);
    return String(p.wartosc ?? '') !== String(pierwotne.wartosc ?? '');
  });

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBledy([]);
    ustawZapisano(false);
    try {
      const cialo = Object.fromEntries(zmienione.map((p) => [p.klucz, p.wartosc]));
      await API.put('/api/psa/ustawienia', cialo);
      ustawZapisano(true);
      odswiez();
    } catch (e) {
      ustawBledy(e instanceof BladApi && e.bledy ? e.bledy : [e.message]);
    } finally {
      ustawZapisywanie(false);
    }
  }

  return (
    <>
      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Dane kancelarii</div>
          <div className="podtytul-strony">
            Metryka wstawiana do każdej umowy o prowadzenie rejestru i do każdego pisma.
          </div>
        </div>
      </div>

      <Komunikat odmiana="blad" tytul={bledy.length ? 'Nie zapisano' : null} lista={bledy} tresc={bledy.length ? ' ' : null} />
      {zapisano && zmienione.length === 0 && (
        <Komunikat odmiana="rejestr" tresc="Zapisano. Nowe dokumenty będą wystawiane z tymi danymi." />
      )}

      <div className="siatka-2">
        <Karta tytul="Metryka">
          {robocze.map((p) => (
            <Pole
              key={p.klucz}
              etykieta={p.etykieta}
              wymagane={p.wymagane}
              podpowiedz={p.podpowiedz || (p.z_bazy ? null : 'Wartość z pliku konfiguracyjnego.')}
            >
              <input
                type="text"
                value={p.wartosc ?? ''}
                onChange={(z) => zmien(p.klucz, z.target.value)}
                autoComplete="off"
              />
            </Pole>
          ))}
        </Karta>

        <div>
          <Karta tytul="Tak zobaczy to klient">
            <PodgladNaglowka pola={robocze} />
            <div className="podstawa-prawna odstep-g">
              Nagłówek umowy o prowadzenie rejestru i pism wychodzących. Puste miejsca
              zostaną w dokumencie kreskami — dlatego widać je tu na czerwono.
            </div>
          </Karta>
        </div>
      </div>

      <div className="kreator-stopka">
        <span className="wyciszony male">
          {zmienione.length === 0
            ? 'Brak niezapisanych zmian.'
            : `Niezapisanych zmian: ${zmienione.length}.`}
        </span>
        <div className="kreator-stopka-prawa">
          <button
            className="btn btn-glowny"
            disabled={zapisywanie || zmienione.length === 0}
            onClick={zapisz}
          >
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz dane kancelarii'}
          </button>
        </div>
      </div>
    </>
  );
}

window.EkranDaneKancelarii = EkranDaneKancelarii;

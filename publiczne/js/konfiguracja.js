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
              {dane.terminy.ZAWIADOMIENIE_SADU_DNI} dni (od {fmt.data(dane.nowelizacja.WEJSCIE_W_ZYCIE)})
            </Para>
            <Para etykieta="Zgłoszenie zmiany danych przez zarząd">
              {dane.terminy.ZGLOSZENIE_ZMIANY_PRZEZ_ZARZAD_DNI} dni od zdarzenia
            </Para>
          </dl>
          <div className="podstawa-prawna odstep-g">
            Termin 7 dni zamrożony w stanie „wstrzymana” — po wznowieniu biegnie od nowa w pełnym wymiarze.
          </div>
        </Karta>

        <Karta tytul="Nowelizacja">
          <Komunikat
            odmiana="uwaga"
            tytul={`${dane.nowelizacja.DZIENNIK} — wejście w życie ${fmt.data(dane.nowelizacja.WEJSCIE_W_ZYCIE)}`}
            tresc={
              'Katalog danych rejestru (art. 300(33) § 1 pkt 1–11 KSH) nowelizacja NIE zmienia — jedyne ' +
              'rozwiązanie addytywne wdrożone od pierwszego dnia to zakaz udostępniania PESEL-u, daty ' +
              'urodzenia i adresu zamieszkania pozostałym akcjonariuszom (maskowanie).'
            }
          />
          <dl className="pary">
            <Para etykieta="Koniec okresu przejściowego">
              {fmt.data(dane.nowelizacja.KONIEC_OKRESU_PRZEJSCIOWEGO)} — zgłoszenie podmiotu
              prowadzącego rejestr do KRS
            </Para>
            <Para etykieta="Maskowane dane">
              PESEL, data urodzenia, adres zamieszkania — {dane.podstawy.MASKOWANIE}
            </Para>
            <Para etykieta="Pełny dostęp">{dane.organy_uprawnione.join(', ')}</Para>
          </dl>
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
                  ) : t.sprint <= dane.sprint ? (
                    <Znacznik odmiana="neutralny">przez edycję danych spółki</Znacznik>
                  ) : (
                    <Znacznik odmiana="neutralny">sprint {t.sprint}</Znacznik>
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

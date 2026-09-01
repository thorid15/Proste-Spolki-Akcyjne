/* wydruk.js — wydruki natywne: window.print() + @media print, bez bibliotek PDF.

   Czego NIE umieszczamy na wydrukach dla klienta (sekcja 10 specyfikacji):
   pola `uwagi`, checklist weryfikacji, notatek AML, danych kontaktowych innych
   akcjonariuszy ani skrótów. Serwer nie wysyła ich dla ról innych niż
   kancelaria — maskowanie jest po stronie API, nie w tym pliku. */

function NaglowekWydruku({ tytul, podtytul, kancelaria }) {
  return (
    <div className="wydruk-naglowek">
      <div>
        <div className="wydruk-tytul">{tytul}</div>
        {podtytul && <div className="podstawa-prawna">{podtytul}</div>}
      </div>
      <div className="wydruk-kancelaria prawo">
        {kancelaria ? kancelaria.nazwa : ''}
        {kancelaria && kancelaria.adres && <span>{kancelaria.adres}</span>}
        {kancelaria && kancelaria.miejscowosc && <span>{kancelaria.miejscowosc}</span>}
        {kancelaria && kancelaria.telefon && <span>tel. {kancelaria.telefon}</span>}
        {kancelaria && kancelaria.email && <span>{kancelaria.email}</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   RAPORT Z REJESTRU — dokument kancelaryjny (faza 4)
   ───────────────────────────────────────────────────── */

/** Data i godzina sporządzenia - raport jest zdjęciem stanu w konkretnej chwili. */
function sporzadzonoTeraz() {
  const t = new Date();
  const dwa = (n) => String(n).padStart(2, '0');
  return `${dwa(t.getDate())}.${dwa(t.getMonth() + 1)}.${t.getFullYear()}, godz. ${dwa(t.getHours())}:${dwa(t.getMinutes())}`;
}

/**
 * Miejsce na logotyp samorządu notarialnego.
 *
 * Pliki dostarcza kancelaria (SESJA-PSA-6-INTERFEJS.md, faza 4). Znaków
 * samorządu NIE generujemy, nie odtwarzamy ani nie pobieramy z sieci —
 * wystarczy WGRAĆ PLIK pod ścieżkę z `LOGO_NOTARIAT` (patrz niżej), a
 * pojawi się sam. Dopóki pliku nie ma, `onError` wraca do ramki z opisem,
 * czego brakuje — dokument nigdy nie pokazuje pustego kwadratu ani
 * ikony zepsutego obrazka.
 */
function LogoSamorzadu({ zrodlo, opis, szeroki = false }) {
  const [nieudane, ustawNieudane] = useState(false);
  const pokazObraz = Boolean(zrodlo) && !nieudane;
  return (
    <div
      className={`raport-logo ${pokazObraz ? 'raport-logo-znak' : ''} ${szeroki && pokazObraz ? 'raport-logo-szeroki' : ''}`}
      title={opis}
    >
      {pokazObraz
        ? <img src={zrodlo} alt={opis} onError={() => ustawNieudane(true)} />
        : opis}
    </div>
  );
}

/**
 * Znak „Notariat Rzeczypospolitej Polskiej" na wydrukach — plik dostarczony
 * przez kancelarię, leży w repozytorium. Gdyby zniknął albo nie dał się
 * wczytać, `LogoSamorzadu` wraca do ramki z nazwą znaku; wydruk nigdy nie
 * pokazuje pustego prostokąta ani ikony zepsutego obrazka.
 *
 * Znak jest szeroki (498 × 220), nie kwadratowy — stąd osobna szerokość
 * kafla w `.raport-logo-szeroki`.
 */
const LOGO_NOTARIAT = '/obrazy/notariat.png';

function NaglowekRaportu({ tytul, podtytul, kancelaria, sporzadzono, logoNotariat = LOGO_NOTARIAT, logoIzba }) {
  return (
    <div className="raport-naglowek">
      <div className="raport-logotypy">
        <LogoSamorzadu zrodlo={logoNotariat} opis="Notariat Rzeczypospolitej Polskiej" szeroki />
        {/* Etap 4.7: rejestr prowadzi KANCELARIA (art. 300(31) § 1 KSH), nie
            izba notarialna - znak izby jest opcją, domyślnie wyłączoną, żeby
            nagłówek nie sugerował, że dokument pochodzi od samorządu. */}
        {kancelaria && kancelaria.pokaz_znak_izby && (
          <LogoSamorzadu zrodlo={logoIzba} opis={kancelaria.nazwa_izby || 'Izba Notarialna'} />
        )}
      </div>
      <div>
        <h1 className="raport-tytul">{tytul}</h1>
        {podtytul && <div className="raport-podtytul">{podtytul}</div>}
      </div>
      <div className="raport-kancelaria">
        <strong>{kancelaria ? kancelaria.nazwa : '—'}</strong>
        {kancelaria && kancelaria.adres && <div>{kancelaria.adres}</div>}
        {kancelaria && kancelaria.miejscowosc && <div>{kancelaria.miejscowosc}</div>}
        <div style={{ marginTop: 4 }}>podmiot prowadzący rejestr</div>
        <div>sporządzono {sporzadzono}</div>
      </div>
    </div>
  );
}

function SekcjaRaportu({ tytul, children }) {
  return (
    <div className="raport-sekcja">
      <div className="raport-sekcja-tytul">{tytul}</div>
      {children}
    </div>
  );
}

/**
 * Stopka raportu.
 *
 * `numeracjaStron`: przeglądarki nie wspierają liczników stron w polach
 * marginesowych `@page`, a bibliotek PDF ten moduł nie używa. Numerację
 * dokłada więc mechanizm druku przeglądarki (nagłówki i stopki w oknie
 * drukowania) — tutaj dbamy o to, żeby KAŻDA strona dała się zidentyfikować
 * po treści: oznaczenie spółki i dzień stanu są w nagłówku sekcji.
 *
 * Etap 4.3: „stan na dzień” i podstawa prowadzenia rejestru są już w
 * nagłówku/sekcji „Podmiot prowadzący rejestr” — stopka zostaje wyłącznie
 * przy klauzuli ustawowej, żeby nie powtarzać tych samych faktów trzeci raz.
 *
 * Etap 12: aplikacja wystawia JEDEN dokument — informację z rejestru
 * akcjonariuszy (art. 300(35) § 3 KSH). Wariant „dokumentu roboczego"
 * (osobny raport wewnętrzny ze znakiem wodnym) zniknął: ustawa go nie zna,
 * a notariusz nie ma po co podpisywać dwóch pism o tej samej treści.
 * Potrzebę „spojrzenia na wszystko bez maskowania" pokrywa ten sam dokument
 * z odbiorcą „kancelaria", a surowe dane do dalszej obróbki — eksport CSV.
 */
function StopkaRaportu({ oznaczenie, dodatek }) {
  return (
    <>
      <div className="raport-stopka">
        <div>
          Dokument stanowi informację z rejestru akcjonariuszy w rozumieniu
          art. 300(35) § 3 Kodeksu spółek handlowych.
        </div>
        {oznaczenie && <div style={{ marginTop: 4 }}>Oznaczenie dokumentu: {oznaczenie}</div>}
        {dodatek && <div style={{ marginTop: 4 }}>{dodatek}</div>}
      </div>
      <div className="raport-podpis">
        <div className="raport-podpis-linia">podpis i pieczęć notariusza</div>
      </div>
    </>
  );
}

function Para({ etykieta, children }) {
  return (
    <>
      <dt>{etykieta}</dt>
      <dd>{children || '—'}</dd>
    </>
  );
}

function StopkaWydruku({ data, dodatek }) {
  return (
    <div className="wydruk-stopka">
      <div>
        Stan rejestru na dzień {fmt.data(data)}. Dokument sporządzono {fmt.data(fmt.dzisIso())}.
      </div>
      {dodatek && <div style={{ marginTop: 5 }}>{dodatek}</div>}
      <div style={{ marginTop: 5 }}>
        Rejestr akcjonariuszy prowadzony na podstawie art. 300(31) § 1 Kodeksu spółek handlowych.
      </div>
    </div>
  );
}

function TabelaAkcjonariuszyWydruk({ akcjonariusze, razem, pokazObciazenia = true }) {
  if (akcjonariusze.length === 0) {
    return <div className="przyciemnione">Na wskazany dzień rejestr nie wykazuje akcjonariuszy.</div>;
  }
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Lp.</th>
          <th>Akcjonariusz</th>
          <th>Seria</th>
          <th className="prawo">Liczba akcji</th>
          <th>Numery akcji</th>
          <th className="prawo">% akcji</th>
          {pokazObciazenia && <th>Obciążenia</th>}
        </tr>
      </thead>
      <tbody>
        {akcjonariusze.map((a, i) => (
          <tr key={`${a.osoba_id}-${a.emisja_klucz}`}>
            <td>{i + 1}</td>
            <td>
              <div>{a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`}</div>
              {a.osoba && a.osoba.jawny_identyfikator && (
                <div className="podstawa-prawna">{a.osoba.jawny_identyfikator}</div>
              )}
            </td>
            <td>{a.seria}</td>
            <td className="prawo">{fmt.liczba(a.ilosc)}</td>
            <td className="numery">{a.numery}</td>
            <td className="prawo">{fmt.procent(a.procent)}</td>
            {pokazObciazenia && (
              <td>
                {a.obciazenia.length === 0
                  ? '—'
                  : a.obciazenia
                      .map((o) => `${o.typ === 'zajecie' ? 'zajęcie' : o.typ} ${o.numery}`)
                      .join('; ')}
              </td>
            )}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} style={{ fontWeight: 600 }}>Razem</td>
          <td className="prawo" style={{ fontWeight: 600 }}>{fmt.liczba(razem)}</td>
          <td />
          <td className="prawo" style={{ fontWeight: 600 }}>100%</td>
          {pokazObciazenia && <td />}
        </tr>
      </tfoot>
    </table>
  );
}

/**
 * Tabela akcjonariuszy w raporcie kancelaryjnym.
 *
 * Trzy różnice wobec tabeli ekranowej:
 *  - kolumna udziału procentowego (art. 300(93) § 1 KSH — liczba głosów idzie
 *    za liczbą akcji, więc udział jest informacją, nie ozdobą),
 *  - wiersz obciążony niesie pigułkę, żeby nie trzeba było czytać ostatniej
 *    kolumny do końca,
 *  - pozycje ułamkowe zapisane wprost: „1/3 akcji nr 96". Skrót byłby
 *    nieczytelny dla sądu, który aplikacji nie zna.
 */
function TabelaAkcjonariuszyRaport({ akcjonariusze, razem }) {
  if (akcjonariusze.length === 0) {
    return <div className="wyciszony">Na wskazany dzień rejestr nie wykazuje akcjonariuszy.</div>;
  }
  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>Lp.</th>
          <th>Akcjonariusz</th>
          <th>Seria</th>
          <th className="do-prawej">Liczba akcji</th>
          <th>Numery akcji</th>
          <th className="do-prawej">Udział</th>
          <th>Obciążenia</th>
        </tr>
      </thead>
      <tbody>
        {akcjonariusze.map((a, i) => {
          const ulamki = a.czesci_ulamkowe || [];
          return (
            <tr key={`${a.osoba_id}-${a.emisja_klucz}`}>
              <td className="kol-dane">{i + 1}</td>
              <td>
                <div>{a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`}</div>
                {a.osoba && a.osoba.jawny_identyfikator && (
                  <div className="podstawa-prawna">{a.osoba.jawny_identyfikator}</div>
                )}
                {ulamki.length > 0 && (
                  <div className="podstawa-prawna raport-ulamek">
                    {ulamki
                      .map((u) => `${u.czesc_licznik}/${u.czesc_mianownik} akcji nr ${u.nr}`)
                      .join('; ')}
                  </div>
                )}
              </td>
              <td>{a.seria}</td>
              <td className="do-prawej kol-dane">{fmt.liczba(a.ilosc)}</td>
              <td className="kol-dane">{a.numery}</td>
              <td className="do-prawej kol-dane">{fmt.procent(a.procent)}</td>
              <td>
                {a.obciazenia.length === 0 ? (
                  '—'
                ) : (
                  <>
                    <Pigulka odmiana="mosiadz">obciążone</Pigulka>{' '}
                    {a.obciazenia
                      .map((o) => `${o.typ === 'zajecie' ? 'zajęcie' : o.typ} ${o.numery}`)
                      .join('; ')}
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} style={{ fontWeight: 600 }}>Razem</td>
          <td className="do-prawej kol-dane" style={{ fontWeight: 600 }}>{fmt.liczba(razem)}</td>
          <td />
          <td className="do-prawej kol-dane" style={{ fontWeight: 600 }}>100%</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

function PaskiWydruku({ spolkaId, data, ustawDate, dzieci }) {
  return (
    <div className="pasek-gorny bez-druku">
      <div className="row-g" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => idz(`/spolki/${spolkaId}`)}>← Kokpit spółki</button>
        <span className="fl" style={{ marginBottom: 0 }}>Stan na dzień</span>
        <PoleDaty wartosc={data} max={fmt.dzisIso()} przyZmianie={(v) => v && ustawDate(v)} />
        {dzieci}
      </div>
      <button className="btn btn-glowny" onClick={() => window.print()}>Drukuj</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   INFORMACJA Z REJESTRU (art. 300(35) § 3 KSH)

   JEDYNY dokument, jaki aplikacja wystawia ze stanu rejestru. Wcześniej stał
   obok niego „raport" — dokument roboczy kancelarii o tej samej treści, bez
   maskowania i bez podpisu. Ustawa czegoś takiego nie zna: art. 300(35) zna
   prawo dostępu do danych (§ 2) i prawo żądania INFORMACJI z rejestru (§ 3),
   nic ponadto. Zostaje więc jedno pismo, a różnicę „dla kogo" niesie wybór
   odbiorcy, od którego zależy maskowanie z § 1(1).

   Treść odpowiada zakresowi rejestru z art. 300(33) § 1 KSH:
     pkt 1–2  — firma, siedziba, adres, sąd rejestrowy i numer KRS
     pkt 3–4  — daty emisji, serie, numery, rodzaj akcji i uprawnienia z akcji
     pkt 5    — akcjonariusze wraz z adresami
     pkt 6–8  — obciążenia i prawo głosu z akcji obciążonej
     pkt 10   — ograniczenia w rozporządzaniu akcją
   ───────────────────────────────────────────────────── */
function EkranInformacji({ spolkaId, dataPoczatkowa }) {
  const [data, ustawDate] = useState(dataPoczatkowa || fmt.dzisIso());
  const [rola, ustawRole] = useState('spolka');
  const [odbiorca, ustawOdbiorce] = useState('');
  const [organ, ustawOrgan] = useState('sąd');

  const zapytanie =
    `/api/psa/spolki/${spolkaId}/stan?data=${data}&rola=${rola}` +
    (rola === 'akcjonariusz' && odbiorca ? `&odbiorca=${odbiorca}` : '');
  const stan = useDane(zapytanie, [data, rola, odbiorca]);
  const rdzen = useDane('/api/wspolne/kancelaria');

  const nazwaSpolki = stan.dane && stan.dane.spolka ? stan.dane.spolka.nazwa : null;

  /* Nazwa pliku PDF proponowana przez przeglądarkę bierze się z `document.title`
     — bez tego zapisany dokument nazywałby się „Rejestr akcjonariuszy P.S.A.". */
  useEffect(() => {
    if (!nazwaSpolki) return undefined;
    const poprzedni = document.title;
    document.title = `Informacja z rejestru ${nazwaSpolki} ${data}`;
    return () => { document.title = poprzedni; };
  }, [nazwaSpolki, data]);

  if (stan.ladowanie || rdzen.ladowanie) return <Spinner />;
  if (stan.blad) return <Komunikat odmiana="blad" tresc={stan.blad.message} />;

  const d = stan.dane;
  const kancelaria = rdzen.dane ? rdzen.dane.kancelaria : null;
  const zamaskowane = d.akcjonariusze.some((a) => a.osoba && a.osoba.zamaskowane);
  const odbiorcaOsoba = d.akcjonariusze.find((a) => String(a.osoba_id) === String(odbiorca));
  const adresSpolki = [
    d.spolka.ulica && `${d.spolka.ulica} ${d.spolka.nr_domu || ''}${d.spolka.nr_lokalu ? `/${d.spolka.nr_lokalu}` : ''}`,
    [d.spolka.kod_pocztowy, d.spolka.miejscowosc].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  const opisOdbiorcy = {
    kancelaria: 'podmiot prowadzący rejestr',
    spolka: 'spółka, której rejestr dotyczy',
    akcjonariusz: odbiorcaOsoba && odbiorcaOsoba.osoba ? odbiorcaOsoba.osoba.oznaczenie : 'akcjonariusz',
    organ,
  }[rola];

  return (
    <>
      <PaskiWydruku
        spolkaId={spolkaId}
        data={data}
        ustawDate={ustawDate}
        dzieci={
          <>
            <span className="fl" style={{ marginBottom: 0 }}>Odbiorca</span>
            <select value={rola} onChange={(z) => ustawRole(z.target.value)} style={{ width: 'auto' }}>
              <option value="spolka">spółka</option>
              <option value="akcjonariusz">akcjonariusz</option>
              <option value="organ">sąd, prokurator, komornik, organ egzekucyjny</option>
              <option value="kancelaria">na potrzeby wewnętrzne kancelarii</option>
            </select>
            {rola === 'akcjonariusz' && (
              <select
                value={odbiorca}
                onChange={(z) => ustawOdbiorce(z.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">— który akcjonariusz —</option>
                {d.akcjonariusze.map((a) => (
                  <option key={a.osoba_id} value={a.osoba_id}>
                    {a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`}
                  </option>
                ))}
              </select>
            )}
            {rola === 'organ' && (
              <select value={organ} onChange={(z) => ustawOrgan(z.target.value)} style={{ width: 'auto' }}>
                <option value="sąd">sąd</option>
                <option value="prokurator">prokurator</option>
                <option value="komornik sądowy">komornik sądowy</option>
                <option value="administracyjny organ egzekucyjny">administracyjny organ egzekucyjny</option>
              </select>
            )}
            {/* Eksport surowych danych do dalszej obróbki — narzędzie, nie
                dokument: nic nie podpisuje i niczego nie zaświadcza. */}
            <a className="btn" href={`/api/psa/spolki/${spolkaId}/stan.csv?data=${data}`}>
              Eksport CSV
            </a>
          </>
        }
      />

      {/* Podpowiedź dla pracownika, nie treść dokumentu — na papierze ta sama
          informacja jest w stopce, więc baner nie drukuje się (`bez-druku`). */}
      {rola === 'akcjonariusz' && (
        <div className="bez-druku">
          <Komunikat
            odmiana={zamaskowane ? 'ok' : 'info'}
            tytul="Maskowanie danych wrażliwych"
            tresc={
              'Pozostali akcjonariusze nie mają dostępu do numeru PESEL, daty urodzenia ani adresu ' +
              'zamieszkania — art. 300(35) § 1(1) KSH. Dane własne odbiorcy pokazujemy w całości.'
            }
          />
        </div>
      )}

      <div className="raport">
        <NaglowekRaportu
          tytul="Informacja z rejestru akcjonariuszy"
          podtytul={`${d.spolka.nazwa} — stan na dzień ${fmt.data(data)}`}
          kancelaria={kancelaria}
          sporzadzono={sporzadzonoTeraz()}
        />

        <div className="raport-sekcja">
          <dl className="pary">
            <Para etykieta="Odbiorca informacji">{opisOdbiorcy}</Para>
            <Para etykieta="Stan na dzień">{fmt.data(data)}</Para>
          </dl>
        </div>

        {/* art. 300(33) § 1 pkt 1–2 KSH */}
        <SekcjaRaportu tytul="Spółka">
          <dl className="pary">
            <Para etykieta="Firma">{d.spolka.nazwa}</Para>
            <Para etykieta="Forma prawna">{d.spolka.forma_prawna}</Para>
            <Para etykieta="Siedziba i adres">{adresSpolki}</Para>
            <Para etykieta="Sąd rejestrowy">
              {[d.spolka.sad_rejestrowy, d.spolka.wydzial].filter(Boolean).join(', ')}
            </Para>
            <Para etykieta="Numer KRS">{d.spolka.krs}</Para>
            <Para etykieta="NIP">{d.spolka.nip}</Para>
            <Para etykieta="REGON">{d.spolka.regon}</Para>
            <Para etykieta="Status">{NAZWY_STATUSU[d.spolka.status] || d.spolka.status}</Para>
          </dl>
        </SekcjaRaportu>

        <SekcjaRaportu tytul="Podmiot prowadzący rejestr">
          <dl className="pary">
            <Para etykieta="Podmiot">{kancelaria ? kancelaria.nazwa : '—'}</Para>
            <Para etykieta="Podstawa prowadzenia">art. 300(31) § 1 KSH</Para>
            <Para etykieta="Data uchwały o wyborze">{fmt.data(d.spolka.data_uchwaly_wyboru)}</Para>
            <Para etykieta="Data umowy o prowadzenie rejestru">{fmt.data(d.spolka.data_umowy)}</Para>
            <Para etykieta="Data otwarcia rejestru">{fmt.data(d.spolka.data_otwarcia_rejestru)}</Para>
          </dl>
        </SekcjaRaportu>

        {/* art. 300(33) § 1 pkt 5 KSH */}
        <SekcjaRaportu tytul="Akcjonariusze">
          <TabelaAkcjonariuszyRaport akcjonariusze={d.akcjonariusze} razem={d.razem_akcji} />
        </SekcjaRaportu>

        {/* art. 300(33) § 1 pkt 3–4 KSH */}
        <SekcjaRaportu tytul="Emisje i serie akcji">
          {d.emisje.length === 0 ? (
            <div className="wyciszony">Rejestr nie wykazuje emisji.</div>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Seria</th><th>Tytuł</th><th>Podstawa</th><th>Numery</th>
                  <th className="do-prawej">Wyemitowane</th>
                  <th className="do-prawej">Umorzone</th>
                  <th className="do-prawej">W obrocie</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {d.emisje.map((e) => {
                  const b = d.bilans.find((x) => x.emisja_klucz === e.klucz) || {};
                  return (
                    <tr key={e.klucz}>
                      <td style={{ fontWeight: 600 }}>{e.seria}</td>
                      <td>{e.tytul || '—'}</td>
                      <td>{e.podstawa_prawna || '—'}</td>
                      <td className="kol-dane">{e.zakres}</td>
                      <td className="do-prawej">{fmt.liczba(e.ilosc)}</td>
                      <td className="do-prawej">{fmt.liczba(b.umorzone || 0)}</td>
                      <td className="do-prawej">{fmt.liczba(b.w_obrocie || 0)}</td>
                      <td>{fmt.data(e.data_emisji)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </SekcjaRaportu>

        {/* art. 300(33) § 1 pkt 4 KSH — uprawnienia szczególne z akcji.
            Sekcje warunkowe: pusta tabela „uprawnień" na piśmie do sądu
            sugerowałaby, że o coś nie zapytano, a nie że ich nie ma. */}
        {d.uprawnienia.length > 0 && (
          <SekcjaRaportu tytul="Uprawnienia, przywileje i obowiązki związane z akcjami">
            <table className="tabela">
              <thead>
                <tr><th>Rodzaj</th><th>Dotyczy</th><th>Tytuł</th><th>Treść</th><th>Od dnia</th></tr>
              </thead>
              <tbody>
                {d.uprawnienia.map((u) => (
                  <tr key={u.klucz}>
                    <td>{u.rodzaj}</td>
                    <td>{u.osoba ? u.osoba.oznaczenie : u.seria || 'cała spółka'}</td>
                    <td>{u.tytul || '—'}</td>
                    <td className="zawijaj">{u.tresc || '—'}</td>
                    <td>{fmt.data(u.data_ustanowienia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SekcjaRaportu>
        )}

        {/* art. 300(33) § 1 pkt 6–8 KSH */}
        {d.obciazenia.length > 0 && (
          <SekcjaRaportu tytul="Obciążenia i zajęcia akcji">
            <table className="tabela">
              <thead>
                <tr><th>Typ</th><th>Seria</th><th>Numery</th><th>Uprawniony</th><th>Prawo głosu</th><th>Od dnia</th></tr>
              </thead>
              <tbody>
                {d.obciazenia.map((o) => (
                  <tr key={o.klucz}>
                    <td>{o.typ === 'zajecie' ? 'zajęcie' : o.typ}</td>
                    <td>{o.seria}</td>
                    <td className="kol-dane">{o.numery}</td>
                    <td>{o.uprawniony ? o.uprawniony.oznaczenie : '—'}</td>
                    <td>{o.prawo_glosu ? 'tak' : 'nie'}</td>
                    <td>{fmt.data(o.data_od)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SekcjaRaportu>
        )}

        {/* art. 300(33) § 1 pkt 10 KSH */}
        {d.ograniczenia && d.ograniczenia.length > 0 && (
          <SekcjaRaportu tytul="Ograniczenia w rozporządzaniu akcjami">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Zakres</th><th>Seria</th><th>Numery</th>
                  <th>Zgoda spółki</th><th>Prawo pierwszeństwa</th><th>Opis</th>
                </tr>
              </thead>
              <tbody>
                {d.ograniczenia.map((o) => (
                  <tr key={o.klucz}>
                    <td>{o.zakres === 'spolka' ? 'cała spółka' : o.zakres}</td>
                    <td>{o.seria || '—'}</td>
                    <td className="kol-dane">{o.numery || '—'}</td>
                    <td>{o.wymaga_zgody_spolki ? 'tak' : 'nie'}</td>
                    <td>{o.prawo_pierwszenstwa ? 'tak' : 'nie'}</td>
                    <td className="zawijaj">{o.opis || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SekcjaRaportu>
        )}

        <StopkaRaportu
          oznaczenie={`odbiorca: ${opisOdbiorcy}`}
          dodatek={
            zamaskowane
              ? 'Numery PESEL, daty urodzenia i adresy zamieszkania pozostałych akcjonariuszy ' +
                'zostały zasłonięte — art. 300(35) § 1(1) KSH.'
              : null
          }
        />
      </div>
    </>
  );
}

window.EkranInformacji = EkranInformacji;

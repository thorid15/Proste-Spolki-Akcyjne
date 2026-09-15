/* oplaty.js — rozliczenia (sekcja 1, 5, 8 specyfikacji).

   Naliczanie samo: wpis odpłatny (workflow sprawy), informacja z rejestru
   (kancelaria i portal), prowadzenie rejestru (wsadowo, raz na rok). Ten
   ekran to wyłącznie PODGLĄD i ręczne korekty/status — logika naliczania
   żyje w server/oplaty.js. */

const TYP_ETYKIETA = {
  prowadzenie: 'Prowadzenie rejestru (rocznie)',
  wpis: 'Wpis w rejestrze',
  informacja: 'Informacja z rejestru',
};

const STATUS_ZNACZNIK = {
  naliczona: 'neutralny',
  zafakturowana: 'lupek',
  oplacona: 'zielony',
  anulowana: 'bordo',
};

const STATUS_ETYKIETA = {
  naliczona: 'naliczona',
  zafakturowana: 'zafakturowana',
  oplacona: 'opłacona',
  anulowana: 'anulowana',
};

function ModalNowaOplata({ spolki, stawki, przyZamknieciu, przyZapisie }) {
  const [dane, ustawDane] = useState({ spolka_id: '', typ: 'informacja', okres: '', kwota_grosze: '', notatka: '' });
  const [blad, ustawBlad] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);

  const pole = (k) => ({ value: dane[k] ?? '', onChange: (z) => ustawDane((p) => ({ ...p, [k]: z.target.value })) });
  const rokBiezacy = new Date().getFullYear();

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/oplaty', {
        ...dane,
        spolka_id: Number(dane.spolka_id),
        kwota_grosze: dane.kwota_grosze === '' ? undefined : Math.round(Number(dane.kwota_grosze) * 100),
      });
      przyZapisie(wynik.oplata);
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  const stawkaDomyslna = stawki ? stawki[{ prowadzenie: 'PROWADZENIE_ROCZNIE', wpis: 'WPIS', informacja: 'INFORMACJA' }[dane.typ]] : null;

  return (
    <Modal
      tytul="Nowa opłata"
      przyZamknieciu={przyZamknieciu}
      szerokosc={480}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-glowny" onClick={zapisz} disabled={zapisywanie || !dane.spolka_id}>
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      <Pole etykieta="Spółka" wymagane>
        <select {...pole('spolka_id')}>
          <option value="">— wybierz —</option>
          {spolki.map((s) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}
        </select>
      </Pole>
      <Pole etykieta="Rodzaj opłaty" wymagane>
        <select {...pole('typ')}>
          <option value="informacja">Informacja z rejestru</option>
          <option value="wpis">Wpis w rejestrze</option>
          <option value="prowadzenie">Prowadzenie rejestru (rocznie)</option>
        </select>
      </Pole>
      {dane.typ === 'prowadzenie' && (
        <Pole etykieta="Rok (okres)" wymagane>
          <input type="number" {...pole('okres')} placeholder={String(rokBiezacy)} />
        </Pole>
      )}
      <Pole
        etykieta="Kwota (zł)"
        podpowiedz={stawkaDomyslna != null ? `Zostaw puste, aby użyć stawki kancelarii: ${fmt.zlote(stawkaDomyslna)}.` : undefined}
      >
        <input type="number" step="0.01" min="0" {...pole('kwota_grosze')} placeholder={stawkaDomyslna != null ? String(stawkaDomyslna / 100) : ''} />
      </Pole>
      <Pole etykieta="Notatka"><textarea {...pole('notatka')} /></Pole>
    </Modal>
  );
}

/**
 * Naliczenie kolejnego roku prowadzenia rejestru.
 *
 * Nie po kalendarzu, tylko po ROCZNICY kazdej spolki: rok prowadzenia
 * biegnie od dnia otwarcia jej rejestru (§ 15b pkt 1 — "za kazdy rozpoczety
 * rok"), wiec kazda spolka ma wlasny termin. Wyprzedzenie mowi, jak daleko
 * w przod patrzec — 0 znaczy "tylko te, ktorym okres wlasnie sie konczy".
 */
function ModalOdnowienia({ przyZamknieciu, przyNaliczeniu }) {
  const [dni, ustawDni] = useState('30');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [wynik, ustawWynik] = useState(null);

  async function nalicz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const odpowiedz = await API.post('/api/psa/oplaty/odnowienia', { dni: Number(dni) });
      ustawWynik(odpowiedz);
      przyNaliczeniu();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  return (
    <Modal
      tytul="Nalicz kolejny rok prowadzenia rejestru"
      przyZamknieciu={przyZamknieciu}
      szerokosc={520}
      stopka={
        wynik
          ? <button className="btn btn-glowny" onClick={przyZamknieciu}>Zamknij</button>
          : (
            <>
              <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
              <button className="btn btn-glowny" onClick={nalicz} disabled={zapisywanie}>
                {zapisywanie ? 'Naliczanie…' : 'Nalicz'}
              </button>
            </>
          )
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      {wynik ? (
        <Komunikat odmiana="ok" tresc={wynik.komunikat} lista={wynik.naliczone.map((o) => `${o.spolka_nazwa || `spółka #${o.spolka_id}`} — ${o.okres}`)} />
      ) : (
        <Pole
          etykieta="Z wyprzedzeniem (dni)"
          podpowiedz="Nalicza kolejny okres tym spółkom, którym bieżący kończy się w tylu dniach. Idempotentne — można uruchomić wielokrotnie."
        >
          <input type="number" min="0" max="365" value={dni} onChange={(z) => ustawDni(z.target.value)} />
        </Pole>
      )}
    </Modal>
  );
}

/**
 * Jedna nalezność w widoku kancelarii. Poza kwotą i stanem niesie ODHACZENIE
 * FAKTURY — aplikacja faktur nie wystawia (robi to program księgowy), ale
 * bez tego znacznika pracownik nie ma gdzie zobaczyć, co jeszcze nie poszło
 * do księgowości.
 */
function WierszOplatyKancelarii({ oplata, przyZmianie }) {
  const [edycjaFaktury, ustawEdycjeFaktury] = useState(false);
  const [numer, ustawNumer] = useState(oplata.faktura_numer || '');
  const [pracuje, ustawPracuje] = useState(false);

  async function ustawFakture(wystawiona) {
    ustawPracuje(true);
    try {
      await API.patch(`/api/psa/oplaty/${oplata.id}/faktura`, { wystawiona, numer });
      ustawEdycjeFaktury(false);
      przyZmianie();
    } finally {
      ustawPracuje(false);
    }
  }

  async function zmienStatus(status) {
    ustawPracuje(true);
    try {
      await API.patch(`/api/psa/oplaty/${oplata.id}`, { status });
      przyZmianie();
    } finally {
      ustawPracuje(false);
    }
  }

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 500 }}>{TYP_ETYKIETA[oplata.typ] || oplata.typ}</div>
        {oplata.zamawiajacy && (
          <div className="male przyciemnione">zamówił: {oplata.zamawiajacy}</div>
        )}
      </td>
      <td className="przyciemnione">
        {oplata.okres_od && oplata.okres_do
          ? `${fmt.data(oplata.okres_od)} – ${fmt.data(oplata.okres_do)}`
          : (oplata.okres || '—')}
      </td>
      <td className="prawo" style={{ fontWeight: 600 }}>{fmt.zlote(oplata.kwota_grosze)}</td>
      <td>
        <Znacznik odmiana={STATUS_ZNACZNIK[oplata.status]}>{STATUS_ETYKIETA[oplata.status]}</Znacznik>
        {oplata.oplacona_online && <div className="male przyciemnione">online</div>}
      </td>
      <td>
        {oplata.faktura_wystawiono ? (
          <span className="male">
            <Znacznik odmiana="zielony">wystawiona</Znacznik>
            {oplata.faktura_numer ? ` ${oplata.faktura_numer}` : ''}
            <button className="btn-tekstowy" disabled={pracuje} onClick={() => ustawFakture(false)}>cofnij</button>
          </span>
        ) : edycjaFaktury ? (
          <span className="row-g">
            <input
              type="text"
              placeholder="numer faktury"
              value={numer}
              onChange={(z) => ustawNumer(z.target.value)}
              style={{ maxWidth: 150 }}
            />
            <button className="btn btn-maly btn-glowny" disabled={pracuje} onClick={() => ustawFakture(true)}>
              Zapisz
            </button>
            <button className="btn btn-maly" onClick={() => ustawEdycjeFaktury(false)}>Anuluj</button>
          </span>
        ) : (
          <button className="btn btn-maly" onClick={() => ustawEdycjeFaktury(true)}>Odhacz fakturę</button>
        )}
      </td>
      <td className="prawo">
        {/* Zamiast listy czterech statusow — dwie akcje, ktore pracownik
            rzeczywiscie wykonuje recznie. „Zafakturowana" ustawia sie sama
            przy odhaczeniu faktury, „oplacona" przychodzi z platnosci
            online; reczne oznaczenie zostaje dla przelewu na rachunek
            kancelarii. Lista pozwalala tez cofnac oplacona na naliczona,
            czego nikt nigdy nie chcial zrobic swiadomie. */}
        <span className="rzad" style={{ justifyContent: 'flex-end', gap: 'var(--od-8)' }}>
          {oplata.status !== 'oplacona' && (
            <button
              className="btn-tekstowy"
              disabled={pracuje}
              title="Wpłata poza portalem — np. przelew na rachunek kancelarii"
              onClick={() => zmienStatus('oplacona')}
            >
              Oznacz opłaconą
            </button>
          )}
          {oplata.status !== 'oplacona' && (
            <button className="btn-tekstowy" disabled={pracuje} onClick={() => zmienStatus('anulowana')}>
              Anuluj
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}

/**
 * Rozliczenia kancelarii — SPOLKA PO SPOLCE, bo tak pracownik o nich mysli:
 * „co jest do zafakturowania u tej spolki", a nie „wszystkie naleznosci
 * kancelarii posortowane po dacie". Plaska lista z filtrami zostala tylko
 * tam, gdzie jest naprawde potrzebna — w eksporcie CSV do ksiegowosci.
 */
function EkranOplat() {
  const sesja = useSesja();
  const [modalNowa, ustawModalNowa] = useState(false);
  const [modalOdnowienia, ustawModalOdnowienia] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [tylkoNierozliczone, ustawTylkoNierozliczone] = useState(true);
  const [przypomina, ustawPrzypomina] = useState(false);
  const [wynikPrzypomnien, ustawWynikPrzypomnien] = useState(null);

  const { dane, ladowanie, odswiez } = useDane('/api/psa/oplaty/wg-spolek');
  const { dane: spolkiOdp } = useDane('/api/psa/spolki');
  const { dane: meta } = useDane('/api/psa/meta');

  async function przypomnij() {
    ustawPrzypomina(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/oplaty/przypomnienia', { dni: 30 });
      ustawWynikPrzypomnien(wynik);
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawPrzypomina(false);
    }
  }

  if (ladowanie) return <Spinner />;
  if (!dane) return <Komunikat odmiana="blad" tresc="Nie udało się wczytać rozliczeń." />;

  const spolki = spolkiOdp ? spolkiOdp.spolki : [];
  const razemDoZaplaty = dane.spolki.reduce((s, g) => s + g.do_zaplaty_grosze, 0);
  const razemBezFaktury = dane.spolki.reduce((s, g) => s + g.bez_faktury_grosze, 0);
  const widoczne = dane.spolki.filter((g) => !tylkoNierozliczone || g.do_zaplaty_grosze > 0 || g.bez_faktury_grosze > 0);

  return (
    <>
      <div className="pasek-gorny">
        <div className="row-g" style={{ flexWrap: 'wrap' }}>
          <span className="stan-skrot">
            <span className="stan-skrot-etykieta">Do zapłaty</span>
            <strong>{fmt.zlote(razemDoZaplaty)}</strong>
          </span>
          <span className="stan-skrot">
            <span className="stan-skrot-etykieta">Bez faktury</span>
            <strong>{fmt.zlote(razemBezFaktury)}</strong>
          </span>
        </div>
        <div className="row-g">
          {dane.do_odnowienia.length > 0 && (
            <button className="btn" disabled={przypomina} onClick={przypomnij}>
              {przypomina ? 'Wysyłanie…' : 'Wyślij przypomnienia'}
            </button>
          )}
          {sesja.uzytkownik && sesja.uzytkownik.rola === 'admin' && (
            <button className="btn" onClick={() => ustawModalOdnowienia(true)}>Nalicz kolejny rok</button>
          )}
          <a className="btn" href="/api/psa/oplaty/eksport">Eksportuj CSV</a>
          <button className="btn btn-glowny" onClick={() => ustawModalNowa(true)}>+ Nowa opłata</button>
        </div>
      </div>

      <Komunikat odmiana="blad" tresc={blad} />
      {wynikPrzypomnien && (
        <Komunikat
          odmiana="ok"
          tytul={wynikPrzypomnien.komunikat}
          lista={wynikPrzypomnien.wyniki
            .filter((w) => !w.wyslano)
            .map((w) => `${w.spolka_nazwa || `spółka #${w.spolka_id}`}: ${w.powod}`)}
        />
      )}

      {/* Rok prowadzenia biegnie od rocznicy KAZDEJ SPOLKI z osobna, wiec
          bez tego przypomnienia termin przepada niezauwazony. */}
      {dane.do_odnowienia.length > 0 && (
        <Komunikat
          odmiana="uwaga"
          tytul={`Kończy się rok prowadzenia rejestru — ${fmt.odmien(dane.do_odnowienia.length, 'spółka', 'spółki', 'spółek')}`}
          tresc="Nalicz kolejny okres i wystaw fakturę, zanim bieżący się skończy."
          lista={dane.do_odnowienia.map((w) =>
            `${w.spolka_nazwa}: okres do ${fmt.data(w.okres_do)}`
            + (w.dni_do_konca >= 0 ? ` (${w.dni_do_konca} dni)` : ' — już minął')
          )}
        />
      )}

      <div className="row-g" style={{ marginBottom: 'var(--od-12)' }}>
        <label className="row-g" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={tylkoNierozliczone}
            onChange={(z) => ustawTylkoNierozliczone(z.target.checked)}
          />
          <span>Tylko spółki z czymś do rozliczenia</span>
        </label>
      </div>

      {widoczne.length === 0 ? (
        <Karta>
          <Pusto ikona="oplaty" tytul="Wszystko rozliczone" opis="Żadna spółka nie ma nieopłaconych ani niezafakturowanych należności." />
        </Karta>
      ) : (
        widoczne.map((grupa) => (
          <Sekcja
            key={grupa.spolka_id}
            tytul={grupa.spolka_nazwa}
            licznik={grupa.oplaty.length}
            domyslnieOtwarta={grupa.do_zaplaty_grosze > 0}
            akcje={
              <button className="btn btn-maly" onClick={() => idz(`/spolki/${grupa.spolka_id}`)}>
                Kokpit spółki
              </button>
            }
          >
            <div className="sekcja-tresc">
              <div className="row-g" style={{ marginBottom: 'var(--od-12)', flexWrap: 'wrap' }}>
                <span className="male przyciemnione">
                  Do zapłaty: <strong>{fmt.zlote(grupa.do_zaplaty_grosze)}</strong>
                </span>
                <span className="male przyciemnione">
                  Bez faktury: <strong>{fmt.zlote(grupa.bez_faktury_grosze)}</strong>
                </span>
                {grupa.data_otwarcia_rejestru && (
                  <span className="male przyciemnione">
                    Rejestr otwarty {fmt.data(grupa.data_otwarcia_rejestru)}
                  </span>
                )}
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Rodzaj</th>
                    <th>Okres</th>
                    <th className="prawo">Kwota</th>
                    <th>Stan</th>
                    <th>Faktura</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {grupa.oplaty.map((o) => (
                    <WierszOplatyKancelarii
                      key={o.id}
                      oplata={o}
                      przyZmianie={() => { ustawBlad(null); odswiez(); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Sekcja>
        ))
      )}

      {modalNowa && (
        <ModalNowaOplata
          spolki={spolki}
          stawki={meta ? meta.stawki_grosze : null}
          przyZamknieciu={() => ustawModalNowa(false)}
          przyZapisie={() => { ustawModalNowa(false); odswiez(); }}
        />
      )}
      {modalOdnowienia && (
        <ModalOdnowienia
          przyZamknieciu={() => ustawModalOdnowienia(false)}
          przyNaliczeniu={odswiez}
        />
      )}
    </>
  );
}

window.EkranOplat = EkranOplat;

/* kokpit.js — kokpit spółki: JEDEN EKRAN (sekcja 9 specyfikacji).

   Układ idzie za rejestrem akcjonariuszy prowadzonym przez notariuszy
   (Krajowa Rada Notarialna): u góry metryka spółki, niżej rozwijane
   REJESTRY o tych samych nazwach, których używa się w kancelarii —
   akcjonariuszy, akcji, uprawnień, zajęć — a na końcu akta i łańcuch
   zdarzeń. Każdy rejestr ma WŁASNY przycisk wpisu: nie ma jednego
   „Nowe zdarzenie", po którym trzeba było dopiero wybierać typ z listy
   dwudziestu kafelków. Wchodząc do sekcji „Rejestr akcji" wiadomo, że
   wpisuje się emisję — kreator dostaje typ z adresu i otwiera się od razu
   na podstawie wpisu.

   Dawna „oś akcji" (wykres numer akcji × czas z playheadem) została
   usunięta — stan na dzień wsteczny wybiera się zwykłym polem daty
   w nagłówku, bo tylko po to oś była w praktyce używana. */


/* ═════════════════════════════════════════════════════
   TABELA AKCJONARIATU + PRZEŁĄCZNIK UPROSZCZONY/SZCZEGÓŁOWY (2.4)
   ═════════════════════════════════════════════════════ */

/* Tryb szczegółowy: jeden wiersz na PRZEDZIAŁ numeryczny zamiast łączenia
   wszystkich zakresów pozycji w jedną komórkę — każdy wiersz pokazuje
   WYŁĄCZNIE obciążenia nakładające się na TEN konkretny przedział. Zakres
   obciążenia czytamy z jego własnego pola `numery` (ten sam ciąg, który
   tabela i tak wyświetla) — czysto prezentacyjne, bez zmiany kontraktu. */
function parsujNumery(tekst) {
  return String(tekst || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const czesci = c.split(/[-–]/).map((x) => Number(x.trim()));
      return { nr_od: czesci[0], nr_do: czesci.length > 1 ? czesci[1] : czesci[0] };
    });
}
function zakresyNakladajaSie(a, b) {
  return a.nr_od <= b.nr_do && b.nr_od <= a.nr_do;
}
function opiszZakres(z) {
  return z.nr_od === z.nr_do ? String(z.nr_od) : `${z.nr_od}–${z.nr_do}`;
}
function rozbijNaSzczegoly(akcjonariusze) {
  const wiersze = [];
  for (const a of akcjonariusze) {
    for (const z of a.zakresy) {
      const ilosc = z.nr_do - z.nr_od + 1;
      wiersze.push({
        ...a,
        zakresy: [z],
        ilosc,
        numery: opiszZakres(z),
        procent: a.ilosc ? (a.procent * ilosc) / a.ilosc : a.procent,
        obciazenia: a.obciazenia.filter((o) => parsujNumery(o.numery).some((zo) => zakresyNakladajaSie(zo, z))),
      });
    }
  }
  return wiersze;
}

/* Naprawa Z-058: pokrycie i rodzaj akcji (art. 300(33) § 1 pkt 4 i 9 KSH) sa
   USTAWOWA TRESCIA REJESTRU — dotad widoczne wylacznie na wydruku, kokpit
   ma je pokazywac na biezaco, bez potrzeby generowania dokumentu. */
const NAZWY_POKRYCIA_KOKPIT = {
  tak: 'w całości',
  nie: 'niepokryte',
  czesciowo: 'częściowo',
};
const NAZWA_POKRYCIA_NIEUSTALONE = 'nieustalone';

function opiszPokrycieKokpit(pokryta) {
  return NAZWY_POKRYCIA_KOKPIT[pokryta] || NAZWA_POKRYCIA_NIEUSTALONE;
}

const NAZWY_RODZAJU_AKCJI_KOKPIT = {
  zwykla: 'zwykła',
  uprzywilejowana: 'uprzywilejowana',
  zalozycielska: 'założycielska',
  niema: 'niema',
};

function rodzajAkcjiDlaEmisji(emisje, emisjaKlucz) {
  const emisja = (emisje || []).find((e) => e.klucz === emisjaKlucz);
  const rodzaj = emisja ? emisja.rodzaj_akcji : null;
  return NAZWY_RODZAJU_AKCJI_KOKPIT[rodzaj] || 'zwykła';
}

function TabelaAkcjonariatu({ akcjonariusze, razem, emisje }) {
  if (akcjonariusze.length === 0) {
    return (
      <Pusto
        ikona="osoby"
        tytul="Brak akcjonariuszy na wskazany dzień"
        opis="Zarejestruj emisję akcji, a następnie ich objęcie."
      />
    );
  }
  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>Akcjonariusz</th>
          <th>Seria</th>
          <th>Rodzaj akcji</th>
          <th className="do-prawej">Liczba akcji</th>
          <th>Numery</th>
          <th className="do-prawej">% akcji</th>
          <th>Pokrycie</th>
          <th>Obciążenia</th>
        </tr>
      </thead>
      <tbody>
        {akcjonariusze.map((a, i) => {
          // Tryb szczegółowy rozbija jedną pozycję na kilka wierszy — `id`
          // do przewijania z osi akcji nadajemy TYLKO pierwszemu.
          const pierwszaDlaPozycji =
            akcjonariusze.findIndex((x) => x.osoba_id === a.osoba_id && x.emisja_klucz === a.emisja_klucz) === i;
          return (
            <tr
              key={`${a.osoba_id}-${a.emisja_klucz}-${i}`}
              id={pierwszaDlaPozycji ? `akcjonariusz-${a.osoba_id}-${a.emisja_klucz}` : undefined}
            >
              <td>
                <div style={{ fontWeight: 500 }}>{a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`}</div>
                <div className="wiersz-podtytul">
                  akcjonariusz od {fmt.data(a.data_nabycia)}
                  {a.osoba && a.osoba.jawny_identyfikator ? ` · ${a.osoba.jawny_identyfikator}` : ''}
                </div>
                {/* D-050/B12: moment SYSTEMOWEGO wpisu (co do sekundy) —
                    inny od daty prawnej zdarzenia wyżej. Puste dla pozycji
                    wpisanych przed kolumną `data_wpisu` z sekundami. */}
                {a.wpisano_do_rejestru && (
                  <div className="wiersz-podtytul wyciszony">
                    Wpisano do rejestru: {fmt.dataCzas(a.wpisano_do_rejestru)}
                  </div>
                )}
              </td>
              <td>{a.seria}</td>
              <td>{rodzajAkcjiDlaEmisji(emisje, a.emisja_klucz)}</td>
              <td className="do-prawej" style={{ fontWeight: 600 }}>{fmt.liczba(a.ilosc)}</td>
              <td className="kol-dane">{a.numery}</td>
              <td className="do-prawej">{fmt.procent(a.procent)}</td>
              <td>{opiszPokrycieKokpit(a.pokryta)}</td>
              <td>
                {a.obciazenia.length === 0 ? (
                  <span className="wyciszony">—</span>
                ) : (
                  <div className="rzad" style={{ flexWrap: 'wrap', gap: 5 }}>
                    {a.obciazenia.map((o, j) => (
                      <Pigulka key={j} odmiana={o.blokuje_rozporzadzanie ? 'sygnal' : 'mosiadz'}>
                        {o.typ === 'zajecie' ? 'zajęcie' : o.typ} {o.numery}
                      </Pigulka>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3}>Razem</td>
          <td className="do-prawej">{fmt.liczba(razem)}</td>
          <td />
          <td className="do-prawej">100%</td>
          <td />
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

/* ═════════════════════════════════════════════════════
   SPROSTOWANIE
   ═════════════════════════════════════════════════════ */

/** Sprostowanie jako czysta adnotacja — pełne wycofanie zdarzenia jest gestem
    wyjątkowym, więc UI oferuje wyłącznie ścieżkę „uzasadnienie” (bez `zamiast`,
    dla zdarzeń bez zależnych) — patrz README, sekcja o zakresie sprintu 2. */
function ModalSprostowania({ zdarzenie, przyZamknieciu, przyZapisie }) {
  const [uzasadnienie, ustawUzasadnienie] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/zdarzenia/${zdarzenie.id}/sprostuj`, { uzasadnienie });
      przyZapisie();
    } catch (e) {
      ustawBlad(e.message);
      ustawZapisywanie(false);
    }
  }

  return (
    <Modal
      tytul={`Sprostowanie zdarzenia #${zdarzenie.id}`}
      przyZamknieciu={przyZamknieciu}
      szerokosc={560}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-glowny" disabled={!uzasadnienie.trim() || zapisywanie} onClick={zapisz}>
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz sprostowanie'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="info" tresc={
        'Rejestr jest niezmienialny — sprostowanie jest NOWYM zdarzeniem wskazującym ' +
        'zdarzenie prostowane. Bez treści zastępczej jest to pełne wycofanie tego zdarzenia ' +
        '(nie ma czym go zastąpić) — możliwe tylko, gdy nic innego już od niego nie zależy.'
      } />
      <Komunikat odmiana="blad" tresc={blad} />
      <Pole etykieta={`Prostowane zdarzenie: ${zdarzenie.podsumowanie || zdarzenie.typ}`} />
      <Pole etykieta="Uzasadnienie" wymagane>
        <textarea value={uzasadnienie} onChange={(z) => ustawUzasadnienie(z.target.value)} autoFocus />
      </Pole>
    </Modal>
  );
}

/* ═════════════════════════════════════════════════════
   ZGŁOSZENIA NIEPRAWIDŁOWOŚCI Z PORTALU (B9) — klient sygnalizuje, że
   ISTNIEJĄCY wpis jest błędny; pracownik wyłącznie KWALIFIKUJE zgłoszenie
   (samo zakwalifikowanie nie zakłada sprostowania ani sprawy — to
   świadoma, osobna czynność w zwykłym kreatorze zdarzenia).
   ═════════════════════════════════════════════════════ */
const CZEGO_DOTYCZY_ZGLOSZENIA_ETYKIETY = {
  blad_w_danych: 'Błąd w danych (literówka, zła data, zły numer)',
  niezgodny_z_dokumentem: 'Wpis niezgodny z dokumentem, na podstawie którego powstał',
  inne: 'Inne',
};

function ModalKwalifikacjaZgloszenia({ zgloszenie, przyZamknieciu, przyZapisie }) {
  const [kwalifikacja, ustawKwalifikacje] = useState('');
  const [notatka, ustawNotatke] = useState('');
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/zgloszenia-nieprawidlowosci/${zgloszenie.id}/kwalifikuj`, {
        kwalifikacja, notatka,
      });
      przyZapisie();
    } catch (e) {
      ustawBlad(e.message);
      ustawZapisywanie(false);
    }
  }

  return (
    <Modal
      tytul="Kwalifikacja zgłoszenia nieprawidłowości"
      przyZamknieciu={przyZamknieciu}
      szerokosc={560}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-glowny" disabled={!kwalifikacja || zapisywanie} onClick={zapisz}>
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz kwalifikację'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      <Pole etykieta="Czego dotyczy">
        {CZEGO_DOTYCZY_ZGLOSZENIA_ETYKIETY[zgloszenie.czego_dotyczy] || zgloszenie.czego_dotyczy}
      </Pole>
      <Pole etykieta="Opis klienta">{zgloszenie.opis}</Pole>
      <Pole etykieta="Kwalifikacja" wymagane>
        <select value={kwalifikacja} onChange={(z) => ustawKwalifikacje(z.target.value)}>
          <option value="">— wybierz —</option>
          <option value="sprostowanie">Sprostowanie — dokonam go w kreatorze zdarzenia</option>
          <option value="zadanie_wpisu">To żądanie nowego wpisu, nie błąd</option>
          <option value="brak_nieprawidlowosci">Rejestr jest poprawny — brak nieprawidłowości</option>
        </select>
      </Pole>
      <Pole etykieta="Notatka (opcjonalnie)">
        <textarea rows={3} value={notatka} onChange={(z) => ustawNotatke(z.target.value)} />
      </Pole>
      {kwalifikacja === 'sprostowanie' && (
        <Komunikat
          odmiana="info"
          tresc="Kwalifikacja NIE dokonuje sprostowania automatycznie — po zapisaniu wykonaj je zwykłym kreatorem zdarzenia (przycisk „Sprostuj” przy zdarzeniu w historii)."
        />
      )}
    </Modal>
  );
}

/* ═════════════════════════════════════════════════════
   METRYKA REJESTRU (prawa, przyklejona kolumna — 2 „Plan projektu")
   ═════════════════════════════════════════════════════ */

const NAZWY_UMOWE_ZAWARL = {
  notariusz: 'notariusz',
  zastepca: 'zastępca notarialny',
  osoba_upowazniona: 'osoba upoważniona',
};

/**
 * Przelacznik "stosuje procedure AML" (etap 3.1) - wylaczony domyslnie.
 * Wlacza go zbieranie skanow dokumentow, oswiadczenia PEP i beneficjenta
 * rzeczywistego przy edycji akcjonariuszy TEJ spolki (patrz FormularzOsoby
 * w osoby.js) - domyslnie (wylaczony) kartoteka zbiera wylacznie dane Z
 * dokumentu, bez pliku.
 */
function KartaProceduryAml({ spolka, spolkaId, odswiez }) {
  const [zapisywanie, ustawZapisywanie] = useState(false);

  async function przelacz() {
    ustawZapisywanie(true);
    try {
      await API.put(`/api/psa/spolki/${spolkaId}`, { stosuje_procedure_aml: !spolka.stosuje_procedure_aml });
      odswiez();
    } catch (e) {
      window.alert(e instanceof BladApi ? e.message : 'Nie udało się zmienić ustawienia procedury AML.');
    } finally {
      ustawZapisywanie(false);
    }
  }

  const wlaczona = Boolean(Number(spolka.stosuje_procedure_aml));

  return (
    <Karta tytul="Procedura AML">
      <div className="metryka-pion">
        <label className="chk" style={{ padding: '4px 0' }}>
          <input type="checkbox" checked={wlaczona} onChange={przelacz} disabled={zapisywanie} />
          <span className="chk-tresc">Stosuje procedurę AML dla tej spółki</span>
        </label>
        <div className="podpowiedz">
          {wlaczona
            ? 'Włączona: przy edycji akcjonariuszy tej spółki można dodać skan dokumentu tożsamości, oświadczenie PEP i wskazać beneficjenta rzeczywistego.'
            : 'Wyłączona (domyślnie): kartoteka zbiera wyłącznie dane z dokumentu tożsamości (status, data weryfikacji, notatka) — bez pliku.'}
        </div>
      </div>
    </Karta>
  );
}

function MetrykaBoczna({ spolka, dane, spolkaId, odswiez }) {
  const integralnosc = useDane('/api/psa/integralnosc');
  const terminy = useDane(`/api/psa/sprawy?spolka_id=${spolkaId}`);
  const sprawyWToku = terminy.dane ? terminy.dane.sprawy : [];
  const najpilniejsza = sprawyWToku
    .filter((s) => s.termin && s.termin.dni_pozostale != null)
    .sort((a, b) => a.termin.dni_pozostale - b.termin.dni_pozostale)[0];

  return (
    <aside className="siatka-tresc-prawa bez-druku">
      <Karta tytul="Dane rejestrowe">
        <div className="metryka-pion">
          <MetrykaPoz etykieta="Numer KRS" wartosc={spolka.krs} dane />
          <MetrykaPoz etykieta="NIP" wartosc={spolka.nip} dane />
          <MetrykaPoz etykieta="Sąd rejestrowy" wartosc={[spolka.sad_rejestrowy, spolka.wydzial].filter(Boolean).join(', ')} />
        </div>
      </Karta>

      <Karta tytul="Umowa o prowadzenie rejestru">
        <div className="metryka-pion">
          <MetrykaPoz etykieta="Data uchwały o wyborze" wartosc={fmt.data(spolka.data_uchwaly_wyboru)} dane podpowiedz="art. 300³² § 1 KSH" />
          <MetrykaPoz etykieta="Data umowy" wartosc={fmt.data(spolka.data_umowy)} dane />
          <MetrykaPoz
            etykieta="Zawarł"
            wartosc={
              spolka.umowe_zawarl
                ? `${NAZWY_UMOWE_ZAWARL[spolka.umowe_zawarl] || spolka.umowe_zawarl}${
                    spolka.umowe_zawarl_imie_nazwisko ? ` — ${spolka.umowe_zawarl_imie_nazwisko}` : ''
                  }`
                : null
            }
          />
          <MetrykaPoz etykieta="Data otwarcia rejestru" wartosc={fmt.data(spolka.data_otwarcia_rejestru)} dane />
        </div>
      </Karta>

      <Karta tytul="Stan rejestru">
        <div className="metryka-pion">
          <MetrykaPoz etykieta="Akcje w obrocie" wartosc={fmt.liczba(dane.razem_akcji)} />
          <MetrykaPoz etykieta="Zdarzenia tej spółki" wartosc={fmt.liczba(dane.liczba_zdarzen)} />
          <div className="metryka-pion-poz">
            <div className="metryka-pion-etykieta">Łańcuch skrótów rejestru</div>
            {integralnosc.ladowanie ? (
              <div className="metryka-pion-wartosc wyciszony">sprawdzanie…</div>
            ) : integralnosc.dane && integralnosc.dane.ok ? (
              <Pigulka odmiana="rejestr">nieprzerwany</Pigulka>
            ) : integralnosc.dane ? (
              <Pigulka odmiana="sygnal">zerwany przy #{integralnosc.dane.blad && integralnosc.dane.blad.id}</Pigulka>
            ) : (
              <span className="wyciszony male">niedostępne</span>
            )}
          </div>
        </div>
      </Karta>

      <Karta tytul="Terminy">
        {sprawyWToku.length === 0 ? (
          <div className="male wyciszony">Brak spraw w toku dla tej spółki.</div>
        ) : (
          <div className="metryka-pion">
            <MetrykaPoz etykieta="Sprawy w toku" wartosc={String(sprawyWToku.length)} />
            {najpilniejsza && (
              <div className="metryka-pion-poz">
                <div className="metryka-pion-etykieta">Najbliższy termin</div>
                <Pigulka odmiana={najpilniejsza.termin.po_terminie ? 'sygnal' : najpilniejsza.termin.pilny ? 'mosiadz' : undefined}>
                  {najpilniejsza.termin.po_terminie ? 'po terminie' : `${najpilniejsza.termin.dni_pozostale} dz.`}
                </Pigulka>
              </div>
            )}
            <button className="btn btn-maly" onClick={() => idz(`/sprawy?spolka_id=${spolkaId}`)}>
              Zobacz sprawy
            </button>
          </div>
        )}
      </Karta>

      <KartaProceduryAml spolka={spolka} spolkaId={spolkaId} odswiez={odswiez} />
    </aside>
  );
}

function MetrykaPoz({ etykieta, wartosc, dane, podpowiedz }) {
  return (
    <div className="metryka-pion-poz">
      <div className="metryka-pion-etykieta">{etykieta}</div>
      <div className={`metryka-pion-wartosc ${dane ? 'dane' : ''}`}>{wartosc || '—'}</div>
      {podpowiedz && <div className="podstawa-prawna">{podpowiedz}</div>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   WPISY: KAŻDY REJESTR MA SWÓJ PRZYCISK
   ═════════════════════════════════════════════════════ */

/**
 * Przycisk zakładający sprawę o KONKRETNYM typie zdarzenia.
 *
 * Dawniej wszystko szło przez jedno „Nowe zdarzenie" i ekran z dwudziestoma
 * kafelkami, na którym trzeba było dopiero znaleźć właściwy. Skoro przycisk
 * stoi przy rejestrze zajęć, to wiadomo, że wpisuje się zajęcie — typ jedzie
 * w adresie, a kreator otwiera się od razu na podstawie wpisu.
 */
function PrzyciskWpisu({ spolkaId, typ, emisja, glowny, dzieci, children }) {
  const tresc = children ?? dzieci;
  const adres =
    `/spolki/${spolkaId}/zdarzenie?typ=${typ}` + (emisja ? `&emisja=${encodeURIComponent(emisja)}` : '');
  return (
    <button className={`btn btn-maly ${glowny ? 'btn-glowny' : ''}`} onClick={() => idz(adres)}>
      {glowny && <Ikona nazwa="plus" rozmiar={14} />}
      {tresc}
    </button>
  );
}

/** Rząd wpisów rzadszych — pod tabelą, nie w nagłówku sekcji. */
function DalszeWpisy({ tytul, dzieci, children }) {
  return (
    <div className="dalsze-wpisy bez-druku">
      <span className="dalsze-wpisy-tytul">{tytul}</span>
      {children ?? dzieci}
    </div>
  );
}

/**
 * „Dodaj akcjonariusza" — pytanie, którego rejestr naprawdę potrzebuje.
 *
 * Akcjonariusz nie pojawia się w rejestrze sam z siebie: albo OBEJMUJE akcje
 * nowo wyemitowane, albo NABYWA je od kogoś, kto już je ma. To dwa różne
 * zdarzenia, z inną podstawą wpisu i innymi skutkami — więc zamiast kazać
 * wybierać typ z listy, pytamy wprost, co się stało. Ile akcji czeka na
 * objęcie, system wie sam i podpowiada.
 */
function ModalDodajAkcjonariusza({ spolkaId, nieobjete, sanAkcjonariusze, przyZamknieciu }) {
  function idzDo(typ) {
    idz(`/spolki/${spolkaId}/zdarzenie?typ=${typ}`);
  }
  return (
    <Modal
      tytul="Skąd ten akcjonariusz ma akcje?"
      przyZamknieciu={przyZamknieciu}
      szerokosc={620}
      stopka={<button className="btn" onClick={przyZamknieciu}>Anuluj</button>}
    >
      <div className="kafelki-wyboru">
        <button className="kafelek-wyboru" onClick={() => idzDo('objecie')} disabled={nieobjete === 0}>
          <Ikona nazwa="akcje" rozmiar={20} />
          <span className="kafelek-wyboru-tytul">Obejmuje akcje nowej emisji</span>
          <span className="kafelek-wyboru-opis">
            {nieobjete > 0
              ? `${fmt.AKCJE(nieobjete)} czeka na objęcie.`
              : 'Żadna emisja nie czeka na objęcie — najpierw wpisz emisję w rejestrze akcji.'}
          </span>
        </button>
        <button className="kafelek-wyboru" onClick={() => idzDo('przeniesienie')} disabled={!sanAkcjonariusze}>
          <Ikona nazwa="zdarzenie" rozmiar={20} />
          <span className="kafelek-wyboru-tytul">Nabył akcje od akcjonariusza</span>
          <span className="kafelek-wyboru-opis">
            {sanAkcjonariusze
              ? 'Sprzedaż, darowizna, dziedziczenie, wniesienie aportem.'
              : 'W rejestrze nie ma jeszcze nikogo, kto mógłby zbyć akcje.'}
          </span>
        </button>
      </div>
    </Modal>
  );
}

/* ═════════════════════════════════════════════════════
   DOKUMENTY SPÓŁKI (AKTA)
   ═════════════════════════════════════════════════════ */

const NAZWY_GRUP_AKT = {
  zalozycielski: 'Z wniosku o prowadzenie rejestru',
  sprawa: 'Odesłane przy żądaniach wpisu',
  wydany: 'Wystawione przez kancelarię',
};

/**
 * Teczka spółki — komplet z wniosku, skany dosłane przy kolejnych żądaniach
 * (umowa sprzedaży akcji trafia tu razem ze sprawą, w której ją złożono)
 * i wszystko, co kancelaria wystawiła. Dotąd te trzy zbiory mieszkały na
 * trzech ekranach.
 */
function ZawartoscAkt({ dokumenty, ladowanie, spolkaId }) {
  const [wystawianie, ustawWystawianie] = useState(false);
  if (ladowanie) return <Spinner />;

  const grupy = Object.keys(NAZWY_GRUP_AKT)
    .map((g) => [g, dokumenty.filter((d) => d.grupa === g)])
    .filter(([, lista]) => lista.length > 0);

  return (
    <div className="sekcja-tresc">
      {grupy.length === 0 ? (
        <Pusto
          ikona="dokument"
          tytul="Akta są jeszcze puste"
          opis="Trafią tu dokumenty z wniosku, skany dosyłane przy żądaniach wpisu i pisma wystawione przez kancelarię."
        />
      ) : (
        grupy.map(([grupa, lista]) => (
          <div key={grupa} className="akta-grupa">
            <div className="akta-grupa-tytul">{NAZWY_GRUP_AKT[grupa]}</div>
            <table className="tabela">
              <thead>
                <tr><th>Dokument</th><th>Opis</th><th>Data</th><th className="do-prawej">Plik</th></tr>
              </thead>
              <tbody>
                {lista.map((d) => (
                  <tr key={`${d.grupa}-${d.id}`}>
                    <td style={{ fontWeight: 500 }}>{d.nazwa}</td>
                    <td className="wyciszony">{d.opis}</td>
                    <td className="wyciszony">{fmt.data(d.data)}</td>
                    <td className="do-prawej">
                      <span className="rzad" style={{ justifyContent: 'flex-end' }}>
                        {d.url ? (
                          <a className="btn btn-maly" href={d.url} target="_blank" rel="noopener">
                            {d.url_podpisany ? 'Wystawiony' : 'Pobierz'}
                          </a>
                        ) : (
                          <span className="wyciszony male">bez pliku</span>
                        )}
                        {d.url_podpisany && (
                          <a className="btn btn-maly btn-glowny" href={d.url_podpisany} target="_blank" rel="noopener">
                            Podpisany
                          </a>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
      <DalszeWpisy tytul="Wystaw dokument:">
        <button className="btn btn-maly" onClick={() => ustawWystawianie(true)}>
          Informacja, zaświadczenie, pismo
        </button>
      </DalszeWpisy>
      {wystawianie && (
        <ModalWystawDokumentu spolkaId={spolkaId} przyZamknieciu={() => ustawWystawianie(false)} />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   EKRAN KOKPITU
   ═════════════════════════════════════════════════════ */

/** Zdarzenia, które mają własny rejestr — w „Rejestrze zdarzeń" byłyby powtórką. */
const TYPY_WE_WLASNYCH_REJESTRACH = [
  'emisja', 'objecie', 'przeniesienie', 'umorzenie', 'uniewaznienie',
  'obciazenie', 'wykreslenie_obciazenia', 'prawo_glosu_zastawnika',
  'zajecie', 'wykreslenie_zajecia', 'uprawnienie', 'ograniczenie',
];

function EkranKokpitu({ spolkaId }) {
  // Stan rejestru na wskazany dzień (art. 300(35) KSH — informacja wydaje się
  // NA DZIEŃ). Dawniej wybierało się go playheadem na osi akcji; oś zniknęła,
  // więc została sama data, czyli to, o co naprawdę chodziło.
  //
  // D-050 (sesja frontendowa v2, B12): pole godziny dodane naprawą Z-305/P-011
  // usunięte z powrotem — serwer nadal przyjmuje `data` z dokładnością do
  // minuty, ale w UI to niepotrzebna złożoność (rejestr zmienia się kilka
  // razy w roku, nie kilka razy dziennie); dokładny moment wpisu widać teraz
  // przy KAŻDEJ pozycji akcjonariusza i w historii zdarzeń (fmt.dataCzas).
  const [dataDnia, ustawDataDnia] = useState(fmt.dzisIso());
  const data = dataDnia;
  function ustawDate(nowaData) {
    ustawDataDnia(nowaData);
  }
  const [szczegolowy, ustawSzczegolowy] = useState(false);
  const [przeliczanie, ustawPrzeliczanie] = useState(null);
  const [sprostowanie, ustawSprostowanie] = useState(null);
  const [dodawanieAkcjonariusza, ustawDodawanieAkcjonariusza] = useState(false);
  const [kwalifikowanieZgloszenia, ustawKwalifikowanieZgloszenia] = useState(null);

  const wstecz = data !== fmt.dzisIso();

  const { dane, ladowanie, blad, odswiez } = useDane(
    `/api/psa/spolki/${spolkaId}?data=${encodeURIComponent(data)}`,
    [data]
  );
  const wszystkieZdarzenia = useDane(`/api/psa/spolki/${spolkaId}/zdarzenia`);
  const akta = useDane(`/api/psa/spolki/${spolkaId}/akta`);
  const zgloszeniaNieprawidlowosci = useDane(
    `/api/psa/zgloszenia-nieprawidlowosci?spolka_id=${spolkaId}&stan=nowe`,
    [spolkaId]
  );

  /** Etap 5.1: skok miedzy zdarzeniem prostowanym a prostujacym - link dziala w OBIE strony. */
  function skoczDoZdarzenia(id) {
    const el = document.getElementById(`zdarzenie-${id}`);
    if (!el) return;
    const bezRuchu = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: bezRuchu ? 'auto' : 'smooth', block: 'center' });
    el.classList.add('podswietlone');
    setTimeout(() => el.classList.remove('podswietlone'), 1600);
  }

  async function przelicz() {
    ustawPrzeliczanie(null);
    try {
      const wynik = await API.post(`/api/psa/spolki/${spolkaId}/przelicz`);
      ustawPrzeliczanie(wynik);
      odswiez();
    } catch (e) {
      ustawPrzeliczanie({ ok: false, komunikat: e.message, niezgodnosci: e.bledy || [] });
    }
  }

  if (ladowanie && !dane) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tytul="Nie udało się wczytać spółki" tresc={blad.message} />;
  if (!dane) return null;

  const { spolka, emisje, bilans, akcjonariusze, obciazenia, uprawnienia, ograniczenia } = dane;
  const nieobjete = bilans.reduce((s, b) => s + b.nieobjete, 0);
  const zdarzenia = wszystkieZdarzenia.dane ? wszystkieZdarzenia.dane.zdarzenia : dane.zdarzenia;
  const zdarzeniaPozostale = zdarzenia.filter((z) => !TYPY_WE_WLASNYCH_REJESTRACH.includes(z.typ));
  const dokumentyAkt = akta.dane ? akta.dane.dokumenty : [];
  const liczbaAkcjonariuszy = new Set(akcjonariusze.map((a) => a.osoba_id)).size;

  return (
    <>
      <div className="okruszki bez-druku">
        <button onClick={() => idz('/spolki')}>Spółki</button>
        <Ikona nazwa="strzalkaPrawo" rozmiar={13} />
        <span>{spolka.nazwa}</span>
      </div>

      <div className="naglowek-strony">
        <div style={{ minWidth: 0 }}>
          <div className="rzad" style={{ gap: 'var(--od-12)', flexWrap: 'wrap' }}>
            <h1 className="tytul-ekranu">{spolka.nazwa}</h1>
            <StatusSpolki status={spolka.status} />
            {wstecz && (
              <span className="pigulka-archiwalna">
                <Ikona nazwa="zegar" rozmiar={13} />
                Stan na {fmt.dataCzas(data)}
              </span>
            )}
          </div>
          <div className="naglowek-strony-kontekst">
            Rejestr prowadzi {spolka.organ_prowadzacy || 'Kancelaria Notarialna Łukasz Kozon'} —
            art. 300³¹ § 1 KSH
            {/* K7 (FAZA 3 sesji frontendowej v2, pkt 2): akcja niemal nigdy
                nie używana (wyłącznie przy przeniesieniu spółki z innego
                rejestru) stała dotąd na pierwszym planie, obok „Informacja
                z rejestru" — tego samego formatu przycisku. Zostaje jako
                dyskretny odnośnik tekstowy, nie znika (bywa potrzebna raz na
                spółkę), ale nie konkuruje wzrokowo ze zwykłymi akcjami. */}
            {!wstecz && dane.liczba_zdarzen === 0 && (
              <>
                {' · '}
                <button
                  type="button"
                  className="btn-tekstowy"
                  onClick={() => idz(`/spolki/${spolkaId}/migracja`)}
                  title="WYŁĄCZNIE dla spółki przenoszonej z innego rejestru (np. Rejestrów Notarialnych), z datami historycznymi z przeszłości. Nowa spółka (w tym z przyjętego wniosku portalowego) otwiera rejestr przez przycisk „Otwórz rejestr” w kreatorze, nie tędy."
                >
                  Migracja z innego rejestru — stan otwarcia
                </button>
              </>
            )}
          </div>
        </div>
        <div className="naglowek-strony-akcje">
          {/* Stan wsteczny to ODCZYT, nie zmiana — zostaje też w trybie
              archiwalnym, tak jak wydruki. */}
          <div className="stan-na-dzien bez-druku">
            <span className="stan-na-dzien-etykieta">Stan na dzień</span>
            <PoleDaty wartosc={dataDnia} max={fmt.dzisIso()} przyZmianie={(v) => v && ustawDate(v)} />
            {wstecz && (
              <button className="btn btn-maly" onClick={() => ustawDate(fmt.dzisIso())}>Dziś</button>
            )}
          </div>
          <button className="btn" onClick={() => idz(`/spolki/${spolkaId}/wydruk/informacja?data=${data}`)}>
            <Ikona nazwa="dokument" rozmiar={16} /> Informacja z rejestru
          </button>
        </div>
      </div>

      <div className={`siatka-tresc ${wstecz ? 'archiwalny' : ''}`}>
        <div style={{ minWidth: 0 }}>
          {dane.niezgodnosci && dane.niezgodnosci.length > 0 && (
            <Komunikat odmiana="blad" tytul="Bilans akcji się nie zgadza" lista={dane.niezgodnosci} />
          )}
          {przeliczanie && (
            <Komunikat
              odmiana={przeliczanie.ok ? 'rejestr' : 'blad'}
              tresc={przeliczanie.komunikat}
              lista={przeliczanie.niezgodnosci}
            />
          )}
          {nieobjete > 0 && (
            <Komunikat
              odmiana="uwaga"
              tytul="Akcje wyemitowane, a jeszcze nieobjęte"
              tresc={
                `${fmt.AKCJE(nieobjete)} czeka na wpis objęcia. Zadaniem podmiotu prowadzącego ` +
                'rejestr jest zapewnienie zgodności liczby akcji zarejestrowanych z liczbą ' +
                'wyemitowanych (art. 300(31) § 2 KSH).'
              }
            />
          )}

          {/* ─── 1. REJESTR AKCJONARIUSZY ─────────────────────────────── */}
          <Sekcja
            tytul="Rejestr akcjonariuszy"
            licznik={liczbaAkcjonariuszy}
            domyslnieOtwarta
            akcje={
              <>
                <div className="rzad bez-druku" role="group" aria-label="Widok tabeli akcjonariatu">
                  <button
                    className={`btn btn-maly ${!szczegolowy ? 'btn-glowny' : ''}`}
                    onClick={() => ustawSzczegolowy(false)}
                    title="Jeden wiersz na akcjonariusza"
                  >
                    Uproszczony
                  </button>
                  <button
                    className={`btn btn-maly ${szczegolowy ? 'btn-glowny' : ''}`}
                    onClick={() => ustawSzczegolowy(true)}
                    title="Jeden wiersz na przedział numeryczny — widać obciążenia i współwłasność co do numeru"
                  >
                    Szczegółowy
                  </button>
                </div>
                {!wstecz && (
                  <button className="btn btn-maly btn-glowny" onClick={() => ustawDodawanieAkcjonariusza(true)}>
                    <Ikona nazwa="plus" rozmiar={14} /> Dodaj akcjonariusza
                  </button>
                )}
              </>
            }
          >
            <div className="sekcja-tresc">
              <TabelaAkcjonariatu
                akcjonariusze={szczegolowy ? rozbijNaSzczegoly(akcjonariusze) : akcjonariusze}
                razem={dane.razem_akcji}
                emisje={emisje}
              />
              {!wstecz && (
                <DalszeWpisy tytul="Dalsze wpisy:">
                  <PrzyciskWpisu spolkaId={spolkaId} typ="przeniesienie">Przeniesienie akcji</PrzyciskWpisu>
                  <PrzyciskWpisu spolkaId={spolkaId} typ="zmiana_danych_akcjonariusza">
                    Zmiana danych akcjonariusza
                  </PrzyciskWpisu>
                  <PrzyciskWpisu spolkaId={spolkaId} typ="przedstawiciel">
                    Przedstawiciel współuprawnionych
                  </PrzyciskWpisu>
                </DalszeWpisy>
              )}
            </div>
          </Sekcja>

          {/* ─── 2. REJESTR AKCJI ─────────────────────────────────────── */}
          <Sekcja
            tytul="Rejestr akcji"
            licznik={emisje.length}
            akcje={
              !wstecz && (
                <PrzyciskWpisu spolkaId={spolkaId} typ="emisja" glowny>Nowa emisja</PrzyciskWpisu>
              )
            }
          >
            <div className="sekcja-tresc">
              {emisje.length === 0 ? (
                <Pusto
                  ikona="akcje"
                  tytul="Brak emisji"
                  opis="Pierwszym zdarzeniem w rejestrze jest emisja akcji — zwykle założycielska, z umowy spółki."
                />
              ) : (
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Seria</th><th>Tytuł</th><th>Numery</th>
                      <th className="do-prawej">Wyemitowane</th>
                      <th className="do-prawej">Nieobjęte</th>
                      <th className="do-prawej">Umorzone</th>
                      <th className="do-prawej">Cena emisyjna</th>
                      <th>Data emisji</th>
                      {/* Kolumna akcji pojawia się TYLKO wtedy, gdy jest co
                          obejmować — pusty nagłówek zabierał miejsce ośmiu
                          kolumnom, które zawsze mają treść. */}
                      {!wstecz && nieobjete > 0 && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {emisje.map((e) => {
                      const b = bilans.find((x) => x.emisja_klucz === e.klucz) || {};
                      return (
                        <tr key={e.klucz}>
                          <td style={{ fontWeight: 600 }}>{e.seria}</td>
                          <td>{e.tytul || '—'}</td>
                          <td className="kol-dane">{e.zakres}</td>
                          <td className="do-prawej">{fmt.liczba(e.ilosc)}</td>
                          <td className="do-prawej">
                            {b.nieobjete ? <span style={{ color: 'var(--mosiadz)' }}>{fmt.liczba(b.nieobjete)}</span> : '—'}
                          </td>
                          <td className="do-prawej">{b.umorzone ? fmt.liczba(b.umorzone) : '—'}</td>
                          <td className="do-prawej">{fmt.zlote(e.cena_emisyjna_grosze)}</td>
                          <td className="wyciszony">{fmt.data(e.data_emisji)}</td>
                          {/* Emisja bez objęcia to akcje, których nikt nie ma —
                              wskazanie obejmującego zaczyna się przy tym wierszu,
                              z już wybraną serią. */}
                          {!wstecz && nieobjete > 0 && (
                            <td className="do-prawej bez-druku">
                              {b.nieobjete ? (
                                <PrzyciskWpisu spolkaId={spolkaId} typ="objecie" emisja={e.klucz} glowny>
                                  Kto obejmuje
                                </PrzyciskWpisu>
                              ) : null}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {!wstecz && (
                <DalszeWpisy tytul="Dalsze wpisy:">
                  <PrzyciskWpisu spolkaId={spolkaId} typ="umorzenie">Umorzenie akcji</PrzyciskWpisu>
                  <PrzyciskWpisu spolkaId={spolkaId} typ="uniewaznienie">Unieważnienie przez sąd</PrzyciskWpisu>
                  <PrzyciskWpisu spolkaId={spolkaId} typ="pokrycie_akcji">Pokrycie akcji wkładem</PrzyciskWpisu>
                  <PrzyciskWpisu spolkaId={spolkaId} typ="przeniesienie_ulamka">Zbycie ułamka akcji</PrzyciskWpisu>
                </DalszeWpisy>
              )}
            </div>
          </Sekcja>

          {/* ─── 3. REJESTR UPRAWNIEŃ, PRZYWILEJÓW I OBOWIĄZKÓW ───────── */}
          <Sekcja
            tytul="Rejestr uprawnień, przywilejów i obowiązków"
            licznik={uprawnienia.length + ograniczenia.length}
            akcje={
              !wstecz && (
                <PrzyciskWpisu spolkaId={spolkaId} typ="uprawnienie" glowny>Wpisz uprawnienie</PrzyciskWpisu>
              )
            }
          >
            <div className="sekcja-tresc">
              {uprawnienia.length === 0 ? (
                <Pusto
                  tytul="Brak zarejestrowanych uprawnień"
                  opis="Uprawnienia osobiste, przywileje i obowiązki związane z akcją — art. 300(33) § 1 pkt 9 KSH."
                />
              ) : (
                <table className="tabela">
                  <thead>
                    <tr><th>Rodzaj</th><th>Zakres</th><th>Tytuł</th><th>Treść</th><th>Od</th></tr>
                  </thead>
                  <tbody>
                    {uprawnienia.map((u2) => (
                      <tr key={u2.klucz}>
                        <td>{u2.rodzaj}</td>
                        <td>{u2.osoba ? u2.osoba.oznaczenie : u2.seria || 'cała spółka'}</td>
                        <td>{u2.tytul || '—'}</td>
                        <td className="zawijaj">{u2.tresc || '—'}</td>
                        <td className="wyciszony">{fmt.data(u2.data_ustanowienia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Ograniczenie w rozporządzaniu jest OBOWIĄZKIEM akcjonariusza
                  (zgoda spółki, prawo pierwszeństwa), więc siedzi w tym samym
                  rejestrze co przywileje — osobno tylko dlatego, że ma inne
                  kolumny. */}
              <div className="akta-grupa">
                <div className="akta-grupa-tytul">Ograniczenia w rozporządzaniu akcjami</div>
                {ograniczenia.length === 0 ? (
                  <div className="male wyciszony" style={{ padding: '0 var(--od-24) var(--od-16)' }}>
                    Brak ograniczeń — art. 300(33) § 1 pkt 10 KSH.
                  </div>
                ) : (
                  <table className="tabela">
                    <thead>
                      <tr><th>Zakres</th><th>Numery</th><th>Zgoda spółki</th><th>Prawo pierwszeństwa</th><th>Opis</th></tr>
                    </thead>
                    <tbody>
                      {ograniczenia.map((o) => (
                        <tr key={o.klucz}>
                          <td>{o.seria || o.zakres}</td>
                          <td className="kol-dane">{o.numery || '—'}</td>
                          <td>{o.wymaga_zgody_spolki ? 'wymagana' : 'nie'}</td>
                          <td>{o.prawo_pierwszenstwa ? 'tak' : 'nie'}</td>
                          <td className="zawijaj">{o.opis || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {!wstecz && (
                <DalszeWpisy tytul="Dalsze wpisy:">
                  <PrzyciskWpisu spolkaId={spolkaId} typ="ograniczenie">Ograniczenie w rozporządzaniu</PrzyciskWpisu>
                  <PrzyciskWpisu spolkaId={spolkaId} typ="zobowiazanie">
                    Zobowiązanie do przeniesienia lub obciążenia
                  </PrzyciskWpisu>
                </DalszeWpisy>
              )}
            </div>
          </Sekcja>

          {/* ─── 4. REJESTR ZAJĘĆ, ZASTAWÓW, UŻYTKOWANIA ──────────────── */}
          <Sekcja
            tytul="Rejestr zajęć, zastawów, użytkowania"
            licznik={obciazenia.length}
            akcje={
              !wstecz && (
                <PrzyciskWpisu spolkaId={spolkaId} typ="obciazenie" glowny>Zastaw lub użytkowanie</PrzyciskWpisu>
              )
            }
          >
            <div className="sekcja-tresc">
              {obciazenia.length === 0 ? (
                <Pusto
                  tytul="Brak obciążeń i zajęć"
                  opis="Zastaw, użytkowanie i zajęcie egzekucyjne wpisuje się na konkretne numery akcji."
                />
              ) : (
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Typ</th><th>Seria</th><th>Numery</th><th>Uprawniony</th>
                      <th>Prawo głosu</th><th>Blokuje rozporządzanie</th><th>Od</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obciazenia.map((o) => (
                      <tr key={o.klucz}>
                        <td>{o.typ === 'zajecie' ? 'zajęcie' : o.typ}</td>
                        <td>{o.seria}</td>
                        <td className="kol-dane">{o.numery}</td>
                        <td>{o.uprawniony ? o.uprawniony.oznaczenie : '—'}</td>
                        <td>{o.prawo_glosu ? 'tak' : 'nie'}</td>
                        <td>{o.blokuje_rozporzadzanie ? 'tak' : 'nie'}</td>
                        <td className="wyciszony">{fmt.data(o.data_od)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!wstecz && (
                <DalszeWpisy tytul="Dalsze wpisy:">
                  {/* Zajęcie idzie Z URZĘDU — bez żądania i bez opłaty
                      (art. 300(34) § 2 KSH), dlatego stoi obok, a nie
                      w jednym rzędzie z wpisami na wniosek. */}
                  <PrzyciskWpisu spolkaId={spolkaId} typ="zajecie">Zajęcie egzekucyjne (z urzędu)</PrzyciskWpisu>
                  <PrzyciskWpisu spolkaId={spolkaId} typ="prawo_glosu_zastawnika">
                    Prawo głosu zastawnika
                  </PrzyciskWpisu>
                  <PrzyciskWpisu spolkaId={spolkaId} typ="wykreslenie_obciazenia">Wykreślenie obciążenia</PrzyciskWpisu>
                  <PrzyciskWpisu spolkaId={spolkaId} typ="wykreslenie_zajecia">Uchylenie zajęcia</PrzyciskWpisu>
                </DalszeWpisy>
              )}
            </div>
          </Sekcja>

          {/* ─── 5. REJESTR ZDARZEŃ ───────────────────────────────────── */}
          {/* Wpisy, które nie mają własnej tabeli stanu: zmiana danych,
              zobowiązanie, sprostowanie, zdarzenie odnotowane „inne".
              Zdarzenia widoczne w rejestrach wyżej nie powtarzają się tutaj —
              pełny łańcuch jest w historii na końcu. */}
          <Sekcja
            tytul="Rejestr zdarzeń"
            licznik={zdarzeniaPozostale.length}
            akcje={
              !wstecz && (
                <PrzyciskWpisu spolkaId={spolkaId} typ="zdarzenie_inne" glowny>Odnotuj zdarzenie</PrzyciskWpisu>
              )
            }
          >
            <div className="sekcja-tresc">
              {zdarzeniaPozostale.length === 0 ? (
                <Pusto
                  ikona="zdarzenie"
                  tytul="Brak takich zdarzeń"
                  opis="Zmiany danych, zobowiązania i sprostowania pojawią się tutaj."
                />
              ) : (
                <table className="tabela">
                  <thead>
                    <tr><th>Data</th><th>Zdarzenie</th><th>Wpisano</th></tr>
                  </thead>
                  <tbody>
                    {zdarzeniaPozostale.map((z) => (
                      <tr key={z.id}>
                        <td className="wyciszony">{fmt.data(z.data_zdarzenia)}</td>
                        <td className="zawijaj">{z.podsumowanie || `Zdarzenie typu „${z.typ}”.`}</td>
                        <td className="wyciszony">{fmt.dataCzas(z.data_wpisu)} · {z.autor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Sekcja>

          {/* ─── 5b. ZGŁOSZENIA NIEPRAWIDŁOWOŚCI Z PORTALU (B9) ─────────── */}
          {zgloszeniaNieprawidlowosci.dane && zgloszeniaNieprawidlowosci.dane.zgloszenia.length > 0 && (
            <Sekcja
              tytul="Zgłoszenia nieprawidłowości z portalu"
              licznik={zgloszeniaNieprawidlowosci.dane.zgloszenia.length}
            >
              <div style={{ padding: '20px 24px' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Zgłoszono</th><th>Czego dotyczy</th><th>Opis</th><th></th></tr>
                  </thead>
                  <tbody>
                    {zgloszeniaNieprawidlowosci.dane.zgloszenia.map((z) => (
                      <tr key={z.id}>
                        <td className="wyciszony">{fmt.dataCzas(z.utworzono)}</td>
                        <td>{CZEGO_DOTYCZY_ZGLOSZENIA_ETYKIETY[z.czego_dotyczy] || z.czego_dotyczy}</td>
                        <td className="zawijaj">{z.opis}</td>
                        <td>
                          <button className="btn btn-maly" onClick={() => ustawKwalifikowanieZgloszenia(z)}>
                            Kwalifikuj
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Sekcja>
          )}

          {/* ─── 6. DOKUMENTY ─────────────────────────────────────────── */}
          <Sekcja tytul="Dokumenty" licznik={akta.ladowanie ? undefined : dokumentyAkt.length}>
            <ZawartoscAkt dokumenty={dokumentyAkt} ladowanie={akta.ladowanie} spolkaId={spolkaId} />
          </Sekcja>

          {/* ─── 7. HISTORIA ZDARZEŃ ──────────────────────────────────── */}
          <Sekcja
            tytul="Historia zdarzeń"
            licznik={dane.liczba_zdarzen}
            akcje={
              !wstecz && (
                <button className="btn btn-maly" onClick={przelicz} title="Odbudowa stanu ze zdarzeń">
                  Przelicz stan
                </button>
              )
            }
          >
            <div style={{ padding: '20px 24px 8px' }}>
              {zdarzenia.length === 0 ? (
                <Pusto tytul="Brak zdarzeń" opis="Rejestr jeszcze się nie zaczął." />
              ) : (
                <div className="zdarzenia-czas">
                  {zdarzenia.map((z) => (
                    <div
                      key={z.id}
                      id={`zdarzenie-${z.id}`}
                      className={`zdarzenie-poz ${z.typ === 'sprostowanie' || z.sprostowane_przez_id ? 'sprostowane' : ''}`}
                    >
                      <div className="rzad-rozdzielony">
                        <div className="zdarzenie-data">
                          {fmt.data(z.data_zdarzenia)} · zdarzenie #{z.id}
                        </div>
                        {!wstecz && z.typ !== 'sprostowanie' && !z.sprostowane_przez_id && (
                          <button className="btn btn-maly bez-druku" onClick={() => ustawSprostowanie(z)}>
                            Sprostuj
                          </button>
                        )}
                      </div>
                      <div className="zdarzenie-tresc">{z.podsumowanie || `Zdarzenie typu „${z.typ}”.`}</div>
                      {z.typ === 'sprostowanie' && z.zdarzenie_prostowane_id != null && (
                        <button
                          className="btn-tekstowy bez-druku"
                          onClick={() => skoczDoZdarzenia(z.zdarzenie_prostowane_id)}
                        >
                          → zobacz zdarzenie prostowane #{z.zdarzenie_prostowane_id}
                        </button>
                      )}
                      {z.sprostowane_przez_id != null && (
                        <button
                          className="btn-tekstowy bez-druku"
                          onClick={() => skoczDoZdarzenia(z.sprostowane_przez_id)}
                        >
                          Sprostowane zdarzeniem #{z.sprostowane_przez_id} →
                        </button>
                      )}
                      <div className="zdarzenie-meta">
                        wpisano {fmt.dataCzas(z.data_wpisu)} · {z.autor} · skrót {z.hash_skrocony}…
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Sekcja>

          <div className="podstawa-prawna" style={{ marginTop: 16 }}>
            Rejestru nie da się edytować ani skasować. Pomyłkę prostuje się zdarzeniem
            „sprostowanie”, które wskazuje zdarzenie prostowane — oba pozostają w łańcuchu.
          </div>
        </div>

        <MetrykaBoczna spolka={spolka} dane={dane} spolkaId={spolkaId} odswiez={odswiez} />
      </div>

      {dodawanieAkcjonariusza && (
        <ModalDodajAkcjonariusza
          spolkaId={spolkaId}
          nieobjete={nieobjete}
          sanAkcjonariusze={akcjonariusze.length > 0}
          przyZamknieciu={() => ustawDodawanieAkcjonariusza(false)}
        />
      )}

      {sprostowanie && (
        <ModalSprostowania
          zdarzenie={sprostowanie}
          przyZamknieciu={() => ustawSprostowanie(null)}
          przyZapisie={() => {
            ustawSprostowanie(null);
            odswiez();
          }}
        />
      )}

      {kwalifikowanieZgloszenia && (
        <ModalKwalifikacjaZgloszenia
          zgloszenie={kwalifikowanieZgloszenia}
          przyZamknieciu={() => ustawKwalifikowanieZgloszenia(null)}
          przyZapisie={() => {
            ustawKwalifikowanieZgloszenia(null);
            zgloszeniaNieprawidlowosci.odswiez();
          }}
        />
      )}
    </>
  );
}

window.EkranKokpitu = EkranKokpitu;
window.TabelaAkcjonariatu = TabelaAkcjonariatu;

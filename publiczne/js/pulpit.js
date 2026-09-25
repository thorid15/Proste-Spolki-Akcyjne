/* pulpit.js — ekran startowy.
   Sesja SESJA-PSA-6-INTERFEJS.md, faza 1; FAZA 3 sesji frontendowej v2 (K1).

   Zadanie ekranu: wiedzieć, co czeka na ruch kancelarii, i wejść w to jednym
   kliknięciem. Cztery kafle statystyk (D-051, K1) zastąpione sekcją „Do
   zrobienia" — jedna lista wierszy (nie tabela — wiersz ma być celem
   kliknięcia, nie siatką do czytania) łącząca sprawy z terminem, zgłoszenia
   nowe, wnioski złożone/podpisane i zawiadomienia do wysłania. Ta sama
   definicja „co czeka" co liczniki w nawigacji (Faza 1 pkt 9,
   `server/trasy/pozostale.js: GET /liczniki` i `GET /pulpit` — jedno
   źródło, żeby liczba przy pozycji menu i wiersz na pulpicie zawsze się
   zgadzały). W prawej szynie zostają szybkie akcje i tempo pracy (sprawy
   z terminem) — jedyne, czego nie widać już w liście „Do zrobienia" wprost. */

/** Priorytet w sekcji „Do zrobienia": sprawy z realnym terminem ustawowym
    (art. 300(34) § 1 KSH) idą przed pozycjami bez takiego terminu — te
    ostatnie sortowane od najdłużej czekającej (K1: „posortowane według
    terminu"; zgłoszenia/wnioski/zawiadomienia nie mają własnego terminu
    ustawowego w tym systemie, więc czas oczekiwania jest tu jego zastępstwem). */
const PRIORYTET_DO_ZROBIENIA = { sprawa_po_terminie: 0, sprawa_po_celu: 1, inne: 2, sprawa_w_celu: 3 };

function pozycjeDoZrobienia({ sprawy, zgloszenia, wnioski, zawiadomienia }) {
  const pozycje = [];
  for (const s of sprawy) {
    const priorytet = s.termin && s.termin.po_terminie
      ? PRIORYTET_DO_ZROBIENIA.sprawa_po_terminie
      : s.termin && s.termin.po_celu
      ? PRIORYTET_DO_ZROBIENIA.sprawa_po_celu
      : PRIORYTET_DO_ZROBIENIA.sprawa_w_celu;
    pozycje.push({
      klucz: `sprawa-${s.id}`,
      priorytet,
      data: s.data_wplywu,
      ikona: IKONY_ZDARZEN[s.typ_zdarzenia] || 'sprawy',
      tytul: s.typ_nazwa,
      podtytul: s.spolka_nazwa,
      przyKlik: () => idz(`/sprawy/${s.id}`),
      prawo: (
        <>
          <Pigulka>{NAZWY_STANU_PULPIT[s.stan] || s.stan}</Pigulka>
          <TerminPigulka termin={s.termin} />
        </>
      ),
    });
  }
  for (const z of zgloszenia) {
    pozycje.push({
      klucz: `zgloszenie-${z.id}`,
      priorytet: PRIORYTET_DO_ZROBIENIA.inne,
      data: z.utworzono,
      ikona: 'sprawy',
      tytul: 'Nowe zgłoszenie',
      podtytul: z.nazwa_spolki || z.email,
      przyKlik: () => idz('/zgloszenia'),
      prawo: <Pigulka odmiana="mosiadz">do oceny</Pigulka>,
    });
  }
  for (const w of wnioski) {
    pozycje.push({
      klucz: `wniosek-${w.id}`,
      priorytet: PRIORYTET_DO_ZROBIENIA.inne,
      data: w.zaktualizowano || w.utworzono,
      ikona: 'sprawy',
      tytul: w.nazwa || w.konto_email,
      podtytul: w.status === 'zlozony' ? 'wniosek złożony — wystaw dokumenty' : 'umowa podpisana — zweryfikuj i przyjmij',
      przyKlik: () => idz(`/wnioski/${w.id}`),
      prawo: <Pigulka odmiana="mosiadz">wniosek</Pigulka>,
    });
  }
  for (const z of zawiadomienia) {
    pozycje.push({
      klucz: `zawiadomienie-${z.spolka_id}`,
      priorytet: PRIORYTET_DO_ZROBIENIA.inne,
      data: z.najstarsze,
      ikona: 'szablony',
      tytul: `${z.ile} ${fmt.odmien(z.ile, 'wpis czeka', 'wpisy czekają', 'wpisów czeka')} na zawiadomienie`,
      podtytul: z.spolka_nazwa,
      przyKlik: () => idz('/zawiadomienia'),
      prawo: <Pigulka odmiana="mosiadz">zawiadomienie</Pigulka>,
    });
  }
  return pozycje.sort((a, b) => (a.priorytet - b.priorytet) || (new Date(a.data) - new Date(b.data)));
}

const NAZWY_STANU_PULPIT = {
  nowa: 'nowa',
  weryfikacja: 'w weryfikacji',
  wstrzymana: 'wstrzymana',
  spor: 'spór',
};

/**
 * Pigułka terminu. Mosiądz = czas, czerwień WYŁĄCZNIE po terminie ustawowym.
 *
 * Dwa zegary: cel wewnętrzny kancelarii i termin z art. 300(34) § 1 KSH.
 * Wyróżnienie zaczyna się po przekroczeniu CELU, a nie dopiero pod koniec
 * terminu ustawowego — „niezwłocznie" znaczy krócej niż siedem dni. Liczba
 * na pigułce to zawsze dni do terminu ustawowego: to ona wiąże prawnie.
 * Przekroczenie samego celu nie jest naruszeniem ustawy, więc nigdy nie
 * dostaje czerwieni.
 */
function TerminPigulka({ termin }) {
  if (!termin) return null;
  if (termin.zamrozony) return <Pigulka odmiana="mosiadz">termin zawieszony</Pigulka>;
  if (termin.po_terminie) return <Pigulka odmiana="sygnal">po terminie</Pigulka>;
  if (termin.po_celu) return <Pigulka odmiana="mosiadz">po celu · {termin.dni_pozostale} dz.</Pigulka>;
  return <Pigulka>{termin.dni_pozostale} dz.</Pigulka>;
}

const IKONY_ZDARZEN = {
  emisja: 'akcje',
  objecie: 'akcje',
  przeniesienie: 'zdarzenie',
  przeniesienie_ulamka: 'zdarzenie',
  umorzenie: 'archiwum',
  uniewaznienie: 'ostrzezenie',
  zobowiazanie: 'dokument',
  obciazenie: 'ostrzezenie',
  zajecie: 'ostrzezenie',
  wykreslenie_obciazenia: 'sprawdz',
  wykreslenie_zajecia: 'sprawdz',
  prawo_glosu_zastawnika: 'sprawdz',
  uprawnienie: 'dokument',
  ograniczenie: 'dokument',
  pokrycie_akcji: 'sprawdz',
  przedstawiciel: 'osoby',
  zmiana_danych_akcjonariusza: 'osoby',
  zmiana_danych_spolki: 'spolki',
  zdarzenie_inne: 'wiecej',
  sprostowanie: 'popraw',
};

function EkranPulpitu() {
  const { dane, ladowanie, blad } = useDane('/api/psa/pulpit');

  if (ladowanie) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tytul="Nie udało się wczytać pulpitu" tresc={blad.message} />;

  const { spolki, integralnosc, sprawy, zgloszenia, wnioski, zawiadomienia } = dane;
  const wToku = sprawy.pozycje || [];
  const poTerminie = wToku.filter((s) => s.termin && s.termin.po_terminie).length;
  // Wczesny sygnal to przekroczenie CELU wewnetrznego, nie zblizanie sie do
  // siodmego dnia - po to cel istnieje, zeby ostrzegal wczesniej niz ustawa.
  const poCelu = wToku.filter((s) => s.termin && s.termin.po_celu && !s.termin.po_terminie).length;
  const doZrobienia = pozycjeDoZrobienia({ sprawy: wToku, zgloszenia, wnioski, zawiadomienia });

  return (
    <>
      {!integralnosc.ok && (
        <Komunikat
          odmiana="blad"
          tytul="Naruszona integralność rejestru zdarzeń"
          tresc={
            integralnosc.blad
              ? integralnosc.blad.opis
              : 'Weryfikacja łańcucha skrótów wykryła niezgodność.'
          }
        />
      )}

      <div className="siatka-tresc">
        <div style={{ minWidth: 0 }}>
          <Karta
            scisla
            tytul="Do zrobienia"
            akcje={
              doZrobienia.length > 0 && (
                <span className="male drugorzedny">
                  {doZrobienia.length} {fmt.odmien(doZrobienia.length, 'pozycja', 'pozycje', 'pozycji')}
                </span>
              )
            }
          >
            {doZrobienia.length === 0 ? (
              <Pusto
                ikona="sprawdz"
                tytul="Wszystko załatwione"
                opis="Nic nie czeka na ruch kancelarii. Nową sprawę zakładasz z kokpitu spółki."
                akcja={<button className="btn" onClick={() => idz('/spolki')}>Przejdź do spółek</button>}
              />
            ) : (
              <div className="lista-wierszy">
                {doZrobienia.map((p) => (
                  <WierszListy
                    key={p.klucz}
                    ikona={p.ikona}
                    tytul={p.tytul}
                    podtytul={p.podtytul}
                    przyKlik={p.przyKlik}
                    prawo={p.prawo}
                    data={fmt.data(p.data)}
                  />
                ))}
              </div>
            )}
          </Karta>

          <Karta
            scisla
            tytul="Spółki"
            akcje={<button className="karta-link" onClick={() => idz('/spolki')}>Wszystkie</button>}
          >
            {spolki.length === 0 ? (
              <Pusto
                ikona="spolki"
                tytul="Nie prowadzisz jeszcze żadnego rejestru"
                opis="Dodaj spółkę, żeby otworzyć dla niej rejestr akcjonariuszy."
                akcja={
                  <button className="btn btn-glowny" onClick={() => idz('/spolki/nowa')}>
                    <Ikona nazwa="plus" rozmiar={16} /> Dodaj spółkę
                  </button>
                }
              />
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Spółka</th>
                    <th className="do-prawej">Akcjonariusze</th>
                    <th className="do-prawej">Akcje</th>
                    <th>Ostatnie zdarzenie</th>
                    <th className="kol-strzalka" />
                  </tr>
                </thead>
                <tbody>
                  {spolki.slice(0, 6).map((s) => (
                    <tr key={s.id} className="klikalna" onClick={() => idz(`/spolki/${s.id}`)}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.nazwa}</div>
                        <div className="wiersz-podtytul">
                          {s.krs ? `KRS ${s.krs}` : 'bez numeru KRS'}
                        </div>
                      </td>
                      <td className="do-prawej">{fmt.liczba(s.liczba_akcjonariuszy)}</td>
                      <td className="do-prawej">
                        {fmt.liczba(s.liczba_akcji)}
                        {s.akcje_nieobjete > 0 && (
                          <div className="podstawa-prawna" style={{ color: 'var(--mosiadz)' }}>
                            {fmt.liczba(s.akcje_nieobjete)} nieobjętych
                          </div>
                        )}
                      </td>
                      <td className="kol-dane wyciszony">{fmt.data(s.ostatnie_zdarzenie)}</td>
                      <td className="kol-strzalka"><Ikona nazwa="strzalkaPrawo" rozmiar={15} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Karta>
        </div>

        <aside className="siatka-tresc-prawa bez-druku">
          <Karta tytul="Szybkie akcje">
            <SzybkieAkcje
              akcje={[
                /* Tylko to, czego NIE MA w szynie obok. „Przejdź do kolejki
                   spraw" i „Nalicz opłaty" prowadziły dokładnie tam, gdzie
                   pozycje nawigacji dwa centymetry w lewo. */
                { nazwa: 'Dodaj spółkę', ikona: 'spolki', przyKlik: () => idz('/spolki/nowa') },
                { nazwa: 'Dodaj osobę do kartoteki', ikona: 'osoby', przyKlik: () => idz('/osoby') },
              ]}
            />
          </Karta>

          {wToku.length > 0 && (
            <Karta tytul="Terminy">
              <div className="pion" style={{ gap: 'var(--od-12)' }}>
                <div className="rzad-rozdzielony">
                  <span className="male drugorzedny">Po terminie</span>
                  <strong className="liczba" style={{ color: poTerminie ? 'var(--sygnal)' : 'inherit' }}>
                    {poTerminie}
                  </strong>
                </div>
                <div className="rzad-rozdzielony">
                  <span className="male drugorzedny">Po celu wewnętrznym</span>
                  <strong className="liczba" style={{ color: poCelu ? 'var(--mosiadz)' : 'inherit' }}>
                    {poCelu}
                  </strong>
                </div>
                <div className="rzad-rozdzielony">
                  <span className="male drugorzedny">W celu</span>
                  <strong className="liczba">{wToku.length - poTerminie - poCelu}</strong>
                </div>
              </div>
              <div className="rozdzielacz" />
              <div className="podstawa-prawna">
                Cel wewnętrzny to 3 dni. Siedem dni to termin maksymalny — ustawa nakazuje
                działać niezwłocznie (art. 300³⁴ § 1 KSH).
              </div>
            </Karta>
          )}
        </aside>
      </div>
    </>
  );
}

window.EkranPulpitu = EkranPulpitu;

/* pulpit.js — ekran startowy.
   Sesja SESJA-PSA-6-INTERFEJS.md, faza 1.

   Zadanie ekranu (brief, sekcja 1): wiedzieć, co ma termin, i wejść w to
   jednym kliknięciem. Stąd układ: cztery liczby na górze, po nich sprawy
   w toku jako lista wierszy (a nie tabela — wiersz ma być celem kliknięcia,
   nie siatką do czytania), a w prawej szynie szybkie akcje i tempo pracy. */

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

  const { spolki, liczniki, integralnosc, sprawy } = dane;
  const wToku = sprawy.pozycje || [];
  const poTerminie = wToku.filter((s) => s.termin && s.termin.po_terminie).length;
  // Wczesny sygnal to przekroczenie CELU wewnetrznego, nie zblizanie sie do
  // siodmego dnia - po to cel istnieje, zeby ostrzegal wczesniej niz ustawa.
  const poCelu = wToku.filter((s) => s.termin && s.termin.po_celu && !s.termin.po_terminie).length;
  const nieobjete = spolki.reduce((suma, s) => suma + (s.akcje_nieobjete || 0), 0);

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

      <div className="kafle">
        <Kafel
          etykieta="Prowadzone rejestry"
          wartosc={fmt.liczba(liczniki.spolki)}
          delta={nieobjete > 0 ? `${fmt.AKCJE(nieobjete)} bez objęcia` : 'bilans akcji zgodny'}
          deltaOdmiana={nieobjete > 0 ? 'uwaga' : 'dodatnia'}
          ikona="spolki"
          przyKlik={() => idz('/spolki')}
        />
        <Kafel
          etykieta="Sprawy w toku"
          wartosc={fmt.liczba(wToku.length)}
          delta={
            poTerminie > 0
              ? `${poTerminie} po terminie`
              : poCelu > 0
              ? `${poCelu} po celu`
              : 'wszystkie w celu'
          }
          deltaOdmiana={poTerminie > 0 ? '' : poCelu > 0 ? 'uwaga' : 'dodatnia'}
          ikona="sprawy"
          przyKlik={() => idz('/sprawy')}
        />
        <Kafel
          etykieta="Akcjonariusze"
          wartosc={fmt.liczba(liczniki.akcjonariusze)}
          delta={`${fmt.liczba(liczniki.osoby)} ${fmt.odmien(liczniki.osoby, 'osoba', 'osoby', 'osób')} w kartotece`}
          ikona="osoby"
          przyKlik={() => idz('/osoby')}
        />
        <Kafel
          etykieta="Zdarzenia rejestrowe"
          wartosc={fmt.liczba(liczniki.zdarzenia)}
          delta={
            integralnosc.ok
              ? `łańcuch nieprzerwany (${fmt.liczba(integralnosc.sprawdzono)})`
              : 'łańcuch zerwany'
          }
          deltaOdmiana={integralnosc.ok ? 'dodatnia' : ''}
          ikona="zdarzenie"
        />
      </div>

      <div className="siatka-tresc">
        <div style={{ minWidth: 0 }}>
          <Karta
            scisla
            tytul="Sprawy w toku"
            akcje={<button className="karta-link" onClick={() => idz('/sprawy')}>Cała kolejka</button>}
          >
            {wToku.length === 0 ? (
              <Pusto
                ikona="sprawdz"
                tytul="Kolejka jest pusta"
                opis="Żadna sprawa nie czeka na wpis. Nowe zakładasz z kokpitu spółki."
                akcja={<button className="btn" onClick={() => idz('/spolki')}>Przejdź do spółek</button>}
              />
            ) : (
              <div className="lista-wierszy">
                {wToku.slice(0, 6).map((s) => (
                  <WierszListy
                    key={s.id}
                    ikona={IKONY_ZDARZEN[s.typ_zdarzenia] || 'sprawy'}
                    tytul={s.typ_nazwa}
                    podtytul={s.spolka_nazwa}
                    przyKlik={() => idz(`/sprawy/${s.id}`)}
                    prawo={
                      <>
                        <Pigulka>{NAZWY_STANU_PULPIT[s.stan] || s.stan}</Pigulka>
                        <TerminPigulka termin={s.termin} />
                      </>
                    }
                    data={fmt.data(s.data_wplywu)}
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
                { nazwa: 'Dodaj spółkę', ikona: 'spolki', przyKlik: () => idz('/spolki/nowa') },
                { nazwa: 'Dodaj osobę do kartoteki', ikona: 'osoby', przyKlik: () => idz('/osoby') },
                { nazwa: 'Przejdź do kolejki spraw', ikona: 'sprawy', przyKlik: () => idz('/sprawy') },
                { nazwa: 'Nalicz opłaty', ikona: 'oplaty', przyKlik: () => idz('/oplaty') },
              ]}
            />
          </Karta>

          <div className="karta-akcent">
            <div className="karta-akcent-tytul">Rejestru nie da się cofnąć</div>
            <div className="karta-akcent-tresc">
              Każde zdarzenie niesie skrót poprzedniego. Zmiana wpisu wstecz jest
              niemożliwa bez przepisania całej historii — to realizacja obowiązku
              zapewnienia integralności z art. 300³¹ § 4 KSH.
            </div>
            <button className="btn btn-maly" onClick={() => idz('/spolki')}>
              Zobacz rejestry
            </button>
          </div>

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

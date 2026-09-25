# Test ręczny nowej strony publicznej — dla Łukasza

Przed publikacją proszę przejrzeć `strona/dist/` (albo uruchomić `npm run buduj-strone` i otworzyć
pliki lokalnie) na trzech przeglądarkach: **telefon — Safari i Chrome**, **komputer — Edge**.

## Treść — najważniejsze

- [ ] Wszystkie zdania oznaczone ⚠️ **DO WERYFIKACJI** (lista w
      `frontend-audyt/raporty/faza-strona-stop-b.md`, § 5) — potwierdzone albo poprawione.
- [ ] Kwoty w sekcji „Opłaty” (strona główna i `/oplaty`) — zgodne z tym, co ma być publikowane
      (dziś: stawki maksymalne z `przepisy.js`, 1200/100/50 zł netto).
- [ ] Zdanie „bez wizyty w kancelarii” (hero strony głównej, pytanie „Czy muszę przyjść do
      kancelarii?”) — czy to nadal ma być takie kategoryczne, czy ma zostać złagodzone.
- [ ] Dane kancelarii w stopce i na `/kontakt` — nazwa, adres, telefon, e-mail, „Notariusz Łukasz
      Kozon” — zgodne z rzeczywistością.

## Na telefonie (Safari i Chrome osobno)

- [ ] Otwórz stronę główną — brak przewijania w poziomie.
- [ ] Kliknij ikonę menu (☰) w prawym górnym rogu — panel z odnośnikami się rozwija, każdy
      odnośnik działa, X zamyka panel.
- [ ] Przewiń stronę w dół, za sekcję hero — u dołu ekranu pojawia się przyklejony przycisk „Złóż
      wniosek”, nie zasłania treści ani nie znika za paskiem systemowym telefonu.
- [ ] Kliknij mały szary znacznik przy przepisie (np. „art. 300³⁴ § 1”) — otwiera się dymek z
      treścią przepisu; da się go zamknąć (dotknięcie poza dymkiem albo drugi raz na znacznik).
- [ ] `/oplaty` — tabela czytelna, jeśli za szeroka to przewija się w poziomie TYLKO tabela, nie
      cała strona; kalkulator pod tabelą liczy sensownie po wpisaniu liczby wpisów/informacji.
- [ ] `/pytania` — każde pytanie rozwija się po dotknięciu, drugie dotknięcie zwija.

## Na komputerze (Edge)

- [ ] Strona główna na pełnym ekranie — pasek górny, menu poziome (Jak zacząć / Opłaty / Pytania
      / Kontakt), przyciski „Zaloguj się” / „Złóż wniosek” widoczne bez przewijania.
- [ ] „Żywy wpis” w prawej kolumnie hero — przy odświeżeniu strony wiersze podświetlają się
      kolejno (chyba że w systemie włączone „ogranicz ruch” — wtedy bez animacji, to celowe).
- [ ] Kliknięcie „Złóż wniosek” (dowolne miejsce) i „Zaloguj się” — prowadzi do portalu klienta.
- [ ] Wszystkie odnośniki w pasku górnym i stopce prowadzą pod właściwe adresy (bez 404).
- [ ] Powiększ/pomniejsz stronę (Ctrl +/-) do ok. 150% — układ się nie rozjeżdża, tekst nie
      nachodzi na siebie.

## Jeśli coś nie działa

Proszę o zrzut ekranu i krótki opis (co kliknięto, co się stało, co powinno się stać) — reszta
sesji poprawi to przed publikacją produkcyjną.

# Baza sądów rejestrowych (`sady-rejestrowe.json`)

Fallback dla oznaczenia sądu rejestrowego, gdy API KRS go nie zwraca —
sekcja 1.7 poprawek. Potwierdzone empirycznie (żywa odpowiedź API, KRS
0001114217, rejestr=P, 17.08.2026): odpis dla rejestru przedsiębiorców
**nie zawiera** żadnego pola z oznaczeniem sądu rejestrowego. Fallback jest
więc potrzebny zawsze, nie tylko w rzadkich przypadkach.

## Stan: uzupełniona, 2154 z ok. 2477 gmin w Polsce

Zbudowana z dwóch wykazów Ministerstwa Sprawiedliwości (stan na luty
2025 r.), dostarczonych przez Łukasza:

1. **„Właściwość sądów powszechnych"** — dla każdego z 319 sądów
   rejonowych: pełna lista gmin/miast w jego obszarze właściwości.
2. **„Lista Wydziałów Gospodarczych Krajowego Rejestru Sądowego"** — który
   sąd rejonowy (i który numer wydziału) prowadzi sprawy KRS dla obszaru
   którego sądu okręgowego (albo których konkretnie sądów rejonowych, gdy
   duży okręg jest podzielony między kilka wydziałów, np. Warszawa i
   Kraków).

Dopasowanie działa na poziomie **gminy** (dokładnie granulacja źródła), nie
powiatu — KRS zwraca `gmina` wprost w `dzial1.siedzibaIAdres.siedziba`, więc
nie trzeba było iść przez pośrednią warstwę powiatu ani osobną listę
wyjątków dla podzielonych powiatów, jak pierwotnie zakładano.

## Trzy świadome ograniczenia (opisane też w samym pliku danych)

1. **~70 nazw gmin powtarza się** w różnych regionach Polski (np. „Dobra"
   jest gminą i pod Limanową, i pod Turkiem, i pod Łobzem — trzy różne
   wydziały). Bez wiarygodnego źródła TERYT (gmina → województwo) nie da
   się ich rozstrzygnąć bez zgadywania, więc są **celowo pominięte** w
   tabeli — pełna lista w `gminy-niejednoznaczne.json` w tym katalogu, do
   uzupełnienia, jeśli pojawi się rzetelne źródło.
2. **Warszawa i Kraków nie występują w tabeli wcale.** Obie mają wewnętrzny
   podział właściwości KRS na poziomie **dzielnicy** (nie gminy) —
   np. Warszawa-Śródmieście i Warszawa-Mokotów trafiają do różnych
   wydziałów. API KRS nie zwraca dzielnicy, więc nie da się tego
   rozstrzygnąć bez zgadywania. Gminy **przyległe** do tych miast (np.
   Wieliczka, Piaseczno, Łomianki) są rozstrzygane normalnie i są w
   tabeli.
3. **Będzin i Czeladź nie mają wpisu.** Formalnie należą do obszaru Sądu
   Okręgowego w Rybniku, ale żaden z 27 wydziałów gospodarczych KRS z
   wykazu MS ich literalnie nie wymienia — luka w źródle, nie błąd
   kodowania (zweryfikowana: nazwa nie pojawia się w żadnym z 27 opisów
   wydziałów). Do sprawdzenia bezpośrednio w Ministerstwie, jeśli to
   istotne w praktyce.

We wszystkich trzech przypadkach `ustalSadRejestrowy()` zwraca `null` —
pole w formularzu zostaje puste i edytowalne, dokładnie jak dla gminy
nieobecnej w ogóle. To bezpieczne zachowanie, nie błąd.

## Format

```json
{
  "wydzialy": [
    { "id": "czestochowa-xvii", "sad": "Sąd Rejonowy w Częstochowie",
      "numer_wydzialu": "XVII",
      "nazwa_pelna": "XVII Wydział Gospodarczy Krajowego Rejestru Sądowego" }
  ],
  "gminy": [
    { "gmina": "CZĘSTOCHOWA", "wydzial_id": "czestochowa-xvii" }
  ]
}
```

`ustalSadRejestrowy({ gmina })` (`server/logika/sad-rejestrowy.js`) czyta
`gmina` dokładnie tak, jak przychodzi z `dzial1.siedzibaIAdres.siedziba.gmina`
w odpowiedzi API KRS (WIELKIMI LITERAMI) — dopasowanie jest wielkości liter
niewrażliwe. Wynik jest **zawsze propozycją**, nigdy wartością wiążącą —
pole w formularzu spółki zostaje edytowalne niezależnie od wyniku
(sekcja 1.7, punkt 3 poprawek).

## Aktualizacja

Właściwości sądów się zmieniają (rozporządzenie MS z 28.12.2018 było
nowelizowane wielokrotnie, ostatnio 23.07.2025 wg promptu poprawek — ten
plik danych bazuje na stanie z **lutego 2025**, sprawdź czy nowelizacja z
lipca 2025 coś zmieniła, zanim uznasz dane za w pełni aktualne). Przy
aktualizacji: podmień oba pliki źródłowe (wykaz MS), przelicz od nowa wg
metody opisanej wyżej, zaktualizuj `wersja_danych`/`obowiazuje_od` w
`sady-rejestrowe.json`.

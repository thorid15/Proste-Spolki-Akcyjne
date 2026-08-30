# Plan poprawek portalu klienta i rejestru

Uporządkowana lista uwag z przeglądu, podzielona na sześć etapów. Każdy etap
jest zamkniętą całością — da się go wdrożyć i sprawdzić osobno.

---

## Etap 1 — drobne poprawki interfejsu i formularzy

1. **Pasek marki** — nazwa kancelarii wyśrodkowana, bez podtytułu „Rejestr
   akcjonariuszy prostych spółek akcyjnych” (ta informacja jest już w szynie
   po lewej i w stopce).
2. **Zgłoszenie wstępne** — numer KRS staje się polem **obowiązkowym**.
   Rejestr akcjonariuszy prowadzi się dla spółki już wpisanej do rejestru
   przedsiębiorców, więc brak KRS odsiewa zgłoszenia przedwczesne.
3. **Liczniki w szynie nawigacji** — przy „Zgłoszenia”, „Wnioski” i „Kolejka
   spraw” mała liczba pozycji wymagających uwagi. „Spółki” i „Kartoteka osób”
   liczników nie dostają — to katalogi, nie kolejki.
4. **Usunięte pola formularza spółki** (klient i kancelaria):
   - „Siedziba w miejscowniku” — patrz etap 4, rezygnujemy z odmiany;
   - „Data ostatniego wpisu do KRS” — nie wynika z żadnego przepisu, nie
     wchodzi do rejestru, nie trafia do żadnego pisma;
   - przycisk „Popraw automatyczną odmianę” wraz z trzema polami korekty;
   - dopiski „w mianowniku” przy danych reprezentanta.
5. **Nowe pole** — adres e-mail osoby reprezentującej spółkę.

## Etap 2 — zapis wniosku na bieżąco

Formularz wniosku zapisuje dane **automatycznie**, bez przycisku „Zapisz”.
Przycisk znika; zostaje „Usuń” przy pozycji akcjonariusza. To usuwa też błąd,
przez który nie dało się złożyć wniosku: przycisk „Złóż wniosek” patrzył na
stan formularza w przeglądarce, a serwer na to, co faktycznie zapisano —
jeśli klient nie kliknął „Zapisz”, składanie odbijało się o brak nazwy spółki.

## Etap 3 — dane akcjonariusza zgodne z art. 300³³ § 1 KSH

Przepis wymaga w rejestrze: nazwiska i imienia, **numeru PESEL albo daty
urodzenia**; dla podmiotu niebędącego osobą fizyczną — firmy (nazwy) oraz
numeru w rejestrze i nazwy rejestru; adresu zamieszkania albo siedziby **albo**
innego adresu do doręczeń **albo** adresu do doręczeń elektronicznych; adresu
poczty elektronicznej, jeżeli akcjonariusz wyraził zgodę na komunikację
elektroniczną; a przy współwłasności akcji — danych pozostałych współwłaścicieli,
rodzaju współwłasności i wielkości udziału przy współwłasności ułamkowej.

Zmiany:

1. **Brak PESEL-u** (cudzoziemiec) — jawny przełącznik. Bez PESEL-u data
   urodzenia staje się polem obowiązkowym, bo ustawa dopuszcza alternatywę,
   ale nie brak obu.
2. **Adres** — jeden świadomy wybór rodzaju adresu wpisywanego do rejestru:
   zamieszkania/siedziby, inny adres do doręczeń albo adres do doręczeń
   elektronicznych. Adres do doręczeń opisany jako „jeśli akcjonariusz posiada”.
3. **Zgoda na komunikację elektroniczną dotyczy adresu E-MAIL**, nie adresu
   do e-Doręczeń — dziś jest to pomylone. Zgoda w trzech stanach: brak,
   zadeklarowana przez spółkę, potwierdzona podpisanym oświadczeniem
   akcjonariusza (etap 6).
4. **Współwłasność akcji** — rodzaj (łączna albo w częściach ułamkowych),
   pozostali współwłaściciele, a przy ułamkowej wielkość udziału.

## Etap 4 — koniec z odmianą gramatyczną

Dziś aplikacja odmienia imiona, nazwiska i funkcje przez przypadki
(`deklinacja.js`, `formy-osobowe.js`), co przy nietypowych nazwiskach daje
wyniki wymagające ręcznej korekty. Rezygnujemy z tego w całości: wszystkie
dane wpisuje się i drukuje w mianowniku, a zdania w pismach buduje się tak,
żeby odmiana nie była potrzebna.

Zamiast „reprezentowaną przez Jana Kowalskiego, syna Jana i Natalii,
legitymującego się dowodem osobistym …, zamieszkałego: …, działającego jako
Prezesa Zarządu”:

> reprezentowaną przez: Jan Kowalski, imiona rodziców: Jan i Natalia,
> dowód osobisty: …, PESEL: …, adres zamieszkania: …, działający jako:
> Prezes Zarządu

Obejmuje to pola w formularzach, klucze kontekstu pism, wszystkie wzory
`.docx` i ich generatory. Przy okazji: puste miejsce w miejscu miejscowości
kancelarii („zawarta w —”) bierze się z niewypełnionych zmiennych
`KANCELARIA_*` w `.env` — do uzupełnienia we wdrożeniu.

## Etap 5 — wygląd portalu klienta

Ekran logowania klienta i krok „Weryfikacja” wniosku dostają spójny układ
zgodny z systemem wizualnym reszty aplikacji: jeden zestaw krojów, treść
w kolumnie zamiast w rogach ekranu, czytelne odstępy i wielkości pisma.
Wszystkie widoki klienta mają wyglądać jak jedna aplikacja.

## Etap 6 — pakiet dokumentów po złożeniu wniosku

Po złożeniu wniosku, obok projektu umowy, powstaje komplet dokumentów:

| Dokument | Ile sztuk |
|---|---|
| Umowa o prowadzenie rejestru akcjonariuszy | 1 |
| Zgoda na komunikację elektroniczną | po jednym na akcjonariusza |
| Oświadczenie o zapoznaniu się z informacją RODO | po jednym na akcjonariusza |
| Oświadczenie GIIF — beneficjent rzeczywisty i status PEP | po jednym na akcjonariusza |
| Żądanie dokonania pierwszego wpisu wraz ze zgodą na wpis | 1, podpisywane przez wszystkich |

Wymagania techniczne:

* format **PDF** — dokument do podpisu nie ma być łatwy do podmiany,
* autor w metadanych pliku: **Kancelaria Notarialna Łukasz Kozon**
  (dziś widnieje `python-docx`),
* nazwa pliku opisowa, z numerem KRS spółki — np.
  `Umowa o prowadzenie rejestru — KRS 0001114217.pdf`.

---

## Odpowiedzi na dwa pytania z przeglądu

**Czy każdy akcjonariusz musi założyć konto w portalu?**
Nie. Żaden przepis tego nie wymaga. Rejestr prowadzi notariusz, a wpisu żąda
spółka albo osoba mająca interes prawny — konto w portalu jest wygodą
(podgląd własnych akcji, zgłaszanie zmian), nie warunkiem. Konto akcjonariusza
warto zakładać na życzenie, zwłaszcza przy większym akcjonariacie.

**Jak akcjonariusz wyraża zgodę na komunikację elektroniczną, skoro wniosek
wypełnia prezes zarządu?**
Zgoda jest oświadczeniem samego akcjonariusza — zarząd nie może jej złożyć za
niego. Dlatego wniosek zbiera adres e-mail i zgodę jako **zadeklarowaną przez
spółkę**, a rejestr wpisuje adres dopiero po otrzymaniu **podpisanego
oświadczenia akcjonariusza** (dokument z etapu 6). Do tego czasu adres e-mail
figuruje w aktach sprawy, ale nie jako element treści rejestru.

---

## Do ustalenia (zapisane, nie wykonane)

* **Klauzula RODO pokazywana po pierwszym logowaniu klienta** — treść wymaga
  dopracowania merytorycznego (zakres danych, okresy przechowywania, podstawy
  przetwarzania przy poszczególnych kategoriach danych). Dziś jest wersja
  robocza; do przejścia z notariuszem przed wdrożeniem.
* **Konto klienta po przyjęciu wniosku** nie przepina się z roli
  „wnioskodawca" na „spółka", więc klient nie widzi jeszcze podglądu rejestru.
  Do decyzji, czy ma się to dziać automatycznie przy przyjęciu wniosku, czy
  dopiero po otwarciu rejestru.

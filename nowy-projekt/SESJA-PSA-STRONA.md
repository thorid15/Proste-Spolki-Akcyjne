# SESJA-PSA-STRONA — wdrożenie zatwierdzonego projektu strony publicznej

> **Wersja 4 — 26.09.2026.** Zastępuje wcześniejsze wersje.
>
> Sesja Claude Code dla modułu **Rejestr akcjonariuszy P.S.A.** Zadanie: **wdrożyć 1:1 zatwierdzony
> przez Łukasza projekt strony** — plik `projekt-strony/nowa-strona.html`. Nie projektujesz strony.
> Wygląd, teksty, kolejność sekcji i animacje są ustalone w pliku.
>
> **Warunek wstępny:** w repozytorium są `projekt-strony/nowa-strona.html` i
> `projekt-strony/notariat.png`. Jeśli ich nie ma — zatrzymaj się i zapytaj.

---

## 1. Zasada nadrzędna

Plik projektu jest źródłem prawdy. Zmieniasz tylko to, czego wymaga technika wdrożenia: ścieżki,
podział na pliki, generowanie kwot, znaczniki w `<head>`. Każda inna różnica względem projektu to błąd.
Jeśli coś jest technicznie niewykonalne albo narusza zasadę bezpieczeństwa (np. CSP) — opisz to przy
STOP zamiast poprawiać po swojemu.

## 2. Zadania

1. **Strona główna publiczna = projekt.** Zastępuje obecną stronę z Fazy 5. Usuń podstrony `jak-zaczac`,
   `oplaty`, `pytania`, `sprzedaz-akcji`, `przeniesienie-rejestru`, `czym-jest-rejestr-akcjonariuszy`,
   `zbycie-akcji-i-wpisy`, `zmiana-podmiotu-prowadzacego-rejestr`, `nowelizacja-2027`. Jeśli któryś
   adres był opublikowany — przekierowanie 301 do kotwicy (`#oplaty`, `#portal`, `#informacja`,
   `#pytania`). Zostają `regulamin` i `polityka-prywatnosci` — dostają nagłówek, stopkę i typografię
   z projektu.
2. **Pliki.** Style do `strona.css`, skrypt do `strona.js` (`defer`). Jednolinijkowy skrypt z `<head>`
   (klasa `anim`) zostaje inline albo trafia do osobnego pliku w `<head>` bez `defer` — zależnie od
   CSP. Nie dodawaj `unsafe-inline`.
3. **Fonty:** te same pliki co portal, pod `/fonty/`; dla każdego kroju podzbiory latin i latin-ext
   z `unicode-range` jak w projekcie. `preload` tylko dla dwóch plików latin.
4. **Obraz:** `/obrazy/notariat.png`, z atrybutami `width` i `height`.
5. **Linki:** „Złóż wniosek” → rzeczywista trasa publicznego formularza zgłoszenia w portalu;
   „Zaloguj się” → logowanie portalu; regulamin i polityka → istniejące strony. Sprawdź każdy.
6. **Kwoty z jednego źródła:** `server/logika/przepisy.js` (`STAWKI_GROSZE`, `STAWKA_VAT_PROCENT`,
   `obliczBrutto`) — wstawiane przy budowaniu w cennik (netto i brutto), odpowiedź „Ile kosztuje
   prowadzenie rejestru?”, opis sekcji „Informacja z rejestru” i JSON-LD (`offers`). Żadnej kwoty nie
   wpisujesz ręcznie. Test: zmiana stawki w `przepisy.js` zmienia każde z tych miejsc po zbudowaniu.
7. **Stawki potwierdzone** przez Łukasza 26.09.2026 (1 200 / 100 / 50 zł netto). Ustaw
   `STAWKI_DO_WERYFIKACJI = false` i dodaj wpis D-xxx. Gwarancja ceny (3 lata od podpisania umowy,
   wszystkie opłaty) jest decyzją Łukasza z tego samego dnia — wpis D-xxx.
8. **Dane kancelarii** (nazwa, adres, e-mail `biuro@notariusz.gdansk.pl`) z `/api/wspolne/kancelaria`
   przy budowaniu — w stopce, w sekcji pytań i w JSON-LD. Telefonu na stronie nie ma.
9. **`<head>`:** `{{BASE_URL}}` w `canonical`, Open Graph i JSON-LD zastępuje budowanie adresem strony
   (D-049). Obraz Open Graph `obrazy/og-rejestr.png` (1200×630) przygotuj z sekcji hero. Dodaj
   `sitemap.xml` i `robots.txt`; portal i aplikacja kancelarii `noindex`.
10. **Zaślepki** (`<!-- DO UZUPEŁNIENIA -->`): zrzut ekranu portalu w hero i przykładowa informacja
    z rejestru. Zostają bez zmian do czasu, aż Łukasz dostarczy ostateczne materiały. Strony nie
    publikuj produkcyjnie z widocznymi zaślepkami.
11. **Cookies i elementy prawne.** Strona publiczna nie zapisuje ciasteczek ani danych w przeglądarce
    — tak ma zostać (bez analityki, bez zewnętrznych zasobów), więc baner zgód nie jest potrzebny.
    Portal używa ciasteczka sesji (`psa_sesja_portal`), niezbędnego do działania usługi. W polityce
    prywatności dodaj sekcję o plikach cookies: nazwa ciasteczka, cel, czas przechowywania, informacja,
    że strona publiczna ich nie używa. Treść prawna — do akceptacji Łukasza (`<!-- DO WERYFIKACJI -->`).
12. **Zachowanie:** animacje dokładnie jak w projekcie; `prefers-reduced-motion` wyłącza wszystkie;
    bez JavaScriptu strona jest kompletna.
13. **`DECYZJE.md`:** D-xxx — nowa strona publiczna (jedna strona + regulamin i polityka), rezygnacja
    z podstron i ze strony o nowelizacji.

## 3. Weryfikacja przed STOP

- Zrzuty 1440 px i 390 px (pełna strona, `reducedMotion: 'reduce'`) obok zrzutów projektu — wypisz
  każdą różnicę.
- Brak przewijania w poziomie przy 360, 390, 768, 1024 i 1440 px.
- Lighthouse (profil mobilny): wydajność, dostępność, dobre praktyki i SEO ≥ 95; axe-core: zero błędów
  krytycznych i poważnych; walidator danych strukturalnych bez błędów.
- Każdy link prowadzi do istniejącej strony albo trasy portalu.
- W przeglądarce po wejściu na stronę publiczną nie powstaje żadne ciasteczko ani wpis w pamięci.

### ⛔ STOP — zrzuty porównawcze, Lighthouse, axe, lista zmian technicznych

## 4. Czego nie robić

- Nie zmieniać tekstów, kolorów, odstępów, kolejności sekcji ani animacji.
- Nie dodawać sekcji, podstron, ikon, zdjęć, numeru telefonu ani treści prawnych.
- Nie ładować niczego z zewnętrznych CDN; bez frameworków, bibliotek i narzędzi analitycznych.
- Nie przywracać starego generatora podstron.
- Nie wpisywać kwot ręcznie.

# Znaleziska audytu PSA — log narastający

> Format: co zrobiłem → co się stało → co powinno się stać → podstawa → waga.
> Waga: KRYTYCZNY / POWAŻNY / DROBNY. Kolejne fazy dopisują na końcu, nie zmieniają numeracji
> wcześniejszych wpisów.

## Z-001 [DROBNY/do potwierdzenia wagi] — `GET /api/psa/meta` w pełni publiczny

- **Co zrobiłem:** `curl http://localhost:3005/api/psa/meta` bez żadnych ciasteczek/logowania.
- **Co się stało:** HTTP 200, pełna treść JSON — słowniki typów zdarzeń, checklisty, podstawy
  prawne, flagi `portal_wlaczony`/`podglad_systemu`.
- **Co powinno się stać:** endpoint pod prefiksem `/api/psa/*` w każdym innym pliku wymaga sesji
  pracownika (`wymagajPracownika`); ten jeden endpoint w `pozostale.js` (linia 68) nie ma żadnego
  middleware, mimo że plik jest montowany bez gate na poziomie `app.use` (każda trasa musi go
  dodać sama — ta jedna tego nie zrobiła).
- **Podstawa:** zasada techniczna (spójność modelu autoryzacji), nie przepis ustawy — dane
  ujawnione to metadane systemu (słowniki), nie dane osobowe ani rejestrowe konkretnej spółki.
- **Waga:** DROBNY–POWAŻNY (do ostatecznej klasyfikacji w FAZA 5 — ujawnia wewnętrzną logikę
  biznesową/checklisty bez uwierzytelnienia, ale bez danych osobowych ani dostępu do konkretnego
  rejestru).

## Z-002 [POWAŻNY] — zacommitowany plik `:memory:` (prawdziwa baza SQLite) w repozytorium

- **Co zrobiłem:** `git ls-files | grep ':memory:'`, otworzyłem plik przez `better-sqlite3`.
- **Co się stało:** plik `:memory:` w korzeniu repo jest śledzony przez git i jest prawdziwą bazą
  SQLite (71 stron). Wszystkie tabele `psa_*` puste (0 wierszy), tylko `psa_migracje` ma 35
  rekordów metadanych migracji — brak danych osobowych.
- **Co powinno się stać:** `WSPOLNA_BAZA=:memory:` w `.env` powinno dać efemeryczną bazę w
  pamięci (standardowa konwencja SQLite). Zamiast tego `server/konfiguracja.js::sciezka()` zawsze
  wywołuje `path.resolve(KATALOG_GLOWNY, wartosc)`, więc `:memory:` zamienia się w realną ścieżkę
  pliku na dysku w korzeniu repo — i w tym wypadku trafiła do gita.
- **Podstawa:** zasada techniczna — błąd konfiguracji + higiena repozytorium (przypadkowy
  artefakt w historii git). Art. 300³¹ § 4 KSH (bezpieczeństwo i integralność rejestru) czyni tego
  typu pomyłki tym bardziej istotnymi, mimo że akurat ten plik jest pusty.
- **Sprawdziłem dodatkowo:** `testy/pomoc.js:14` wywołuje `baza.otworz(':memory:')` bezpośrednio,
  z pominięciem `konfiguracja.sciezka()` — testy jednostkowe NIE są dotknięte tym błędem i dostają
  prawdziwą bazę w pamięci. Błąd materializuje się wyłącznie przy ustawieniu zmiennej środowiskowej
  `WSPOLNA_BAZA=:memory:` w `.env`, co przechodzi przez `sciezka()`.
- **Waga:** POWAŻNY (błąd konfiguracji — każdy, kto świadomie ustawi `WSPOLNA_BAZA=:memory:`
  licząc na efemeryczną bazę np. do jednorazowego testu na produkcyjnym hoście, dostanie trwały
  plik na dysku; potwierdzony przypadek trafienia takiego pliku do repozytorium git).

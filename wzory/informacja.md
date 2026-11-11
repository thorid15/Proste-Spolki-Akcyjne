# Informacja z rejestru akcjonariuszy

| Spółka | Stan na | Numer informacji |
|---|---|---|
| **{{spolka_firma}}** KRS {{spolka_krs}} | **{{stan_na}}** | {{numer}} |

### Spółka

| | |
|---|---|
| Siedziba | {{spolka_siedziba}} |
| Adres | {{spolka_adres}} |
| Sąd rejestrowy | {{spolka_sad}} |
| Data rejestracji spółki | {{spolka_data_rejestracji}} |

### Akcje

| Seria | Numery | Liczba | Rodzaj i uprawnienia szczególne | Data rejestracji emisji |
|---|---|--:|---|---|
{{#lista serie}}| {{seria}} | {{numery}} | {{liczba}} | {{rodzaj}} | {{data_emisji}} |
{{/lista}}
{{#jesli umorzone}}

Numery umorzone: {{#lista umorzone}}seria {{seria}}: {{numery}}{{#jesli dalej}}; {{/jesli}}{{/lista}}.
{{/jesli}}

### Akcjonariusze

| Akcjonariusz | Seria | Numery | Liczba | Data wpisu | Pokryte w całości |
|---|---|---|--:|---|---|
{{#lista akcjonariusze}}| **{{nazwa}}** {{dane}} | {{seria}} | {{numery}} | {{liczba}} | {{data_wpisu}} | {{pokryte}} |
{{/lista}}
{{#jesli obciazenia}}

### Obciążenia, ograniczenia, obowiązki

| Numery | Treść | Uprawniony | Prawo głosu | Data wpisu |
|---|---|---|---|---|
{{#lista obciazenia}}| {{numery}} | {{tresc}} | {{uprawniony}} | {{prawo_glosu}} | {{data_wpisu}} |
{{/lista}}
{{/jesli}}

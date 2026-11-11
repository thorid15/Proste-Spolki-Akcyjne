{{#jesli !adresat_spolka}}Osoba żądająca wpisu \
{{/jesli}}**{{adresat_nazwa}}** \
{{adresat_adres}}

Sprawa nr {{sprawa_znak}}

# Powiadomienie o wpisie w rejestrze akcjonariuszy

## *art. 300³⁴ § 7 zdanie pierwsze Kodeksu spółek handlowych*

Jako podmiot prowadzący rejestr akcjonariuszy spółki {{spolka_firma}}, siedziba: {{spolka_siedziba}}, wpisanej do rejestru przedsiębiorców Krajowego Rejestru Sądowego prowadzonego przez {{spolka_sad}} pod numerem KRS {{spolka_krs}}, zawiadamiam, że w dniu {{wpis_data}} o godzinie {{wpis_godzina}} dokonano w rejestrze akcjonariuszy wpisu o następującej treści:

{{#lista zmiany}}
- {{opis}}
{{/lista}}

Wpis został dokonany na podstawie żądania, które wpłynęło w dniu {{data_wplywu}}.{{#jesli zadajacy}} Żądający wpisu: {{zadajacy}}.{{/jesli}}{{#jesli podstawa}} Podstawa wpisu: {{podstawa}}{{#jesli podstawa_data}} z dnia {{podstawa_data}}{{/jesli}}.{{/jesli}}

### Stan rejestru po wpisie

| Akcjonariusz | Seria | Numery akcji | Liczba | Obciążenia |
|---|---|---|--:|---|
{{#lista pozycje}}| {{akcjonariusz}} | {{seria}} | {{numery}} | {{liczba}} | {{obciazenia}} |
{{/lista}}

### Pouczenie

Wobec spółki za akcjonariusza uważa się tylko tę osobę, która jest wpisana do rejestru akcjonariuszy.
{{#jesli adresat_spolka}}

### Lista akcjonariuszy

W załączeniu przekazuję sporządzony na podstawie stanu rejestru projekt listy akcjonariuszy. Po otrzymaniu niniejszego powiadomienia zarząd albo rada dyrektorów niezwłocznie składa do sądu rejestrowego listę akcjonariuszy podpisaną przez wszystkich członków zarządu albo rady dyrektorów, zawierającą nazwisko i imię albo firmę (nazwę) oraz liczbę i serię akcji posiadanych przez każdego z akcjonariuszy, wraz ze wzmianką o ustanowieniu zastawu lub użytkowania na akcjach.
{{/jesli}}

[podpis: {{podpisujacy_funkcja}} {{podpisujacy}}, podmiot prowadzący rejestr akcjonariuszy]
{{#jesli adresat_spolka}}

Załącznik: projekt listy akcjonariuszy — 1 egzemplarz.

---

{{spolka_firma}} \
{{spolka_adres}} \
KRS {{spolka_krs}}

Do \
**{{spolka_sad}}**

# Lista akcjonariuszy

## *art. 300³⁴ § 8 Kodeksu spółek handlowych*

Niniejsza lista obejmuje akcjonariuszy spółki {{spolka_firma}} według stanu rejestru akcjonariuszy na dzień {{wpis_data}}.

| Lp. | Nazwisko i imię albo firma (nazwa) | Seria | Liczba akcji | Wzmianka o zastawie lub użytkowaniu |
|--:|---|---|--:|---|
{{#lista lista_akcjonariuszy}}| {{lp}} | {{nazwa}} | {{seria}} | {{liczba}} | {{wzmianka}} |
{{/lista}}

Łączna liczba akcji: {{akcje_razem}}.

Rejestr akcjonariuszy spółki prowadzi Kancelaria Notarialna, notariusz: {{notariusz}}, adres: {{kancelaria_adres}}.

[podpis: podpisy wszystkich członków zarządu albo rady dyrektorów]
{{/jesli}}

# -*- coding: utf-8 -*-
from _naglowek import *

d = nowy_dokument()
naglowek_pisma(d)
blok_adresata(d, 'Osoba, której uprawnienia z akcji mają być wykreślone, zmienione lub obciążone')
tytul_pisma(d, 'POWIADOMIENIE O TREŚCI ZAMIERZONEGO WPISU',
            'art. §§300^34 § 3 Kodeksu spółek handlowych')

p = akapit(d, 'just', po=6)
pisz(p, 'Jako podmiot prowadzący rejestr akcjonariuszy ' + SPOLKA_DOPELNIACZ +
        ', powiadamiam, że wpłynęło żądanie dokonania wpisu dotyczącego uprawnień z akcji '
        'przysługujących adresatowi niniejszego pisma. Zamierzony wpis ma następującą treść:')

p = akapit(d, 'just', po=6, wciecie=0.75)
pisz(p, '{{wpis_opis}}')

p = akapit(d, 'just', po=6)
pisz(p, 'Żądanie wpłynęło w dniu {{zadanie_data_wplywu}}. Żądający wpisu: {{zadajacy_mianownik}}. '
        'Podstawa wpisu: {{dokument_rodzaj}} z dnia {{dokument_data}}.')

p = akapit(d, 'just', po=6)
pisz(p, 'Proszę o zajęcie stanowiska co do zamierzonego wpisu — wyrażenie zgody albo zgłoszenie zastrzeżeń — '
        'w terminie do dnia {{termin_stanowiska}}, w formie dokumentowej, na adres wskazany w nagłówku '
        'niniejszego pisma albo za pośrednictwem portalu rejestru akcjonariuszy.')

sekcja(d, 'Stan rejestru po zamierzonym wpisie')
tabela_pozycji(d)
d.add_paragraph()

sekcja(d, 'Pouczenie')
punkt(d, '1.', POUCZENIE_BADANIE, wciecie=0.75)
punkt(d, '2.', POUCZENIE_SPOR, wciecie=0.75)
punkt(d, '3.', POUCZENIE_TERMIN, wciecie=0.75)

podpis_podmiotu(d)
zapisz(d, '05-Powiadomienie-o-zamierzonym-wpisie-WZOR.docx')

# -*- coding: utf-8 -*-
"""Zawiadomienie o dokonaniu wpisu — jeden wzór, adresat wybierany sekcją warunkową.
Scala dawne 09 (do żądającego) i 10 (do spółki).
  {{#adresat_zadajacy}} – wariant dla osoby żądającej wpisu
  {{#adresat_spolka}}   – wariant dla spółki, dodaje blok o liście akcjonariuszy
Dokładnie jedna z sekcji ma element."""
from _naglowek import *

d = nowy_dokument()
naglowek_pisma(d)

# --- adresat: rola zależna od wariantu
t = d.add_table(rows=1, cols=2)
t.autofit = True
t.cell(0, 0).text = ''
c = t.cell(0, 1)
c.text = ''
p = c.paragraphs[0]
p.paragraph_format.space_after = Pt(0)
pisz(p, '{{#adresat_zadajacy}}Osoba żądająca wpisu{{/adresat_zadajacy}}', size=10, italic=True)
p = c.add_paragraph()
p.paragraph_format.space_after = Pt(0)
pisz(p, '{{#adresat_spolka}}{{spolka_organ}} spółki{{/adresat_spolka}}', size=10, italic=True)
for l in ('{{adresat_nazwa}}', '{{adresat_adres}}'):
    p = c.add_paragraph()
    p.paragraph_format.space_after = Pt(0)
    pisz(p, l)
d.add_paragraph()

tytul_pisma(d, 'ZAWIADOMIENIE O DOKONANIU WPISU W REJESTRZE AKCJONARIUSZY',
            'art. §§300^34 § 7 zdanie pierwsze Kodeksu spółek handlowych')

p = akapit(d, 'just', po=6)
pisz(p, 'Jako podmiot prowadzący rejestr akcjonariuszy ' + SPOLKA_DOPELNIACZ +
        ', zawiadamiam, że w dniu {{wpis_data}} o godzinie {{wpis_godzina}} dokonano w rejestrze akcjonariuszy '
        'wpisu o następującej treści:')

p = akapit(d, 'just', po=6, wciecie=0.75)
pisz(p, '{{wpis_opis}}')

p = akapit(d, 'just', po=6)
pisz(p, 'Wpis został dokonany na podstawie żądania, które wpłynęło w dniu {{zadanie_data_wplywu}}. '
        'Żądający wpisu: {{zadajacy_mianownik}}. Podstawa wpisu: {{dokument_rodzaj}} z dnia {{dokument_data}}.')

sekcja(d, 'Stan rejestru po wpisie')
tabela_pozycji(d)
d.add_paragraph()

sekcja(d, 'Pouczenie')
punkt(d, '1.', POUCZENIE_LEGITYMACJA, wciecie=0.75)
pk = akapit(d, 'left', po=0)
pisz(pk, '{{#wpis_konstytutywny}}')
punkt(d, '2.', 'Nabycie akcji albo ustanowienie na niej ograniczonego prawa rzeczowego nastąpiło z chwilą '
               'dokonania wpisu (art. §§300^37 § 1 Kodeksu spółek handlowych).', wciecie=0.75)
pk = akapit(d, 'left', po=0)
pisz(pk, '{{/wpis_konstytutywny}}')
pk = akapit(d, 'left', po=0)
pisz(pk, '{{#wpis_deklaratoryjny}}')
punkt(d, '2.', 'Przejście akcji nastąpiło z mocy prawa. Wpis ma charakter deklaratoryjny i potwierdza stan '
               'istniejący (art. §§300^37 § 2 Kodeksu spółek handlowych).', wciecie=0.75)
pk = akapit(d, 'left', po=0)
pisz(pk, '{{/wpis_deklaratoryjny}}')

# --- blok wyłącznie dla spółki
p = akapit(d, 'left', po=0)
pisz(p, '{{#adresat_spolka}}')
sekcja(d, 'Lista akcjonariuszy')
p = akapit(d, 'just', po=6)
pisz(p, 'W załączeniu przekazuję sporządzony na podstawie stanu rejestru projekt listy akcjonariuszy. '
        'Po otrzymaniu niniejszego zawiadomienia {{spolka_organ}} niezwłocznie składa do sądu rejestrowego listę '
        'akcjonariuszy podpisaną przez wszystkich {{spolka_organ_czlonkowie}}, zawierającą nazwisko i imię albo '
        'firmę (nazwę) oraz liczbę i serię akcji posiadanych przez każdego z akcjonariuszy, wraz ze wzmianką '
        'o ustanowieniu zastawu lub użytkowania na akcjach (art. §§300^34 § 8 Kodeksu spółek handlowych).')
p = akapit(d, 'left', po=0)
pisz(p, '{{/adresat_spolka}}')

podpis_podmiotu(d)

p = akapit(d, 'left', przed=18, po=0)
pisz(p, '{{#adresat_spolka}}Załącznik: projekt listy akcjonariuszy — 1 egzemplarz.{{/adresat_spolka}}', size=10)

zapisz(d, '07-Zawiadomienie-o-dokonaniu-wpisu-WZOR.docx')

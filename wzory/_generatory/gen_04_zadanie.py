# -*- coding: utf-8 -*-
"""Żądanie dokonania wpisu — jeden wzór na wszystkie przypadki.
Scala dawne 05 (stan otwarcia rejestru) i 06 (obrót akcjami).
Różnice obsłużone sekcjami warunkowymi:
  {{#zgoda}}     – gdy wpis wykreśla, zmienia albo obciąża czyjeś uprawnienia
  {{#zalaczniki}} – gdy do żądania dołączono dokumenty
Treść skrócona do minimum wymaganego przez KSH; pouczenia zachowane."""
from _naglowek import *

d = nowy_dokument()

p = akapit(d, 'right', po=12)
pisz(p, '{{kancelaria_miasto}}, dnia {{zadanie_data}} r.')

t = d.add_table(rows=1, cols=2)
t.autofit = True
t.cell(0, 0).text = ''
c = t.cell(0, 1)
c.text = ''
p = c.paragraphs[0]
p.paragraph_format.space_after = Pt(0)
pisz(p, 'Do', size=10, italic=True)
for l in ('Kancelaria Notarialna Notariusza {{notariusz_dopelniacz}}',
          'ulica {{kancelaria_ulica}}, {{kancelaria_kod}} {{kancelaria_miasto}}',
          'podmiot prowadzący rejestr akcjonariuszy'):
    p = c.add_paragraph()
    p.paragraph_format.space_after = Pt(0)
    pisz(p, l)
d.add_paragraph()
tytul_pisma(d, 'ŻĄDANIE DOKONANIA WPISU W REJESTRZE AKCJONARIUSZY',
            'art. §§300^34 § 1 i § 4 Kodeksu spółek handlowych')

sekcja(d, 'I. Żądający wpisu')
p = akapit(d, 'just', po=4)
pisz(p, '{{zadajacy_mianownik}}, {{zadajacy_identyfikator}}, adres: {{zadajacy_adres}}, '
        'adres poczty elektronicznej: {{zadajacy_email}}, występujący jako: {{zadajacy_rola}}.')

sekcja(d, 'II. Żądanie')
p = akapit(d, 'just', po=4)
pisz(p, 'Żądam dokonania w rejestrze akcjonariuszy ' + SPOLKA_DOPELNIACZ + ' wpisu o treści:')
p = akapit(d, 'just', po=6, wciecie=0.75)
pisz(p, '{{wpis_opis}}')
p = akapit(d, 'left', po=0)
pisz(p, '{{#podstawa_dokument}}')
p = akapit(d, 'just', po=4)
pisz(p, 'Podstawa wpisu: {{dokument_rodzaj}} z dnia {{dokument_data}}.')
p = akapit(d, 'left', po=4)
pisz(p, '{{/podstawa_dokument}}')

p = akapit(d, 'left', po=0)
pisz(p, '{{#zalaczniki}}')
p = akapit(d, 'left', przed=4, po=2)
pisz(p, 'Załączniki:', bold=True)
p = akapit(d, 'just', po=3, wciecie=0.75, wysuniecie=-0.5)
pisz(p, '— {{zalacznik_opis}}')
p = akapit(d, 'left', po=4)
pisz(p, '{{/zalaczniki}}')

sekcja(d, 'III. Doręczenia')
p = akapit(d, 'just', po=4)
pisz(p, 'Adres do doręczeń: {{zadajacy_adres_doreczen}}. Wnoszę o doręczanie korespondencji dotyczącej '
        'niniejszego żądania: {{sposob_doreczen}}. {{zgoda_email}} na komunikację ze Spółką i z Notariuszem '
        'przy wykorzystaniu poczty elektronicznej oraz na ujawnienie adresu poczty elektronicznej w rejestrze '
        'akcjonariuszy (art. §§300^30 § 3 pkt 5 Kodeksu spółek handlowych).')

linia_podpisu(d, 'podpis żądającego wpisu', align='right', przed=20)

p = akapit(d, 'left', po=0)
pisz(p, '{{#zgoda}}')
sekcja(d, 'IV. Zgoda na dokonanie wpisu')
p = akapit(d, 'just', po=4)
pisz(p, 'Ja, niżej {{zgadzajacy_podpisany}} {{zgadzajacy_mianownik}}, {{zgadzajacy_identyfikator}}, jako osoba, '
        'której uprawnienia z akcji zostaną przez wpis wykreślone, zmienione lub obciążone, wyrażam zgodę '
        'na dokonanie wpisu o treści wskazanej w pkt II. Zgoda dotyczy wyłącznie tego wpisu.')
linia_podpisu(d, '{{zgadzajacy_mianownik}}', align='right', przed=18)
p = akapit(d, 'left', po=4)
pisz(p, '{{/zgoda}}')

sekcja(d, 'Pouczenie')
punkt(d, '1.', POUCZENIE_CIEZAR, wciecie=0.75)
punkt(d, '2.', POUCZENIE_BADANIE, wciecie=0.75)
punkt(d, '3.', POUCZENIE_TERMIN, wciecie=0.75)
punkt(d, '4.', 'Zgoda wyrażona w pkt IV zwalnia podmiot prowadzący rejestr wyłącznie z obowiązku uprzedniego '
               'powiadomienia o treści zamierzonego wpisu (art. §§300^34 § 3 Kodeksu spółek handlowych). '
               'Nie zastępuje zgody spółki na zbycie akcji, jeżeli umowa spółki takiej zgody wymaga, ani zgody '
               'spółki wymaganej przy zbyciu akcji nie w pełni pokrytej (art. §§300^40 § 1 Kodeksu spółek '
               'handlowych).', wciecie=0.75)

zapisz(d, '04-Zadanie-dokonania-wpisu-WZOR.docx')

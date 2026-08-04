'use strict';

/**
 * Rejestr akcjonariuszy P.S.A. — punkt wejscia modulu.
 *
 * Port dev: 3005. Prefiks tabel: `psa_*`. Trasy: `/api/psa/...`.
 */

const path = require('node:path');
const express = require('express');

const konfiguracja = require('./server/konfiguracja');
const { db } = require('./server/baza');
const migracje = require('./server/migracje');
const { posrednikBledow } = require('./server/pomocnicze/odpowiedzi');

const aplikacja = express();

aplikacja.disable('x-powered-by');
aplikacja.use(express.json({ limit: '1mb' }));

// ── Migracje przy starcie - idempotentne ─────────────────────────────────
const zastosowane = migracje.uruchom(db());
if (zastosowane.length > 0) {
  console.log(`[psa] wykonano migracje: ${zastosowane.join(', ')}`);
}

// ── API ──────────────────────────────────────────────────────────────────
aplikacja.use('/api/wspolne', require('./server/trasy/wspolne'));
aplikacja.use('/api/psa/spolki', require('./server/trasy/spolki'));
aplikacja.use('/api/psa/osoby', require('./server/trasy/osoby'));
aplikacja.use('/api/psa/sprawy', require('./server/trasy/sprawy'));
aplikacja.use('/api/psa/zdarzenia', require('./server/trasy/zdarzenia'));
aplikacja.use('/api/psa', require('./server/trasy/pozostale'));

// ── Statyki ──────────────────────────────────────────────────────────────
// `design.css` serwujemy pod /wspolne/design.css - tak, jak linkuja go
// pozostale moduly kancelarii (sekcja 2 specyfikacji).
aplikacja.use(express.static(path.join(__dirname, 'publiczne'), { extensions: ['html'] }));

// Nieznana trasa API konczy sie JSON-em, nie strona.
aplikacja.use('/api', (zad, odp) => {
  odp.status(404).json({ blad: `Nieznany endpoint: ${zad.method} /api${zad.path}` });
});

// Pozostale sciezki obsluguje aplikacja jednostronicowa.
aplikacja.get('*', (zad, odp) => {
  odp.sendFile(path.join(__dirname, 'publiczne', 'index.html'));
});

aplikacja.use(posrednikBledow);

// ─────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  aplikacja.listen(konfiguracja.PORT, () => {
    console.log(`[psa] Rejestr akcjonariuszy P.S.A. — http://localhost:${konfiguracja.PORT}`);
    console.log(`[psa] baza: ${konfiguracja.WSPOLNA_BAZA}`);
    if (!konfiguracja.PORTAL_WLACZONY) {
      console.log('[psa] portal klienta wyłączony (PORTAL_WLACZONY=false) — wchodzi w sprincie 3');
    }
  });
}

module.exports = aplikacja;

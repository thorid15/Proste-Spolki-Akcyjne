'use strict';

/**
 * Rate limiting logowania. Dwa liczniki, bo broni sie przed dwoma roznymi
 * atakami: zgadywaniem hasla do JEDNEGO konta i ROZPYLANIEM jednego hasla
 * po wielu kontach.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const limiter = require('../server/logika/limiter');

function probujZalogowac(ip, email) {
  limiter.sprawdz(ip, email);
  limiter.zanotujNieudana(ip, email);
}

test('zgadywanie hasla do jednego konta blokuje sie po piatej probie', () => {
  const ip = '10.0.0.1';
  for (let i = 0; i < limiter.LIMIT; i++) probujZalogowac(ip, 'ofiara@example.pl');
  assert.throws(
    () => limiter.sprawdz(ip, 'ofiara@example.pl'),
    (e) => e.name === 'BladOgraniczenia'
  );
});

/**
 * Klucz `IP + e-mail` broni jednego konta, ale nie calej kancelarii:
 * atakujacy bierze jedno popularne haslo i przechodzi po stu adresach,
 * za kazdym razem z NOWYM kluczem, wiec pierwszy licznik nigdy nie dochodzi
 * do piatki. Sprawdzone sonda na dzialajacym serwerze: 25 kont z jednego
 * adresu przechodzilo bez blokady.
 */
test('rozpylanie hasla po wielu kontach blokuje licznik adresu', () => {
  const ip = '10.0.0.2';
  let zablokowano = false;
  for (let i = 0; i < limiter.LIMIT_IP + 5; i++) {
    try {
      probujZalogowac(ip, `ofiara${i}@example.pl`);
    } catch (e) {
      zablokowano = e.name === 'BladOgraniczenia';
      break;
    }
  }
  assert.equal(zablokowano, true, 'licznik adresu zatrzymuje rozpylanie');
});

/**
 * Udane logowanie czysci licznik TEGO KONTA, ale nie licznika adresu —
 * atakujacy, ktory po dwudziestu probach trafil jedno konto, nie dostaje
 * w nagrode czystego licznika na kolejne dwadziescia.
 */
test('udane logowanie nie zeruje licznika adresu', () => {
  const ip = '10.0.0.3';
  for (let i = 0; i < limiter.LIMIT_IP - 1; i++) {
    try { probujZalogowac(ip, `k${i}@example.pl`); } catch (e) { /* jeszcze nie */ }
  }
  limiter.wyczyscPoUdanej(ip, 'k0@example.pl');
  assert.throws(
    () => { probujZalogowac(ip, 'kolejny@example.pl'); probujZalogowac(ip, 'jeszcze@example.pl'); },
    (e) => e.name === 'BladOgraniczenia'
  );
});

test('licznik jednego adresu nie usypia innego', () => {
  const ip = '10.0.0.4';
  for (let i = 0; i < limiter.LIMIT; i++) probujZalogowac(ip, 'ofiara@example.pl');
  assert.throws(() => limiter.sprawdz(ip, 'ofiara@example.pl'));
  // Inny adres pracuje normalnie.
  assert.doesNotThrow(() => limiter.sprawdz('10.0.0.5', 'ofiara@example.pl'));
});

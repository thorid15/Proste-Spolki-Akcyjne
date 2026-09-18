'use strict';
// Test niskopoziomowy: wysylamy zadanie POST przez surowy socket TCP i
// natychmiast po wyslaniu ostatniego bajtu ciala niszczymy polaczenie
// (przed odebraniem JAKIEJKOLWIEK odpowiedzi). Symuluje utrate lacza
// klienta w trakcie, gdy serwer moze juz miec caly request i przetwarzac go.
const net = require('node:net');
const fs = require('node:fs');

async function main() {
  const cookie = fs.readFileSync('/tmp/faza7-cookies.txt', 'utf8')
    .split('\n').find((l) => l.includes('psa_sesja'))
    .split('\t').pop().trim();

  const znacznik = `AbortSocket-${Date.now()}`;
  const cialo = JSON.stringify({ typ: 'fizyczna', nazwisko: znacznik, imie: 'X' });
  const zadanie =
    `POST /api/psa/osoby HTTP/1.1\r\n` +
    `Host: localhost:3005\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Length: ${Buffer.byteLength(cialo)}\r\n` +
    `Cookie: psa_sesja=${cookie}\r\n` +
    `Connection: close\r\n\r\n` +
    cialo;

  await new Promise((resolve, reject) => {
    const socket = net.connect(3005, 'localhost', () => {
      socket.write(zadanie, () => {
        // Niszczymy polaczenie NATYCHMIAST po wyslaniu, bez czekania na
        // JAKAKOLWIEK odpowiedz - najbardziej agresywny wariant zerwania.
        socket.destroy();
        resolve();
      });
    });
    socket.on('error', () => resolve()); // ECONNRESET po naszej stronie jest oczekiwane
    socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('timeout')); });
  });

  console.log('Zadanie wyslane i polaczenie zniszczone bez odczytu odpowiedzi.');
  await new Promise((r) => setTimeout(r, 800));

  const sprawdz = await fetch(`http://localhost:3005/api/psa/osoby?q=${znacznik}`, {
    headers: { Cookie: `psa_sesja=${cookie}` },
  }).then((r) => r.json());
  console.log('Czy osoba trafila do bazy mimo zerwania socketu:', sprawdz.osoby.length > 0, sprawdz.osoby.map((o) => o.id));
}

main().catch((e) => { console.error(e); process.exit(1); });

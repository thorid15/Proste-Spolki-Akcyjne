const http = require('node:http');
let n = 0;
http.createServer((zad, odp) => {
  let c = ''; zad.on('data', (x) => { c += x; }); zad.on('end', () => {
    const j = (k, d) => { odp.writeHead(k, { 'Content-Type': 'application/json' }); odp.end(JSON.stringify(d)); };
    if (zad.url === '/oauth/auth') {
      // Operator przyjmuje tu FORMULARZ, nie JSON — atrapa pilnuje tego tak samo.
      if (!String(zad.headers['content-type'] || '').includes('x-www-form-urlencoded')) {
        return j(400, { error: 'oczekiwano application/x-www-form-urlencoded' });
      }
      return j(200, { access_token: 't', expires_in: 7200 });
    }
    if (/^\/transactions\/[^/]+\/cancel$/.test(zad.url)) return j(200, { result: 'success' });
    if (zad.url === '/transactions' && zad.method === 'POST') {
      n += 1;
      return j(200, { transactionId: `TR-${n}`, transactionPaymentUrl: `https://atrapa.example/p/TR-${n}` });
    }
    if (zad.url.startsWith('/transactions/')) return j(200, { status: 'pending' });
    return j(404, {});
  });
}).listen(3199, '127.0.0.1', () => console.log('atrapa tpay na 3199'));

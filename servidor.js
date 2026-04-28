/**
 * MOVE PÉ — Servidor Local de Rede
 * Roda o sistema para todos os PCs da rede Wi-Fi
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/dashboard.html';

  const filePath = path.join(ROOT, urlPath);

  // Segurança: não permite sair da pasta do sistema
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Proibido'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Tenta index.html como fallback
      if (urlPath !== '/index.html') {
        fs.readFile(path.join(ROOT, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end('Não encontrado'); return; }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(d2);
        });
      } else {
        res.writeHead(404); res.end('Não encontrado');
      }
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  // Descobre o IP local da rede
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) ips.push(addr.address);
    }
  }

  console.log('\n========================================');
  console.log('  MOVE PÉ — Sistema rodando na rede!');
  console.log('========================================');
  console.log('\n  Neste computador:');
  console.log('  http://localhost:' + PORT);
  ips.forEach(ip => {
    console.log('\n  Outros computadores / celular:');
    console.log('  http://' + ip + ':' + PORT);
  });
  console.log('\n  Copie o endereço acima e abra em');
  console.log('  qualquer navegador da sua rede Wi-Fi.');
  console.log('\n  Para parar o servidor: feche esta janela.');
  console.log('========================================\n');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n  ERRO: A porta ' + PORT + ' já está em uso.');
    console.error('  O servidor pode já estar rodando.');
    console.error('  Tente abrir: http://localhost:' + PORT + '\n');
  } else {
    console.error('Erro ao iniciar servidor:', e.message);
  }
  process.exit(1);
});

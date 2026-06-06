#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const root = path.resolve(__dirname, '..');
process.env.LXD_CONTENT_ROOT = process.env.LXD_CONTENT_ROOT || root;
process.env.LXD_ADMIN_ALLOW_UNAUTH = process.env.LXD_ADMIN_ALLOW_UNAUTH || 'true';

const adminFunction = require('../netlify/functions/admin-content.js');
const port = Number(process.env.PORT || 8888);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function safeStaticPath(urlPath) {
  let pathname = decodeURIComponent(urlPath.split('?')[0] || '/');
  if (pathname.endsWith('/')) pathname += 'index.html';
  const full = path.resolve(root, pathname.replace(/^\/+/, ''));
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

async function handleApi(req, res, parsedUrl) {
  const body = await readBody(req);
  const queryStringParameters = {};
  parsedUrl.searchParams.forEach((value, key) => { queryStringParameters[key] = value; });

  const result = await adminFunction.handler({
    httpMethod: req.method,
    headers: { ...req.headers, host: req.headers.host || `localhost:${port}` },
    queryStringParameters,
    body: body || null,
    isBase64Encoded: false,
    path: parsedUrl.pathname,
  }, {});

  res.writeHead(result.statusCode || 200, result.headers || {});
  res.end(result.body || '');
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);

    if (parsedUrl.pathname === '/api/admin-content' || parsedUrl.pathname === '/.netlify/functions/admin-content') {
      await handleApi(req, res, parsedUrl);
      return;
    }

    const full = safeStaticPath(parsedUrl.pathname);
    if (!full) return send(res, 403, 'Forbidden', { 'content-type': 'text/plain; charset=utf-8' });

    fs.stat(full, (err, stat) => {
      if (err || !stat.isFile()) {
        const fallback404 = path.join(root, '404.html');
        if (fs.existsSync(fallback404)) {
          return send(res, 404, fs.readFileSync(fallback404), { 'content-type': 'text/html; charset=utf-8' });
        }
        return send(res, 404, 'Not found', { 'content-type': 'text/plain; charset=utf-8' });
      }
      const type = TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      fs.createReadStream(full).pipe(res);
    });
  } catch (err) {
    console.error(err);
    send(res, 500, err.message || 'Internal error', { 'content-type': 'text/plain; charset=utf-8' });
  }
});

server.listen(port, () => {
  console.log('Llobregat local listo:');
  console.log(`  Web:   http://localhost:${port}/`);
  console.log(`  Admin: http://localhost:${port}/admin/`);
  console.log('Pulsa Ctrl+C para parar.');
});

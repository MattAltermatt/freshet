import http from 'node:http';

const PORT = 4391;

const DB = {
  '/internal/user/1234': {
    id: 1234,
    insertDate: '2026-04-17T23:09:30Z',
    status: 'DOWN',
    internalId1: 7777,
    internalId2: 8888,
    theValueICareAbout: 9999,
  },
  '/internal/user/42': {
    id: 42,
    insertDate: '2025-11-02T08:15:00Z',
    status: 'UP',
    internalId1: 1,
    internalId2: 2,
    theValueICareAbout: 3,
  },
};

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const body = DB[pathname];
  if (body) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body, null, 2));
    return;
  }
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta charset=utf-8><title>Present-JSON fixtures</title>
<h1>Present-JSON fixture server</h1>
<p>Try these URLs:</p>
<ul>
${Object.keys(DB).map((p) => `<li><a href="${p}">${p}</a></li>`).join('\n')}
</ul>`);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[fixtures] listening on http://127.0.0.1:${PORT}`);
  for (const p of Object.keys(DB)) {
    console.log(`[fixtures]   http://127.0.0.1:${PORT}${p}`);
  }
});

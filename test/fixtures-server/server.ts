import http from 'node:http';

const JSON_BODY = {
  id: 1234,
  insertDate: '2026-04-17T23:09:30Z',
  status: 'DOWN',
  internalId1: 7777,
  internalId2: 8888,
  theValueICareAbout: 9999,
};

export function startServer(port: number): Promise<() => Promise<void>> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/internal/user/1234') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(JSON_BODY));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(port, '127.0.0.1', () =>
      resolve(() => new Promise<void>((res) => server.close(() => res()))),
    );
  });
}

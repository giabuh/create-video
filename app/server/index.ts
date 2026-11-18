// Temporary static server; Task 8 replaces it.
import {Hono} from 'hono';
import {serve} from '@hono/node-server';
import {serveStatic} from '@hono/node-server/serve-static';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const app = new Hono();
for (const name of ['library', 'music', 'brands', 'projects', 'voices']) {
  app.use(`/${name}/*`, serveStatic({root: path.join(repo, name), rewriteRequestPath: (p) => p.replace(new RegExp(`^/${name}`), '')}));
}
serve({fetch: app.fetch, port: 5316, hostname: '127.0.0.1'});

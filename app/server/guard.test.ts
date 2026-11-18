import {Hono} from 'hono';
import {describe, expect, it} from 'vitest';
import {hostGuard} from './guard.ts';

const app = new Hono().use(hostGuard([5316, 5317])).all('*', c => c.text('ok'));
const req = (method: string, headers: Record<string, string>) => app.request('http://x/api', {method, headers});

describe('hostGuard', () => {
  it('allows loopback host GET', async () => expect((await req('GET', {Host: '127.0.0.1:5316'})).status).toBe(200));
  it('rejects foreign host', async () => expect((await req('GET', {Host: 'evil.com'})).status).toBe(403));
  it('rejects wrong port', async () => expect((await req('GET', {Host: 'localhost:9999'})).status).toBe(403));
  it('POST with same-set Origin ok', async () => expect((await req('POST', {Host: 'localhost:5317', Origin: 'http://localhost:5317'})).status).toBe(200));
  it('POST with foreign Origin 403', async () => expect((await req('POST', {Host: 'localhost:5317', Origin: 'http://evil.com'})).status).toBe(403));
  it('POST without Origin ok', async () => expect((await req('POST', {Host: 'localhost:5317'})).status).toBe(200));
});

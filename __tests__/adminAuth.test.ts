import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAuthorizedAdminRequest } from '@/lib/adminAuth';

function requestWith(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://localhost:3000/api/whatever', { headers });
}

describe('isAuthorizedAdminRequest', () => {
  beforeEach(() => {
    delete process.env.RESCRAPE_TOKEN;
    delete process.env.RESCRAPE_TOKEN_AGENT;
  });

  afterEach(() => {
    delete process.env.RESCRAPE_TOKEN;
    delete process.env.RESCRAPE_TOKEN_AGENT;
  });

  it('rejects when no token is configured, even with a token supplied', () => {
    expect(isAuthorizedAdminRequest(requestWith('anything'))).toBe(false);
  });

  it('rejects a missing Authorization header', () => {
    process.env.RESCRAPE_TOKEN = 'secret';
    expect(isAuthorizedAdminRequest(requestWith())).toBe(false);
  });

  it('accepts the primary token', () => {
    process.env.RESCRAPE_TOKEN = 'secret';
    expect(isAuthorizedAdminRequest(requestWith('secret'))).toBe(true);
  });

  it('accepts the secondary agent token when configured', () => {
    process.env.RESCRAPE_TOKEN = 'secret';
    process.env.RESCRAPE_TOKEN_AGENT = 'agent-secret';
    expect(isAuthorizedAdminRequest(requestWith('agent-secret'))).toBe(true);
  });

  it('rejects a token matching neither secret', () => {
    process.env.RESCRAPE_TOKEN = 'secret';
    process.env.RESCRAPE_TOKEN_AGENT = 'agent-secret';
    expect(isAuthorizedAdminRequest(requestWith('wrong'))).toBe(false);
  });
});

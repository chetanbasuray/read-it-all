import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { regex } from 'shorol';

const BEARER_PREFIX_REGEX = regex().start().literal('Bearer').whitespace().oneOrMore().toRegExp('i');

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// RESCRAPE_TOKEN_AGENT is a second, independently revocable secret so a token
// handed to an external caller never has to be the same one used for
// personal/manual calls. Shared by every internal (not linked from the UI) endpoint.
export function isAuthorizedAdminRequest(request: NextRequest): boolean {
  const validTokens = [process.env.RESCRAPE_TOKEN, process.env.RESCRAPE_TOKEN_AGENT].filter(
    (t): t is string => !!t,
  );
  if (validTokens.length === 0) return false;

  const provided = request.headers.get('authorization')?.replace(BEARER_PREFIX_REGEX, '') ?? '';
  return validTokens.some((token) => tokenMatches(provided, token));
}

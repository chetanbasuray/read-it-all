import { describe, it, expect } from 'vitest';
import sites from '../scripts/regression-sites.json';

interface Site {
  domain: string;
  url: string;
  status: string;
  blockedInProduction?: boolean;
  note?: string;
}
const list = sites as Site[];

describe('regression fixture invariants', () => {
  it('marks a production-blocked site only when it is also known-hard', () => {
    for (const s of list.filter((x) => x.blockedInProduction)) {
      expect(s.status).toBe('known-hard');
    }
  });

  it('requires a note explaining any production-blocked entry', () => {
    for (const s of list.filter((x) => x.blockedInProduction)) {
      expect(s.note && s.note.length).toBeGreaterThan(30);
    }
  });

  it('holds cnn.com and timesofisrael.com as production-blocked, both verified 502 from Vercel', () => {
    for (const domain of ['cnn.com', 'timesofisrael.com']) {
      const s = list.find((x) => x.domain === domain)!;
      expect(s.blockedInProduction).toBe(true);
      expect(s.note).toContain('502');
    }
  });

  it('keeps every entry to the two known statuses and a unique domain', () => {
    const domains = list.map((s) => s.domain);
    expect(new Set(domains).size).toBe(domains.length);
    for (const s of list) expect(['known-good', 'known-hard']).toContain(s.status);
  });
});

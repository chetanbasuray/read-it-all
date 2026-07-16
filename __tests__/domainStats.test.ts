import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.KV_URL = 'https://dummy-redis.example.com';
});

vi.mock('@vercel/kv', () => ({
  kv: {
    sadd: vi.fn().mockResolvedValue(1),
    hincrby: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    hgetall: vi.fn().mockResolvedValue(null),
  },
}));

const { recordDomainOutcome, getAllDomainStats } = await import('@/lib/domainStats');
const { kv } = await import('@vercel/kv');

describe('recordDomainOutcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds the hostname (without www) to the domain set and increments the tier and total', async () => {
    await recordDomainOutcome('https://www.example.com/article', 'direct-fetch');

    expect(kv.sadd).toHaveBeenCalledWith('domain-stats:domains', 'example.com');
    expect(kv.hincrby).toHaveBeenCalledWith('domain-stats:example.com', 'direct-fetch', 1);
    expect(kv.hincrby).toHaveBeenCalledWith('domain-stats:example.com', 'total', 1);
  });

  it('does nothing for an invalid URL', async () => {
    await recordDomainOutcome('not a url', 'failed');
    expect(kv.sadd).not.toHaveBeenCalled();
  });

  it('swallows a Redis failure rather than throwing', async () => {
    vi.mocked(kv.sadd).mockRejectedValueOnce(new Error('redis down'));
    await expect(recordDomainOutcome('https://example.com/x', 'failed')).resolves.toBeUndefined();
  });
});

describe('getAllDomainStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes success rate from total minus failed', async () => {
    vi.mocked(kv.smembers).mockResolvedValueOnce(['example.com']);
    vi.mocked(kv.hgetall).mockResolvedValueOnce({
      total: 10,
      'direct-fetch': 7,
      failed: 3,
    });

    const stats = await getAllDomainStats();

    expect(stats).toEqual([
      {
        domain: 'example.com',
        total: 10,
        tiers: {
          'direct-fetch': 7,
          warmup: 0,
          amp: 0,
          'browser-render': 0,
          'google-cache': 0,
          wayback: 0,
          failed: 3,
        },
        successRate: 0.7,
      },
    ]);
  });

  it('reports 0 success rate for a domain with no recorded attempts', async () => {
    vi.mocked(kv.smembers).mockResolvedValueOnce(['never-scraped.com']);
    vi.mocked(kv.hgetall).mockResolvedValueOnce(null);

    const stats = await getAllDomainStats();

    expect(stats[0].total).toBe(0);
    expect(stats[0].successRate).toBe(0);
  });

  it('sorts by request volume, most-requested first', async () => {
    vi.mocked(kv.smembers).mockResolvedValueOnce(['low.com', 'high.com']);
    vi.mocked(kv.hgetall)
      .mockResolvedValueOnce({ total: 2, failed: 0 })
      .mockResolvedValueOnce({ total: 50, failed: 0 });

    const stats = await getAllDomainStats();

    expect(stats.map((s) => s.domain)).toEqual(['high.com', 'low.com']);
  });

  it('returns an empty list when Redis fails', async () => {
    vi.mocked(kv.smembers).mockRejectedValueOnce(new Error('redis down'));
    expect(await getAllDomainStats()).toEqual([]);
  });
});

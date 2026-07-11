import { lookup } from 'dns/promises';
import { isIP } from 'net';

function ipInCIDR(ip: string, cidr: string): boolean {
  const [rangeNet, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  const ipBytes = ip.split('.').map(Number);
  const rangeBytes = rangeNet.split('.').map(Number);
  if (ipBytes.length !== 4 || rangeBytes.length !== 4) return false;

  let mask = 0;
  for (let i = 0; i < 4; i++) {
    const shift = bits - i * 8;
    if (shift <= 0) break;
    const m = shift >= 8 ? 0xff : 0xff << (8 - shift);
    mask = m;
    if ((ipBytes[i] & mask) !== (rangeBytes[i] & mask)) return false;
  }
  return true;
}

function isPrivateIP(ip: string): boolean {
  if (ip === '::1') return true;
  if (ip.startsWith('fe80:')) return true;
  if (!isIP(ip)) return false;

  const v4Mapped = ip.includes('::ffff:') ? ip.split('::ffff:')[1] : ip;

  return (
    ipInCIDR(v4Mapped, '127.0.0.0/8') ||
    ipInCIDR(v4Mapped, '10.0.0.0/8') ||
    ipInCIDR(v4Mapped, '172.16.0.0/12') ||
    ipInCIDR(v4Mapped, '192.168.0.0/16') ||
    ipInCIDR(v4Mapped, '169.254.0.0/16')
  );
}

export async function validateUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are allowed');
  }

  const hostname = parsed.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error(`URL resolves to a loopback address: ${hostname}`);
  }

  if (isIP(hostname) && isPrivateIP(hostname)) {
    throw new Error(`URL is a private IP address: ${hostname}`);
  }

  try {
    const addresses = await lookup(hostname);
    const resolved = addresses.address;
    if (isPrivateIP(resolved)) {
      throw new Error(
        `URL resolves to a private/internal IP address: ${resolved}`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('URL resolves to')) {
      throw e;
    }
    throw new Error(`Could not resolve hostname: ${hostname}`);
  }
}

export interface UnsupportedSite {
  domain: string;
  reason: string;
}

// sites this app deliberately does not scrape, distinct from scripts/regression-sites.json's
// "known-hard" entries (those are attempted but unreliable; these are refused on purpose)
export const UNSUPPORTED_SITES: UnsupportedSite[] = [
  {
    domain: 'telegraph.co.uk',
    reason:
      'Serves an explicit "Access Restricted" notice to automated requests stating unauthorised access is prohibited without a licensing contract.',
  },
];

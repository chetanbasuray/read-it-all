# Unsupported Sites

Sites this app deliberately refuses to scrape, distinct from the regression suite's "known-hard" entries (those are attempted but unreliable; these are refused on purpose).

## UnsupportedSite

`interface UnsupportedSite { domain: string;; reason: string; }`

A deliberately unsupported domain and the reason scraping is refused.

## UNSUPPORTED_SITES

`const UNSUPPORTED_SITES: UnsupportedSite[] = [ { domain: 'telegraph.co.uk', reason: 'Serves an explicit "Access Restricted" notice to automated requests stating unauthorised access is prohibited without a licensing contract.', }, ]`

The list of deliberately unsupported domains with their refusal reasons.

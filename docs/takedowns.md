# Takedowns

Publisher-requested content removals loaded from the takedown registry and checked at the start of every scrape, so a takedown also applies to background revalidation.

## TakedownEntry

`interface TakedownEntry { requestId: string;; link: string;; date: string;; note?: string; }`

A single takedown notice: the publisher's request id, the public notice link, its date, and an optional note.

## matchTakedown

`matchTakedown(takedowns: TakedownsData, url: string): TakedownEntry | null`

Searches the loaded takedown data for an entry whose URL matches the given article URL.

## getTakedown

`getTakedown(url: string): TakedownEntry | null`

Returns the takedown entry for a URL, or `null` when the article is not affected by any takedown.

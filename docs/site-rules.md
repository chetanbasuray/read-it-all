# Site Rules

Per-domain preprocessing and post-processing overrides. `preprocessHtmlForSite` runs before extraction (rewriting or removing publisher widgets that confuse the parser), `polishArticleForSite` runs after extraction (fixing garbled markup, bylines, and lead images). Rules are keyed by domain and many domain entries share one rule.

## SiteRule

`interface SiteRule { eprocessHtml?: (html: string) => string;; lishArticle?: (article: ArticleData) => ArticleData; } }`

A per-site override: an optional HTML preprocessor run before extraction and an optional article polisher run after.

## SITE_RULES

`const SITE_RULES: Record<string, SiteRule> = { 'bbc.com': bbcRule, 'bbc.co.uk': bbcRule, 'reuters.com': reutersRule, 'theguardian.com': guardianRule, 'cnn.com': cnnRule, 'edition.cnn.com': cnnRule, 'timesofindia.indiatimes.com': toiRule, 'timesofisrael.com': toiIsraelRule, 'bylinetimes.com': bylineTimesRule, 'pcmag.com': pcmagRule, 'dailymail.co.uk': dailyMailRule, 'dailymail.com': dailyMailRule, 'theverge.com': vergeRule, 'thehindu.com': hinduRule, 'moneycontrol.com': moneycontrolRule, 'yahoo.com': yahooRule, 'techspot.com': techSpotRule, 'pravda.com.ua': pravdaRule, 'dw.com': dwRule, 'rte.ie': rteRule, 'arstechnica.com': arsTechnicaRule, 'eurogamer.net': eurogamerRule, 'dexerto.com': dexertoRule, 'cnbc.com': cnbcRule, 'ign.com': ignRule, 'insideevs.com': insideEvsRule, 'i24news.tv': i24NewsRule, 'fortune.com': fortuneRule, 'kyivpost.com': kyivPostRule, 'heise.de': heiseRule, 'spiegel.de': spiegelRule, 'mashable.com': mashableRule, 'indianexpress.com': indianExpressRule, 'thenationaldesk.com': nationalDeskRule, 'newindianexpress.com': newIndianExpressRule, 'news18.com': news18Rule, 'hartpunkt.de': hartpunktRule, 'apnews.com': apNewsRule, 'nytimes.com': nytimesRule, 'politico.eu': politicoRule, 'g1.globo.com': globoRule, 'aninews.in': aniNewsRule, 'politico.com': politicoComRule, }`

The domain-to-rule registry consulted by both the preprocess and polish helpers.

## preprocessHtmlForSite

`preprocessHtmlForSite(url: string, html: string): string`

Looks up the rule for the URL's domain and runs its preprocessor on the fetched HTML, returning the page (possibly rewritten) meant for extraction.

## polishArticleForSite

`polishArticleForSite(article: ArticleData): ArticleData`

Looks up the rule for the article's URL and runs its polisher on the extracted article, returning the final `ArticleData`.

## aniNewsRule

`const aniNewsRule: SiteRule = { polishArticle: polishAniArticle, }`

ANI News: article polish only.

## apNewsRule

`const apNewsRuleSiteRule = preprocessHtml: preprocessApNewsHtml, };`

AP News: HTML preprocessing only.

## arsTechnicaRule

`const arsTechnicaRuleSiteRule = = preprocessHtml: preprocessArsTechnicaHtml, };`

Ars Technica: HTML preprocessing only.

## bbcRule

`const bbcRule: SiteRule = { preprocessHtml: stripBbcWidgets, }`

BBC: strips BBC widget markup before extraction.

## bylineTimesRule

`const bylineTimesRule: SiteRule = { preprocessHtml: preprocessBylineTimesHtml, }`

Byline Times: HTML preprocessing only.

## cnbcRule

`const cnbcRule: SiteRule = { preprocessHtml: preprocessCnbcHtml, }`

CNBC: HTML preprocessing only.

## cnnRule

`const cnnRule: SiteRule = { preprocessHtml: stripCnnWidgets, }`

CNN: strips CNN widget markup before extraction.

## dailyMailRule

`const dailyMailRule: SiteRule = { preprocessHtml: preprocessDailyMailHtml, }`

Daily Mail: HTML preprocessing only.

## dexertoRule

`const dexertoRule: SiteRule = { preprocessHtml: preprocessDexertoHtml, }`

Dexerto: HTML preprocessing only.

## dwRule

`const dwRule: SiteRule = { preprocessHtml: preprocessDwHtml, }`

DW: HTML preprocessing only.

## eurogamerRule

`const eurogamerRule: SiteRule = { preprocessHtml: preprocessEurogamerHtml, }`

Eurogamer: HTML preprocessing only.

## fortuneRule

`const fortuneRule: SiteRule = { preprocessHtml: preprocessFortuneHtml, }`

Fortune: HTML preprocessing only.

## globoRule

`const globoRuleteRule = { = preprocessHtml: preprocessGloboHtml, };`

Globo: HTML preprocessing only.

## hartpunktRule

`const hartpunktRule: SiteRule = { preprocessHtml: preprocessHartpunktHtml, }`

Hartpunkt: HTML preprocessing only.

## heiseRule

`const heiseRule: SiteRule = { preprocessHtml: preprocessHeiseHtml, }`

Heise: HTML preprocessing only.

## i24NewsRule

`const i24NewsRule: SiteRule = { preprocessHtml: preprocessI24NewsHtml, }`

i24News: HTML preprocessing only.

## ignRule

`const ignRule: SiteRule = { preprocessHtml: preprocessIgnHtml, polishArticle: polishIgnArticle, }`

IGN: both HTML preprocessing and article polish.

## indianExpressRule

`const indianExpressRule: SiteRule = { preprocessHtml: preprocessIndianExpressHtml, polishArticle: polishIndianExpressArticle, }`

Indian Express: both HTML preprocessing and article polish.

## toiRule

`const toiRule: SiteRule = { preprocessHtml: preprocessToiHtml, polishArticle: polishToiArticle, }`

Times of India: both HTML preprocessing and article polish.

## insideEvsRule

`const insideEvsRule: SiteRule = { polishArticle: polishInsideEvsArticle, }`

InsideEVs: article polish only.

## kyivPostRule

`const kyivPostRule: SiteRule = { preprocessHtml: preprocessKyivPostHtml, }`

Kyiv Post: HTML preprocessing only.

## mashableRule

`const mashableRule: SiteRule = { preprocessHtml: preprocessMashableHtml, }`

Mashable: HTML preprocessing only.

## moneycontrolRule

`const moneycontrolRule: SiteRule = { preprocessHtml: preprocessMoneycontrolHtml, }`

Moneycontrol: HTML preprocessing only.

## newIndianExpressRule

`const newIndianExpressRule: SiteRule = { preprocessHtml: preprocessNewIndianExpressHtml, }`

New Indian Express: HTML preprocessing only.

## news18Rule

`const news18Rule: SiteRule = { preprocessHtml: preprocessNews18Html, }`

News18: HTML preprocessing only.

## nytimesRule

`const nytimesRule: SiteRule = { preprocessHtml: preprocessNytimesHtml, }`

NYTimes: HTML preprocessing only.

## pcmagRule

`const pcmagRule: SiteRule = { preprocessHtml: preprocessPcmagHtml, }`

PCMag: HTML preprocessing only.

## politicoComRule

`const politicoComRule: SiteRule = { preprocessHtml: preprocessPoliticoComHtml, }`

Politico (US): HTML preprocessing only.

## politicoRule

`const politicoRule: SiteRule = { preprocessHtml: preprocessPoliticoHtml, }`

Politico (EU): HTML preprocessing only.

## pravdaRule

`const pravdaRule: SiteRule = { preprocessHtml: preprocessPravdaHtml, }`

Pravda: HTML preprocessing only.

## reutersRule

`const reutersRule: SiteRule = { polishArticle: polishReutersArticle, }`

Reuters: article polish only.

## rteRule

`const rteRule: SiteRule = { preprocessHtml: preprocessRteHtml, }`

RTE: HTML preprocessing only.

## spiegelRule

`const spiegelRule: SiteRule = { preprocessHtml: preprocessSpiegelHtml, }`

Spiegel: HTML preprocessing only.

## techSpotRule

`const techSpotRule: SiteRule = { preprocessHtml: preprocessTechSpotHtml, }`

TechSpot: HTML preprocessing only.

## guardianRule

`const guardianRule: SiteRule = { polishArticle: polishGuardianArticle, }`

The Guardian: article polish only.

## hinduRule

`const hinduRule: SiteRule = { preprocessHtml: preprocessHinduHtml, }`

The Hindu: HTML preprocessing only.

## nationalDeskRule

`const nationalDeskRule: SiteRule = { preprocessHtml: preprocessNationalDeskHtml, polishArticle: polishNationalDeskArticle, }`

The National Desk: both HTML preprocessing and article polish.

## vergeRule

`const vergeRule: SiteRule = { polishArticle: polishVergeArticle, }`

The Verge: article polish only.

## toiIsraelRule

`const toiIsraelRule: SiteRule = { preprocessHtml: preprocessToiIsraelHtml, polishArticle: polishToiIsraelArticle, }`

Times of Israel: both HTML preprocessing and article polish.

## yahooRule

`const yahooRule: SiteRule = { preprocessHtml: preprocessYahooHtml, }`

Yahoo: HTML preprocessing only.

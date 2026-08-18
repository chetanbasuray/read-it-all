import * as cheerio from 'cheerio';
import { regex } from 'shorol';
import type { ArticleData } from '../scraper';
import { WHITESPACE_RUN_REGEX } from '../utils';
import type { SiteRule } from './types';

const FOLLOW_TOOLTIP_PATTERN = regex()
  .literal('Posts from this ')
  .group((b) => b.literal('topic').orLiteral('author'))
  .literal(' will be added')
  .toRegExp();

// "follow this topic/author" tag chips appear above the headline (breadcrumb)
// and after the article (footer tags), marked by a stable id pattern. The
// same component also wraps the lead byline, where only the hover-card
// tooltip is disposable and the visible name must stay - that's handled
// separately by stripFollowTooltips.
function stripFollowTopics($: cheerio.CheerioAPI): void {
  $('[id^="follow-category-"], [id*="-article_footer-"]').each((_, el) => {
    const item = $(el).closest('li');
    (item.length ? item : $(el)).remove();
  });
  $('ul').filter((_, el) => $(el).children('li').length === 0).remove();
}

// the "follow" component's hover-card tooltip renders as plain text once
// extracted; anchored on its fixed copy since it has no stable class/id
function stripFollowTooltips($: cheerio.CheerioAPI): void {
  $('p')
    .filter((_, el) => FOLLOW_TOOLTIP_PATTERN.test($(el).text()))
    .each((_, el) => {
      $(el).parent().remove();
    });
}

// everything from the layout rail onward is ads, a "related stories" list,
// and a newsletter signup - none of it is article text
function stripLayoutRail($: cheerio.CheerioAPI): void {
  $('[class*="duet--layout--rail"]').remove();
}

// closing nag encouraging the reader to follow the story's topics/authors
function stripFollowPrompt($: cheerio.CheerioAPI): void {
  $('strong')
    .filter((_, el) => $(el).text().trim() === 'Follow topics and authors')
    .closest('div')
    .remove();
}

// Verge renders the dek twice, once per responsive layout container, and both are
// real paragraphs. Class-based matching is unusable here: the wrapper names are
// hashed per deploy, and the class the copies share is on every body paragraph
// too. Matching on identical text among the opening paragraphs is narrower.
const MIN_DEK_LENGTH = 40;
const OPENING_PARAGRAPHS = 4;

function stripDuplicateDek($: cheerio.CheerioAPI): void {
  const seen = new Set<string>();
  $('p')
    .slice(0, OPENING_PARAGRAPHS)
    .each((_, el) => {
      const text = $(el).text().replace(WHITESPACE_RUN_REGEX, ' ').trim();
      // short repeats are labels rather than a dek, and dropping one could lose
      // something real; only a substantial exact repeat is treated as the copy
      if (text.length < MIN_DEK_LENGTH) return;
      if (seen.has(text)) {
        $(el).remove();
        return;
      }
      seen.add(text);
    });
}

function polishVergeArticle(article: ArticleData): ArticleData {
  const $ = cheerio.load(article.content);
  stripDuplicateDek($);
  stripFollowTooltips($);
  stripFollowTopics($);
  stripLayoutRail($);
  stripFollowPrompt($);
  return { ...article, content: $('body').html() ?? article.content };
}

export const vergeRule: SiteRule = {
  polishArticle: polishVergeArticle,
};

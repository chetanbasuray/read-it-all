import * as cheerio from 'cheerio';
import type { ArticleData } from '../scraper';
import type { SiteRule } from './types';

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
    .filter((_, el) => /Posts from this (topic|author) will be added/.test($(el).text()))
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

function polishVergeArticle(article: ArticleData): ArticleData {
  const $ = cheerio.load(article.content);
  stripFollowTooltips($);
  stripFollowTopics($);
  stripLayoutRail($);
  stripFollowPrompt($);
  return { ...article, content: $('body').html() ?? article.content };
}

export const vergeRule: SiteRule = {
  polishArticle: polishVergeArticle,
};

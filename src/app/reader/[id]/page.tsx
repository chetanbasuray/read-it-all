import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Reader } from '@/components/Reader';
import { getArticleById, getArticleViews, getUrlForId } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// generateMetadata and the page component below both need the same article;
// cache() dedupes the two calls into a single Redis read per request
const getArticle = cache(getArticleById);

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const article = await getArticle(params.id);
  if (!article) {
    return { title: 'Article not found - Read It All' };
  }

  const description = article.excerpt || article.textContent?.slice(0, 200);

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      images: article.image ? [{ url: article.image }] : undefined,
      ...(article.byline ? { authors: [article.byline] } : {}),
    },
    twitter: {
      card: article.image ? 'summary_large_image' : 'summary',
      title: article.title,
      description,
      images: article.image ? [article.image] : undefined,
    },
  };
}

export default async function ReaderPage({
  params,
}: {
  params: { id: string };
}) {
  const article = await getArticle(params.id);

  if (!article) {
    const url = await getUrlForId(params.id);
    if (url) {
      redirect(`/reader/bypass?url=${encodeURIComponent(url)}`);
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">Article not found or expired</p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const views = await getArticleViews(params.id);

  return <Reader article={{ id: params.id, ...article, cached: true, views }} />;
}

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Report Content - Read It All',
};

export default function ReportPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-8 w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Report Content</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          For publishers and rights holders who want content removed
        </p>

        <div className="prose dark:prose-invert prose-gray max-w-none">
          <p>
            Read It All caches extracted article content so a shared link keeps working. If you are the
            publisher or rights holder of an article that was cached here and you would like it removed,
            please let us know and it will be taken down.
          </p>

          <h2>How to request removal</h2>
          <p>
            <a
              href="https://github.com/chetanbasuray/read-it-all/issues/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open an issue on GitHub
            </a>{' '}
            and include:
          </p>
          <ul>
            <li>The original article URL, or the whole domain if you want everything from your site excluded</li>
            <li>The Read It All link (the <code>/reader/...</code> URL), if you have it</li>
            <li>A brief statement that you are the publisher or rights holder, or represent them</li>
          </ul>
          <p>
            Requests are handled promptly. The corresponding cached content is deleted, and that URL (or
            domain, if requested) is added to a permanent removal list so it is not scraped again. The
            GitHub issue itself serves as the record of the request.
          </p>

          <h2>Search engines</h2>
          <p>
            Read It All&apos;s <code>robots.txt</code> already excludes every <code>/reader/...</code> page
            from search indexing, so this content is not intended to be discoverable outside of a direct
            link.
          </p>
        </div>
      </main>
    </div>
  );
}

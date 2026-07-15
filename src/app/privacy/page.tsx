import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - Read It All',
};

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: July 2026</p>

        <div className="prose dark:prose-invert prose-gray max-w-none">
          <p>
            Read It All is a small, personally run tool. It does not have user accounts, and it does not
            collect your name, email address, or any other information that directly identifies you.
            Here is what it does collect, and why.
          </p>

          <h2>Article URLs and content</h2>
          <p>
            When you paste an article URL, Read It All fetches that page and extracts its content so it can
            show you a clean reading view. It saves (&quot;caches&quot;) that extracted content so that the
            page loads instantly the next time anyone opens it, and so that a link you share keeps working
            even if the original page changes or disappears later. Cached content is kept for up to 60 days
            and is refreshed automatically if it looks out of date.
          </p>

          <h2>Your IP address, briefly</h2>
          <p>
            To stop the article-fetching feature from being abused, for example by a script sending
            thousands of requests a minute, Read It All temporarily counts how many requests come from your
            IP address. This count is deleted automatically after 60 seconds. There is no permanent log
            tying an IP address to what you read.
          </p>
          <p>
            Under data protection law (such as the EU&apos;s GDPR), an IP address counts as personal data.
            Read It All processes it only for this security purpose, which is a recognized legitimate
            interest, and only for as long as it takes to enforce the limit.
          </p>

          <h2>Cookies you provide for a site you already have access to</h2>
          <p>
            If you choose to paste in your own login cookies for a site you are already subscribed to, so
            that Read It All can fetch an article you already have the right to read, those cookies are used
            only for that one request. They are never saved, logged, or cached.
          </p>

          <h2>Basic, anonymous usage stats</h2>
          <p>
            Read It All uses Vercel Analytics to see roughly how many people use the site. It is cookie-free
            and does not track you individually or across other sites.
          </p>

          <h2>Do we share any of this?</h2>
          <p>No. Nothing described above is sold, rented, or shared with anyone else.</p>

          <h2>Questions</h2>
          <p>
            If anything here is unclear, or you have a concern, feel free to{' '}
            <a href="https://github.com/chetanbasuray/read-it-all/issues" target="_blank" rel="noopener noreferrer">
              open an issue on GitHub
            </a>
            .
          </p>

          <h2>Changes to this policy</h2>
          <p>This page may be updated as the service changes.</p>
        </div>
      </main>
    </div>
  );
}

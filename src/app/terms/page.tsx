import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms and Conditions - Read It All',
};

export default function TermsPage() {
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

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: July 2026</p>

        <div className="prose dark:prose-invert prose-gray max-w-none">
          <h2>What this is</h2>
          <p>
            Read It All lets you paste the URL of an article and view its extracted text in a clean,
            distraction-free reading view. It is a personal, hobby-run tool, not a commercial product.
          </p>

          <h2>Use it responsibly</h2>
          <p>
            Only use Read It All to read articles you already have a right to access, for example articles
            that are freely available, or ones from a publication you already subscribe to. Read It All does
            not grant you any legal right to content you would not otherwise be allowed to read, and you are
            responsible for how you use whatever it shows you.
          </p>

          <h2>No guarantees</h2>
          <p>
            The service is provided &quot;as is,&quot; with no promise that it will always work, be
            available, or successfully extract content from any particular website. Some sites actively
            block this kind of tool, and Read It All may not be able to access their content at all.
          </p>

          <h2>Acceptable use</h2>
          <p>
            Please do not use Read It All to overload or automate mass requests against the service, or
            against the websites it fetches from, or to try to get around its rate limits. Do not use it for
            anything illegal.
          </p>

          <h2>No liability</h2>
          <p>
            Read It All is not responsible for the accuracy of extracted content, for anything that happens
            as a result of using content extracted through it, or for the availability or behavior of the
            third-party websites it fetches from.
          </p>

          <h2>Content removal</h2>
          <p>
            If you are a publisher or rights holder and want content removed from Read It All&apos;s cache,
            see the <Link href="/report">Report Content</Link> page.
          </p>

          <h2>Changes</h2>
          <p>These terms may change as the service evolves.</p>

          <h2>Questions</h2>
          <p>
            If anything here is unclear, feel free to{' '}
            <a href="https://github.com/chetanbasuray/read-it-all/issues" target="_blank" rel="noopener noreferrer">
              open an issue on GitHub
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

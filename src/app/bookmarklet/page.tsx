'use client';

import { useEffect, useState } from 'react';

export default function BookmarkletPage() {
  const [appUrl, setAppUrl] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAppUrl(window.location.origin);
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const bookmarkletCode = `javascript:(function(){
  var u='${appUrl}/api/ingest';
  var d=JSON.stringify({url:location.href,html:document.documentElement.outerHTML});
  fetch(u,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:d})
  .then(function(){window.location.href='${appUrl}/reader/bypass?url='+encodeURIComponent(location.href)})
  .catch(function(e){alert('Error: '+e.message)})
})();`;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg mx-auto text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Bookmarklet
        </h1>

        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Drag the button below to your bookmarks bar. Then click it on any
          paywalled article page to open it in the reader.
        </p>

        <a
          href={bookmarkletCode}
          className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-base transition-colors cursor-grab active:cursor-grabbing select-none"
        >
          📖 Read in Reader
        </a>

        <div className="mt-8 text-left bg-gray-50 dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-sm">
            How to install
          </h2>
          <ol className="text-sm text-gray-500 dark:text-gray-400 space-y-2 list-decimal pl-4">
            <li>Make sure your bookmarks bar is visible (Cmd+Shift+B)</li>
            <li>
              Drag the &quot;Read in Reader&quot; button above to your bookmarks
              bar
            </li>
            <li>
              Navigate to any paywalled article (e.g. WSJ, NYT) and click the
              bookmarklet
            </li>
            <li>
              The article will open in the reader view &mdash; no scraping
              needed, it uses your browser&apos;s authenticated session
            </li>
          </ol>
        </div>

        <div className="mt-6 text-left bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-5 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            <strong>How it works:</strong> The bookmarklet sends the current
            page&apos;s HTML to <code className="text-xs font-mono">{appUrl}/api/ingest</code>,
            which extracts the article using Readability. Since it runs in your
            browser, all your cookies and session data are included &mdash; no
            DataDome blocking.
          </p>
        </div>
      </div>
    </div>
  );
}

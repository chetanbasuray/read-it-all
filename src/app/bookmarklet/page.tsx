'use client';

export default function BookmarkletPage() {
  const ingestUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const bookmarkletCode = `javascript:(function(){
  var url=encodeURIComponent(location.href);
  var u='${ingestUrl}/api/ingest';
  fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:location.href,html:document.documentElement.outerHTML})})
  .then(function(r){return r.json()})
  .then(function(d){if(d.id){window.open('${ingestUrl}/reader/'+d.id,'_blank')}else{alert('Could not extract article: '+d.error)}})
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
              Drag the <strong>&quot;Read in Reader&quot;</strong> button above
              to your bookmarks bar
            </li>
            <li>
              Navigate to any paywalled article (e.g. WSJ, NYT) and click the
              bookmarklet
            </li>
            <li>
              The article will open in the reader view — no scraping needed,
              it uses your browser&apos;s authenticated session
            </li>
          </ol>
        </div>

        <div className="mt-6 text-left bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-5 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            <strong>How it works:</strong> The bookmarklet sends the current
            page&apos;s HTML to the ingest API, which extracts the article
            using Readability. Since it runs in your browser, all your cookies
            and session data are included — no DataDome blocking.
          </p>
        </div>
      </div>
    </div>
  );
}

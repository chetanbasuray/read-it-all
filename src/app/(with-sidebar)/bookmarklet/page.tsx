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
  var A='${appUrl}';
  function ex(){
    var e=document.querySelector('article');
    if(e&&e.textContent.length>200)return e.innerHTML;
    var s=['[role="main"]','.article-content','.story-body','#article-body','.entry-content','.post-content','main'];
    for(var i=0;i<s.length;i++){e=document.querySelector(s[i]);if(e&&e.textContent.length>200)return e.innerHTML}
    var p='';e=document.querySelectorAll('p');
    for(i=0;i<e.length;i++)p+=e[i].outerHTML;
    return p.length>200?'<div>'+p+'</div>':null;
  }
  try{
    var c=ex();
    if(c){
      var t=c.replace(/<[^>]*>/g,'');
      var d=JSON.stringify({url:location.href,title:document.title,content:c,textContent:t,byline:'',excerpt:t.substring(0,200),image:''});
      if(d.length<90000){window.location.href=A+'/reader/accept#'+encodeURIComponent(d);return}
    }
  }catch(e){}
  fetch(A+'/api/ingest',{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify({url:location.href,html:document.documentElement.outerHTML})})
  .then(function(){window.location.href=A+'/reader/bypass?url='+encodeURIComponent(location.href)})
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
            <li>
              Make sure your bookmarks bar is visible (Ctrl+Shift+B on Windows/Linux,
              Cmd+Shift+B on Mac)
            </li>
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
            <strong>How it works:</strong> The bookmarklet extracts article
            content from the live page DOM and passes it to the reader via URL
            hash &mdash; no CORS issues, no DataDome blocking. For large
            articles it falls back to a background fetch. Since everything runs
            in your browser, your authenticated session is used.
          </p>
        </div>
      </div>
    </div>
  );
}

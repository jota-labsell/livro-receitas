"use client";
/** First observed origin in this browser session; never reconstruct historical attribution. */
export function operationAttribution() {
  const q = new URLSearchParams(location.search);
  const current = {
    source: q.get('utm_source') || (q.has('fbclid') ? 'meta' : document.referrer ? 'referencia' : 'direto'),
    medium: q.get('utm_medium'), campaign: q.get('utm_campaign'),
    content: q.get('utm_content'), term: q.get('utm_term'), landing: location.pathname,
  };
  try {
    const stored = sessionStorage.getItem('recipe-operation-origin');
    if (stored) return JSON.parse(stored) as typeof current;
    sessionStorage.setItem('recipe-operation-origin', JSON.stringify(current));
  } catch {}
  return current;
}

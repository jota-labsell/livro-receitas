"use client";
import { operationAttribution } from './operation-attribution-client';
import { visitId } from './analytics';
const clickPattern = /^[A-Za-z0-9_-]{8,500}$/;
const fbcPattern = /^fb\.\d{1,3}\.\d{10,13}\.[A-Za-z0-9_-]{1,500}$/;
function cookie(name: string) {
  try { return decodeURIComponent(document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || ''); }
  catch { return ''; }
}
/** Capture the real ad click before navigation; never invent a click identifier. */
export function metaAttribution() {
  let allowed = true;
  try { allowed = localStorage.getItem('recipe-ad-measurement') !== 'deny'; } catch {}
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) allowed = false;
  if (!allowed) return { allowed: false };
  let fbc = cookie('_fbc');
  try {
    const click = new URL(location.href).searchParams.get('fbclid');
    let saved: { click?: string; fbc?: string } | null = null;
    try { saved = JSON.parse(sessionStorage.getItem('recipe-meta-click') || 'null'); } catch {}
    if (click && clickPattern.test(click)) {
      fbc = saved?.click === click && fbcPattern.test(saved.fbc || '') ? saved.fbc! : `fb.1.${Date.now()}.${click}`;
      try { sessionStorage.setItem('recipe-meta-click', JSON.stringify({ click, fbc })); } catch {}
    } else if (!fbcPattern.test(fbc) && fbcPattern.test(saved?.fbc || '')) fbc = saved!.fbc!;
  } catch {}
  return { allowed: true, operation: {visitId:visitId(),attribution:operationAttribution()}, fbc: fbcPattern.test(fbc) ? fbc : undefined, fbp: cookie('_fbp') || undefined, sourceUrl: location.origin + location.pathname };
}

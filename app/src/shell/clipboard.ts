/** Copy text; plain-http LAN access has no navigator.clipboard, so fall back to execCommand. */
export async function copyText(text: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard) { await navigator.clipboard.writeText(text); return; }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { if (!document.execCommand('copy')) throw new Error('copy failed'); } finally { ta.remove(); }
}

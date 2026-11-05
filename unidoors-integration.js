/* Unidoors proof of concept. Load this script on the configurator page.
   Requires html-to-image (https://github.com/bubkoo/html-to-image).
   The door is captured only when the customer clicks the button.
   Keep all layers and pseudo-elements in #bigdoor. */
(function () {
  const VIEWER = 'https://xmiroslav.github.io/door-live-prototype/?v=18';
  const SCRIPT = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js';
  let loading;
  const mobileQuery = window.matchMedia('(max-width: 1024px) and (pointer: coarse)');
  function mobileAllowed() { return mobileQuery.matches; }
  function syncVisibility() {
    const button = document.getElementById('unidoors-ar-preview');
    if (button) { button.hidden = !mobileAllowed(); button.style.display = mobileAllowed() ? 'block' : 'none'; }
  }
  function loadLibrary() {
    if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT;
      s.onload = () => window.htmlToImage ? resolve(window.htmlToImage) : reject(new Error('Library unavailable'));
      s.onerror = () => reject(new Error('Could not load html-to-image'));
      document.head.appendChild(s);
    });
    return loading;
  }
  async function preview() {
    if (!mobileAllowed()) return;
    const target = document.getElementById('bigdoor');
    if (!target) { alert('Door element #bigdoor not found'); return; }
    // Open synchronously with the click so mobile browsers do not block the popup.
    const viewer = window.open(VIEWER, '_blank');
    if (!viewer) { alert('Please allow popups for Unidoors'); return; }
    const button = document.getElementById('unidoors-ar-preview');
    if (button) { button.disabled = true; button.textContent = 'מכין תצוגה…'; }
    try {
      const lib = await loadLibrary();
      const image = await lib.toPng(target, {
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        cacheBust: true,
        backgroundColor: 'transparent',
        filter: node => !(node instanceof Element && node.matches('.door-color-panel,.floorplace'))
      });
      let attempts = 0;
      const send = () => {
        if (viewer.closed || ++attempts > 40) return;
        viewer.postMessage({type:'unidoors-door-image',image}, 'https://xmiroslav.github.io');
        if (attempts < 40) setTimeout(send, 500);
      };
      send();
    } catch (error) {
      console.error('Unidoors door capture failed:', error);
      alert('לא ניתן להכין את הדלת לתצוגה. בדוק תמונות חיצוניות ו-CORS.');
      viewer.close();
    } finally {
      if (button) { button.disabled = false; button.textContent = 'הצג את הדלת בבית שלי'; }
    }
  }
  function init() {
    if (document.getElementById('unidoors-ar-preview')) { syncVisibility(); return; }
    const target = document.querySelector('.resultdoor') || document.querySelector('.greydoorplace.parentgrid1') || document.getElementById('bigdoor')?.parentElement;
    if (!target || !document.getElementById('bigdoor')) return;
    const button = document.createElement('button');
    button.id = 'unidoors-ar-preview';
    button.type = 'button';
    button.textContent = 'הצג את הדלת בבית שלי';
    button.hidden = true;
    button.style.cssText = 'display:none;margin:12px auto;padding:13px 22px;border:0;border-radius:9px;background:#167ba4;color:#fff;font:600 16px Arial;cursor:pointer';
    button.addEventListener('click', preview);
    target.appendChild(button);
    syncVisibility();
  }
  mobileQuery.addEventListener?.('change', syncVisibility);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // The configurator may render the selected door after initial page load.
  let attempts = 0;
  const timer = setInterval(() => { init(); if (document.getElementById('unidoors-ar-preview') || ++attempts >= 40) clearInterval(timer); }, 500);
})();

/* Unidoors proof of concept. Load this script on the configurator page.
   Requires html-to-image (https://github.com/bubkoo/html-to-image).
   The door is captured only when the customer clicks the button.
   Keep all layers and pseudo-elements in #bigdoor. */
(function () {
  const VIEWER = 'https://xmiroslav.github.io/door-live-prototype/?v=38&return=' + encodeURIComponent(window.location.href);
  const SCRIPT = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js';
  let loading;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function settleDoor(target) {
    await document.fonts?.ready;
    const images = Array.from(target.querySelectorAll('img'));
    await Promise.all(images.map(img => img.decode ? img.decode().catch(()=>{}) : Promise.resolve()));
    await new Promise(resolve => requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }
  function captureFilter(node) {
    return !(node instanceof Element && node.id==='unidoors-ar-preview');
  }
  async function captureExactDoor(lib,target) {
    await settleDoor(target);
    const options={pixelRatio:Math.min(4,Math.max(3,window.devicePixelRatio||3)),cacheBust:true,backgroundColor:'transparent',filter:captureFilter,skipAutoScale:false};
    let result=await lib.toPng(target,options);
    const probe=new Image();probe.src=result;await probe.decode();
    const check=document.createElement('canvas');check.width=probe.naturalWidth;check.height=probe.naturalHeight;
    const context=check.getContext('2d',{willReadFrequently:true});context.drawImage(probe,0,0);
    const pixels=context.getImageData(0,0,check.width,check.height).data;
    let occupied=0;for(let i=3;i<pixels.length;i+=64)if(pixels[i]>40)occupied++;
    if(occupied<100)throw new Error('Captured door is blank');
    return result;
  }
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
      const image = await captureExactDoor(lib,target);
      // Send after viewer loads; mobile Safari can defer opening the new tab.
      let attempts = 0;
      const send = () => {
        if (viewer.closed || ++attempts > 35) return;
        viewer.postMessage({type:'unidoors-door-image',image}, 'https://xmiroslav.github.io');
        if (attempts < 35) setTimeout(send, 550);
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
    button.style.cssText = 'display:none;margin:12px auto;padding:13px 22px;border:0;border-radius:30px;background:#CD8080;color:#fff;font:600 16px Arial;cursor:pointer';
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

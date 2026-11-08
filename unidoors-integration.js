/* Unidoors proof of concept. Load this script on the configurator page.
   Requires html-to-image (https://github.com/bubkoo/html-to-image).
   The door is captured only when the customer clicks the button.
   Keep all layers and pseudo-elements in #bigdoor. */
(function () {
  const VIEWER = 'https://xmiroslav.github.io/door-live-prototype/?v=79&return=' + encodeURIComponent(window.location.href);
  const SCRIPT = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js';
  let loading;
  const buttonLabel='הדלת אצלי בבית';
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
    if (button) { button.hidden = !mobileAllowed(); button.style.display = mobileAllowed() ? 'flex' : 'none'; }
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
    // Same-tab iframe avoids Safari suspending the source tab and severing window.opener.
    document.getElementById('unidoors-live-overlay')?.remove();
    const overlay=document.createElement('div');overlay.id='unidoors-live-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#fff';
    const viewer=document.createElement('iframe');viewer.src=VIEWER;
    viewer.allow='camera; microphone';viewer.setAttribute('allowfullscreen','');
    viewer.style.cssText='display:block;width:100%;height:100%;border:0';
    overlay.appendChild(viewer);document.body.appendChild(overlay);
    const oldOverflow=document.documentElement.style.overflow;
    document.documentElement.style.overflow='hidden';
    const close=()=>{overlay.remove();document.documentElement.style.overflow=oldOverflow;window.removeEventListener('message',onMessage)};
    const onMessage=e=>{
      if(e.source!==viewer.contentWindow||e.origin!=='https://xmiroslav.github.io')return;
      if(e.data?.type==='unidoors-viewer-close')close();
    };
    window.addEventListener('message',onMessage);
    const button = document.getElementById('unidoors-ar-preview');
    if (button) { button.disabled = true; button.textContent = '…'; }
    try {
      const lib = await loadLibrary();
      const image = await captureExactDoor(lib,target);
      const transferId=String(Date.now())+'-'+Math.random().toString(36).slice(2);
      let acknowledged=false,attempts=0;
      const payload={type:'unidoors-door-image',image,transferId};
      const send=()=>{if(!acknowledged&&overlay.isConnected)viewer.contentWindow?.postMessage(payload,'https://xmiroslav.github.io')};
      const onTransfer=e=>{
        if(e.source!==viewer.contentWindow||e.origin!=='https://xmiroslav.github.io')return;
        if(e.data?.type==='unidoors-door-ack'&&e.data.transferId===transferId){acknowledged=true;window.removeEventListener('message',onTransfer)}
        if(e.data?.type==='unidoors-viewer-ready')send();
      };
      window.addEventListener('message',onTransfer);
      const retry=()=>{if(acknowledged||!overlay.isConnected||++attempts>90){window.removeEventListener('message',onTransfer);return}send();setTimeout(retry,500)};
      viewer.addEventListener('load',send);retry();
    } catch (error) {
      console.error('Unidoors door capture failed:', error);
      alert('לא ניתן להכין את הדלת לתצוגה. בדוק תמונות חיצוניות ו-CORS.');
      close();
    } finally {
      if (button) { button.disabled = false; button.innerHTML = '<span style="font-size:13px;line-height:1.25;font-weight:700;text-align:center;display:block;width:100%">'+buttonLabel+'</span>'; }
    }
  }
  function init() {
    if (document.getElementById('unidoors-ar-preview')) { syncVisibility(); return; }
    if (!document.getElementById('bigdoor')) return;
    const button = document.createElement('button');
    button.id = 'unidoors-ar-preview';
    button.type = 'button';
    button.innerHTML = '<span style="font-size:12px;line-height:1.3;font-weight:700">'+buttonLabel+'</span>';
    button.setAttribute('aria-label', 'הצג את הדלת בבית שלי');
    button.title = 'הצג את הדלת בבית שלי';
    button.hidden = true;
    button.style.cssText = 'display:none;position:fixed;right:max(18px,env(safe-area-inset-right));bottom:calc(104px + env(safe-area-inset-bottom));z-index:2147483000;width:78px;height:78px;padding:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-align:center;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:#369b72;color:#fff;font:700 13px Arial;line-height:1;box-shadow:0 6px 20px rgba(20,92,64,.25);cursor:pointer;touch-action:manipulation;direction:rtl';
    button.addEventListener('click', preview);
    document.body.appendChild(button);
    syncVisibility();
  }
  mobileQuery.addEventListener?.('change', syncVisibility);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // The configurator may render the selected door after initial page load.
  let attempts = 0;
  const timer = setInterval(() => { init(); if (document.getElementById('unidoors-ar-preview') || ++attempts >= 40) clearInterval(timer); }, 500);
})();

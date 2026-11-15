/* Unidoors proof of concept. Load this script on the configurator page.
   Requires html-to-image (https://github.com/bubkoo/html-to-image).
   The door is captured only when the customer clicks the button.
   Keep all layers and pseudo-elements in #bigdoor. */
(function () {
  const VIEWER = 'https://door-live-ai-trial-miro-91.duskyfalcon1.chatgpt.site/?v=95&return=' + encodeURIComponent(window.location.href);
  const SCRIPT = 'https://cdn.jsdelivr.net/npm/html2canvas-pro@2.6.4/dist/html2canvas-pro.min.js';
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
  // Targeted TEST ONLY: normalize the grid16 mask's CSS zoom in the cloned DOM.
  function cssUrl(value) {
    const m = /^url\(["']?(.*?)["']?\)$/.exec(value);
    if (!m) throw new Error('Unsupported image layer');
    return m[1];
  }
  function loadImage(url) {
    return new Promise((resolve,reject)=>{
      const im=new Image(); im.onload=()=>resolve(im); im.onerror=()=>reject(new Error('Door asset unavailable')); im.src=url;
    });
  }
  function scalePosition(value, factor) {
    return value.replace(/(-?\d*\.?\d+)px/g,(_,n)=>(Number(n)*factor)+'px');
  }
  async function captureExactDoor(lib,target) {
    await settleDoor(target);
    const grid=target.querySelector('#gridfront.grid16 > div, #gridfront.grid16a > div');
    let normalise=null;
    if(grid){
      const glass=grid.querySelector('#glass');
      if(!glass)throw new Error('Missing door glass');
      const gs=getComputedStyle(grid), gl=getComputedStyle(glass);
      const zoom=parseFloat(gs.zoom)||1;
      if(gs.maskRepeat!=='no-repeat'||gs.maskSize!=='auto'||gl.backgroundSize!=='auto') throw new Error('Unsupported grid16 styles');
      const [maskImage, glassImage]=await Promise.all([loadImage(cssUrl(gs.maskImage)),loadImage(cssUrl(gl.backgroundImage))]);
      normalise={w:parseFloat(gs.width)*zoom,h:parseFloat(gs.height)*zoom,
        maskSize:(maskImage.naturalWidth*zoom)+'px '+(maskImage.naturalHeight*zoom)+'px',
        maskPosition:scalePosition(gs.maskPosition,zoom),
        glassSize:(glassImage.naturalWidth*zoom)+'px '+(glassImage.naturalHeight*zoom)+'px',
        glassPosition:scalePosition(gl.backgroundPosition,zoom)};
    }
    const result=await lib(target,{scale:2,backgroundColor:null,logging:false,onclone:doc=>{
      if(!normalise)return;
      const g=doc.querySelector('#bigdoor #gridfront.grid16 > div, #bigdoor #gridfront.grid16a > div');
      if(!g)throw new Error('Could not find cloned door');
      const glass=g.querySelector('#glass');
      Object.assign(g.style,{zoom:'1',width:normalise.w+'px',height:normalise.h+'px',maskSize:normalise.maskSize,maskPosition:normalise.maskPosition,webkitMaskSize:normalise.maskSize,webkitMaskPosition:normalise.maskPosition});
      Object.assign(glass.style,{backgroundSize:normalise.glassSize,backgroundPosition:normalise.glassPosition});
    }});
    if(!result.width||!result.height)throw new Error('Captured door is blank');
    return result.toDataURL('image/png');
  }
  const mobileQuery = window.matchMedia('(max-width: 1024px) and (pointer: coarse)');
  function mobileAllowed() { return mobileQuery.matches; }
  function syncVisibility() {
    const button = document.getElementById('unidoors-ar-preview');
    if (button) { button.hidden = !mobileAllowed(); button.style.display = mobileAllowed() ? 'flex' : 'none'; }
  }
  function loadLibrary() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT;
      s.onload = () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error('Library unavailable'));
      s.onerror = () => reject(new Error('Could not load html-to-image'));
      document.head.appendChild(s);
    });
    return loading;
  }
  async function preview() {
    if (!mobileAllowed()) return;
    const target=document.getElementById('bigdoor');
    if(!target){alert('לא נמצאה הדלת לתצוגה');return}
    const popup=window.open(VIEWER,'_blank');
    if(!popup){alert('יש לאפשר פתיחת חלון בדפדפן ולנסות שוב');return}
    const button=document.getElementById('unidoors-ar-preview');
    if(button){button.disabled=true;button.textContent='…'}
    let image=null, acknowledged=false, attempts=0;
    const targetOrigin='https://door-live-ai-trial-miro-91.duskyfalcon1.chatgpt.site';
    const transferId=String(Date.now())+'-'+Math.random().toString(36).slice(2);
    const send=()=>{if(image&&!acknowledged&&!popup.closed)popup.postMessage({type:'unidoors-door-image',image,transferId},targetOrigin)};
    const onMessage=e=>{
      if(e.source!==popup||e.origin!==targetOrigin)return;
      if(e.data?.type==='unidoors-viewer-ready')send();
      if(e.data?.type==='unidoors-door-ack'&&e.data.transferId===transferId){acknowledged=true;window.removeEventListener('message',onMessage)}
    };
    window.addEventListener('message',onMessage);
    try{
      const lib=await loadLibrary();image=await captureExactDoor(lib,target);send();
      const retry=()=>{if(acknowledged||popup.closed||++attempts>240){window.removeEventListener('message',onMessage);if(!acknowledged&&!popup.closed)console.warn('Door Live transfer not acknowledged');return}send();setTimeout(retry,500)};
      retry();
    }catch(error){console.error('Door capture failed:',error);window.removeEventListener('message',onMessage);alert('לא ניתן להכין את הדלת לתצוגה');}
    finally{if(button){button.disabled=false;button.textContent=buttonLabel}}
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

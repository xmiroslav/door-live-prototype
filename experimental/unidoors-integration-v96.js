/* Experimental capture for Unidoors: the live configurator is never modified. */
(function(root){
'use strict';
function zoomTransform(zoom, transform){
 const value=Number.parseFloat(zoom);
 if(!Number.isFinite(value)||value<=0||Math.abs(value-1)<0.00001)return null;
 return 'scale('+value+')'+(transform&&transform!=='none'?' '+transform:'');
}
if(typeof module!=='undefined'&&module.exports)module.exports={zoomTransform};
if(!root||!root.document)return;
const VIEWER='https://door-live-ai-trial-miro-91.duskyfalcon1.chatgpt.site';
const LIBRARY='https://cdn.jsdelivr.net/npm/html2canvas-pro@2.6.4/dist/html2canvas-pro.min.js';
let libraryPromise;
function loadLibrary(){
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
  const previous=root.html2canvas,s=document.createElement('script');s.src=LIBRARY;
  s.onload=()=>{const renderer=root.html2canvas;if(previous===undefined)delete root.html2canvas;else root.html2canvas=previous;renderer&&renderer!==previous?resolve(renderer):reject(Error('לא ניתן לטעון את כלי יצירת התמונה'))};
  s.onerror=()=>reject(Error('לא ניתן לטעון את כלי יצירת התמונה'));document.head.appendChild(s)
 }).catch(e=>{libraryPromise=null;throw e});
 return libraryPromise;
}
async function captureDoor(target){
 if(!target||!target.isConnected||!target.offsetWidth||!target.offsetHeight)throw Error('הדלת שנבחרה אינה זמינה');
 await document.fonts?.ready;
 await Promise.all(Array.from(target.querySelectorAll('img'),img=>img.decode?img.decode().catch(()=>{}):Promise.resolve()));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const render=await loadLibrary();
 const output=await render(target,{backgroundColor:null,scale:Math.min(3,Math.max(2,root.devicePixelRatio||1)),useCORS:true,logging:false,onclone:(doc,copy)=>{
  copy.style.setProperty('zoom','1','important');
  for(const el of [copy,...copy.querySelectorAll('*')]){
   const s=doc.defaultView.getComputedStyle(el);
   const mask=s.maskImage||s.webkitMaskImage;
   if(!mask||mask==='none')continue;
   const transform=zoomTransform(s.zoom,s.transform);
   if(transform){el.style.setProperty('zoom','1','important');el.style.setProperty('transform-origin','center center','important');el.style.setProperty('transform',transform,'important')}
  }
 }});
 if(!output.width||!output.height)throw Error('לא ניתן ליצור תמונת דלת');
 return output.toDataURL('image/png');
}
root.UnidoorsCaptureTest={captureDoor};
function init(){
 const target=document.getElementById('bigdoor');if(!target||document.getElementById('unidoors-ar-preview'))return;
 const button=document.createElement('button');button.id='unidoors-ar-preview';button.type='button';button.textContent='הדלת אצלי בבית';button.style.cssText='position:fixed;right:18px;bottom:120px;z-index:2147483000;width:82px;height:82px;border-radius:50%;border:0;color:white;background:#369b72;font-weight:bold;padding:8px';
 button.addEventListener('click',async()=>{
  if(button.disabled)return;button.disabled=true;button.textContent='מכין תמונה…';
  try{
   const image=await captureDoor(document.getElementById('bigdoor'));
   const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#fff';
   const viewer=document.createElement('iframe');const url=new URL(VIEWER+'/');url.searchParams.set('v','96');url.searchParams.set('return',location.href);viewer.src=url.href;viewer.allow='camera';viewer.style.cssText='display:block;width:100%;height:100%;border:0';overlay.append(viewer);const exit=document.createElement('button');exit.type='button';exit.textContent='✕';exit.setAttribute('aria-label','סגירה');exit.style.cssText='position:absolute;top:8px;left:8px;z-index:2;background:#fff;color:#173c3a;border:1px solid #ddd;border-radius:50%;width:38px;height:38px;font-size:20px';overlay.append(exit);document.body.append(overlay);
   const oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
   const transferId=String(Date.now())+'-'+Math.random().toString(36).slice(2);let acknowledged=false;let timer;
   function close(){clearInterval(timer);window.removeEventListener('message',onMessage);overlay.remove();document.documentElement.style.overflow=oldOverflow}
   exit.onclick=close;
   function send(){if(overlay.isConnected&&!acknowledged)viewer.contentWindow?.postMessage({type:'unidoors-door-image',image,transferId},VIEWER)}
   function onMessage(e){if(e.origin!==VIEWER||e.source!==viewer.contentWindow||!e.data)return;if(e.data.type==='unidoors-viewer-close'){close();return}if(e.data.type==='unidoors-door-ack'&&e.data.transferId===transferId){acknowledged=true;clearInterval(timer)}if(e.data.type==='unidoors-viewer-ready')send()}
   window.addEventListener('message',onMessage);viewer.addEventListener('load',send);timer=setInterval(send,1000);
  }catch(error){alert('לא ניתן להכין תמונת דלת: '+error.message)}
  finally{button.disabled=false;button.textContent='הדלת אצלי בבית'}
 });document.body.append(button);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window==='undefined'?null:window);

(function (global) {
  'use strict';
  function cssMatrix(width, height, q) {
    if (!(width > 0 && height > 0) || !Array.isArray(q) || q.length !== 4 || q.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v)))) return null;
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a=q[i], b=q[(i+1)%4], c=q[(i+2)%4];
      const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
      if (Math.abs(cross)<1e-7 || (sign && Math.sign(cross)!==sign)) return null;
      sign=Math.sign(cross);
    }
    const [p0,p1,p2,p3]=q;
    const dx1=p1[0]-p2[0], dy1=p1[1]-p2[1], dx2=p3[0]-p2[0], dy2=p3[1]-p2[1];
    const dx3=p0[0]-p1[0]+p2[0]-p3[0], dy3=p0[1]-p1[1]+p2[1]-p3[1];
    const det=dx1*dy2-dx2*dy1;
    if(Math.abs(det)<1e-8)return null;
    const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;
    const a=(p1[0]-p0[0]+g*p1[0])/width,b=(p3[0]-p0[0]+h*p3[0])/height;
    const d=(p1[1]-p0[1]+g*p1[1])/width,e=(p3[1]-p0[1]+h*p3[1])/height;
    return [a,d,0,g/width,b,e,0,h/height,0,0,1,0,p0[0],p0[1],0,1];
  }
  if(typeof module!=='undefined'&&module.exports) module.exports={cssMatrix};
  else global.DoorDomGeometry={cssMatrix};
})(typeof globalThis!=='undefined'?globalThis:this);
/* Experimental DOM copy: computed styles and native CSS masks remain in the browser. */
(function(global){
'use strict';
// Keep the snapshot stable even when the configurator's own stylesheet has
// more specific selectors or important rules for its layers and masks.
function declarations(s){let text='';for(let i=0;i<s.length;i++){const p=s[i],v=s.getPropertyValue(p);if(v)text+=p+':'+v+' !important;'}return text}
function copyDoor(source){
 if(!source||!source.isConnected)throw new Error('Door is unavailable');
 const clone=source.cloneNode(true), original=[source,...source.querySelectorAll('*')], copies=[clone,...clone.querySelectorAll('*')];
 const token='dl'+Math.random().toString(36).slice(2),rules=[];
 for(let i=0;i<original.length;i++){
  const node=original[i],copy=copies[i];copy.setAttribute('data-door-copy',token+'-'+i);
  const computed=getComputedStyle(node);copy.style.cssText=declarations(computed);copy.style.setProperty('pointer-events','none','important');
  copy.style.setProperty('animation','none','important');copy.style.setProperty('transition','none','important');
  for(const pseudo of ['::before','::after']){
   const s=getComputedStyle(node,pseudo);if(!s.content||s.content==='none'||s.content==='normal')continue;
   rules.push('[data-door-copy="'+token+'-'+i+'"]'+pseudo+'{'+declarations(s)+'}');
  }
 }
 clone.removeAttribute('id');
 clone.setAttribute('aria-hidden','true');
 clone.style.setProperty('margin','0','important');
 clone.style.setProperty('position','absolute','important');
 clone.style.setProperty('left','0','important');clone.style.setProperty('top','0','important');
 clone.style.setProperty('transform-origin','0 0','important');
 clone.style.setProperty('pointer-events','none','important');
 const style=document.createElement('style');style.textContent=rules.join('\n');
 const container=document.createElement('div');container.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden';container.append(style,clone);
 return {container,clone,width:source.offsetWidth,height:source.offsetHeight};
}
global.DoorDomSnapshot={copyDoor};
})(window);
(function(){
 'use strict';
 const viewerOrigin='https://door-live-ai-trial-miro-91.duskyfalcon1.chatgpt.site';
 const buttonId='unidoors-ar-dom-test';
 function open(){
  const door=document.getElementById('bigdoor');if(!door){alert('הדלת אינה זמינה');return}
  const snapshot=window.DoorDomSnapshot.copyDoor(door);
  if(!snapshot.width||!snapshot.height){alert('לא ניתן להציג את הדלת');return}
  const shell=document.createElement('div');shell.style.cssText='position:fixed;inset:0;z-index:2147483646;background:white';
  const frame=document.createElement('iframe');const url=new URL(viewerOrigin+'/dom.html');url.searchParams.set('dom','1');url.searchParams.set('return',location.href);frame.src=url.href;
  frame.setAttribute('allow','camera');frame.style.cssText='width:100%;height:100%;border:0;display:block';shell.append(frame);document.body.append(shell,snapshot.container);
  const guides=document.createElementNS('http://www.w3.org/2000/svg','svg');guides.setAttribute('width','100%');guides.setAttribute('height','100%');guides.style.cssText='position:absolute;inset:0;pointer-events:none';snapshot.container.append(guides);snapshot.container.style.display='none';const oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
  const close=()=>{window.removeEventListener('message',onMessage);shell.remove();snapshot.container.remove();document.documentElement.style.overflow=oldOverflow};
  function onMessage(event){
   if(event.source!==frame.contentWindow||event.origin!==viewerOrigin||!event.data||typeof event.data!=='object')return;
   if(event.data.type==='unidoors-viewer-close'){close();return}
   if(event.data.type!=='unidoors-dom-corners')return;
   if(event.data.visible!==true){snapshot.container.style.display='none';return}
   const r=frame.getBoundingClientRect();
   if(!Array.isArray(event.data.corners)||event.data.corners.length!==4)return;
   const q=event.data.corners.map(p=>Array.isArray(p)&&p.length===2?[p[0]+r.left,p[1]+r.top]:[NaN,NaN]);
   const matrix=window.DoorDomGeometry.cssMatrix(snapshot.width,snapshot.height,q);
   if(!matrix){snapshot.container.style.display='none';return}
   snapshot.clone.style.setProperty('transform','matrix3d('+matrix.join(',')+')','important');
   guides.replaceChildren();
   if(event.data.editing===true){const border=document.createElementNS('http://www.w3.org/2000/svg','polygon');border.setAttribute('points',q.map(p=>p.join(',')).join(' '));border.setAttribute('fill','none');border.setAttribute('stroke','#cd8080');border.setAttribute('stroke-width','3');border.setAttribute('stroke-dasharray','7 5');guides.append(border);for(const p of q){const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',p[0]);c.setAttribute('cy',p[1]);c.setAttribute('r','12');c.setAttribute('fill','white');c.setAttribute('stroke','#cd8080');c.setAttribute('stroke-width','3');guides.append(c)}}
   snapshot.container.style.display='block';
  }
  window.addEventListener('message',onMessage);
 }
 function init(){if(document.getElementById(buttonId)||!document.getElementById('bigdoor'))return;const b=document.createElement('button');b.id=buttonId;b.type='button';b.textContent='בדיקת דלת בבית';b.style.cssText='position:fixed;right:18px;bottom:120px;z-index:2147483000;width:78px;height:78px;border-radius:50%;border:0;color:white;background:#369b72;font-weight:bold';b.addEventListener('click',open);document.body.append(b)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();


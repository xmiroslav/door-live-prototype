'use strict';
let last=null,streak=0;
self.onmessage=e=>{
 const {id,buffer,w,h,target,still}=e.data;
 const gray=new Uint8Array(buffer),W=w+1,iv=new Float32Array(W*(h+1)),ih=new Float32Array(W*(h+1));
 for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){
  const xx=x-1,yy=y-1,i=yy*w+xx,k=y*W+x;
  const vx=xx>2&&xx<w-3?Math.abs(gray[i+2]-gray[i-2]):0;
  const hy=yy>2&&yy<h-3?Math.abs(gray[i+2*w]-gray[i-2*w]):0;
  iv[k]=vx+iv[k-1]+iv[k-W]-iv[k-W-1];ih[k]=hy+ih[k-1]+ih[k-W]-ih[k-W-1];
 }
 const sum=(a,x1,y1,x2,y2)=>{x1=Math.max(0,x1|0);x2=Math.min(w,x2|0);y1=Math.max(0,y1|0);y2=Math.min(h,y2|0);return a[y2*W+x2]-a[y1*W+x2]-a[y2*W+x1]+a[y1*W+x1]};
 const v=(x,y1,y2)=>sum(iv,x-2,y1,x+3,y2)/Math.max(1,5*(y2-y1));
 const hor=(y,x1,x2)=>sum(ih,x1,y-2,x2,y+3)/Math.max(1,5*(x2-x1));
 let best=null,score=-1e10,quality=0;
 for(let top=14;top<h*.48;top+=8)for(let width=40;width<=Math.min(w*.72,126);width+=8){
  for(const aspect of [1.85,2.05,2.25]){
   const height=width*aspect,bottom=top+height;if(bottom>h-7)continue;
   for(let left=7;left+width<w-7;left+=8){
    const right=left+width,vl=v(left,top,bottom),vr=v(right,top,bottom),lintel=hor(top,left,right);
    const cx=target?target[0]:w*.5,cy=target?target[1]:h*.5;
    const distance=Math.hypot((left+width/2-cx)*1.1,((top+bottom)/2-cy)*.85);
    if(target&&(cx<left||cx>right||cy<top||cy>bottom))continue;
    const continuity=Math.min(v(left,top,top+height*.4),v(left,top+height*.6,bottom))+Math.min(v(right,top,top+height*.4),v(right,top+height*.6,bottom));
    const q=Math.min(vl,vr,lintel);
    const s=2*Math.min(vl,vr)+.7*(vl+vr)+1.3*lintel+.45*continuity+q*1.5-distance*(target?2.2:.32);
    if(s>score){score=s;quality=q;best=[left,top,right,bottom]}
   }
  }
 }
 if(!best||quality<(target?10:17)){last=null;streak=0;self.postMessage({id,best:null,quality});return}
 if(last&&Math.hypot(...best.map((x,i)=>x-last[i]))<18)streak++;else streak=1;
 last=best;self.postMessage({id,best,quality,stable:!!still||streak>=3});
};
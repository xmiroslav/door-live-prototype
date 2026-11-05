'use strict';
let last=null,streak=0,lastEpoch=null;
self.onmessage=e=>{
 const {id,epoch,mode,buffer,w,h,target,still}=e.data;
 if(epoch!==lastEpoch){last=null;streak=0;lastEpoch=epoch}
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

 // Fit two independent jamb lines and the lintel to local image gradients.
 // This permits slanted sides and a sloped top in oblique photographs.
 const edgeX=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<3||x>=w-3||y<3||y>=h-3)return 0;return Math.abs(gray[y*w+x+2]-gray[y*w+x-2])};
 const edgeY=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<3||x>=w-3||y<3||y>=h-3)return 0;return Math.abs(gray[(y+2)*w+x]-gray[(y-2)*w+x])};
 const fitSide=(x0,y0,y1)=>{
  let optimum=null;
  for(let shift=-12;shift<=12;shift+=3)for(let tilt=-.22;tilt<=.22;tilt+=.035){
   let sum=0,valid=0;
   for(let j=1;j<=14;j++){const t=j/15,y=y0+(y1-y0)*t,x=x0+shift+tilt*(y-(y0+y1)/2);const v=edgeX(x,y);sum+=Math.min(v,100);if(v>12)valid++}
   const value=sum/14+valid*1.8-Math.abs(shift)*.5-Math.abs(tilt)*12;
   if(!optimum||value>optimum.value)optimum={x:x0+shift,tilt,value,valid};
  }
  return optimum;
 };
 const fitTop=(y0,x0,x1)=>{
  let optimum=null;
  for(let shift=-10;shift<=10;shift+=2)for(let tilt=-.18;tilt<=.18;tilt+=.03){
   let sum=0,valid=0;
   for(let j=1;j<=12;j++){const t=j/13,x=x0+(x1-x0)*t,y=y0+shift+tilt*(x-(x0+x1)/2);const v=edgeY(x,y);sum+=Math.min(v,100);if(v>12)valid++}
   const value=sum/12+valid*1.8-Math.abs(shift)*.6-Math.abs(tilt)*12;
   if(!optimum||value>optimum.value)optimum={y:y0+shift,tilt,value,valid};
  }
  return optimum;
 };
 const refineQuad=rect=>{
  const [l,t,r,b]=rect,left=fitSide(l,t,b),right=fitSide(r,t,b),top=fitTop(t,l,r);
  if(!left||!right||!top||left.valid<5||right.valid<5||top.valid<4)return null;
  const midY=(t+b)/2,midX=(l+r)/2;
  const intersection=side=>{
   const slope=side.tilt,k=top.tilt;
   const y=(top.y+k*(side.x-midX)+k*slope*midY)/(1-k*slope);
   const x=side.x+slope*(y-midY);
   return [x,y];
  };
  const tl=intersection(left),tr=intersection(right);
  const bl=[left.x+left.tilt*(b-midY),b],br=[right.x+right.tilt*(b-midY),b];
  const quad=[tl,tr,br,bl];
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  if(quad.some(p=>!p.every(Number.isFinite))||quad[1][0]-quad[0][0]<25||quad[2][0]-quad[3][0]<20)return null;
  if(!quad.every((p,i)=>cross(p,quad[(i+1)%4],quad[(i+2)%4])>0))return null;
  return quad;
 };
 if(!best||quality<(target?10:17)){last=null;streak=0;self.postMessage({id,epoch,mode,best:null,quality});return}
 if(last&&Math.hypot(...best.map((x,i)=>x-last[i]))<18)streak++;else streak=1;
 last=best;const quad=refineQuad(best);self.postMessage({id,epoch,mode,best,quad,quality,stable:!!still||streak>=3});
};
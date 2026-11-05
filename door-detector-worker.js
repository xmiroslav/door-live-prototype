'use strict';
let last=null,streak=0,lastEpoch=null;
self.onmessage=e=>{
 const {id,epoch,mode,buffer,w,h,target,still}=e.data;
 if(epoch!==lastEpoch){last=null;streak=0;lastEpoch=epoch}
 // Dedicated still-photo detector: line segments, not brute-force rectangles.
 // Work in the original letterboxed image coordinates, with no crop.
 if(mode==='photo'){
  const gray=new Uint8Array(buffer),gx=new Uint8Array(w*h),gy=new Uint8Array(w*h);
  // The upload uses neutral-gray letterboxing; restrict all search to actual pixels.
  let x0=w,y0=h,x1=0,y1=0;
  for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){
   const i=y*w+x;
   gx[i]=Math.min(255,Math.abs(gray[i+2]-gray[i-2]));
   gy[i]=Math.min(255,Math.abs(gray[i+2*w]-gray[i-2*w]));
   if(gray[i]!==127){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
  }
  if(x1<=x0||y1<=y0){self.postMessage({id,epoch,mode,best:null,quality:0});return}
  const iw=x1-x0,ih=y1-y0,valid=(x,y)=>x>=x0+3&&x<=x1-3&&y>=y0+3&&y<=y1-3;
  const edge=(x,y,vertical)=>{
   x=Math.round(x);y=Math.round(y);if(!valid(x,y))return 0;
   const arr=vertical?gx:gy,i=y*w+x;
   return Math.max(arr[i],arr[i-1],arr[i+1],arr[i-w],arr[i+w]);
  };
  const measure=(p,q,vertical)=>{
   let sum=0,hits=0,thirds=[0,0,0];
   for(let j=0;j<30;j++){
    const t=(j+.5)/30,x=p[0]*(1-t)+q[0]*t,y=p[1]*(1-t)+q[1]*t;
    const v=edge(x,y,vertical);sum+=Math.min(v,110);
    if(v>13){hits++;thirds[Math.floor(j/10)]++}
   }
   return {value:sum/30,coverage:hits/30,parts:thirds.filter(v=>v>=3).length};
  };
  // Detect long jambs first. Interior windows, furniture and second-room doors
  // may be stronger locally but should lose to the complete foreground frame.
  const candidates=[];
  const dx=Math.max(3,Math.round(iw/85)),dy=Math.max(4,Math.round(ih/95));
  const yTopMax=y0+ih*.58;
  for(let top=y0+6;top<yTopMax;top+=dy*2){
   for(let bottom=y1-5;bottom>top+ih*.38;bottom-=dy*2){
    const height=bottom-top;
    const sides=[];
    for(let x=x0+6;x<x1-6;x+=dx){
     for(const slope of [-.27,-.18,-.09,0,.09,.18,.27]){
      const p=[x-slope*height/2,top],q=[x+slope*height/2,bottom];
      if(!valid(p[0],top)||!valid(q[0],bottom))continue;
      const e=measure(p,q,true);
      if(e.parts===3&&e.coverage>=.53&&e.value>=11)sides.push({x,slope,p,q,e});
     }
    }
    sides.sort((a,b)=>b.e.value-a.e.value);
    // Keep geographically separated lines, not multiple tilts on the same jamb.
    const distinct=[];
    for(const side of sides){
     if(distinct.every(v=>Math.abs(v.x-side.x)>dx*2))distinct.push(side);
     if(distinct.length>=28)break;
    }
    for(let i=0;i<distinct.length;i++)for(let j=0;j<distinct.length;j++){
     const L=distinct[i],R=distinct[j],width=R.x-L.x;
     if(width<iw*.13||width>iw*.85||height/width<1.25||height/width>5.3)continue;
     if(R.p[0]-L.p[0]<width*.55||R.q[0]-L.q[0]<width*.55)continue;
     let lintel=null;
     for(const tilt of [-.20,-.10,0,.10,.20]){
      const p=[L.p[0],top-tilt*width/2],q=[R.p[0],top+tilt*width/2];
      const e=measure(p,q,false);
      if(e.parts>=2&&e.coverage>=.45&&(!lintel||e.value>lintel.e.value))lintel={p,q,e};
     }
     if(!lintel||lintel.e.value<10)continue;
     // Bottom must be near the end of both jambs; a floor line is useful,
     // but may be invisible beneath carpet or open-door thresholds.
     const foot=measure(L.q,R.q,false);
     const quad=[lintel.p,lintel.q,R.q,L.q];
     const full=height/ih,area=height*width/(iw*ih);
     const center=Math.abs((L.x+R.x)/2-(x0+x1)/2)/iw;
     const score=Math.min(L.e.value,R.e.value)*1.4+lintel.e.value*.9+
       Math.min(foot.value,50)*.20+full*30+area*24-
       center*7+(bottom-y0)/ih*10;
     candidates.push({score,quad,quality:Math.min(L.e.value,R.e.value,lintel.e.value),
       rect:[Math.min(L.p[0],L.q[0]),top,Math.max(R.p[0],R.q[0]),bottom],full,area});
    }
   }
  }
  candidates.sort((a,b)=>b.score-a.score);
  // Prefer the outer enclosing jambs over a smaller door/window deeper in view.
  // Nested frames must not win solely on contrast.
  let winner=null;
  for(const c of candidates.slice(0,90)){
   const enclosing=candidates.filter(o=>o!==c&&o.area>c.area*1.45&&
     o.quad[0][0]<c.quad[0][0]&&o.quad[1][0]>c.quad[1][0]&&
     o.quad[0][1]<c.quad[0][1]&&o.quad[3][1]>=c.quad[3][1]-.06*ih&&
     o.quality>=c.quality*.62);
   if(enclosing.length)continue;
   if(!winner||c.score>winner.score)winner=c;
  }
  if(!winner)winner=candidates[0];
  if(!winner||winner.quality<10){self.postMessage({id,epoch,mode,best:null,quality:0});return}
  self.postMessage({id,epoch,mode,best:winner.rect,quad:winner.quad,
   quality:winner.quality,stable:true,method:'photo-foreground-frame'});
  return;
 }
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
 // Coarse-to-fine multi-candidate search. Do not lock onto a single high-contrast
 // rectangle (cupboard, window, picture frame) before checking jamb geometry.
 const candidates=[];
 const consider=(rect,score,quality)=>{
  if(!Number.isFinite(score))return;
  const near=candidates.findIndex(c=>Math.abs(c.rect[0]-rect[0])<12&&Math.abs(c.rect[1]-rect[1])<12&&Math.abs(c.rect[2]-rect[2])<12&&Math.abs(c.rect[3]-rect[3])<18);
  if(near>=0){if(score>candidates[near].score)candidates[near]={rect,score,quality};return}
  candidates.push({rect,score,quality});candidates.sort((a,b)=>b.score-a.score);
  if(candidates.length>14)candidates.length=14;
 };
 const margin=mode==='photo'?6:9;
 const step=Math.max(5,Math.round(w*.026));
 for(let top=margin;top<h*.62;top+=step){
  for(let width=Math.max(20,Math.round(w*.08));width<=Math.min(w*.78,Math.round(h*.47));width+=step){
   for(const aspect of [1.65,1.9,2.15,2.4,2.7,3.0]){
    const height=width*aspect,bottom=top+height;
    if(bottom>h-margin)continue;
    for(let left=margin;left+width<w-margin;left+=step){
     const right=left+width,vl=v(left,top,bottom),vr=v(right,top,bottom),lintel=hor(top,left,right);
     const cx=target?target[0]:w*.5,cy=target?target[1]:h*.5;
     if(target&&(cx<left||cx>right||cy<top||cy>bottom))continue;
     const continuity=Math.min(v(left,top,top+height*.42),v(left,top+height*.58,bottom))+Math.min(v(right,top,top+height*.42),v(right,top+height*.58,bottom));
     const q=Math.min(vl,vr,lintel);
     // Penalize an edge that exists only in one short region.
     const balance=Math.min(vl,vr)/Math.max(1,Math.max(vl,vr));
     const distance=Math.hypot((left+width/2-cx)*1.1,((top+bottom)/2-cy)*.85);
     const strength=2*Math.min(vl,vr)+.65*(vl+vr)+1.35*lintel+.5*continuity+q*1.5;
     const score=strength*(.65+.35*balance)-distance*(target?1.8:.12);
     if(q>(target?7:11))consider([left,top,right,bottom],score,q);
    }
   }
  }
 }

 // Fit two independent jamb lines and the lintel to local image gradients.
 // This permits slanted sides and a sloped top in oblique photographs.
 const edgeX=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<3||x>=w-3||y<3||y>=h-3)return 0;return Math.abs(gray[y*w+x+2]-gray[y*w+x-2])};
 const edgeY=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<3||x>=w-3||y<3||y>=h-3)return 0;return Math.abs(gray[(y+2)*w+x]-gray[(y-2)*w+x])};
 const fitSide=(x0,y0,y1)=>{
  let optimum=null;
  for(let shift=-16;shift<=16;shift+=2)for(let tilt=-.38;tilt<=.38;tilt+=.025){
   let sum=0,valid=0;
   for(let j=1;j<=14;j++){const t=j/15,y=y0+(y1-y0)*t,x=x0+shift+tilt*(y-(y0+y1)/2);const v=edgeX(x,y);sum+=Math.min(v,100);if(v>12)valid++}
   const value=sum/14+valid*1.8-Math.abs(shift)*.5-Math.abs(tilt)*12;
   if(!optimum||value>optimum.value)optimum={x:x0+shift,tilt,value,valid};
  }
  return optimum;
 };
 const fitTop=(y0,x0,x1)=>{
  let optimum=null;
  for(let shift=-14;shift<=14;shift+=2)for(let tilt=-.28;tilt<=.28;tilt+=.025){
   let sum=0,valid=0;
   for(let j=1;j<=12;j++){const t=j/13,x=x0+(x1-x0)*t,y=y0+shift+tilt*(x-(x0+x1)/2);const v=edgeY(x,y);sum+=Math.min(v,100);if(v>12)valid++}
   const value=sum/12+valid*1.8-Math.abs(shift)*.6-Math.abs(tilt)*12;
   if(!optimum||value>optimum.value)optimum={y:y0+shift,tilt,value,valid};
  }
  return optimum;
 };
 const refineQuad=rect=>{
  const [l,t,r,b]=rect,left=fitSide(l,t,b),right=fitSide(r,t,b),top=fitTop(t,l,r);
  if(!left||!right||!top||left.valid<6||right.valid<6||top.valid<5)return null;
  const midY=(t+b)/2,midX=(l+r)/2;
  const intersection=side=>{
   const slope=side.tilt,k=top.tilt;
   const y=(top.y+k*(side.x-midX)-k*slope*midY)/(1-k*slope);
   const x=side.x+slope*(y-midY);
   return [x,y];
  };
  const tl=intersection(left),tr=intersection(right);
  // Floor threshold: look for a coherent horizontal transition near the expected
  // bottom of the opening. Never shift the door far from the jamb endpoints.
  let floorY=b,floorStrength=0;
  for(let yy=Math.max(t+35,b-25);yy<=Math.min(h-5,b+22);yy+=2){
   const xl=left.x+left.tilt*(yy-midY),xr=right.x+right.tilt*(yy-midY);
   const strength=hor(yy,xl+8,xr-8);
   const adjusted=strength-Math.abs(yy-b)*.28;
   if(adjusted>floorStrength){floorStrength=adjusted;floorY=yy}
  }
  if(floorStrength<13)floorY=b;
  // Independently estimate the floor edge on each half to accommodate oblique views.
  const floorAt=(x1,x2)=>{
   let chosen=floorY,peak=-Infinity;
   for(let yy=Math.max(t+45,floorY-18);yy<=Math.min(h-5,floorY+18);yy+=2){
    const strength=hor(yy,x1,x2)-Math.abs(yy-floorY)*.65;
    if(strength>peak){peak=strength;chosen=yy}
   }
   return peak>11?chosen:floorY;
  };
  const mid=(left.x+right.x)/2;
  const leftFloor=floorAt(left.x+5,mid-3),rightFloor=floorAt(mid+3,right.x-5);
  const bl=[left.x+left.tilt*(leftFloor-midY),leftFloor],br=[right.x+right.tilt*(rightFloor-midY),rightFloor];
  const quad=[tl,tr,br,bl];
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  if(quad.some(p=>!p.every(Number.isFinite))||quad[1][0]-quad[0][0]<25||quad[2][0]-quad[3][0]<20)return null;
  if(!quad.every((p,i)=>cross(p,quad[(i+1)%4],quad[(i+2)%4])>0))return null;
  return quad;
 };
 // Verify geometry for multiple candidates. Reject letterbox bars and false frames.
 let winner=null;
 for(const candidate of candidates){
  const rect=candidate.rect,quad=refineQuad(rect);
  if(!quad)continue;
  const [tl,tr,br,bl]=quad;
  const topWidth=Math.hypot(tr[0]-tl[0],tr[1]-tl[1]);
  const bottomWidth=Math.hypot(br[0]-bl[0],br[1]-bl[1]);
  const leftHeight=Math.hypot(bl[0]-tl[0],bl[1]-tl[1]);
  const rightHeight=Math.hypot(br[0]-tr[0],br[1]-tr[1]);
  if(Math.min(topWidth,bottomWidth)<18||Math.min(leftHeight,rightHeight)<35)continue;
  if(Math.max(topWidth,bottomWidth)/Math.min(topWidth,bottomWidth)>1.65)continue;
  if(Math.max(leftHeight,rightHeight)/Math.min(leftHeight,rightHeight)>1.4)continue;
  // Require the detected frame to have enough visible area for reliable placement.
  const area=(topWidth+bottomWidth)*(leftHeight+rightHeight)*.25;
  if(area<w*h*(mode==='photo'?.008:.014))continue;
  const [l,t,r,b]=rect;
  const leftEdge=v(l,t,b),rightEdge=v(r,t,b),topEdge=hor(t,l,r);
  const continuity=Math.min(v(l,t,t+(b-t)*.4),v(l,t+(b-t)*.6,b),v(r,t,t+(b-t)*.4),v(r,t+(b-t)*.6,b));
  const frameQuality=Math.min(leftEdge,rightEdge,topEdge);
  if(frameQuality<(target?9:14)||continuity<8)continue;
  // Higher preference for long, coherent jambs rather than isolated interior lines.
  const rank=candidate.score+continuity*1.8+Math.min(frameQuality,55)*1.5;
  if(!winner||rank>winner.rank)winner={rect,quad,rank,quality:frameQuality};
 }
 if(!winner){last=null;streak=0;self.postMessage({id,epoch,mode,best:null,quality:0});return}
 const best=winner.rect,quality=winner.quality,quad=winner.quad;
 if(last&&Math.hypot(...best.map((x,i)=>x-last[i]))<18)streak++;else streak=1;
 last=best;
 self.postMessage({id,epoch,mode,best,quad,quality,stable:!!still||streak>=3});
};
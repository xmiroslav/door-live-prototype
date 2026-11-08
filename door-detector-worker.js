'use strict';
let last=null,streak=0,lastEpoch=null;
self.onmessage=e=>{
 const {id,epoch,mode,buffer,w,h,target,still}=e.data;
 if(epoch!==lastEpoch){last=null;streak=0;lastEpoch=epoch}
 // Dedicated still-photo detector: line segments, not brute-force rectangles.
 // Work in the original letterboxed image coordinates, with no crop.
 if(mode==='photo'){
  // Bounded still-image search: choose a coherent outer frame, not a small
  // high-contrast interior rectangle. Complexity is linear in image pixels.
  const gray=new Uint8Array(buffer),vx=new Float32Array(w),hy=new Float32Array(h);
  let x0=3,x1=w-4,y0=3,y1=h-4;
  // Photo is letterboxed in neutral gray by captureGray().
  const activeX=new Uint8Array(w),activeY=new Uint8Array(h);
  for(let y=3;y<h-3;y+=2)for(let x=3;x<w-3;x+=2){
   if(Math.abs(gray[y*w+x]-127)>4){activeX[x]=1;activeY[y]=1}
  }
  let xs=0,xe=w-1,ys=0,ye=h-1;
  while(xs<w-1&&!activeX[xs])xs++;
  while(xe>xs&&!activeX[xe])xe--;
  while(ys<h-1&&!activeY[ys])ys++;
  while(ye>ys&&!activeY[ye])ye--;
  if(xe-xs<w*.35||ye-ys<h*.35){self.postMessage({id,epoch,mode,best:null,quality:0});return}
  x0=Math.max(3,xs+2);x1=Math.min(w-4,xe-2);y0=Math.max(3,ys+2);y1=Math.min(h-4,ye-2);
  const iw=x1-x0,ih=y1-y0;
  const gradX=(x,y)=>Math.abs(gray[y*w+x+2]-gray[y*w+x-2]);
  const gradY=(x,y)=>Math.abs(gray[(y+2)*w+x]-gray[(y-2)*w+x]);
  // Integrate side evidence over the full vertical span. This rejects
  // windows, switches and short vertical objects inside the doorway.
  const top0=Math.round(y0+ih*.12),bottom0=Math.round(y0+ih*.86);
  for(let x=x0+4;x<x1-4;x++){
   let sum=0,hits=0;
   for(let y=top0;y<bottom0;y+=3){const g=Math.min(100,gradX(x,y));sum+=g;if(g>12)hits++}
   vx[x]=sum/Math.max(1,(bottom0-top0)/3)+hits/Math.max(1,(bottom0-top0)/3)*14;
  }
  // Rank pairs of full-height jambs, preferring the outer enclosing pair.
  let best=null;
  for(let l=x0+iw*.07|0;l<x0+iw*.68;l+=2){
   if(vx[l]<5.5)continue;
   for(let rr=l+iw*.22|0;rr<x1-iw*.05;rr+=2){
    const width=rr-l;
    if(width>iw*.90||vx[rr]<5.5)continue;
    let topPeak=0,topY=0;
    for(let y=y0+ih*.09|0;y<y0+ih*.46;y+=3){
     let sum=0,hits=0;
     for(let x=l+4;x<rr-4;x+=4){const g=Math.min(100,gradY(x,y));sum+=g;if(g>13)hits++}
     const count=Math.max(1,(width-8)/4),score=sum/count+hits/count*10;
     if(score>topPeak){topPeak=score;topY=y}
    }
    if(topPeak<6.5)continue;
    // A complete doorway extends down to the floor, not to a window sill.
    const side=Math.min(vx[l],vx[rr]);
    const score=side*1.7+topPeak+width/iw*27-Math.abs((l+rr)/2-(x0+x1)/2)/iw*8;
    if(!best||score>best.score)best={l,r:rr,top:topY,score,side,topPeak};
   }
  }
  if(!best||best.side<6||best.topPeak<6.5){self.postMessage({id,epoch,mode,best:null,quality:0});return}
  // Locate the actual threshold in the lower part of the photo. Do not
  // stretch the door down to the viewport or beyond the photographed floor.
  let bottom=Math.round(y0+ih*.84),bottomScore=-1;
  for(let y=y0+ih*.69|0;y<y0+ih*.96;y+=2){
   let sum=0;
   for(let x=best.l+5;x<best.r-5;x+=3)sum+=Math.min(100,gradY(x,y));
   const avg=sum/Math.max(1,(best.r-best.l-10)/3);
   const score=avg-Math.abs(y-(y0+ih*.84))*.09;
   if(score>bottomScore){bottomScore=score;bottom=y}
  }
  if(bottom-best.top<ih*.38){self.postMessage({id,epoch,mode,best:null,quality:0});return}
  // A real jamb must form a tall, coherent quadrilateral. Estimate the two
  // visible vertical edges independently to retain oblique perspective.
  const fitJamb=x0=>{
   let chosen=null;
   for(let slope=-.26;slope<=.26;slope+=.025)for(let shift=-8;shift<=8;shift+=2){
    let score=0,hits=0,n=0;
    for(let y=best.top+8;y<bottom-8;y+=4){
     const x=Math.round(x0+shift+slope*(y-(best.top+bottom)/2));
     if(x<3||x>=w-3)continue;
     const g=gradX(x,y);score+=Math.min(100,g);hits+=g>12?1:0;n++;
    }
    if(n<10)continue;
    const value=score/n+hits/n*16-Math.abs(shift)*.2-Math.abs(slope)*6;
    if(!chosen||value>chosen.value)chosen={x:x0+shift,slope,value,hits,n};
   }
   return chosen;
  };
  const left=fitJamb(best.l),right=fitJamb(best.r);
  if(!left||!right||left.hits/left.n<.15||right.hits/right.n<.15){
   self.postMessage({id,epoch,mode,best:null,quality:0});return;
  }
  const at=(line,y)=>[line.x+line.slope*(y-(best.top+bottom)/2),y];
  const quad=[at(left,best.top),at(right,best.top),at(right,bottom),at(left,bottom)];
  const topW=quad[1][0]-quad[0][0],bottomW=quad[2][0]-quad[3][0];
  const height=bottom-best.top,aspect=height/Math.max(1,(topW+bottomW)/2);
  // Do not automatically place a full door in a window or tiny interior rectangle.
  if(topW<iw*.19||bottomW<iw*.19||Math.min(topW,bottomW)<16||
     Math.max(topW,bottomW)/Math.min(topW,bottomW)>1.55||
     aspect<1.25||aspect>4.2||bottomScore<5){
   self.postMessage({id,epoch,mode,best:null,quality:0});return;
  }
  self.postMessage({id,epoch,mode,best:[best.l,best.top,best.r,bottom],quad,
   quality:Math.min(best.side,best.topPeak,left.value,right.value),stable:true,method:'jamb-perspective-photo'});
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
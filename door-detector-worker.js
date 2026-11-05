'use strict';
let last=null,streak=0,lastEpoch=null;
self.onmessage=e=>{
 const {id,epoch,mode,buffer,w,h,target,still}=e.data;
 if(epoch!==lastEpoch){last=null;streak=0;lastEpoch=epoch}
 // Dedicated still-photo detector: line segments, not brute-force rectangles.
 // Work in the original letterboxed image coordinates, with no crop.
 if(mode==='photo'){
  const gray=new Uint8Array(buffer),vx=new Uint8Array(w*h),hy=new Uint8Array(w*h);
  let minX=w,maxX=0,minY=h,maxY=0;
  for(let y=4;y<h-4;y++)for(let x=4;x<w-4;x++){
   const i=y*w+x;
   const a=Math.abs(gray[i+2]-gray[i-2]),b=Math.abs(gray[i+2*w]-gray[i-2*w]);
   vx[i]=Math.min(255,a);hy[i]=Math.min(255,b);
   // Letterbox pixels are neutral gray, unlike room content.
   if(gray[i]!==127){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  }
  const inside=(x,y)=>x>=minX+3&&x<=maxX-3&&y>=minY+3&&y<=maxY-3;
  const vertical=(x,top,bottom,slope)=>{
   let total=0,valid=0;
   for(let j=0;j<24;j++){
    const y=top+(bottom-top)*(j+.5)/24,px=Math.round(x+slope*(y-(top+bottom)/2)),py=Math.round(y);
    if(!inside(px,py))return null;
    const g=Math.max(vx[py*w+px],vx[py*w+px-1],vx[py*w+px+1]);
    total+=Math.min(130,g);if(g>18)valid++;
   }
   return valid>=15?total/24*(valid/24):null;
  };
  const horizontal=(y,x0,x1,tilt)=>{
   let total=0,valid=0;
   for(let j=0;j<20;j++){
    const x=x0+(x1-x0)*(j+.5)/20,py=Math.round(y+tilt*(x-(x0+x1)/2)),px=Math.round(x);
    if(!inside(px,py))return null;
    const g=Math.max(hy[py*w+px],hy[(py-1)*w+px],hy[(py+1)*w+px]);
    total+=Math.min(130,g);if(g>17)valid++;
   }
   return valid>=11?total/20*(valid/20):null;
  };
  const spanX=maxX-minX,spanY=maxY-minY;
  // Doorframe is typically taller than wide, but oblique perspective is allowed.
  const candidates=[];
  const stride=Math.max(3,Math.round(w/90));
  for(let top=minY+5;top<minY+spanY*.54;top+=stride*2){
   for(let height=Math.round(spanY*.30);height<=spanY*.91;height+=stride*3){
    const bottom=top+height;if(bottom>maxY-3)continue;
    const sides=[];
    for(let x=minX+6;x<maxX-6;x+=stride){
     for(const slope of [-.30,-.20,-.10,0,.10,.20,.30]){
      const strength=vertical(x,top,bottom,slope);
      if(strength!==null&&strength>15)sides.push({x,slope,strength});
     }
    }
    sides.sort((a,b)=>b.strength-a.strength);
    const strongest=sides.slice(0,24);
    for(let a=0;a<strongest.length;a++)for(let b=0;b<strongest.length;b++){
     const L=strongest[a],R=strongest[b],width=R.x-L.x;
     if(width<spanX*.08||width>Math.min(spanX*.65,height*.86)||height/width<1.3||height/width>4.8)continue;
     const topLeft=L.x-L.slope*height/2,topRight=R.x-R.slope*height/2;
     const bottomLeft=L.x+L.slope*height/2,bottomRight=R.x+R.slope*height/2;
     if(topRight-topLeft<width*.55||bottomRight-bottomLeft<width*.55)continue;
     let bestTop=null;
     for(const tilt of [-.20,-.10,0,.10,.20]){
      const score=horizontal(top,topLeft+3,topRight-3,tilt);
      if(score!==null&&(!bestTop||score>bestTop.score))bestTop={tilt,score};
     }
     if(!bestTop||bestTop.score<13)continue;
     let floor=horizontal(bottom,bottomLeft+4,bottomRight-4,0)||0;
     const q=[[topLeft,top-bestTop.tilt*(topRight-topLeft)/2],[topRight,top+bestTop.tilt*(topRight-topLeft)/2],[bottomRight,bottom],[bottomLeft,bottom]];
     if(q.some(p=>!inside(Math.round(p[0]),Math.round(p[1]))))continue;
     const center=(L.x+R.x)/2;
     const score=Math.min(L.strength,R.strength)*2+bestTop.score*1.6+Math.min(floor,55)*.3
       +Math.min(height/spanY,.75)*15-Math.abs(center-(minX+maxX)/2)/spanX*12;
     if(candidates.length<8||score>candidates[candidates.length-1].score){
      candidates.push({score,quad:q,quality:Math.min(L.strength,R.strength,bestTop.score),rect:[Math.min(topLeft,bottomLeft),top,Math.max(topRight,bottomRight),bottom]});
      candidates.sort((a,b)=>b.score-a.score);if(candidates.length>8)candidates.pop();
     }
    }
   }
  }
  const winner=candidates[0];
  // No automatic overlay without multiple coherent, contrasted frame edges.
  if(!winner||winner.quality<15){self.postMessage({id,epoch,mode,best:null,quality:0});return}
  self.postMessage({id,epoch,mode,best:winner.rect,quad:winner.quad,quality:winner.quality,stable:true,method:'photo-lines'});
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
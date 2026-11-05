/* DoorGeometry: independent perspective/shape validation. No fixed door location. */
(function(root){
 'use strict';
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 function assess(q,frame){
  if(!Array.isArray(q)||q.length!==4||q.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))return {ok:false,reason:'invalid-points'};
  const [tl,tr,br,bl]=q;
  const edges=[dist(tl,tr),dist(tr,br),dist(br,bl),dist(bl,tl)];
  if(Math.min(...edges)<3)return {ok:false,reason:'degenerate-edge'};
  const turns=q.map((p,i)=>cross(p,q[(i+1)%4],q[(i+2)%4]));
  if(!turns.every(v=>v>0)&&!turns.every(v=>v<0))return {ok:false,reason:'nonconvex'};
  const area=Math.abs(q.reduce((a,p,i)=>a+p[0]*q[(i+1)%4][1]-p[1]*q[(i+1)%4][0],0)/2);
  if(area<frame.width*frame.height*.008)return {ok:false,reason:'too-small'};
  const top=edges[0],right=edges[1],bottom=edges[2],left=edges[3];
  const aspect=(left+right)/(top+bottom);
  if(aspect<1.15||aspect>6.5)return {ok:false,reason:'implausible-aspect'};
  if(Math.max(top,bottom)/Math.min(top,bottom)>2.7||Math.max(left,right)/Math.min(left,right)>2.7)return {ok:false,reason:'extreme-perspective'};
  const mx=(tl[0]+tr[0]+br[0]+bl[0])/4,my=(tl[1]+tr[1]+br[1]+bl[1])/4;
  if(mx<0||mx>frame.width||my<0||my>frame.height)return {ok:false,reason:'outside-frame'};
  return {ok:true,area,aspect,edges};
 }
 root.DoorGeometry={assess};
})(window);

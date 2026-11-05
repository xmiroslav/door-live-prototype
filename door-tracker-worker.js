'use strict';
// Door Live worker: independently matched background landmarks + robust affine RANSAC.
// The result is a proposal, never proof of correct placement; the UI checks jamb edges.
let prev=null,epoch=-1;
const med=a=>{const b=a.slice().sort((x,y)=>x-y);return b[b.length>>1]};
function patch(a,b,w,h,x,y,dx,dy){
 let sum=0,n=0;
 for(let yy=-6;yy<=6;yy+=3)for(let xx=-6;xx<=6;xx+=3){
  const px=x+xx,py=y+yy,qx=px+dx,qy=py+dy;
  if(px<2||py<2||qx<2||qy<2||px>=w-2||py>=h-2||qx>=w-2||qy>=h-2)return Infinity;
  sum+=Math.abs(a[py*w+px]-b[qy*w+qx]);n++;
 }
 return sum/n;
}
function match(a,b,w,h,x,y,range){
 let best=Infinity,second=Infinity,dxBest=0,dyBest=0;
 for(let dy=-range;dy<=range;dy+=3)for(let dx=-range;dx<=range;dx+=3){
  const v=patch(a,b,w,h,x,y,dx,dy);
  if(v<best){second=best;best=v;dxBest=dx;dyBest=dy}else if(v<second)second=v;
 }
 const bx=dxBest,by=dyBest;
 for(let dy=by-2;dy<=by+2;dy++)for(let dx=bx-2;dx<=bx+2;dx++){
  const v=patch(a,b,w,h,x,y,dx,dy);
  if(v<best){best=v;dxBest=dx;dyBest=dy}
 }
 return {dx:dxBest,dy:dyBest,error:best};
}
function texture(a,w,x,y){
 let sum=0;
 for(let oy=-4;oy<=4;oy+=2)for(let ox=-4;ox<=4;ox+=2){
  const k=(y+oy)*w+x+ox;
  sum+=Math.abs(a[k+2]-a[k-2])+Math.abs(a[k+2*w]-a[k-2*w]);
 }
 return sum;
}
function solve3(rows,values){
 const a=rows.map((r,i)=>[...r,values[i]]);
 for(let col=0;col<3;col++){
  let pivot=col;for(let i=col+1;i<3;i++)if(Math.abs(a[i][col])>Math.abs(a[pivot][col]))pivot=i;
  if(Math.abs(a[pivot][col])<1e-5)return null;
  [a[col],a[pivot]]=[a[pivot],a[col]];
  const v=a[col][col];for(let j=col;j<4;j++)a[col][j]/=v;
  for(let i=0;i<3;i++)if(i!==col){const f=a[i][col];for(let j=col;j<4;j++)a[i][j]-=f*a[col][j]}
 }
 return a.map(r=>r[3]);
}
function affine(a,b,c){
 const rows=[a,b,c].map(p=>[p.x,p.y,1]);
 const X=solve3(rows,[a.X,b.X,c.X]),Y=solve3(rows,[a.Y,b.Y,c.Y]);
 return X&&Y?[...X,...Y]:null;
}
const apply=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[2],m[3]*p[0]+m[4]*p[1]+m[5]];
self.onmessage=e=>{
 const {id,session,buffer,w,h,quad}=e.data,gray=new Uint8Array(buffer);
 if(session!==epoch){prev=null;epoch=session}
 if(!prev){prev=gray;self.postMessage({id,session,ready:true});return}
 const matches=[],center=quad.reduce((v,p)=>[v[0]+p[0]/4,v[1]+p[1]/4],[0,0]);
 // Look for textured, stationary room features around the jamb, not on the door texture.
 const candidates=[];
 for(let edge=0;edge<4;edge++){
  const a=quad[edge],b=quad[(edge+1)%4],vx=b[0]-a[0],vy=b[1]-a[1],len=Math.hypot(vx,vy)||1;
  for(let j=1;j<=7;j++)for(const offset of [-30,-18,-9,9,18,30]){
   const t=j/8,x=Math.round(a[0]+vx*t-offset*vy/len),y=Math.round(a[1]+vy*t+offset*vx/len);
   if(x<22||y<22||x>=w-22||y>=h-22)continue;
   // Reject features well inside the synthetic door.
   if(Math.abs(x-center[0])<8&&Math.abs(y-center[1])<8)continue;
   candidates.push({x,y,quality:texture(prev,w,x,y)});
  }
 }
 candidates.sort((a,b)=>b.quality-a.quality);
 const used=[];
 for(const c of candidates){
  if(matches.length>=48)break;
  if(c.quality<145||used.some(p=>Math.hypot(p.x-c.x,p.y-c.y)<8))continue;
  used.push(c);
  const m=match(prev,gray,w,h,c.x,c.y,18);
  if(m.error>18)continue;
  const back=match(gray,prev,w,h,c.x+m.dx,c.y+m.dy,6);
  if(back.error>20||Math.hypot(m.dx+back.dx,m.dy+back.dy)>2.8)continue;
  matches.push({x:c.x,y:c.y,X:c.x+m.dx,Y:c.y+m.dy,error:m.error});
 }
 prev=gray;
 if(matches.length<10){self.postMessage({id,session,ok:false,count:matches.length});return}
 // Deterministic sample triples keep this reproducible and cheap in a worker.
 let best=null,bestIn=[];
 const count=matches.length;
 for(let t=0;t<100;t++){
  const i=t%count,j=(t*7+11)%count,k=(t*13+23)%count;
  if(i===j||i===k||j===k)continue;
  const m=affine(matches[i],matches[j],matches[k]);if(!m)continue;
  const det=m[0]*m[4]-m[1]*m[3];
  if(det<.78||det>1.28||Math.hypot(m[0],m[3])<.85||Math.hypot(m[1],m[4])<.85)continue;
  const inliers=matches.filter(p=>{const q=apply(m,[p.x,p.y]);return Math.hypot(q[0]-p.X,q[1]-p.Y)<2.8});
  if(inliers.length>bestIn.length){best=m;bestIn=inliers}
 }
 if(!best||bestIn.length<9||bestIn.length/count<.58){self.postMessage({id,session,ok:false,count:bestIn.length});return}
 // Require spatial support around the opening: one wall patch must not control the door.
 const xs=bestIn.map(p=>p.x),ys=bestIn.map(p=>p.y);
 if(Math.max(...xs)-Math.min(...xs)<w*.16||Math.max(...ys)-Math.min(...ys)<h*.15){self.postMessage({id,session,ok:false,reason:'clustered'});return}
 // Least-squares affine refinement from all RANSAC inliers.
 const n=bestIn.length,sx=bestIn.reduce((v,p)=>v+p.x,0)/n,sy=bestIn.reduce((v,p)=>v+p.y,0)/n;
 let xx=0,xy=0,yy=0,xX=0,yX=0,xY=0,yY=0;
 const mx=bestIn.reduce((v,p)=>v+p.X,0)/n,my=bestIn.reduce((v,p)=>v+p.Y,0)/n;
 for(const p of bestIn){const x=p.x-sx,y=p.y-sy,X=p.X-mx,Y=p.Y-my;xx+=x*x;xy+=x*y;yy+=y*y;xX+=x*X;yX+=y*X;xY+=x*Y;yY+=y*Y}
 const den=xx*yy-xy*xy;if(den<1)return;
 const a=(xX*yy-yX*xy)/den,b=(yX*xx-xX*xy)/den,d=(xY*yy-yY*xy)/den,e2=(yY*xx-xY*xy)/den;
 const m=[a,b,mx-a*sx-b*sy,d,e2,my-d*sx-e2*sy];
 const proposed=quad.map(p=>apply(m,p));
 const shift=Math.max(...quad.map((p,i)=>Math.hypot(proposed[i][0]-p[0],proposed[i][1]-p[1])));
 const scale=Math.sqrt(Math.abs(a*e2-b*d));
 if(scale<.87||scale>1.14||shift>Math.max(22,w*.12)){self.postMessage({id,session,ok:false,reason:'motion',count:bestIn.length});return}
 const error=med(bestIn.map(p=>{const q=apply(m,[p.x,p.y]);return Math.hypot(q[0]-p.X,q[1]-p.Y)}));
 self.postMessage({id,session,ok:true,proposed,count:bestIn.length,confidence:Math.min(1,bestIn.length/count)*Math.max(.3,1-error/4),error});
};
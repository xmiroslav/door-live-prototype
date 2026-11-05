'use strict';
let prev=null,epoch=-1;
const score=(a,b,w,h,x,y,dx,dy)=>{
 let total=0,n=0;
 for(let yy=-6;yy<=6;yy+=3)for(let xx=-6;xx<=6;xx+=3){
  const px=x+xx,py=y+yy,qx=px+dx,qy=py+dy;
  if(px<1||py<1||qx<1||qy<1||px>=w-1||py>=h-1||qx>=w-1||qy>=h-1)return Infinity;
  total+=Math.abs(a[py*w+px]-b[qy*w+qx]);n++;
 }
 return total/n;
};
const median=a=>{const b=a.slice().sort((x,y)=>x-y);return b[b.length>>1]};
self.onmessage=e=>{
 const {id,session,buffer,w,h,quad}=e.data;
 const gray=new Uint8Array(buffer);
 if(session!==epoch){prev=null;epoch=session}
 if(!prev){prev=gray;self.postMessage({id,session,ready:true});return}
 const matches=[];
 for(let edge=0;edge<4;edge++){
  const a=quad[edge],b=quad[(edge+1)%4];
  const vx=b[0]-a[0],vy=b[1]-a[1],len=Math.hypot(vx,vy)||1;
  for(let j=1;j<=5;j++){
   const t=j/6;
   for(const offset of [-10,10]){
    const x=Math.round(a[0]+vx*t-offset*vy/len),y=Math.round(a[1]+vy*t+offset*vx/len);
    if(x<20||y<20||x>=w-20||y>=h-20)continue;
    let texture=0;
    for(let oy=-4;oy<=4;oy+=2)for(let ox=-4;ox<=4;ox+=2){
     const k=(y+oy)*w+x+ox;
     texture+=Math.abs(prev[k+2]-prev[k-2])+Math.abs(prev[k+2*w]-prev[k-2*w]);
    }
    if(texture<145)continue;
    let best=Infinity,dxBest=0,dyBest=0;
    for(let dy=-12;dy<=12;dy+=4)for(let dx=-12;dx<=12;dx+=4){
     const v=score(prev,gray,w,h,x,y,dx,dy);
     if(v<best){best=v;dxBest=dx;dyBest=dy}
    }
    const cx=dxBest,cy=dyBest;
    for(let dy=cy-2;dy<=cy+2;dy++)for(let dx=cx-2;dx<=cx+2;dx++){
     const v=score(prev,gray,w,h,x,y,dx,dy);
     if(v<best){best=v;dxBest=dx;dyBest=dy}
    }
    if(best<19)matches.push({x,y,dx:dxBest,dy:dyBest,error:best});
   }
  }
 }
 prev=gray;
 if(matches.length<9){self.postMessage({id,session,ok:false,count:matches.length});return}
 const mx=median(matches.map(m=>m.dx)),my=median(matches.map(m=>m.dy));
 const inliers=matches.filter(m=>Math.hypot(m.dx-mx,m.dy-my)<3.5);
 if(inliers.length<8||inliers.length/matches.length<.65){self.postMessage({id,session,ok:false,count:inliers.length});return}
 const cx=inliers.reduce((v,m)=>v+m.x,0)/inliers.length,cy=inliers.reduce((v,m)=>v+m.y,0)/inliers.length;
 const nx=inliers.reduce((v,m)=>v+m.x+m.dx,0)/inliers.length,ny=inliers.reduce((v,m)=>v+m.y+m.dy,0)/inliers.length;
 let den=0,re=0,im=0;
 for(const m of inliers){
  const x=m.x-cx,y=m.y-cy,X=m.x+m.dx-nx,Y=m.y+m.dy-ny;
  den+=x*x+y*y;re+=x*X+y*Y;im+=x*Y-y*X;
 }
 const scale=Math.hypot(re,im)/Math.max(1,den),angle=Math.atan2(im,re);
 if(scale<.93||scale>1.07||Math.abs(angle)>.1||Math.hypot(nx-cx,ny-cy)>20){self.postMessage({id,session,ok:false,count:inliers.length});return}
 const co=Math.cos(angle)*scale,si=Math.sin(angle)*scale;
 const proposed=quad.map(q=>{const x=q[0]-cx,y=q[1]-cy;return[nx+co*x-si*y,ny+si*x+co*y]});
 self.postMessage({id,session,ok:true,proposed,count:inliers.length,confidence:inliers.length/matches.length});
};
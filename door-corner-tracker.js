/* Research-only camera-frame corner tracker. No ML model or world anchor. */
(function(global){
'use strict';
class DoorCornerTracker {
 constructor(){this.w=256;this.h=192;this.off=document.createElement('canvas');this.off.width=this.w;this.off.height=this.h;this.ctx=this.off.getContext('2d',{willReadFrequently:true});this.prev=null;this.points=null;this.lost=0;}
 reset(){this.prev=null;this.points=null;this.lost=0;}
 sample(video){if(!video||video.readyState<2)return null;this.ctx.drawImage(video,0,0,this.w,this.h);const d=this.ctx.getImageData(0,0,this.w,this.h).data;const g=new Uint8Array(this.w*this.h);for(let i=0;i<g.length;i++)g[i]=(77*d[4*i]+150*d[4*i+1]+29*d[4*i+2])>>8;return g;}
 setQuad(quad,cw,ch,video){const g=this.sample(video);if(!g||!quad||quad.length!==4)return;this.prev=g;this.points=quad.map(p=>[p[0]*this.w/cw,p[1]*this.h/ch]);this.lost=0;}
 track(video,cw,ch){const next=this.sample(video);if(!next)return null;if(!this.prev||!this.points){this.prev=next;return null}
 const old=this.points;const pts=[];const w=this.w,h=this.h;let good=0;
 for(const [ox,oy] of old){
  const cx=Math.round(ox),cy=Math.round(oy),radius=4,search=8;
  if(cx<radius+search||cy<radius+search||cx>=w-radius-search||cy>=h-radius-search){pts.push([ox,oy]);continue}
  let texture=0;for(let yy=-radius;yy<=radius;yy+=2)for(let xx=-radius;xx<=radius;xx+=2)texture+=Math.abs(this.prev[(cy+yy)*w+cx+xx]-this.prev[cy*w+cx]);
  if(texture<130){pts.push([ox,oy]);continue}
  let best=Infinity,bx=cx,by=cy;
  for(let dy=-search;dy<=search;dy+=2)for(let dx=-search;dx<=search;dx+=2){
   let err=0;for(let yy=-radius;yy<=radius;yy+=2)for(let xx=-radius;xx<=radius;xx+=2){
    err+=Math.abs(this.prev[(cy+yy)*w+cx+xx]-next[(cy+dy+yy)*w+cx+dx+xx]);
   }
   if(err<best){best=err;bx=cx+dx;by=cy+dy}
  }
  if(best<390){pts.push([ox+(bx-cx)*.65,oy+(by-cy)*.65]);good++}else pts.push([ox,oy]);
 }
 this.prev=next;
 if(good<2){this.lost++;if(this.lost>12)return {lost:true};return {quad:old.map(p=>[p[0]*cw/w,p[1]*ch/h]),confidence:'low'}}
 this.lost=0;this.points=pts;return {quad:pts.map(p=>[p[0]*cw/w,p[1]*ch/h]),confidence:good===4?'medium':'low'};
 }
}
global.DoorCornerTracker=DoorCornerTracker;
})(window);

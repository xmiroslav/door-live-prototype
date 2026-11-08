/* Shared geometry gate for learned doorway proposals.
   Input corners: TL, TR, BR, BL in image pixels. */
export function validateDoorQuad(quad,width,height){
 if(!Array.isArray(quad)||quad.length!==4||!quad.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))return {ok:false,reason:'invalid-points'};
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
 const turns=quad.map((p,i)=>cross(p,quad[(i+1)%4],quad[(i+2)%4]));
 if(!turns.every(v=>v>0)&&!turns.every(v=>v<0))return {ok:false,reason:'nonconvex'};
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const top=dist(quad[0],quad[1]),bottom=dist(quad[3],quad[2]),left=dist(quad[0],quad[3]),right=dist(quad[1],quad[2]);
 const meanWidth=(top+bottom)/2,meanHeight=(left+right)/2;
 if(meanWidth<width*.06||meanHeight<height*.15)return {ok:false,reason:'too-small'};
 const aspect=meanHeight/meanWidth;
 if(aspect<1.2||aspect>4.4)return {ok:false,reason:'implausible-aspect'};
 if(quad[0][1]>=quad[3][1]||quad[1][1]>=quad[2][1])return {ok:false,reason:'reversed-vertical'};
 if(quad.some(([x,y])=>x< -width*.04||x>width*1.04||y< -height*.04||y>height*1.04))return {ok:false,reason:'outside-image'};
 return {ok:true,aspect};
}
export async function detectWithFallback({model,imageData,geometry}){
 if(model){
  try{
   const result=await model.detect(imageData);
   if(result.available&&result.accepted){
    const check=validateDoorQuad(result.quad,imageData.width,imageData.height);
    if(check.ok)return {source:'ml',quad:result.quad,confidence:result.confidence};
   }
  }catch(e){console.warn('Door ML inference failed; using geometry fallback',e);}
 }
 const fallback=await geometry();
 return fallback?{...fallback,source:'geometry'}:null;
}

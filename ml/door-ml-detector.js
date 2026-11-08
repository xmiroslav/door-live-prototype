/* Doorway keypoint inference adapter. Requires a separately trained ONNX model.
   Contract: RGB float32 [1,3,320,320] -> corners [1,8], confidence [1,1].
   This adapter NEVER manufactures a detection if the model is absent. */
export class DoorMLDetector {
 constructor({modelUrl,ort,threshold=0.72}={}){this.modelUrl=modelUrl;this.ort=ort;this.threshold=threshold;this.session=null;}
 async init(){
  if(!this.modelUrl||!this.ort) return {available:false,reason:'trained-model-not-configured'};
  this.session=await this.ort.InferenceSession.create(this.modelUrl,{executionProviders:['wasm']});
  return {available:true};
 }
 async detect(imageData){
  if(!this.session)return {available:false,reason:'trained-model-not-loaded'};
  const size=320,{width,height,data}=imageData,input=new Float32Array(3*size*size);
  // Bilinear sampling to avoid unstable aliasing on small/low contrast jambs.
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const sx=(x+.5)*width/size-.5,sy=(y+.5)*height/size-.5;
   const x0=Math.max(0,Math.min(width-1,Math.floor(sx))),y0=Math.max(0,Math.min(height-1,Math.floor(sy)));
   const x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1);
   const fx=Math.max(0,Math.min(1,sx-x0)),fy=Math.max(0,Math.min(1,sy-y0));
   for(let c=0;c<3;c++){
    const a=data[(y0*width+x0)*4+c],b=data[(y0*width+x1)*4+c],d=data[(y1*width+x0)*4+c],e=data[(y1*width+x1)*4+c];
    input[c*size*size+y*size+x]=((a*(1-fx)+b*fx)*(1-fy)+(d*(1-fx)+e*fx)*fy)/255;
   }
  }
  const name=this.session.inputNames[0];
  const outputs=await this.session.run({[name]:new this.ort.Tensor('float32',input,[1,3,size,size])});
  const corners=outputs.corners?.data,confidence=Number(outputs.confidence?.data?.[0]);
  if(!corners||corners.length!==8||!Number.isFinite(confidence))throw Error('Incompatible doorway model outputs');
  if(confidence<this.threshold)return {available:true,accepted:false,confidence};
  const quad=Array.from({length:4},(_,i)=>[corners[i*2]*width,corners[i*2+1]*height]);
  return {available:true,accepted:true,confidence,quad};
 }
}

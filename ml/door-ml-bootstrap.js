/* Optional ML activation. The site remains functional without a trained model. */
import {DoorMLDetector} from './door-ml-detector.js';
const modelUrl='./ml/models/doorway-keypoints.onnx';
window.doorML={ready:false,reason:'loading'};
(async()=>{
 try{
  const check=await fetch(modelUrl,{method:'HEAD',cache:'no-store'});
  if(!check.ok){window.doorML.reason='model-not-published';return}
  const ort=await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/+esm');
  const detector=new DoorMLDetector({modelUrl,ort,threshold:0.78});
  await detector.init();
  window.doorML={ready:true,detect:image=>detector.detect(image)};
 }catch(e){window.doorML={ready:false,reason:String(e)};console.warn('Door ML unavailable, retaining geometry detector',e)}
})();

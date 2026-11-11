import assert from 'node:assert/strict';
import {decodeCornerEvidence, assessDoorPlacement} from '../ai/door-corner-evidence.js';

const shape=[1,4,8,8];
const peaks=[[1,1],[6,2],[5,6],[2,6]];
function fixture(){
  const heatmaps=new Float32Array(4*64).fill(-12);
  peaks.forEach(([x,y],corner)=>{heatmaps[corner*64+y*8+x]=12;});
  return {heatmaps,heatmapShape:shape,visibilityLogits:new Float32Array([8,8,8,8]),
          crop:{x:40,y:20,width:240,height:320},imageWidth:400,imageHeight:400};
}
function assess(prediction,extra={}){
  return assessDoorPlacement({prediction,imageWidth:400,imageHeight:400,detectorScore:.95,
    modelValidated:true,calibrationValidated:true,...extra});
}
const prediction=decodeCornerEvidence(fixture());
assert.equal(prediction.available,true);
assert.deepEqual(prediction.corners,[[85,80],[235,120],[205,280],[115,280]]);
assert.equal(assess(prediction).accepted,true);
// Runtime defaults must admit the model's intended sigma=1.5 target distribution.
const gaussian=fixture();gaussian.heatmapShape=[1,4,64,64];
gaussian.heatmaps=new Float32Array(4*64*64);
const centers=[[12,10],[50,13],[48,52],[15,52]];
for(let c=0;c<4;c++)for(let y=0;y<64;y++)for(let x=0;x<64;x++)
  gaussian.heatmaps[c*4096+y*64+x]=-((x-centers[c][0])**2+(y-centers[c][1])**2)/(2*1.5**2);
assert.equal(assess(decodeCornerEvidence(gaussian)).accepted,true);
assert.equal(assess(prediction,{modelValidated:false}).reason,'model-not-validated');
assert.equal(assess(prediction,{calibrationValidated:false}).reason,'calibration-not-validated');
assert.equal(assess(prediction,{detectorScore:.2}).reason,'low-detector-score');
const hidden=fixture();hidden.visibilityLogits[2]=-8;
assert.deepEqual(assess(decodeCornerEvidence(hidden)),
  {accepted:false,reason:'corner-not-visible',cornerIndex:2,action:'manual-adjustment'});
const diffuse=fixture();diffuse.heatmaps.fill(0,64,128);
assert.equal(assess(decodeCornerEvidence(diffuse)).reason,'uncertain-corner-location');
// Two far-apart equally sharp peaks have low normalized entropy but no unique location.
const ambiguous=fixture();ambiguous.heatmaps[6*8+6]=12;
assert.equal(assess(decodeCornerEvidence(ambiguous)).reason,'ambiguous-corner-location');
const edge=fixture();edge.heatmaps.fill(-12,0,64);edge.heatmaps[1]=12;
assert.equal(assess(decodeCornerEvidence(edge)).reason,'corner-at-crop-edge');
for(const bad of [NaN,Infinity,-Infinity]){
  const invalid=fixture();invalid.heatmaps[100]=bad;
  assert.equal(decodeCornerEvidence(invalid).available,false);
}
const missing=fixture();delete missing.visibilityLogits;
assert.equal(decodeCornerEvidence(missing).available,false);
const crop=fixture();crop.crop.x=-1;
assert.equal(decodeCornerEvidence(crop).available,false);
const reversed={...prediction,corners:[...prediction.corners].reverse()};
assert.equal(assess(reversed).accepted,false);
const malformed={...prediction,evidence:prediction.evidence.slice(0,3)};
assert.equal(assess(malformed).accepted,false);
assert.equal(assess(prediction,{detectorScore:NaN}).accepted,false);
assert.equal(assessDoorPlacement({prediction,imageWidth:400,imageHeight:400,detectorScore:.95}).accepted,false);
console.log('Per-corner evidence tests passed');

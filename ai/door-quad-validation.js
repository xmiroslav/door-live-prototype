// Door Live AI — validate a perspective quadrilateral before projection.
// Points must be TL, TR, BR, BL in original image coordinates.
export function validateDoorQuad(points, width, height, options = {}) {
  const minAreaRatio = options.minAreaRatio ?? 0.015;
  const fail = reason => ({ valid: false, reason });
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return fail('invalid-image-size');
  if (!Array.isArray(points) || points.length !== 4) return fail('four-corners-required');
  if (!points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return fail('invalid-points');
  if (points.some(([x,y]) => x < 0 || y < 0 || x >= width || y >= height)) return fail('out-of-image');
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  const turns = points.map((_,i)=>cross(points[i],points[(i+1)%4],points[(i+2)%4]));
  if (turns.some(v=>v<=0)) return fail('crossed-or-concave-quad');
  const area = Math.abs(points.reduce((s,p,i)=>s+p[0]*points[(i+1)%4][1]-points[(i+1)%4][0]*p[1],0)/2);
  if (area < width*height*minAreaRatio) return fail('too-small');
  const [tl,tr,br,bl] = points;
  if ((tl[0]+bl[0])/2 >= (tr[0]+br[0])/2) return fail('left-right-inverted');
  if ((tl[1]+tr[1])/2 >= (bl[1]+br[1])/2) return fail('top-bottom-inverted');
  const edgeLength = (a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const edges = points.map((p,i)=>edgeLength(p,points[(i+1)%4]));
  if (Math.min(...edges)<Math.min(width,height)*0.025) return fail('collapsed-edge');
  return {valid:true,reason:null,area,areaRatio:area/(width*height),edges};
}
export function canProjectDoor({corners, width, height, geometryVerified, score, minimumScore=0.6}) {
  if (!geometryVerified) return {valid:false,reason:'unverified-geometry'};
  if (!Number.isFinite(score)||score<minimumScore) return {valid:false,reason:'low-confidence'};
  return validateDoorQuad(corners,width,height);
}

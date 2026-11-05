/* Door Live: projective WebGL texture renderer. No triangle-mesh seams. */
(function(global){
'use strict';
function inverse(m){
 const [a,b,c,d,e,f,g,h,i]=m;
 const A=e*i-f*h,B=c*h-b*i,C=b*f-c*e,D=f*g-d*i,E=a*i-c*g,F=c*d-a*f,G=d*h-e*g,H=b*g-a*h,I=a*e-b*d;
 const det=a*A+b*D+c*G;
 if(!Number.isFinite(det)||Math.abs(det)<1e-8)return null;
 return [A,B,C,D,E,F,G,H,I].map(v=>v/det);
}
function matrix(q){
 const [p0,p1,p2,p3]=q,dx1=p1[0]-p2[0],dy1=p1[1]-p2[1],dx2=p3[0]-p2[0],dy2=p3[1]-p2[1];
 const dx3=p0[0]-p1[0]+p2[0]-p3[0],dy3=p0[1]-p1[1]+p2[1]-p3[1];
 const det=dx1*dy2-dx2*dy1;
 let g=0,h=0;
 if(Math.abs(det)>1e-8){g=(dx3*dy2-dx2*dy3)/det;h=(dx1*dy3-dx3*dy1)/det}
 return [p1[0]-p0[0]+g*p1[0],p3[0]-p0[0]+h*p3[0],p0[0],p1[1]-p0[1]+g*p1[1],p3[1]-p0[1]+h*p3[1],p0[1],g,h,1];
}
function shader(gl,type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh}
class DoorProjector{
 constructor(){
  this.canvas=document.createElement('canvas');
  const gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:true,preserveDrawingBuffer:true});
  if(!gl)throw Error('WebGL unavailable');
  this.gl=gl;
  const vs=shader(gl,gl.VERTEX_SHADER,'attribute vec2 position;varying vec2 screen;void main(){screen=(position+1.0)*0.5;gl_Position=vec4(position,0.,1.);}');
  const fs=shader(gl,gl.FRAGMENT_SHADER,'precision highp float;varying vec2 screen;uniform mat3 invH;uniform vec2 size;uniform sampler2D door;void main(){vec2 xy=vec2(screen.x,1.0-screen.y)*size;vec3 uvh=invH*vec3(xy,1.0);if(abs(uvh.z)<0.000001)discard;vec2 uv=uvh.xy/uvh.z;if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0)discard;gl_FragColor=texture2D(door,uv);}');
  const pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);this.program=pr;
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const attr=gl.getAttribLocation(pr,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
  this.invLoc=gl.getUniformLocation(pr,'invH');this.sizeLoc=gl.getUniformLocation(pr,'size');
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(pr,'door'),0);this.lastImage=null;
 }
 draw(ctx,img,quad,w,h){
  const gl=this.gl,inv=inverse(matrix(quad));if(!inv)return false;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;gl.viewport(0,0,w,h)}
  gl.useProgram(this.program);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  if(this.lastImage!==img){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);this.lastImage=img}
  // GLSL matrices are column-major.
  gl.uniformMatrix3fv(this.invLoc,false,new Float32Array([inv[0],inv[3],inv[6],inv[1],inv[4],inv[7],inv[2],inv[5],inv[8]]));
  gl.uniform2f(this.sizeLoc,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  ctx.drawImage(this.canvas,0,0);return true;
 }
}
global.DoorProjector=DoorProjector;
})(window);

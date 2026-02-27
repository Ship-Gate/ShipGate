import { useEffect, useRef, useCallback, type RefObject } from "react";

/* ── Vertex shader (fullscreen quad) ── */
const VERT = `#version 300 es
in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/* ── Buffer A: mouse-smoothing state (only pixel 0,0 matters) ── */
const BUFFER_FRAG = `#version 300 es
precision highp float;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
out vec4 O;
void main(){
  vec2 u=gl_FragCoord.xy;
  if(u.x>1.5||u.y>1.5){O=vec4(0);return;}
  vec4 prev=texelFetch(iChannel0,ivec2(0,0),0);
  vec2 sm=prev.xy; float rel=prev.z; float wp=prev.w;
  vec2 ctr=vec2(0.5);
  bool md=iMouse.z>0.5;
  vec2 mp=iMouse.xy/iResolution.xy;
  bool ib=mp.x>0.02&&mp.x<0.98&&mp.y>0.08&&mp.y<0.98;
  bool vc=iMouse.x>5.0&&iMouse.y>5.0&&iMouse.x<(iResolution.x-5.0)&&iMouse.y<(iResolution.y-5.0);
  if(iFrame==0){sm=ctr;rel=iTime;wp=0.0;}
  bool act=md&&ib&&vc;
  if(act){sm=mp;rel=iTime;wp=1.0;}
  else{wp=0.0;float dur=3.0;float el=iTime-rel;float pr=clamp(el/dur,0.0,1.0);pr=1.0-pow(1.0-pr,3.0);sm=mix(sm,ctr,pr);}
  O=vec4(sm,rel,wp);
}
`;

/* ── Main image shader ── */
const MAIN_FRAG = `#version 300 es
precision highp float;
uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform float uScroll;
uniform vec3 uShipColor;
uniform float uIsMobile;
out vec4 O;

#define T iTime
#define PI 3.14159265358979
#define TAU 6.283185
#define MAX_STEPS 50
#define MAX_DIST 20.0
#define SURF_DIST 0.001

struct ITSC{vec3 p;float dist;vec3 n;vec2 uv;};

mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.0-h);}
mat3 rotationMatrixY(float t){float c=cos(t),s=sin(t);return mat3(c,0,s,0,1,0,-s,0,c);}
mat3 rotationMatrixX(float t){float c=cos(t),s=sin(t);return mat3(1,0,0,0,c,-s,0,s,c);}
mat3 rotationMatrixZ(float t){float c=cos(t),s=sin(t);return mat3(c,-s,0,s,c,0,0,0,1);}
vec3 rotateX(vec3 p,float t){return rotationMatrixX(t)*p;}
vec3 rotateY(vec3 p,float t){return p*rotationMatrixY(t);}
vec3 rotateZ(vec3 p,float t){return p*rotationMatrixZ(t);}
float rounding(float d,float h){return d-h;}
float opUnion(float d1,float d2){return min(d1,d2);}
float opSmoothUnion(float d1,float d2,float k){float h=max(k-abs(d1-d2),0.0);return min(d1,d2)-h*h*0.25/k;}
float opSmoothSubtraction(float d1,float d2,float k){float h=clamp(0.5-0.5*(d2+d1)/k,0.0,1.0);return mix(d2,-d1,h)+k*h*(1.0-h);}
float sdCircle(vec3 p,float r){return length(p)-r;}
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
float sdCappedCylinder(vec3 p,float h,float r){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(h,r);return min(max(d.x,d.y),0.0)+length(max(d,0.0));}
float ndot(vec2 a,vec2 b){return a.x*b.x-a.y*b.y;}
float sdRhombus(vec3 p,float la,float lb,float h,float ra){p=abs(p);vec2 b=vec2(la,lb);float f=clamp((ndot(b,b-2.0*p.xz))/dot(b,b),-1.0,1.0);vec2 q=vec2(length(p.xz-0.5*b*vec2(1.0-f,1.0+f))*sign(p.x*b.y+p.z*b.x-b.x*b.y)-ra,p.y-h);return min(max(q.x,q.y),0.0)+length(max(q,0.0));}
float sdEllipsoid(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.0)/k1;}
float sdCapsule(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*h)-r;}

float lenReactor=0.4;
float createReactor(vec3 p,float rad,float len,out int material){
  p=vec3(p.x,p.y,abs(p.z)-0.5);
  float reactor1=sdCappedCylinder(p,rad-0.02,len);
  reactor1=rounding(reactor1,0.02);
  vec3 q=p;q+=vec3(rad*0.8,0.0,0.0);
  float feature1=sdCappedCylinder(q,rad*0.5,len*0.3);
  reactor1=opUnion(reactor1,feature1);
  q=p;q+=vec3(0.0,-len,0.0);
  float fire=sdCircle(q,0.6*rad);
  reactor1=opUnion(reactor1,fire);
  if(fire==reactor1){material=2;}else{material=1;}
  return reactor1;
}

float random2(vec2 uv){return fract(sin(dot(vec2(100.,213.),uv))*3141.);}
float value_noise(vec2 uv){vec2 i=floor(uv);vec2 f=fract(uv);f=f*f*(3.-2.*f);float b=mix(random2(i),random2(i+vec2(1.,0.)),f.x);float t=mix(random2(i+vec2(0.,1.)),random2(i+vec2(1.)),f.x);return mix(b,t,f.y);}
float noise2d(vec2 uv){float n=value_noise(uv);n+=value_noise(uv*2.)*0.5;n+=value_noise(uv*4.)*0.25;n+=value_noise(uv*8.)*0.125;n+=value_noise(uv*16.)*0.0625;return n/1.9375;}

float sdJet(vec3 p,float side){
  p=rotateZ(p,PI);p=rotateX(p,PI);
  p.x-=side*0.5;p.z-=0.05;
  float r=0.1-p.z*0.05;r=max(r,0.0);
  float d=length(p.xy)-r;
  d=max(d,-p.z);d=max(d,p.z-0.7);
  return d;
}

vec3 hueShift(vec3 col,float shift){
  vec3 m=vec3(cos(shift),-sin(shift)*0.57735,0.0);
  m=vec3(m.xy,-m.y)+(1.0-m.x)*0.33333;
  return mat3(m,m.zxy,m.yzx)*col;
}

vec2 rotate2d(vec2 p,float a){return vec2(p.x*cos(a)-p.y*sin(a),p.x*sin(a)+p.y*cos(a));}

float nse3d(vec3 x){
  vec3 p=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
  vec2 uv=(p.xy+vec2(37.0,17.0)*p.z)+f.xy;
  vec2 rg=textureLod(iChannel1,(uv+0.5)/256.0,0.0).yx;
  return mix(rg.x,rg.y,f.z);
}

float densA=1.0,densB=2.0;

float fbm3(vec3 p){
  p+=(nse3d(p*3.0)-0.5)*0.3;
  float mtn=iTime*0.15;
  float v=0.0;float fq=1.0,am=0.5;
  for(int i=0;i<6;i++){v+=nse3d(p*fq+mtn*fq)*am;fq*=2.0;am*=0.5;}
  return v;
}

float hash1(float p){return fract(sin(p*172.435)*29572.683)-0.5;}
float ns(float p){float fr=fract(p);float fl=floor(p);return mix(hash1(fl),hash1(fl+1.0),fr);}
float fbm1(float p){return(ns(p)*0.4+ns(p*2.0-10.0)*0.125+ns(p*8.0+10.0)*0.025);}
float fbmd(float p){float h=0.01;return atan(fbm1(p+h)-fbm1(p-h),h);}

void tPlane(inout ITSC hit,vec3 ro,vec3 rd,vec3 o,vec3 n,vec3 tg,vec2 si){
  vec2 uv;ro-=o;float t=-dot(ro,n)/dot(rd,n);
  if(t<0.0)return;
  vec3 its=ro+rd*t;uv.x=dot(its,tg);uv.y=dot(its,cross(tg,n));
  if(abs(uv.x)>si.x||abs(uv.y)>si.y)return;
  hit.dist=t;hit.uv=uv;
}

float arcsmp(float x,float seed){return fbm1(x*3.0+seed*1111.111)*(1.0-exp(-x*5.0));}
float arc(vec2 p,float seed,float len){
  p*=len;float v=abs(p.y-arcsmp(p.x,seed));
  v+=exp((2.0-p.x)*-4.0);v=exp(v*-60.0)+exp(v*-10.0)*0.6;
  v*=smoothstep(0.0,0.05,p.x);return v;
}
float arcc(vec2 p,float sd){
  float v=0.0;float rnd=fract(sd);float sp=0.0;
  v+=arc(p,sd,1.0);
  for(int i=0;i<4;i++){
    sp=rnd+0.01;vec2 mrk=vec2(sp,arcsmp(sp,sd));
    v+=arc(rotate2d(p-mrk,fbmd(sp)),mrk.x,mrk.x*0.4+1.5);
    rnd=fract(sin(rnd*195.2837)*1720.938);
  }
  return v;
}

ITSC raycylh(vec3 ro,vec3 rd,vec3 c,float r){
  ITSC ii;ii.dist=1e38;
  vec3 e=ro-c;float a=dot(rd.xy,rd.xy);float b=2.0*dot(e.xy,rd.xy);
  float cc=dot(e.xy,e.xy)-r;float f=b*b-4.0*a*cc;
  if(f>0.0){f=sqrt(f);float t=(-b+f)/(2.0*a);
    if(t>0.001){ii.dist=t;ii.p=e+rd*t;ii.n=-vec3(normalize(ii.p.xy),0.0);}}
  return ii;
}

float nse(vec2 p){return texture(iChannel1,p).x;}
float hash33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float valueNoise3(vec3 p){
  vec3 i=floor(p);vec3 f=fract(p);f=f*f*(3.0-2.0*f);
  float a=hash33(i);float b=hash33(i+vec3(1,0,0));float c=hash33(i+vec3(0,1,0));float d=hash33(i+vec3(1,1,0));
  float e=hash33(i+vec3(0,0,1));float f2=hash33(i+vec3(1,0,1));float g=hash33(i+vec3(0,1,1));float h=hash33(i+vec3(1,1,1));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,f2,f.x),mix(g,h,f.x),f.y),f.z);
}
float noise3d(vec3 p){
  float n=0.0;float amp=0.5;float freq=1.0;
  for(int i=0;i<5;i++){n+=valueNoise3(p*freq)*amp;freq*=2.0;amp*=0.5;p+=vec3(23.71,17.37,41.92)*0.07;}
  return n;
}

float jetMask(vec2 uv,float depth){
  uv-=0.5;uv.y-=0.35;uv.x*=2.8;uv.y*=0.55+depth*1.8;
  float dist2=length(uv);float flame=0.07/(dist2+0.02);
  flame*=smoothstep(0.45,0.0,dist2);flame*=smoothstep(-0.1,0.4,uv.y);
  return flame;
}

vec2 getShipOffset(float t){
  vec2 mouse=texelFetch(iChannel0,ivec2(0,0),0).xy;
  mouse.x+=sin(iTime)*0.04;mouse.y+=sin(iTime*0.73)*0.04;
  mouse=mouse*2.0-1.0;mouse.x*=iResolution.x/iResolution.y;mouse.y+=0.2;
  float maxR=2.0;float len2=length(mouse);
  if(len2>maxR)mouse=mouse/len2*maxR;
  return mouse*0.5;
}
float getShipRoll(vec2 so,float t,float scrollCurveRoll){return -so.x*1.5+scrollCurveRoll;}
float getShipPitch(vec2 so,float t){return so.y*1.5+0.2;}

float map(vec3 pos,out int material){
  material=1;
  vec2 shipOffset=getShipOffset(iTime);
  pos.xy-=shipOffset;
  float roll=getShipRoll(shipOffset,iTime,cos(uScroll*600.0*0.12)*0.12*2.5*1.0);
  float pitch=getShipPitch(shipOffset,iTime);
  pos.xy=pos.xy*mat2(cos(roll),-sin(roll),sin(roll),cos(roll));
  pos.yz=pos.yz*mat2(cos(pitch),-sin(pitch),sin(pitch),cos(pitch));
  int dummy;
  if(material==0)material=dummy;
  vec3 q=pos;q=rotateZ(q,PI*0.5);q=rotateX(q,PI*0.5);
  float rad=0.12;
  float reactor=createReactor(q,rad,lenReactor,material);
  q=pos;float coreD=sdRhombus(q,0.3,0.1,0.05,0.2);
  float reactorD=reactor;
  if(coreD<reactorD){material=1;}
  float link=opSmoothUnion(coreD,reactorD,0.1);
  q=vec3(abs(pos.x),pos.y-0.05,pos.z);
  float gun=sdCapsule(q,vec3(0.1,0.0,-0.1),vec3(0.1,0.0,-0.4),0.01);
  link=opUnion(gun,link);if(link==gun){material=1;}
  q=pos+vec3(0.0,0.0,-0.5);
  float core1=sdEllipsoid(q,vec3(0.2,0.15,0.8));
  link=opSmoothUnion(core1,link,0.05);if(link==core1){material=1;}
  q=pos+vec3(0.0,-0.1,-0.3);
  float cockpit=sdEllipsoid(q,vec3(0.1,0.1,0.2));
  link=opUnion(cockpit,link);if(link==cockpit){material=3;}
  vec3 qjet=pos;float jet1=sdJet(qjet,-1.0);float jet2=sdJet(qjet,1.0);
  float jetDist=min(jet1,jet2);
  if(jetDist<0.005){material=(jet1<jet2)?4:5;return link;}
  return link;
}

vec2 RayMarch(vec3 ro,vec3 rd,out int mat2d){
  float dO=0.0;float dM=MAX_DIST;
  for(int i=0;i<MAX_STEPS;i++){
    vec3 p=ro+rd*dO;float dS=map(p,mat2d);
    if(dS<dM)dM=dS;dO+=dS;
    if(dO>MAX_DIST||abs(dS)<SURF_DIST)break;
  }
  return vec2(dO,dM);
}

vec3 GetNormal(vec3 p){
  int mat2d=0;float d=map(p,mat2d);vec2 e=vec2(0.001,0);
  vec3 n=d-vec3(map(p-e.xyy,mat2d),map(p-e.yxy,mat2d),map(p-e.yyx,mat2d));
  return normalize(n);
}

vec3 R(vec2 uv,vec3 p,vec3 l,float z){
  vec3 f=normalize(l-p),r=normalize(cross(vec3(0,1,0),f)),u=cross(f,r),c2=p+f*z,i=c2+uv.x*r+uv.y*u;
  return normalize(i-p);
}

float calcAO(vec3 pos,vec3 nor,float time2){
  float occ=0.0;float sca=1.0;int mat2d=0;
  for(int i=0;i<5;i++){float h=0.01+0.12*float(i)/4.0;float d=map(pos+h*nor,mat2d);occ+=(h-d)*sca;sca*=0.95;}
  return clamp(1.0-3.0*occ,0.0,1.0);
}

float calcSoftshadow(vec3 ro,vec3 rd,float tmin,float tmax,float k){
  int mat2d=0;float res=1.0;float t=tmin;
  for(int i=0;i<50;i++){float h=map(ro+rd*t,mat2d);res=min(res,k*h/t);t+=clamp(h,0.02,0.20);if(res<0.005||t>tmax)break;}
  return clamp(res,0.0,1.0);
}

void main(){
  vec2 u=gl_FragCoord.xy;
  vec4 o=vec4(0);
  float d=0.0,e,s,nn,snd,t=T;
  vec3 b=vec3(0),c=vec3(0),r=iResolution,p;
  vec2 uv=u.xy/iResolution.xy;
  uv=2.0*uv-1.0;
  uv.x*=iResolution.x/iResolution.y;

  vec2 shipOffset=getShipOffset(iTime);
  float scrollZ=uScroll*600.0;
  float scrollCurveRoll=cos(scrollZ*0.12)*0.12*2.5*1.0;
  float roll=getShipRoll(shipOffset,iTime,scrollCurveRoll);
  float camtm=scrollZ;
  float curveX=sin(scrollZ*0.12)*2.5;
  float curveY=cos(scrollZ*0.08)*1.8;
  vec3 ro=vec3(shipOffset.x+curveX,shipOffset.y+curveY,camtm);
  vec3 rd=normalize(vec3(uv,1.0));
  float sd2=sin(u.x*0.01+u.y*3.333333333+iTime)*1298729.146861;

  vec3 arcPositions[3];
  float arcIntensities[3];
  float totalArcIntensity=0.0;
  vec4 rnd=vec4(0.1,0.2,0.3,0.4);
  for(int j=0;j<3;j++){
    rnd=fract(sin(rnd*1.111111)*298729.258972);
    float ts=rnd.z*8.0*1.61803398875+3.0;
    float arcfr=fract(iTime/ts+rnd.y)*ts;
    float arcdur=rnd.x*0.25+0.08;
    float arcint=smoothstep(0.1+arcdur,arcdur,arcfr);
    float timeFade=1.0-smoothstep(arcdur*0.6,arcdur,arcfr);
    float fullIntensity=arcint*timeFade*0.4;
    float arcBaseZ=ro.z+1.0+rnd.x*1.0;
    float direction=sign(rnd.y-0.5);
    float arcSpeed=0.5;
    float arcz=arcBaseZ*(1.0+arcfr*arcSpeed*direction);
    float maxForward=arcBaseZ+2.0;float maxBackward=arcBaseZ-1.0;
    arcz=clamp(arcz,maxBackward,maxForward);
    vec2 arcOff=getShipOffset(iTime)*1.5;
    arcPositions[j]=vec3(arcOff.x,arcOff.y,arcz);
    arcIntensities[j]=fullIntensity;
    totalArcIntensity+=arcint;
  }

  float baseTunnelRadius=densB+1.0*(densA-densB)+fract(sd2)*0.07;
  float arcScale=0.8+totalArcIntensity*0.4;
  ITSC tunRef=raycylh(ro,rd,vec3(0.0),baseTunnelRadius*arcScale);

  float bass=texture(iChannel2,vec2(0.0,0.25)).x;
  bass=bass>0.01?bass*bass:0.3+0.1*sin(t*1.5);
  bass*=0.35;

  vec2 curveOff=vec2(curveX,curveY);
  vec2 tunnelCenter=(shipOffset+curveOff)*0.3;
  d=0.0;
  b.xy=u=(u+u-r.xy)/r.y;

  for(int iter=0;iter<32;iter++){
    float pz=d+scrollZ;
    float localCX=sin(pz*0.12)*2.5;
    float localCY=cos(pz*0.08)*1.8;
    p=vec3(u*d,pz);
    p.xy-=(shipOffset+vec2(localCX,localCY))*d*0.3;
    e=100.0;s=16.0-length(p.xy);
    for(nn=0.08;nn<2.0;nn+=nn){
      s-=abs(dot(sin(s)/s*sin(0.3*p.z+scrollZ+0.5*p/nn),r/r))*nn;
    }
    snd=texture(iChannel2,vec2(u.x/length(r)+float(iter)/42.0,0.0)).r;
    d+=s=min(0.04+0.2*abs(s),e);
    c+=(0.08+bass*bass+(pow(2.0*snd,2.0)+0.05)*max(max(arcIntensities[0],arcIntensities[1]),arcIntensities[2]))*(1.0/s-1.0/e/50.0+hueShift(0.4*vec3(1,3,2)/length(u-tunnelCenter),snd+scrollZ));
  }

  tunnelCenter=shipOffset*0.3;
  rnd=vec4(0.1,0.2,0.3,0.4);
  float arcv=0.0,arclight=0.0;

  for(int i=0;i<3;i++){
    float v=0.0;
    rnd=fract(sin(rnd*1.111111)*298729.258972);
    vec3 arcCenter=arcPositions[i];
    float arcIntensity=arcIntensities[i];
    if(arcIntensity<0.01)continue;
    ITSC arcits;arcits.dist=1e38;
    float arcfl=floor(iTime/(rnd.z*4.0*1.61803398875+1.0)+rnd.y);
    float arca=rnd.x+arcfl*2.39996;
    float planeSize=(baseTunnelRadius*arcScale)*1.0;
    vec3 arcTangent=vec3(-sin(arca),cos(arca),0.0);
    tPlane(arcits,ro,rd,arcCenter,vec3(0.0,0.0,-1.0),arcTangent,vec2(planeSize));
    float arcseed=floor(iTime*max(10.0,abs(rnd.z))+rnd.y);
    if(arcits.dist<20.0){
      arcits.uv*=0.8;float xCoord=abs(arcits.uv.x);
      float blend=smoothstep(0.0,0.05,xCoord);
      v=arcc(vec2(1.0-xCoord,arcits.uv.y)*1.4,arcseed*0.033333)*blend;
    }
    v*=arcIntensity;arcv+=v;
    arclight+=exp(abs(arcCenter.z-tunRef.p.z)*-0.3)*fract(sin(arcseed)*198721.6231)*arcIntensity;
  }
  c+=arcv*vec3(0.9,0.7,0.7)*20.0;

  /* ── HUGE PORTAL GATE — ship flies through on scroll ── */
  {
    float gateZ=3.50;
    float gateRadius=5.0;
    float tubeRadius=0.05;
    vec3 gateCenter=vec3(0,1.50,gateZ);
    float gateDist=gateCenter.z-ro.z;
    float gateVis=smoothstep(-4.0,0.0,gateDist)*smoothstep(60.0,5.0,gateDist);
    if(gateVis>0.001){
      float tHit=gateDist/rd.z;
      if(tHit>0.0){
        vec3 hp=ro+rd*tHit-gateCenter;
        float r2d=length(hp.xy);
        float ringDist=r2d-gateRadius;
        float torusDist=length(vec2(ringDist,0.0))-tubeRadius;
        float angle=atan(hp.y,hp.x);

        float glow=exp(-max(torusDist,0.0)*5.0)*400.0;
        float softGlow=exp(-abs(ringDist)*0.6)*80.0;

        float hexSeg=pow(0.5+0.5*sin(angle*6.0),8.0);
        float hexPulse=0.7+0.3*sin(iTime*3.0+angle*2.0);
        float onRing=exp(-abs(ringDist)*6.0);

        float chevAngle=angle+iTime*2.5;
        float chevrons=pow(0.5+0.5*sin(chevAngle*12.0),10.0);

        float inside=smoothstep(gateRadius+1.2,gateRadius-3.0,r2d);
        float portalFill=inside*15.0;

        float beamAngle=mod(angle+PI*0.25,PI*0.5)-PI*0.25;
        float beam=exp(-abs(beamAngle)*30.0)*smoothstep(gateRadius+0.8,gateRadius,r2d)*smoothstep(gateRadius-1.5,gateRadius,r2d);

        vec3 gateCol=mix(vec3(0.0,0.8,1.0),vec3(0.6,0.0,1.0),0.5+0.5*sin(angle*6.0+iTime));
        vec3 portalCol=vec3(0.0,0.8,1.0);

        c+=gateVis*(
          glow*gateCol+
          softGlow*gateCol*0.5+
          hexSeg*hexPulse*onRing*vec3(0.0,1.0,1.0)*400.0+
          chevrons*onRing*vec3(0.4,0.9,1.0)*250.0+
          portalFill*portalCol+
          beam*vec3(0.2,0.8,1.0)*200.0
        );

        float halo=exp(-abs(r2d-gateRadius*1.3)*1.0)*25.0;
        float halo2=exp(-abs(r2d-gateRadius*1.5)*1.5)*12.0;
        float halo3=exp(-abs(r2d-gateRadius*1.7)*2.0)*6.0;
        c+=gateVis*(halo*vec3(0.1,0.5,1.0)+halo2*vec3(0.3,0.0,0.6)+halo3*vec3(0.1,0.3,0.8));
      }
    }
  }

  vec3 rot2=vec3(0,0.2,-1.1);rot2.y=max(rot2.y,-0.9);
  float shipBankAngle=scrollCurveRoll*0.8;
  vec2 bankedUV=uv+vec2(0,0.5);
  bankedUV=bankedUV*mat2(cos(shipBankAngle),-sin(shipBankAngle),sin(shipBankAngle),cos(shipBankAngle));
  vec3 rdt=R(bankedUV,rot2,vec3(0),1.0);
  float dist2=0.0;
  int mat2d=0;
  dist2=RayMarch(rot2,rdt,mat2d).x;
  p=rot2+rdt*dist2;
  vec3 f0=vec3(1.0);
  bool skipLighting=false;
  vec3 col=vec3(0);

  if(mat2d==1){
    vec3 te=0.5*texture(iChannel1,p.xy).xyz+0.5*texture(iChannel1,p.xz).xyz;
    te=0.7*te;
    // Apply custom ship color with texture influence
    te=mix(te, uShipColor, 0.6);
    f0=te;
  }else if(mat2d==2){
    col=vec3(2.0,0.8,0.2)*(1.5+0.8*sin(iTime*8.0));skipLighting=true;
  }else if(mat2d==3){
    f0=vec3(0.1);
  }else if(mat2d==4||mat2d==5){
    float side=(mat2d==4)?-1.0:1.0;
    vec3 lp=p;
    vec2 shipOffset2=getShipOffset(iTime);
    lp.xy-=shipOffset2;
    float roll2=getShipRoll(shipOffset2,iTime,scrollCurveRoll);
    float pitch2=getShipPitch(shipOffset2,iTime);
    lp.yz=lp.yz*mat2(cos(-pitch2),sin(-pitch2),-sin(-pitch2),cos(-pitch2));
    lp.xy=lp.xy*mat2(cos(-roll2),sin(-roll2),-sin(-roll2),cos(-roll2));
    lp=rotateZ(lp,PI);lp=rotateX(lp,PI);
    lp.x-=side*0.5;lp.z+=0.5;
    float along=lp.z;
    float turb=noise3d(lp*vec3(6.0,6.0,12.0)-vec3(0,0,iTime*7.0));
    turb+=0.5*noise3d(lp*16.0-vec3(0,0,iTime*14.0));
    float radialDist=length(lp.xy);
    vec3 orange=vec3(1.0,1.0,0.5);vec3 red=vec3(2.0,0.0,0.0);
    vec3 colJet=mix(normalize(orange),normalize(red),smoothstep(0.0,0.1,radialDist));
    colJet=mix(colJet,red,smoothstep(0.15,0.4,radialDist));
    colJet*=2.0+turb*3.0;colJet*=0.75+0.25*abs(sin(iTime*80.0));colJet*=exp(-along*1.1);
    col=colJet;f0=colJet;skipLighting=true;
  }

  if(dist2<MAX_DIST&&!skipLighting){
    vec3 lightPos=vec3(0.0,5.0,2.0);
    vec3 l=normalize(lightPos-p);
    vec3 n=GetNormal(p);
    float occ=0.3*calcAO(p,n,iTime);
    float dif=clamp(dot(n,l)*0.5+0.5,0.0,1.0);
    vec3 ref=reflect(rdt,n);
    vec3 spe=vec3(0.3)*smoothstep(0.4,0.6,ref.y);
    float fre=clamp(1.0+dot(rdt,n),0.0,1.0);
    spe*=f0+(1.0-f0)*pow(fre,5.0);spe*=6.0;
    float shadow=calcSoftshadow(p,lightPos,0.001,1.0,8.0);
    dif*=shadow;
    col+=vec3(0.7,0.8,1.1)*dif*occ;
    col+=vec3(0.7,0.8,1.1)*spe*dif;
    lightPos=normalize(vec3(1.7,0.2,-0.4));
    dif=clamp(dot(n,lightPos),0.0,1.0);
    shadow=calcSoftshadow(p,lightPos,0.001,1.0,8.0);
    shadow=mix(0.4,1.0,shadow);
    vec3 hal=normalize(lightPos-rdt);
    spe=vec3(1)*pow(clamp(dot(hal,n),0.0,1.0),32.0);
    spe*=f0+(1.0-f0)*pow(1.0-clamp(dot(hal,lightPos),0.0,1.0),5.0);
    col+=vec3(1.0,0.6,0.3)*dif*f0*occ;
    col+=vec3(1.0,0.6,0.3)*spe*shadow;
    dif=clamp(0.5-0.5*n.y,0.0,1.0);col+=dif*f0*occ;
    lightPos=normalize(vec3(abs(p.x)-0.5,0.0,lenReactor));
    dif=clamp(dot(n,lightPos),0.0,1.0);
    shadow=calcSoftshadow(p,lightPos,0.001,1.0,8.0);
    col+=(0.7+0.3*cos(iTime))*vec3(1.0,0.5,0.1)*dif*shadow;
  }

  o=tanh(o/1e3);
  o.rgb=tanh(col+((dist2<2.5)?0.0:1.0)*(c/90.0));
  O=o;
}
`;

/* ── Helpers ── */
function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const pg = gl.createProgram();
  if (!pg) return null;
  gl.attachShader(pg, vs);
  gl.attachShader(pg, fs);
  gl.linkProgram(pg);
  if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(pg));
    gl.deleteProgram(pg);
    return null;
  }
  return pg;
}

function createFBO(gl: WebGL2RenderingContext, w: number, h: number) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb };
}

function makeNoiseTex(gl: WebGL2RenderingContext) {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = (Math.random() * 255) | 0;
    data[i * 4] = v;
    data[i * 4 + 1] = (Math.random() * 255) | 0;
    data[i * 4 + 2] = (Math.random() * 255) | 0;
    data[i * 4 + 3] = 255;
  }
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

function makeAudioTex(gl: WebGL2RenderingContext) {
  const w = 512, h = 2;
  const data = new Uint8Array(w * h * 4);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function updateAudioTex(gl: WebGL2RenderingContext, tex: WebGLTexture, time: number) {
  const w = 512, h = 2;
  const data = new Uint8Array(w * h * 4);
  for (let x = 0; x < w; x++) {
    const freq = x / w;
    const v0 = Math.max(0, Math.min(255,
      (0.3 + 0.2 * Math.sin(time * 1.5 + freq * 6.28) +
       0.1 * Math.sin(time * 3.7 + freq * 12.56)) * 255
    ));
    // row 0 – spectrum
    data[(x) * 4] = v0;
    data[(x) * 4 + 1] = v0;
    data[(x) * 4 + 2] = v0;
    data[(x) * 4 + 3] = 255;
    // row 1 – waveform
    const v1 = Math.max(0, Math.min(255,
      (0.5 + 0.4 * Math.sin(time * 2.0 + freq * 25.0)) * 255
    ));
    const i1 = (w + x) * 4;
    data[i1] = v1;
    data[i1 + 1] = v1;
    data[i1 + 2] = v1;
    data[i1 + 3] = 255;
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
}

interface DangerousMissionProps {
  scrollRef?: RefObject<number>;
}

export default function DangerousMission({ scrollRef }: DangerousMissionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, z: 0, w: 0 });
  const rafRef = useRef(0);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) { console.error("WebGL2 not supported"); return; }

    /* Float textures for buffer */
    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) console.warn("EXT_color_buffer_float not available – buffer pass may fail");

    /* Compile programs */
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const bufFs = compileShader(gl, gl.FRAGMENT_SHADER, BUFFER_FRAG);
    const mainFs = compileShader(gl, gl.FRAGMENT_SHADER, MAIN_FRAG);
    if (!vs || !bufFs || !mainFs) return;

    const bufProg = linkProgram(gl, vs, bufFs);
    /* Need a second VS instance for the main program */
    const vs2 = compileShader(gl, gl.VERTEX_SHADER, VERT);
    if (!vs2) return;
    const mainProg = linkProgram(gl, vs2, mainFs);
    if (!bufProg || !mainProg) return;

    /* Fullscreen quad VAO */
    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(bufProg, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    /* Also bind for main program */
    const aPos2 = gl.getAttribLocation(mainProg, "a_pos");
    if (aPos2 >= 0 && aPos2 !== aPos) {
      gl.enableVertexAttribArray(aPos2);
      gl.vertexAttribPointer(aPos2, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);

    /* Textures */
    const noiseTex = makeNoiseTex(gl);
    const audioTex = makeAudioTex(gl);

    /* Resize handling */
    let w = 0, h = 0;
    const isMobileDevice = window.innerWidth < 768 || 'ontouchstart' in window;
    const dpr = Math.min(window.devicePixelRatio, isMobileDevice ? 1.5 : 1.5);

    let bufA = createFBO(gl, 4, 4); // only pixel 0,0 matters
    let bufB = createFBO(gl, 4, 4);

    const resize = () => {
      w = canvas.parentElement?.clientWidth || window.innerWidth;
      h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    /* Mouse */
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - rect.left) * dpr;
      mouseRef.current.y = (h * dpr) - (e.clientY - rect.top) * dpr;
    };
    const onDown = (e: MouseEvent) => {
      onMove(e);
      mouseRef.current.z = mouseRef.current.x;
      mouseRef.current.w = mouseRef.current.y;
    };
    const onUp = () => { mouseRef.current.z = 0; mouseRef.current.w = 0; };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onUp);

    /* Uniform locations */
    const bufU = {
      iTime: gl.getUniformLocation(bufProg, "iTime"),
      iFrame: gl.getUniformLocation(bufProg, "iFrame"),
      iMouse: gl.getUniformLocation(bufProg, "iMouse"),
      iResolution: gl.getUniformLocation(bufProg, "iResolution"),
      iChannel0: gl.getUniformLocation(bufProg, "iChannel0"),
    };
    const mainU = {
      iTime: gl.getUniformLocation(mainProg, "iTime"),
      iResolution: gl.getUniformLocation(mainProg, "iResolution"),
      iMouse: gl.getUniformLocation(mainProg, "iMouse"),
      iChannel0: gl.getUniformLocation(mainProg, "iChannel0"),
      iChannel1: gl.getUniformLocation(mainProg, "iChannel1"),
      iChannel2: gl.getUniformLocation(mainProg, "iChannel2"),
      uScroll: gl.getUniformLocation(mainProg, "uScroll"),
      uShipColor: gl.getUniformLocation(mainProg, "uShipColor"),
      uIsMobile: gl.getUniformLocation(mainProg, "uIsMobile"),
    };

    let frame = 0;
    const t0 = performance.now() / 1000;

    const draw = () => {
      const now = performance.now() / 1000 - t0;
      const cw = canvas.width, ch = canvas.height;
      const m = mouseRef.current;

      /* Update fake audio */
      updateAudioTex(gl, audioTex, now);

      gl.bindVertexArray(vao);

      /* ── Pass 1: Buffer A ── */
      gl.useProgram(bufProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bufA.fb);
      gl.viewport(0, 0, 4, 4);
      gl.uniform1f(bufU.iTime, now);
      gl.uniform1i(bufU.iFrame, frame);
      gl.uniform4f(bufU.iMouse, m.x, m.y, m.z, m.w);
      gl.uniform2f(bufU.iResolution, cw, ch);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bufB.tex);
      gl.uniform1i(bufU.iChannel0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      /* ── Pass 2: Main image ── */
      gl.useProgram(mainProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, ch);
      gl.uniform1f(mainU.iTime, now);
      gl.uniform3f(mainU.iResolution, cw, ch, 1.0);
      gl.uniform4f(mainU.iMouse, m.x, m.y, m.z, m.w);
      gl.uniform1f(mainU.uScroll, scrollRef?.current ?? 0);
      // Ship color: cyan by default
      gl.uniform3f(mainU.uShipColor, 0.0, 0.8, 1.0);
      // Mobile flag for ship scaling
      gl.uniform1f(mainU.uIsMobile, isMobileDevice ? 1.0 : 0.0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bufA.tex);
      gl.uniform1i(mainU.iChannel0, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, noiseTex);
      gl.uniform1i(mainU.iChannel1, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, audioTex);
      gl.uniform1i(mainU.iChannel2, 2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      /* Swap buffers */
      const tmp = bufA; bufA = bufB; bufB = tmp;
      frame++;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cleanup();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onUp);
    };
  }, [cleanup]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}

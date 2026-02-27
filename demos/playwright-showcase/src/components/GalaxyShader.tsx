import { useRef, useEffect } from 'react';
import './GalaxyShader.css';

// Galaxy shader — Frank Hugenroth /frankenburgh/ nordlicht/bremen 2015
// Wrapped for WebGL: mainImage(fragColor, fragCoord), uniforms iTime, iResolution

const FRAGMENT_SHADER = `
precision highp float;
uniform float iTime;
uniform vec2 iResolution;

float hash(float n) {
  return fract(cos(n)*41415.92653);
}

float noise(vec2 x) {
  vec2 p  = floor(x);
  vec2 f  = smoothstep(0.0, 1.0, fract(x));
  float n = p.x + p.y*57.0;
  return mix(mix(hash(n+0.0), hash(n+1.0), f.x),
    mix(hash(n+57.0), hash(n+58.0), f.x), f.y);
}

float noise(vec3 x) {
  vec3 p  = floor(x);
  vec3 f  = smoothstep(0.0, 1.0, fract(x));
  float n = p.x + p.y*57.0 + 113.0*p.z;
  return mix(mix(mix(hash(n+0.0), hash(n+1.0), f.x),
    mix(hash(n+57.0), hash(n+58.0), f.x), f.y),
    mix(mix(hash(n+113.0), hash(n+114.0), f.x),
    mix(hash(n+170.0), hash(n+171.0), f.x), f.y), f.z);
}

mat3 m = mat3(0.00, 1.60, 1.20, -1.60, 0.72, -0.96, -1.20, -0.96, 1.28);

float fbmslow(vec3 p) {
  float f = 0.5000*noise(p); p = m*p*1.2;
  f += 0.2500*noise(p); p = m*p*1.3;
  f += 0.1666*noise(p); p = m*p*1.4;
  f += 0.0834*noise(p); p = m*p*1.84;
  return f;
}

float fbm(vec3 p) {
  float f = 0., a = 1., s = 0.;
  f += a*noise(p); p = m*p*1.149; s += a; a *= .75;
  f += a*noise(p); p = m*p*1.41; s += a; a *= .75;
  f += a*noise(p); p = m*p*1.51; s += a; a *= .65;
  f += a*noise(p); p = m*p*1.21; s += a; a *= .35;
  f += a*noise(p); p = m*p*1.41; s += a; a *= .75;
  f += a*noise(p);
  return f/s;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float time = iTime * 0.1;
  vec2 xy = -1.0 + 2.0*fragCoord.xy / iResolution.xy;

  float fade = min(1., time*1.)*min(1., max(0., 15.-time));
  float fade2 = max(0., time-10.)*0.37;
  float glow = max(-.25, 1.+pow(fade2, 10.) - 0.001*pow(fade2, 25.));

  vec3 campos = vec3(500.0, 850., -.0-cos((time-1.4)/2.)*2000.);
  vec3 camtar = vec3(0., 0., 0.);
  float roll = 0.34;
  vec3 cw = normalize(camtar-campos);
  vec3 cp = vec3(sin(roll), cos(roll), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  vec3 rd = normalize(xy.x*cu + xy.y*cv + 1.6*cw);

  vec3 light = normalize(vec3(0., 0., 0.)-campos);
  float sundot = clamp(dot(light, rd), 0.0, 1.0);

  vec3 col = glow*1.8*min(vec3(1.0, 1.0, 1.0), vec3(2.0, 1.0, 0.5)*pow(sundot, 100.0));
  col += 0.55*vec3(0.8, 0.9, 1.2)*pow(sundot, 8.0);

  vec3 stars = 85.5*vec3(pow(fbmslow(rd.xyz*312.0), 7.0))*vec3(pow(fbmslow(rd.zxy*440.3), 8.0));

  vec3 cpos = 1500.*rd + vec3(831.0-time*30., 321.0, 1000.0);
  col += vec3(0.4, 0.5, 1.0) * ((fbmslow(cpos*0.0035) - .5));

  cpos += vec3(831.0-time*33., 321.0, 999.);
  col += vec3(0.6, 0.3, 0.6) * 10.0*pow((fbmslow(cpos*0.0045)), 10.0);

  cpos += vec3(3831.0-time*39., 221.0, 999.0);
  col += 0.03*vec3(0.6, 0.0, 0.0) * 10.0*pow((fbmslow(cpos*0.0145)), 2.0);

  cpos = 1500.*rd + vec3(831.0, 321.0, 999.);
  col += stars*fbm(cpos*0.0021);

  vec2 shift = vec2(time*100.0, time*180.0);
  vec4 sum = vec4(0, 0, 0, 0);
  float c = campos.y / rd.y;
  vec3 cpos2 = campos - c*rd;
  float radius = length(cpos2.xz)/1000.0;

  if (radius<1.8) {
    for (int q=10; q>-10; q--) {
      if (sum.w>0.999) continue;
      float c = (float(q)*8.-campos.y) / rd.y;
      vec3 cpos = campos + c*rd;
      float see = dot(normalize(cpos), normalize(campos));
      vec3 lightUnvis = vec3(0., 0., 0.);
      vec3 lightVis   = vec3(1.3, 1.2, 1.2);
      vec3 shine = mix(lightVis, lightUnvis, smoothstep(0.0, 1.0, see));
      float radius = length(cpos.xz)/999.;
      if (radius>1.0) continue;
      float rot = 3.00*(radius)-time;
      cpos.xz = cpos.xz*mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
      cpos += vec3(831.0+shift.x, 321.0+float(q)*mix(250.0, 50.0, radius)-shift.x*0.2, 1330.0+shift.y);
      cpos *= mix(0.0025, 0.0028, radius);
      float alpha = smoothstep(0.50, 1.0, fbm(cpos));
      alpha *= 1.3*pow(smoothstep(1.0, 0.0, radius), 0.3);
      vec3 dustcolor = mix(vec3(2.0, 1.3, 1.0), vec3(0.1, 0.2, 0.3), pow(radius, .5));
      vec3 localcolor = mix(dustcolor, shine, alpha);
      float gstar = 2.*pow(noise(cpos*21.40), 22.0);
      float gstar2 = 3.*pow(noise(cpos*26.55), 34.0);
      float gholes = 1.*pow(noise(cpos*11.55), 14.0);
      localcolor += vec3(1.0, 0.6, 0.3)*gstar;
      localcolor += vec3(1.0, 1.0, 0.7)*gstar2;
      localcolor -= gholes;
      alpha = (1.0-sum.w)*alpha;
      sum += vec4(localcolor*alpha, alpha);
    }
    for (int q=0; q<20; q++) {
      if (sum.w>0.999) continue;
      float c = (float(q)*4.-campos.y) / rd.y;
      vec3 cpos = campos + c*rd;
      float see = dot(normalize(cpos), normalize(campos));
      vec3 lightUnvis = vec3(0., 0., 0.);
      vec3 lightVis   = vec3(1.3, 1.2, 1.2);
      vec3 shine = mix(lightVis, lightUnvis, smoothstep(0.0, 1.0, see));
      float radius = length(cpos.xz)/200.0;
      if (radius>1.0) continue;
      float rot = 3.2*(radius)-time*1.1;
      cpos.xz = cpos.xz*mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
      cpos += vec3(831.0+shift.x, 321.0+float(q)*mix(250.0, 50.0, radius)-shift.x*0.2, 1330.0+shift.y);
      float alpha = 0.1+smoothstep(0.6, 1.0, fbm(cpos));
      alpha *= 1.2*(pow(smoothstep(1.0, 0.0, radius), 0.72) - pow(smoothstep(1.0, 0.0, radius*1.875), 0.2));
      vec3 localcolor = vec3(0.0, 0.0, 0.0);
      alpha = (1.0-sum.w)*alpha;
      sum += vec4(localcolor*alpha, alpha);
    }
  }
  float alpha = smoothstep(1.-radius*.5, 1.0, sum.w);
  sum.rgb /= sum.w+0.0001;
  sum.rgb -= 0.2*vec3(0.8, 0.75, 0.7) * pow(sundot, 10.0)*alpha;
  sum.rgb += min(glow, 10.0)*0.2*vec3(1.2, 1.2, 1.2) * pow(sundot, 5.0)*(1.0-alpha);
  col = mix(col, sum.rgb, sum.w);

  col = fade*mix(col, vec3(0.4, 0.6, 1.0), 0.85*smoothstep(0.0, 1.0, 45.0*(pow(sundot, 45.0)-pow(sundot, 55.0))/(2.+6.*abs(rd.y))));

  vec2 xy2 = fragCoord.xy / iResolution.xy;
  col *= vec3(.5, .5, .5) + 0.25*pow(100.0*xy2.x*xy2.y*(1.0-xy2.x)*(1.0-xy2.y), .5);

  fragColor = vec4(col, 1.0);
}
`;

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram | null {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  gl.shaderSource(vs, vertexSource);
  gl.shaderSource(fs, fragmentSource);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    return null;
  }
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null;
  }
  return program;
}

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

export default function GalaxyShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (!gl) return;

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) return;

    const positionLoc = gl.getAttribLocation(program, 'a_position');
    const timeLoc = gl.getUniformLocation(program, 'iTime');
    const resolutionLoc = gl.getUniformLocation(program, 'iResolution');

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

    let raf = 0;
    const startTime = performance.now() / 1000;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    };

    const draw = () => {
      resize();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      if (w <= 0 || h <= 0) {
        raf = requestAnimationFrame(draw);
        return;
      }
      gl.useProgram(program);
      gl.uniform1f(timeLoc, performance.now() / 1000 - startTime);
      gl.uniform2f(resolutionLoc, w, h);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(draw);
    };

    draw();

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="galaxy-shader-wrap">
      <canvas ref={canvasRef} className="galaxy-shader-canvas" aria-hidden />
    </div>
  );
}

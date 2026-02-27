import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import './WaterShader.css';

// AFL water shader — afl_ext 2017-2019
// Rendered via Three.js for reliable WebGL across environments

const FSHADER = `
uniform vec2 iResolution;
uniform float iTime;
uniform vec4 uRipple;

#define DRAG_MULT 0.048
#define ITERATIONS_RAYMARCH 13
#define ITERATIONS_NORMAL 48

varying vec2 vUv;

vec2 gRipplePosScaled = vec2(1e9);
float gRippleT0 = -1.0;
float gRippleOn = 0.0;

float rippleHeight(vec2 scaledXZ) {
  if (gRippleOn < 0.5) return 0.0;
  float t = iTime - gRippleT0;
  if (t < 0.0) return 0.0;
  float d = length(scaledXZ - gRipplePosScaled);
  float rings = 2.0 * sin(12.0 * d - 4.0 * t);
  float envelopeSpace = exp(-3.0 * d);
  float envelopeTime = exp(-0.30 * t);
  return 0.25 * rings * envelopeSpace * envelopeTime;
}

vec2 wavedx(vec2 position, vec2 direction, float speed, float frequency, float timeshift) {
  float x = dot(direction, position) * frequency + timeshift * speed;
  float wave = exp(sin(x) - 1.0);
  float dx = wave * cos(x);
  return vec2(wave, -dx);
}

float getwaves(vec2 position, int iterations) {
  float iter = 0.0;
  float phase = 2.0;
  float speed = 0.7;
  float weight = 0.2;
  float w = 0.0;
  float ws = 0.0;
  for (int i = 0; i < iterations; i++) {
    vec2 p = vec2(sin(iter), cos(iter));
    vec2 res = wavedx(position, p, speed, phase, iTime);
    position += normalize(p) * res.y * weight * DRAG_MULT;
    w += res.x * weight;
    iter += 12.0;
    ws += weight;
    weight = mix(weight, 0.0, 0.2);
    phase *= 1.18;
    speed *= 1.07;
  }
  w = w / ws + rippleHeight(position);
  return w;
}

float raymarchwater(vec3 camera, vec3 start, vec3 end, float depth) {
  vec3 pos = start;
  float h = 0.0;
  vec3 dir = normalize(end - start);
  for (int i = 0; i < 318; i++) {
    float wf = getwaves(pos.xz * 0.1, ITERATIONS_RAYMARCH);
    h = wf * depth - depth;
    float dist_pos = distance(pos, camera);
    if (h + 0.01 * dist_pos > pos.y) {
      return dist_pos;
    }
    pos += dir * (pos.y - h);
  }
  return -1.0;
}

vec3 normal(vec2 pos, float e, float depth) {
  vec2 ex = vec2(e, 0.0);
  float s = 0.1;
  float H = getwaves(pos.xy * s, ITERATIONS_NORMAL) * depth;
  vec3 a = vec3(pos.x, H, pos.y);
  float hL = getwaves((pos.xy - ex.xy) * s, ITERATIONS_NORMAL) * depth;
  float hU = getwaves((pos.xy + ex.yx) * s, ITERATIONS_NORMAL) * depth;
  return normalize(cross(
    normalize(a - vec3(pos.x - e, hL, pos.y)),
    normalize(a - vec3(pos.x, hU, pos.y + e))
  ));
}

mat3 rotmat(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

vec3 getRay(vec2 uv) {
  uv = (uv * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
  vec3 proj = normalize(vec3(uv.x, uv.y, 1.0) + vec3(uv.x, uv.y, -1.0) * pow(length(uv), 2.0) * 0.05);
  return rotmat(vec3(0.0, 2.0, 0.0), 1.5) * proj;
}

float intersectPlane(vec3 origin, vec3 direction, vec3 point, vec3 normal) {
  return clamp(dot(point - origin, normal) / dot(direction, normal), -1.0, 9991999.0);
}

vec3 extra_cheap_atmosphere(vec3 raydir, vec3 sundir) {
  sundir.y = max(sundir.y, -0.07);
  float special_trick = 1.0 / (raydir.y * 1.0 + 0.1);
  vec3 bluesky = vec3(5.5, 13.0, 22.4) / 22.4;
  vec3 bluesky2 = max(vec3(0.0), bluesky - vec3(5.5, 13.0, 22.4) * 0.002 * special_trick);
  bluesky2 *= special_trick * 0.24;
  return bluesky2 * (0.7 * pow(1.0 - raydir.y, 3.0));
}

vec3 getatm(vec3 ray) {
  return extra_cheap_atmosphere(ray, normalize(vec3(1.0))) * 0.5;
}

float sun(vec3 ray) {
  vec3 sd = normalize(vec3(1.0));
  return pow(max(0.0, dot(ray, sd)), 1728.0) * 250.0;
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p.zxy, p.yxz + 19.27);
  return fract(vec3(p.x * p.y, p.z * p.x, p.y * p.z));
}

vec3 stars(in vec3 p) {
  vec3 c = vec3(0.);
  float res = iResolution.x * 1.5;
  for (int i = 0; i < 2; i++) {
    vec3 q = fract(p * (0.15 * res)) - 0.5;
    vec3 id = floor(p * (0.15 * res));
    vec2 rn = hash33(id).xy;
    float c2 = smoothstep(1.2, 0., length(q)) / 2.;
    c2 *= step(rn.x, 0.0005 + 0.001);
    c += c2 * (mix(vec3(1.0, 0.49, 0.1), vec3(0.75, 0.9, 1.), rn.y) * 0.25 + 0.75);
    p *= 1.4;
  }
  return c * c * 0.7;
}

vec3 aces_tonemap(vec3 color) {
  mat3 m1 = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777
  );
  mat3 m2 = mat3(
    1.60475, -0.10208, -0.00327,
    -0.53108, 1.10813, -0.07276,
    -0.07367, -0.00605, 1.07602
  );
  vec3 v = m1 * color;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return pow(clamp(m2 * (a / b), 0.0, 1.0), vec3(1.0 / 2.2));
}

void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  vec2 uv = vUv;

  gRipplePosScaled = uRipple.xy;
  gRippleT0 = uRipple.z;
  gRippleOn = (uRipple.a > 0.5 && all(greaterThan(uRipple.xy, vec2(-1e8)))) ? 1.0 : 0.0;

  float waterdepth = 2.1;
  vec3 wfloor = vec3(0.0, -waterdepth, 0.0);
  vec3 wceil = vec3(0.0, 0.0, 0.0);
  vec3 orig = vec3(0.0, 1.0, 0.0);
  vec3 ray = getRay(uv);

  float hihit = intersectPlane(orig, ray, wceil, vec3(0.0, 1.0, 0.0));
  vec4 fragColor;

  if (ray.y >= -0.01) {
    vec3 C = getatm(ray) * 2.0;
    C = aces_tonemap(C);
    fragColor = vec4(C, 1.0);
  } else {
    float lohit = intersectPlane(orig, ray, wfloor, vec3(0.0, 1.0, 0.0));
    vec3 hipos = orig + ray * hihit;
    vec3 lopos = orig + ray * lohit;
    float dist = raymarchwater(orig, hipos, lopos, waterdepth);
    vec3 pos = orig + ray * dist;

    vec3 N = normal(pos.xz, 0.001, waterdepth);
    N = mix(vec3(0.0, 1.0, 0.0), N, 1.0 / (dist * dist * 0.01 + 1.0));
    vec3 R = reflect(ray, N);
    float fresnel = (0.04 + (1.0 - 0.04) * (pow(1.0 - max(0.0, dot(-N, ray)), 5.0)));

    vec3 C = fresnel * getatm(R) * 2.0 + fresnel * sun(R);
    C = aces_tonemap(C);
    fragColor = vec4(C, 1.0);
  }

  fragColor.rgb *= 0.5;
  fragColor.r *= 1.55;

  if (ray.y >= -0.01)
    fragColor.rgb += 10.0 * stars(ray);

  gl_FragColor = fragColor;
}
`;

const VSHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function getRay(uv: [number, number], aspect: number): [number, number, number] {
  const u = (uv[0] * 2 - 1) * aspect;
  const v = uv[1] * 2 - 1;
  const len = Math.sqrt(u * u + v * v);
  const f = 0.05 * len * len;
  const px = u + u * f;
  const py = v + v * f;
  const pz = 1 - f;
  const d = Math.hypot(px, py, pz);
  const x = px / d;
  const y = py / d;
  const z = pz / d;
  const angle = 1.5;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * x - s * z, y, s * x + c * z];
}

function intersectPlane(oy: number, dy: number, py: number): number {
  if (Math.abs(dy) < 1e-8) return -1;
  return (py - oy) / dy;
}

interface WaterShaderProps {
  className?: string;
}

export default function WaterShader({ className = '' }: WaterShaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef({ x: -1e9, y: -1e9, t0: -1, on: 0 });
  const startTimeRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VSHADER,
      fragmentShader: FSHADER,
      uniforms: {
        iResolution: { value: new THREE.Vector2(1, 1) },
        iTime: { value: 0 },
        uRipple: { value: new THREE.Vector4(-1e9, -1e9, -1, 0) },
      },
      depthWrite: false,
      depthTest: false,
    });
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const u = (e.clientX - rect.left) / rect.width;
      const v = 1 - (e.clientY - rect.top) / rect.height;
      const aspect = rect.width / rect.height;
      const [dx, dy, dz] = getRay([u, v], aspect);
      if (dy >= -0.01) return;
      const t = intersectPlane(1, dy, 0);
      if (t < 0) return;
      const hitX = dx * t;
      const hitZ = dz * t;
      rippleRef.current = {
        x: hitX * 0.1,
        y: hitZ * 0.1,
        t0: performance.now() / 1000 - startTimeRef.current,
        on: 1,
      };
    };

    canvas.addEventListener('click', handleClick);

    const startTime = performance.now() / 1000;
    startTimeRef.current = startTime;

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      material.uniforms.iResolution.value.set(renderer.domElement.width, renderer.domElement.height);
    };

    const animate = () => {
      const now = performance.now() / 1000 - startTime;
      const r = rippleRef.current;
      material.uniforms.iTime.value = now;
      material.uniforms.uRipple.value.set(r.x, r.y, r.t0, r.on);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    animate();

    return () => {
      ro.disconnect();
      canvas.removeEventListener('click', handleClick);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      container.removeChild(canvas);
    };
  }, []);

  return (
    <div ref={containerRef} className={`water-shader-wrap ${className}`.trim()}>
    </div>
  );
}

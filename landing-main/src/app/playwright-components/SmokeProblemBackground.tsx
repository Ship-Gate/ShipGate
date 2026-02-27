import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import './SmokeProblemBackground.css';

const SMOKE_TEXTURE_URL = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/82015/blue-smoke.png';

export default function SmokeProblemBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let aborted = false;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const clock = new THREE.Clock();
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(75, w / h, 1, 10000);
    cam.position.z = 1000;
    scene.add(cam);

    const light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.position.set(-1, 0, 1);
    scene.add(light);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x00547f, 1);
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const smokeParticles: THREE.Mesh[] = [];
    let sharedGeo: THREE.PlaneGeometry | null = null;
    let sharedMaterial: THREE.MeshLambertMaterial | null = null;

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      SMOKE_TEXTURE_URL,
      (texture: THREE.Texture) => {
        if (aborted) return;
        sharedGeo = new THREE.PlaneGeometry(300, 300);
        sharedMaterial = new THREE.MeshLambertMaterial({
          map: texture,
          transparent: true,
        });

        for (let p = 0; p < 350; p++) {
          const particle = new THREE.Mesh(sharedGeo, sharedMaterial);
          particle.position.set(
            Math.random() * 500 - 250,
            Math.random() * 500 - 250,
            Math.random() * 1000 - 100
          );
          particle.rotation.z = Math.random() * Math.PI * 2;
          scene.add(particle);
          smokeParticles.push(particle);
        }
      },
      undefined,
      () => {
        // Texture failed: scene stays blue, no smoke
      }
    );

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (aborted) return;
      const delta = clock.getDelta();
      smokeParticles.forEach((sp) => {
        sp.rotation.z += delta * 0.2;
      });
      renderer.render(scene, cam);
    };
    animate();

    const resize = () => {
      if (!container || aborted) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      cam.aspect = nw / nh;
      cam.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', resize);

    return () => {
      aborted = true;
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
      smokeParticles.length = 0;
      sharedGeo?.dispose();
      sharedMaterial?.dispose();
      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="smoke-problem-background" aria-hidden />;
}

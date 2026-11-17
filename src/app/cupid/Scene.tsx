'use client';

// Three.js 배경: 분홍 점 두 개가 "나"와 "상대" — stage.p 가 커질수록 가까워지고 점선으로 이어진다.
// (배경을 채우던 점 그물은 뺐다.)

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { stage } from './stage';

const BRAND = new THREE.Color('#ff7fa6');
const PAPER = new THREE.Color('#fff3f6');

const POINT_VERT = `
  attribute float aSize;
  uniform float uScale;
  uniform float uMax;
  varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aSize * uScale / -mv.z, 9.0 * uMax);
    vFade = smoothstep(46.0, 6.0, -mv.z);
  }`;
const POINT_FRAG = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, uOpacity * vFade * smoothstep(0.5, 0.38, d));
  }`;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function Scene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      // 투명 캔버스: 뒤의 분홍 빛 번짐 배경이 비친다
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(PAPER, 0);
    } catch {
      return; // WebGL이 없으면 종이 배경만 보인다
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(PAPER, 8, 46);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);

    const pointMat = (color: THREE.Color, opacity: number) =>
      new THREE.ShaderMaterial({
        vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false,
        uniforms: { uColor: { value: color }, uOpacity: { value: opacity }, uScale: { value: 1 }, uMax: { value: 1 } },
      });

    // 나와 상대 — 브랜드색 점 두 개와 둘을 잇는 점선
    const nodeGeo = new THREE.SphereGeometry(0.16, 24, 16);
    const nodeMat = new THREE.MeshBasicMaterial({ color: BRAND, fog: false });
    const me = new THREE.Mesh(nodeGeo, nodeMat);
    const you = new THREE.Mesh(nodeGeo, nodeMat);
    scene.add(me, you);
    // 두 점 둘레의 부드러운 빛
    const glowMat = new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.16, depthWrite: false, fog: false });
    const meGlow = new THREE.Mesh(nodeGeo, glowMat);
    const youGlow = new THREE.Mesh(nodeGeo, glowMat);
    scene.add(meGlow, youGlow);

    const DOTS = 56;
    const linkPos = new Float32Array(DOTS * 3);
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
    linkGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(DOTS).fill(0.9), 1));
    const linkMat = pointMat(BRAND, 1);
    const link = new THREE.Points(linkGeo, linkMat);
    link.frustumCulled = false;
    scene.add(link);

    const ringMat = new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), ringMat);
    scene.add(ring);

    const A0 = new THREE.Vector3(-5.2, 1.6, -3), A1 = new THREE.Vector3(-0.7, 0.1, -16);
    const B0 = new THREE.Vector3(8, -2.4, -24), B1 = new THREE.Vector3(0.7, -0.1, -16);
    const park = new THREE.Vector3(); // 앱 화면에서는 읽는 영역 밖(아래쪽)으로 비켜선다
    const a = new THREE.Vector3(), b = new THREE.Vector3(), mid = new THREE.Vector3(), tmp = new THREE.Vector3();
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < h ? 64 : 50; // 세로 화면에서는 더 넓게
      camera.updateProjectionMatrix();
      const scale = h * renderer.getPixelRatio() * 0.11;
      linkMat.uniforms.uScale.value = scale;
      linkMat.uniforms.uMax.value = renderer.getPixelRatio() * 0.45;
    };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });

    let raf = 0;
    let p = stage.p;
    const clock = new THREE.Clock();
    const frame = () => {
      const t = clock.getElapsedTime();
      p += (stage.p - p) * 0.08;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      const near = smooth(0.1, 1, p);
      a.lerpVectors(A0, A1, near);
      b.lerpVectors(B0, B1, near);
      const aside = smooth(0.6, 0.7, p);
      park.set(camera.aspect > 1 ? -5.2 * aside : 0, (camera.aspect > 1 ? -3.4 : -6.2) * aside, 0);
      a.add(park);
      b.add(park);
      a.y += Math.sin(t * 0.7) * 0.18;
      b.y += Math.cos(t * 0.6) * 0.18;
      me.position.copy(a);
      you.position.copy(b);
      const beat = 1 + stage.pulse * 0.35 * (0.5 + 0.5 * Math.sin(t * 5));
      me.scale.setScalar(beat * stage.show + 0.0001);
      you.scale.setScalar(beat * stage.show + 0.0001);
      linkMat.uniforms.uOpacity.value = stage.show;
      meGlow.position.copy(a);
      youGlow.position.copy(b);
      meGlow.scale.setScalar((2.6 + Math.sin(t * 1.6) * 0.3) * stage.show + 0.0001);
      youGlow.scale.setScalar((2.6 + Math.cos(t * 1.6) * 0.3) * stage.show + 0.0001);

      // 점선: p 가 커질수록 나에게서 상대 쪽으로 그려진다
      mid.addVectors(a, b).multiplyScalar(0.5);
      mid.y += 2.2 * (1 - near) + 0.5;
      const drawn = Math.floor(DOTS * smooth(0.22, 0.8, p));
      for (let i = 0; i < DOTS; i++) {
        const u = (i + 1) / (DOTS + 1);
        curve.getPoint(stage.pulse ? (u + t * 0.06 * stage.pulse) % 1 : u, tmp);
        linkPos[i * 3] = tmp.x; linkPos[i * 3 + 1] = tmp.y; linkPos[i * 3 + 2] = tmp.z;
      }
      linkGeo.attributes.position.needsUpdate = true;
      linkGeo.setDrawRange(0, drawn);

      ring.position.copy(mid).setY((a.y + b.y) / 2);
      ring.scale.setScalar(0.6 + stage.ring * 5);
      ringMat.opacity = stage.ring > 0 ? (1 - stage.ring) * 0.9 : 0;

      camera.position.set(Math.sin(p * 2.4) * 2.2 + mouse.x * 0.9, 0.6 - p * 0.6 - mouse.y * 0.6, 11 - p * 11);
      camera.lookAt(mouse.x * 0.4, 0, camera.position.z - 12);
      ring.lookAt(camera.position);

      renderer.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    frame();
    // 움직임 줄이기: 값이 바뀔 때만 다시 그린다
    const still = reduce ? window.setInterval(() => { p = stage.p; frame(); }, 400) : 0;
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) raf = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(still);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      [nodeGeo, linkGeo, ring.geometry].forEach((g) => g.dispose());
      [nodeMat, glowMat, linkMat, ringMat].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="cq-scene" aria-hidden />;
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export function EcoTech3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    // WebGL support check
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      setWebglSupported(false);
      return;
    }

    const container = containerRef.current;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 8;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglSupported(false);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Theme Color Helper
    const getThemeColors = () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      return {
        accent: isLight ? new THREE.Color(0x0284c7) : new THREE.Color(0x38bdf8),
        emerald: isLight ? new THREE.Color(0x15803d) : new THREE.Color(0x10b981),
        wireOpacity: isLight ? 0.15 : 0.22,
        particleOpacity: isLight ? 0.6 : 0.75,
      };
    };

    let colors = getThemeColors();

    // 3D Objects Construction
    // 1. Central Holographic Icosahedron (Globe Shell)
    const globeGeo = new THREE.IcosahedronGeometry(2.2, 2);
    const globeMat = new THREE.MeshBasicMaterial({
      color: colors.accent,
      wireframe: true,
      transparent: true,
      opacity: colors.wireOpacity,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globeMesh);

    // 2. Inner Solid Core Node
    const coreGeo = new THREE.IcosahedronGeometry(1.2, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: colors.emerald,
      wireframe: true,
      transparent: true,
      opacity: colors.wireOpacity * 0.7,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // 3. Orbital Ring 1
    const ringGeo = new THREE.TorusGeometry(3.2, 0.012, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colors.emerald,
      transparent: true,
      opacity: colors.wireOpacity * 1.2,
    });
    const ringMesh1 = new THREE.Mesh(ringGeo, ringMat);
    ringMesh1.rotation.x = Math.PI / 3;
    ringMesh1.rotation.y = Math.PI / 6;
    scene.add(ringMesh1);

    // 4. Orbital Ring 2
    const ringMesh2 = new THREE.Mesh(ringGeo, ringMat);
    ringMesh2.rotation.x = -Math.PI / 4;
    ringMesh2.rotation.y = -Math.PI / 3;
    scene.add(ringMesh2);

    // 5. Floating Telemetry Particles Field
    const particleCount = 140;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const radius = 3.0 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);

      particleScales[i] = Math.random() * 0.05 + 0.02;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: colors.accent,
      size: 0.06,
      transparent: true,
      opacity: colors.particleOpacity,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // Mouse Parallax Logic
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const windowHalfX = window.innerWidth / 2;
      const windowHalfY = window.innerHeight / 2;
      mouseX = (event.clientX - windowHalfX) * 0.0003;
      mouseY = (event.clientY - windowHalfY) * 0.0003;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // MutationObserver for Theme changes
    const observer = new MutationObserver(() => {
      colors = getThemeColors();
      globeMat.color = colors.accent;
      globeMat.opacity = colors.wireOpacity;
      coreMat.color = colors.emerald;
      ringMat.color = colors.emerald;
      particleMat.color = colors.accent;
      particleMat.opacity = colors.particleOpacity;
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      width = containerRef.current.clientWidth || window.innerWidth;
      height = containerRef.current.clientHeight || window.innerHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener("resize", handleResize, { passive: true });

    // Render Loop with visibility optimization
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (document.hidden) return;

      // Smooth Rotation
      globeMesh.rotation.y += 0.0025;
      globeMesh.rotation.x += 0.001;

      coreMesh.rotation.y -= 0.003;
      coreMesh.rotation.z += 0.0015;

      ringMesh1.rotation.z += 0.001;
      ringMesh2.rotation.z -= 0.0015;

      particlePoints.rotation.y += 0.0008;
      particlePoints.rotation.x += 0.0004;

      // Smooth Parallax Damping
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      scene.rotation.y = targetX;
      scene.rotation.x = targetY;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      observer.disconnect();

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      globeGeo.dispose();
      globeMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40 dark:opacity-60 transition-opacity duration-500"
      aria-hidden="true"
    >
      {!webglSupported && (
        <div className="absolute inset-0 bg-radial-glow pointer-events-none opacity-50" />
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useRef } from "react";

/**
 * TopographyBackground
 * High-performance canvas-based interactive topographical contour map.
 * Dynamic elevation isolines warp, deform, and illuminate in real-time as the cursor moves across the viewport.
 */
export function TopographyBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    // Mouse coordinates with smooth spring / lerp interpolation
    const mouse = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.35,
      targetX: window.innerWidth * 0.5,
      targetY: window.innerHeight * 0.35,
      active: false,
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouse.targetX = e.touches[0].clientX;
        mouse.targetY = e.touches[0].clientY;
        mouse.active = true;
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    let time = 0;

    // Fixed ambient mountain/ridge peaks
    const getAmbientNodes = (t: number) => [
      {
        x: width * 0.15 + Math.cos(t * 0.4) * 80,
        y: height * 0.25 + Math.sin(t * 0.3) * 60,
        radius: Math.min(width, height) * 0.45,
        elevation: 1.1,
      },
      {
        x: width * 0.82 + Math.sin(t * 0.35) * 90,
        y: height * 0.68 + Math.cos(t * 0.4) * 70,
        radius: Math.min(width, height) * 0.55,
        elevation: 1.3,
      },
      {
        x: width * 0.48 + Math.sin(t * 0.2) * 50,
        y: height * 0.88 + Math.cos(t * 0.25) * 50,
        radius: Math.min(width, height) * 0.4,
        elevation: 0.9,
      },
    ];

    const render = () => {
      time += 0.006;

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.075;
      mouse.y += (mouse.targetY - mouse.y) * 0.075;

      ctx.fillStyle = "#F5F2F9";
      ctx.fillRect(0, 0, width, height);

      const ambientNodes = getAmbientNodes(time);

      // Mouse elevation node (interacts with the contours)
      const mouseNode = {
        x: mouse.x,
        y: mouse.y,
        radius: Math.min(width, height) * 0.38,
        elevation: 1.45,
      };

      // Elevation field function
      const getElevation = (px: number, py: number) => {
        let elev = 0;

        // Ambient mountains
        for (let i = 0; i < ambientNodes.length; i++) {
          const node = ambientNodes[i];
          const dx = px - node.x;
          const dy = py - node.y;
          const distSq = dx * dx + dy * dy;
          const rSq = node.radius * node.radius;
          if (distSq < rSq * 3.5) {
            elev += node.elevation * Math.exp(-distSq / (rSq * 0.8));
          }
        }

        // Mouse peak
        const mdx = px - mouseNode.x;
        const mdy = py - mouseNode.y;
        const mDistSq = mdx * mdx + mdy * mdy;
        const mRSq = mouseNode.radius * mouseNode.radius;
        if (mDistSq < mRSq * 4) {
          elev += mouseNode.elevation * Math.exp(-mDistSq / (mRSq * 0.9));
        }

        // Subtle topographic waviness (ridge ripple)
        elev += Math.sin(px * 0.005 + time) * Math.cos(py * 0.005 + time * 0.8) * 0.12;

        return elev;
      };

      // Render horizontal contour isolines
      const numLines = 36;
      const stepY = height / (numLines - 1);
      const stepX = 14; // Resolution along the horizontal line

      ctx.lineWidth = 1.1;

      for (let i = 0; i < numLines; i++) {
        const baseY = i * stepY;

        ctx.beginPath();
        let first = true;

        for (let px = -20; px <= width + 20; px += stepX) {
          const elev = getElevation(px, baseY);
          // Distort Y based on local elevation
          const py = baseY - elev * 54;

          if (first) {
            ctx.moveTo(px, py);
            first = false;
          } else {
            ctx.lineTo(px, py);
          }
        }

        // Calculate proximity to cursor for dynamic illumination
        const distToCursorY = Math.abs(baseY - mouse.y);
        const yCloseness = Math.max(0, 1 - distToCursorY / (height * 0.5));

        // Graduated line alpha: crisp near mouse, subtle in background
        const baseAlpha = 0.065 + (i % 5 === 0 ? 0.04 : 0); // Index contour lines slightly heavier
        const glowAlpha = Math.min(0.24, baseAlpha + yCloseness * 0.14);

        ctx.strokeStyle = `rgba(109, 40, 217, ${glowAlpha.toFixed(3)})`;
        ctx.stroke();
      }

      // Cursor topography aura glow
      const auraGradient = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        Math.min(width, height) * 0.35
      );
      auraGradient.addColorStop(0, "rgba(124, 58, 237, 0.075)");
      auraGradient.addColorStop(0.5, "rgba(167, 139, 250, 0.035)");
      auraGradient.addColorStop(1, "rgba(237, 232, 245, 0)");

      ctx.fillStyle = auraGradient;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none -z-10 select-none opacity-90 transition-opacity duration-1000"
      aria-hidden="true"
    />
  );
}

export default TopographyBackground;

import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

const FloatingBackground = React.memo(() => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Only add mouse tracking on larger screens to improve mobile performance
    if (window.innerWidth <= 768) return;

    // Throttle the mouse move to reduce React renders
    let timeoutId: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (timeoutId === null) {
        timeoutId = window.requestAnimationFrame(() => {
          setMousePosition({ x: e.clientX, y: e.clientY });
          timeoutId = null;
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (timeoutId !== null) cancelAnimationFrame(timeoutId);
    };
  }, []);

  // Pre-calculate random positions so they don't change on every re-render
  const shapesData = useMemo(() => {
    const isMobile = window.innerWidth <= 768;
    const count = isMobile ? 2 : 4; // Use fewer shapes on mobile

    const baseShapes = [
      { size: isMobile ? 200 : 300, delay: 0, duration: 20 },
      { size: isMobile ? 150 : 200, delay: 2, duration: 15 },
      { size: isMobile ? 180 : 250, delay: 4, duration: 18 },
      { size: isMobile ? 120 : 180, delay: 1, duration: 22 },
    ];

    return baseShapes.slice(0, count).map((shape) => ({
      ...shape,
      xCoords: [
        Math.random() * window.innerWidth,
        Math.random() * window.innerWidth,
        Math.random() * window.innerWidth,
      ],
      yCoords: [
        Math.random() * window.innerHeight,
        Math.random() * window.innerHeight,
        Math.random() * window.innerHeight,
      ]
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Cursor-following gradient overlay */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, hsl(270 91% 65% / 0.15), transparent 40%)`,
        }}
      // Only animate x/y slightly with CSS to avoid heavy layout recalculation 
      // if we want to bind directly to state. Here state change triggers re-render, 
      // which React.memo ignores from parent, but triggers for itself.
      />

      {/* Floating shapes */}
      {shapesData.map((shape, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            width: shape.size,
            height: shape.size,
            background: `linear-gradient(135deg, hsl(270 91% 65% / 0.1), hsl(186 94% 60% / 0.1))`,
            filter: "blur(60px)",
            willChange: "transform", // Optimize for animation performance
          }}
          animate={{
            x: shape.xCoords,
            y: shape.yCoords,
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: shape.duration,
            delay: shape.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Additional cursor-following element */}
      <motion.div
        className="absolute w-96 h-96 rounded-full hidden md:block"
        style={{
          background: "radial-gradient(circle, hsl(280 100% 75% / 0.15), transparent 70%)",
          filter: "blur(40px)",
          willChange: "transform",
        }}
        animate={{
          x: mousePosition.x / 20,
          y: mousePosition.y / 20,
        }}
        transition={{
          type: "spring",
          stiffness: 50,
          damping: 30,
        }}
      />
    </div>
  );
});

export default FloatingBackground;

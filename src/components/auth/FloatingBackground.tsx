import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const FloatingBackground = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const shapes = [
    { size: 300, delay: 0, duration: 20 },
    { size: 200, delay: 2, duration: 15 },
    { size: 250, delay: 4, duration: 18 },
    { size: 180, delay: 1, duration: 22 },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Cursor-following gradient overlay */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, hsl(270 91% 65% / 0.15), transparent 40%)`,
        }}
      />

      {/* Floating shapes */}
      {shapes.map((shape, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            width: shape.size,
            height: shape.size,
            background: `linear-gradient(135deg, hsl(270 91% 65% / 0.1), hsl(186 94% 60% / 0.1))`,
            filter: "blur(60px)",
          }}
          animate={{
            x: [
              Math.random() * window.innerWidth,
              Math.random() * window.innerWidth,
              Math.random() * window.innerWidth,
            ],
            y: [
              Math.random() * window.innerHeight,
              Math.random() * window.innerHeight,
              Math.random() * window.innerHeight,
            ],
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
        className="absolute w-96 h-96 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(280 100% 75% / 0.15), transparent 70%)",
          filter: "blur(40px)",
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
};

export default FloatingBackground;

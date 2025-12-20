import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

type Expression = "neutral" | "happy" | "sad" | "closed-eyes" | "shocked";

interface AnimatedCharacterProps {
  expression: Expression;
  cursorPosition: { x: number; y: number };
  isTypingPassword?: boolean;
}

const AnimatedCharacter = ({ expression, cursorPosition, isTypingPassword = false }: AnimatedCharacterProps) => {
  const [characterCenter, setCharacterCenter] = useState({ x: 0, y: 0 });
  const [hasWaved, setHasWaved] = useState(false);

  const eyeX = useSpring(0, { stiffness: 150, damping: 15 });
  const eyeY = useSpring(0, { stiffness: 150, damping: 15 });

  // Wave animation on mount
  useEffect(() => {
    if (!hasWaved) {
      setTimeout(() => setHasWaved(true), 500);
    }
  }, []);

  useEffect(() => {
    const element = document.getElementById('character');
    if (element) {
      const rect = element.getBoundingClientRect();
      setCharacterCenter({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  }, []);

  useEffect(() => {
    if (characterCenter.x && characterCenter.y) {
      const deltaX = cursorPosition.x - characterCenter.x;
      const deltaY = cursorPosition.y - characterCenter.y;
      const angle = Math.atan2(deltaY, deltaX);
      const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), 15);
      const moveX = Math.cos(angle) * (distance / 15) * 8;
      const moveY = Math.sin(angle) * (distance / 15) * 8;

      eyeX.set(moveX);
      eyeY.set(moveY);
    }
  }, [cursorPosition, characterCenter, eyeX, eyeY]);

  const mouthVariants = {
    neutral: { d: "M 30 50 Q 50 55 70 50" },
    happy: { d: "M 30 45 Q 50 65 70 45" },
    sad: { d: "M 30 55 Q 50 45 70 55" },
    "closed-eyes": { d: "M 30 50 Q 50 52 70 50" },
    shocked: { d: "M 40 50 Q 50 60 60 50" },
  };

  // Render eyes based on state
  const renderEyes = () => {
    if (isTypingPassword || expression === "closed-eyes") {
      // Closed eyes (lines instead of circles)
      return (
        <>
          <motion.line
            x1="30" y1="40" x2="40" y2="40"
            stroke="hsl(240, 10%, 3.9%)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: [1, 0.8, 1] }}
            transition={{ duration: 0.3 }}
          />
          <motion.line
            x1="60" y1="40" x2="70" y2="40"
            stroke="hsl(240, 10%, 3.9%)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: [1, 0.8, 1] }}
            transition={{ duration: 0.3 }}
          />
        </>
      );
    }

    if (expression === "shocked" || expression === "sad") {
      // Wide open eyes for shocked/sad expression
      return (
        <>
          <motion.g
            animate={expression === "shocked" ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3, repeat: expression === "shocked" ? 2 : 0 }}
          >
            <ellipse cx="35" cy="40" rx="7" ry="10" fill="white" />
            <motion.circle
              cx="35"
              cy="40"
              r="4"
              fill="hsl(240, 10%, 3.9%)"
              style={{ x: eyeX, y: eyeY }}
            />
          </motion.g>

          <motion.g
            animate={expression === "shocked" ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3, repeat: expression === "shocked" ? 2 : 0 }}
          >
            <ellipse cx="65" cy="40" rx="7" ry="10" fill="white" />
            <motion.circle
              cx="65"
              cy="40"
              r="4"
              fill="hsl(240, 10%, 3.9%)"
              style={{ x: eyeX, y: eyeY }}
            />
          </motion.g>
        </>
      );
    }

    // Normal eyes
    return (
      <>
        {/* Left Eye */}
        <g>
          <ellipse cx="35" cy="40" rx="6" ry="8" fill="white" />
          <motion.circle
            cx="35"
            cy="40"
            r="3"
            fill="hsl(240, 10%, 3.9%)"
            style={{ x: eyeX, y: eyeY }}
          />
        </g>

        {/* Right Eye */}
        <g>
          <ellipse cx="65" cy="40" rx="6" ry="8" fill="white" />
          <motion.circle
            cx="65"
            cy="40"
            r="3"
            fill="hsl(240, 10%, 3.9%)"
            style={{ x: eyeX, y: eyeY }}
          />
        </g>
      </>
    );
  };

  return (
    <motion.div
      id="character"
      className="relative"
      initial={{ scale: 0, opacity: 0, rotate: -10 }}
      animate={{
        scale: 1,
        opacity: 1,
        rotate: hasWaved ? [0, -15, 15, -10, 10, 0] : 0
      }}
      transition={{
        scale: { type: "spring", stiffness: 200, damping: 20 },
        rotate: { duration: 0.8, delay: 0.3 }
      }}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 100 100"
        className="drop-shadow-glow"
      >
        {/* Face */}
        <motion.circle
          cx="50"
          cy="50"
          r="40"
          fill="url(#faceGradient)"
          animate={{
            scale: expression === "happy" ? [1, 1.05, 1] : expression === "sad" ? [1, 0.98, 1] : 1,
          }}
          transition={{ duration: 0.5 }}
        />

        {/* Gradient Definition */}
        <defs>
          <linearGradient id="faceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(270, 91%, 65%)" />
            <stop offset="100%" stopColor="hsl(186, 94%, 60%)" />
          </linearGradient>
        </defs>

        {/* Eyes */}
        {renderEyes()}

        {/* Mouth */}
        {/* Mouth */}
        {(mouthVariants[expression as keyof typeof mouthVariants]?.d || mouthVariants.neutral.d) && (
          <motion.path
            stroke="hsl(240, 10%, 3.9%)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            variants={mouthVariants}
            animate={expression || "neutral"}
            transition={{ duration: 0.4 }}
            d={mouthVariants[expression as keyof typeof mouthVariants]?.d || mouthVariants.neutral.d}
          />
        )}

        {/* Sparkles for happy expression */}
        {expression === "happy" && (
          <>
            <motion.circle
              cx="20"
              cy="30"
              r="2"
              fill="white"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.5 }}
            />
            <motion.circle
              cx="80"
              cy="35"
              r="2"
              fill="white"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1, 0] }}
              transition={{ duration: 0.8, delay: 0.3, repeat: Infinity, repeatDelay: 0.5 }}
            />
          </>
        )}
      </svg>
    </motion.div>
  );
};

export default AnimatedCharacter;

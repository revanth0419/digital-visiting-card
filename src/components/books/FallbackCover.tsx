import React from "react";

interface FallbackCoverProps {
  title: string;
  className?: string;
}

function getInitials(title: string): string {
  if (!title) return "BK";
  const words = title.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const second = words[1]?.[0] ?? "";
  const initials = (first + second).toUpperCase();
  return initials || "BK";
}

const FallbackCover: React.FC<FallbackCoverProps> = ({ title, className = "" }) => {
  const initials = getInitials(title);

  return (
    <div
      className={
        "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-indigo-500 to-sky-500 " +
        "shadow-lg overflow-hidden " +
        className
      }
    >
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_#ffffff33,_transparent_60%),radial-gradient(circle_at_bottom,_#00000055,_transparent_60%)]" />
      <div className="relative z-10 flex flex-col items-center justify-center gap-1 px-4 py-3">
        <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          {initials}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/70">
          AI cover fallback
        </span>
      </div>
    </div>
  );
};

export default FallbackCover;




import React from "react";
import { cn } from "@/lib/utils";

interface DVCLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    className?: string;
    variant?: "premium" | "hero" | "premium-green";
}

export const DVCLogo = ({ className, variant = "premium", ...props }: DVCLogoProps) => {
    return (
        <img
            src="/src/assets/branding/dvc-logo-circle.png"
            alt="Digital Visiting Card Logo"
            className={cn(
                "object-contain",
                variant === "premium" && "bg-black rounded-full border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.35)]",
                variant === "premium-green" && "bg-green-600 rounded-full border border-white/10 shadow-lg shadow-green-500/30",
                className
            )}
            {...props}
        />
    );
};

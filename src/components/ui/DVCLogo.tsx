import React from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/branding/dvc-logo-circle.png";

interface DVCLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    className?: string;
    variant?: "premium" | "hero" | "premium-green";
}

export const DVCLogo = ({ className, variant = "premium", ...props }: DVCLogoProps) => {
    return (
        <img
            src={logo}
            alt="Digital Visiting Card Logo"
            className={cn(
                "object-contain",
                variant === "premium" && "bg-black rounded-full border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.35)]",
                variant === "premium-green" && "bg-black rounded-full ring-1 ring-white/15 shadow-lg shadow-purple-500/20 hover:scale-105 transition-transform duration-300",
                className
            )}
            {...props}
        />
    );
};

import React from "react";
import { cn } from "@/lib/utils";

interface DVCLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    className?: string;
}

export const DVCLogo = ({ className, ...props }: DVCLogoProps) => {
    return (
        <img
            src="/dvc-logo-final-v4.png"
            alt="Digital Visiting Card Logo"
            className={cn("object-contain", className)}
            {...props}
        />
    );
};

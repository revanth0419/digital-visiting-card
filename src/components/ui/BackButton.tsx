import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
    className?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "gradient";
    label?: string;
}

export const BackButton = ({ className, variant = "outline", label = "Back" }: BackButtonProps) => {
    const navigate = useNavigate();

    return (
        <Button
            variant={variant}
            size="sm"
            className={`gap-2 ${className}`}
            onClick={() => navigate(-1)}
        >
            <ArrowLeft className="w-4 h-4" />
            {label}
        </Button>
    );
};

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { icon: "h-4 w-4", text: "text-sm" },
  md: { icon: "h-5 w-5", text: "text-base" },
  lg: { icon: "h-6 w-6", text: "text-lg" },
};

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background">
        <Lock className={cn(s.icon, "text-vault")} strokeWidth={2.25} />
      </span>
      {showText && (
        <span className={cn("font-semibold tracking-tight text-foreground", s.text)}>
          PixelSafe
        </span>
      )}
    </div>
  );
}

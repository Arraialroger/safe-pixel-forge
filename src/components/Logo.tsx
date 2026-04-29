import { cn } from "@/lib/utils";
import defaultLogo from "@/assets/pixelsafe-logo.png";

interface LogoProps {
  className?: string;
  /** Mantido por compatibilidade — a logo oficial já contém o wordmark. */
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  customLogoUrl?: string | null;
  customLogoAlt?: string;
}

const sizes = {
  sm: "h-7",
  md: "h-9",
  lg: "h-12",
};

export function Logo({
  className,
  size = "md",
  customLogoUrl,
  customLogoAlt,
}: LogoProps) {
  const src = customLogoUrl || defaultLogo;
  const alt = customLogoAlt ?? "PixelSafe";

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={src}
        alt={alt}
        className={cn(sizes[size], "w-auto max-w-[180px] object-contain")}
      />
    </div>
  );
}

import { cn } from "@/lib/utils";

type IconProps = React.SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function InstagramIcon({ className, ...props }: IconProps) {
  return (
    <svg {...base} className={cn("size-4", className)} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ className, ...props }: IconProps) {
  return (
    <svg {...base} className={cn("size-4", className)} {...props}>
      <path d="M9 18.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 3.2 3.2V5.2" />
      <path d="M12.2 5.2c.6 2.2 2.3 3.8 4.6 4.2" />
    </svg>
  );
}

export function YouTubeIcon({ className, ...props }: IconProps) {
  return (
    <svg {...base} className={cn("size-4", className)} {...props}>
      <rect x="2.75" y="6" width="18.5" height="12" rx="3" />
      <path d="M10.2 9.4v5.2L15.4 12l-5.2-2.6z" />
    </svg>
  );
}

const ICONS = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
} as const;

export type BrandName = keyof typeof ICONS;

export function BrandIcon({
  brand,
  className,
  ...props
}: IconProps & { brand: BrandName }) {
  const Icon = ICONS[brand];
  return <Icon className={className} {...props} />;
}

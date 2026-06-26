import Image from "next/image";
import type { Team } from "@/lib/supabase/types";

type Size = "xs" | "sm" | "md" | "lg" | "rail" | "xl";

const SIZE_PX: Record<Size, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  rail: 72,
  xl: 80,
};

const TEXT_CLASS: Record<Size, string> = {
  xs: "text-[9px]",
  sm: "text-[11px]",
  md: "text-xs",
  lg: "text-sm font-semibold",
  rail: "text-sm font-semibold",
  xl: "text-base font-bold",
};

type Props = {
  team: Pick<Team, "name" | "short_name" | "colour" | "logo_url">;
  size?: Size;
  className?: string;
};

/**
 * Renders the team's logo image if one is set, otherwise falls back to a
 * coloured circle displaying the team's short_name as initials.
 */
export default function TeamBadge({ team, size = "md", className = "" }: Props) {
  const px = SIZE_PX[size];
  const style = { width: px, height: px };

  if (team.logo_url) {
    return (
      <span
        className={`relative inline-block shrink-0 rounded-full overflow-hidden ring-1 ring-black/10 ${className}`}
        style={style}
      >
        <Image
          src={team.logo_url}
          alt={`${team.name} logo`}
          fill
          sizes={`${px}px`}
          className="object-cover"
          unoptimized={false}
        />
      </span>
    );
  }

  // Fallback: coloured circle with initials
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-black/10 font-medium text-white select-none ${TEXT_CLASS[size]} ${className}`}
      style={{ ...style, backgroundColor: team.colour }}
      title={team.name}
      aria-label={team.name}
    >
      {team.short_name}
    </span>
  );
}

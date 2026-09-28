import Image from "next/image";

// Same markup as the home page ladder snapshot (src/app/page.tsx), so a league
// table shown elsewhere looks identical. Two optional extras:
//  - highlightTeam: tints one club's row (e.g. the competition's own club)
//  - compactOnMobile: below `sm`, show only Pos, Team, P, W, L, PD, Pts and
//    fit the screen instead of scrolling sideways.

export type LadderTableRow = {
  team_id: string;
  team_name: string;
  position: number | null;
  matches_played: number | null;
  matches_won: number | null;
  matches_lost: number | null;
  points_for: number | null;
  points_against: number | null;
  points_diff: number | null;
  match_points: number | null;
  crest: string | null;
};

function val(n: number | null): string {
  return n != null ? String(n) : "—";
}

function signed(n: number | null): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

function initials(name: string): string {
  const words = name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/);
  return words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

const DESKTOP_COLS = "46px 1fr 42px 42px 42px 58px 58px 58px 56px";

export default function LadderTable({
  rows,
  teamColours,
  highlightTeam,
  compactOnMobile = false,
}: {
  rows: LadderTableRow[];
  teamColours?: Map<string, string>;
  highlightTeam?: string | null;
  compactOnMobile?: boolean;
}) {
  // In compact mode the grid template comes from classes (mobile vs sm+);
  // otherwise it's the home page's fixed inline template.
  const gridClass = compactOnMobile
    ? "grid grid-cols-[24px_minmax(0,1fr)_26px_26px_26px_40px_34px] sm:grid-cols-[46px_1fr_42px_42px_42px_58px_58px_58px_56px] sm:min-w-[540px] px-3 sm:px-5"
    : "";
  const gridStyle = compactOnMobile
    ? {}
    : { display: "grid", gridTemplateColumns: DESKTOP_COLS, padding: "15px 20px", minWidth: 540 };
  const rowPadding = compactOnMobile ? "py-[13px] sm:py-[15px]" : "";
  const desktopOnly = compactOnMobile ? "hidden sm:block" : "";
  // Phones: drop the crest so the club name has room.
  const crestClass = compactOnMobile ? "hidden sm:flex" : "flex";

  return (
    <div className="rounded-[18px] overflow-hidden" style={{ background: "#fff", border: "1px solid #E4E1D8", fontFeatureSettings: "'tnum'" }}>
      <div className="overflow-x-auto">
        {/* Header */}
        <div
          className={`${gridClass} ${rowPadding}`}
          style={{
            ...gridStyle,
            background: "var(--surface-alt, #0D1016)",
            color: "#9AA1AD",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".08em",
            textTransform: "uppercase" as const,
          }}
        >
          <span>#</span>
          <span>Club</span>
          <span style={{ textAlign: "center" }}>P</span>
          <span style={{ textAlign: "center" }}>W</span>
          <span style={{ textAlign: "center" }}>L</span>
          <span className={desktopOnly} style={{ textAlign: "center" }}>PF</span>
          <span className={desktopOnly} style={{ textAlign: "center" }}>PA</span>
          <span style={{ textAlign: "center" }}>PD</span>
          <span style={{ textAlign: "right" }}>Pts</span>
        </div>

        {rows.map((row, i) => {
          const pd = row.points_diff;
          const pdColor = pd != null && pd > 0 ? "#1F9E5A" : pd != null && pd < 0 ? "#B23A48" : "#5A6371";
          const barColor = i === 0 ? "var(--accent)" : "transparent";
          const teamColour = teamColours?.get(row.team_name) ?? "#2B3A52";
          const highlighted = highlightTeam != null && row.team_name === highlightTeam;

          return (
            <div
              key={row.team_id}
              className={`${gridClass} ${rowPadding}`}
              style={{
                ...gridStyle,
                alignItems: "center",
                borderTop: "1px solid #EFEDE6",
                borderLeft: `3px solid ${highlighted ? "var(--accent)" : barColor}`,
                background: highlighted ? "var(--accent-wash, rgba(217,165,33,.12))" : undefined,
              }}
            >
              <span className="font-display" style={{ fontSize: 16, color: "#11151C" }}>{row.position ?? i + 1}</span>
              <span className={`flex items-center ${compactOnMobile ? "gap-0 sm:gap-3" : "gap-3"}`} style={{ minWidth: 0 }}>
                {row.crest ? (
                  <Image src={row.crest} alt={row.team_name} width={32} height={32} className={`${compactOnMobile ? "hidden sm:block" : ""} rounded-full object-contain shrink-0`} style={{ width: 32, height: 32 }} unoptimized />
                ) : (
                  <span className={`${crestClass} items-center justify-center rounded-full shrink-0 font-display text-[11px] text-white`} style={{ width: 32, height: 32, background: teamColour }}>
                    {initials(row.team_name)}
                  </span>
                )}
                <span style={{ fontWeight: highlighted ? 800 : 700, fontSize: 15, color: "#11151C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.team_name}
                </span>
              </span>
              <span style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>{val(row.matches_played)}</span>
              <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#169B63" }}>{val(row.matches_won)}</span>
              <span style={{ textAlign: "center", fontSize: 14, color: "#B23A48" }}>{val(row.matches_lost)}</span>
              <span className={desktopOnly} style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>{val(row.points_for)}</span>
              <span className={desktopOnly} style={{ textAlign: "center", fontSize: 14, color: "#5A6371" }}>{val(row.points_against)}</span>
              <span style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: pdColor }}>{signed(row.points_diff)}</span>
              <span className="font-display" style={{ textAlign: "right", fontSize: 18, color: "#11151C" }}>{val(row.match_points)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

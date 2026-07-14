import Image from "next/image";
import Link from "next/link";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Player, CoachingStaff } from "@/lib/supabase/types";

function getAvatarColor(name: string): string {
  const colors = [
    "#4A90A4", "#6B8E5A", "#A0522D", "#7B68AE", "#C4834D",
    "#5B7FA5", "#8B6F5C", "#6A9B7B", "#A07DA0", "#7C8B5E",
    "#9C6B4B", "#5C8A9A", "#8B7355", "#6E85A0", "#9A7B6A",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function PlayerCard({
  player,
  teamColor,
}: {
  player: Player;
  teamColor: string;
}) {
  const initials = `${player.first_name[0]}${player.last_name[0]}`;
  const displayName = `${player.first_name[0]}. ${player.last_name}`;
  const avatarBg = getAvatarColor(`${player.first_name} ${player.last_name}`);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#fff",
        border: "1px solid #E4E1D8",
        borderRadius: 12,
        padding: "10px 14px",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: avatarBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: ".03em" }}>
          {initials}
        </span>
        {player.is_captain && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              background: teamColor,
              color: "#fff",
              fontSize: 8,
              fontWeight: 800,
              width: 16,
              height: 16,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
            }}
          >
            C
          </span>
        )}
      </div>

      {/* Name & position */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="font-display"
          style={{
            fontSize: 14,
            color: "#11151C",
            textTransform: "uppercase",
            lineHeight: 1.2,
            letterSpacing: ".02em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayName}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "#8B8676",
              background: "#F2F0EA",
              padding: "2px 7px",
              borderRadius: 4,
            }}
          >
            {player.position}
          </span>
          {(player.apps > 0 || player.pts > 0) && (
            <span style={{ fontSize: 11, color: "#8B8676", fontWeight: 600 }}>
              {player.apps > 0 && `${player.apps} apps`}
              {player.apps > 0 && player.pts > 0 && " · "}
              {player.pts > 0 && `${player.pts} pts`}
            </span>
          )}
        </div>
      </div>

      {/* Jersey number */}
      <span
        className="font-display"
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: "rgba(0,0,0,.1)",
          flexShrink: 0,
        }}
      >
        {player.jersey_number}
      </span>
    </div>
  );
}

function CoachCard({ coach }: { coach: CoachingStaff }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "#fff",
        border: "1px solid #E4E1D8",
        borderRadius: 14,
        padding: "12px 16px",
      }}
    >
      {coach.photo_url ? (
        <Image
          src={coach.photo_url}
          alt={coach.name}
          width={48}
          height={48}
          style={{
            borderRadius: "50%",
            objectFit: "cover",
            width: 48,
            height: 48,
            flexShrink: 0,
          }}
        />
      ) : (
        <span
          className="flex items-center justify-center shrink-0"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#E4E1D8",
            fontSize: 16,
            fontWeight: 700,
            color: "#8B8676",
          }}
        >
          {coach.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)}
        </span>
      )}
      <div>
        <div
          className="font-display"
          style={{
            fontSize: 14,
            color: "#11151C",
            textTransform: "uppercase",
            letterSpacing: ".02em",
          }}
        >
          {coach.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#8B8676",
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          {coach.role}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <span
        style={{
          width: 20,
          height: 3,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "#5A6371",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#8B8676",
          background: "rgba(0,0,0,.05)",
          padding: "2px 8px",
          borderRadius: 999,
        }}
      >
        {count}
      </span>
    </div>
  );
}

export default function SquadDisplay({
  team,
  players,
  coaches,
}: {
  team: Team;
  players: Player[];
  coaches: CoachingStaff[];
}) {
  const sorted = [...players].sort(
    (a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99)
  );

  return (
    <div style={{ background: "#F2F0EA", minHeight: "100vh" }}>
      {/* Dark hero */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div
          className="mx-auto"
          style={{ maxWidth: 1100, padding: "32px 32px 36px" }}
        >
          {/* Back link */}
          <Link
            href="/squads"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,.45)",
              textDecoration: "none",
              marginBottom: 24,
              transition: "color .15s",
            }}
            className="hover:!text-white"
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>&larr;</span>
            Back to Squads
          </Link>

          {/* Team hero info */}
          <div className="flex items-center gap-4 sm:gap-5">
            <TeamBadge team={team} size="xl" />
            <div>
              <h1
                className="font-display uppercase"
                style={{
                  fontSize: 36,
                  lineHeight: 1,
                  margin: 0,
                  color: "#fff",
                }}
              >
                {team.name}
              </h1>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 8,
                  fontSize: 13,
                  color: "rgba(255,255,255,.5)",
                  fontWeight: 600,
                }}
              >
                <span>{players.length} player{players.length !== 1 ? "s" : ""}</span>
                {team.home_ground && <span>{team.home_ground}</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Squad content */}
      <section
        className="mx-auto"
        style={{ maxWidth: 1100, padding: "32px 32px 70px" }}
      >
        {players.length === 0 && coaches.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              color: "#8B8676",
              fontSize: 15,
              fontStyle: "italic",
            }}
          >
            Squad not yet announced
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {sorted.length > 0 && (() => {
              const forwards = sorted.filter(p => (p.jersey_number ?? 99) >= 1 && (p.jersey_number ?? 99) <= 8);
              const backs = sorted.filter(p => (p.jersey_number ?? 99) >= 9 && (p.jersey_number ?? 99) <= 15);
              const reserves = sorted.filter(p => (p.jersey_number ?? 99) >= 16);
              const groups = [
                { title: "Forwards", players: forwards },
                { title: "Backs", players: backs },
                { title: "Reserves", players: reserves },
              ].filter(g => g.players.length > 0);

              return groups.map(g => (
                <div key={g.title}>
                  <SectionHeading title={g.title} count={g.players.length} color={team.colour} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 8 }}>
                    {g.players.map(p => (
                      <PlayerCard key={p.id} player={p} teamColor={team.colour} />
                    ))}
                  </div>
                </div>
              ));
            })()}

            {coaches.length > 0 && (
              <div>
                <SectionHeading
                  title="Coaching Staff"
                  count={coaches.length}
                  color={team.colour}
                />
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
                  style={{ gap: 10 }}
                >
                  {coaches.map((c) => (
                    <CoachCard key={c.id} coach={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

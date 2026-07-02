import Image from "next/image";
import Link from "next/link";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Player, CoachingStaff } from "@/lib/supabase/types";

const CARD_BGS = [
  "#20303F",
  "#2A3A2A",
  "#33262E",
  "#25303B",
  "#382C22",
  "#2E2A38",
  "#213A34",
  "#30302A",
];

const FORWARD_POSITIONS = new Set([
  "Loosehead Prop",
  "Hooker",
  "Tighthead Prop",
  "Lock",
  "Flanker",
  "No. 8",
]);

function PlayerCard({
  player,
  bgColor,
  teamColor,
}: {
  player: Player;
  bgColor: string;
  teamColor: string;
}) {
  const displayName = `${player.first_name[0]}. ${player.last_name.toUpperCase()}`;
  return (
    <div
      style={{
        background: bgColor,
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          aspectRatio: "1",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {player.photo_url ? (
          <Image
            src={player.photo_url}
            alt={`${player.first_name} ${player.last_name}`}
            fill
            sizes="(max-width: 640px) 45vw, 180px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: "rgba(255,255,255,.08)",
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            {player.first_name[0]}
            {player.last_name[0]}
          </span>
        )}

        <span
          className="font-display"
          style={{
            position: "absolute",
            bottom: 8,
            right: 10,
            fontSize: 28,
            lineHeight: 1,
            color: "rgba(255,255,255,.2)",
            fontWeight: 900,
          }}
        >
          {player.jersey_number}
        </span>

        {player.is_captain && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: teamColor,
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: 6,
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            C
          </span>
        )}
      </div>

      <div style={{ padding: "10px 12px 12px" }}>
        <span
          style={{
            display: "inline-block",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.5)",
            background: "rgba(255,255,255,.08)",
            padding: "3px 8px",
            borderRadius: 5,
            marginBottom: 6,
          }}
        >
          {player.position}
        </span>
        <div
          className="font-display"
          style={{
            fontSize: 15,
            color: "#fff",
            textTransform: "uppercase",
            lineHeight: 1.2,
            letterSpacing: ".02em",
          }}
        >
          {displayName}
        </div>
        {(player.apps > 0 || player.pts > 0) && (
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 6,
              fontSize: 11,
              color: "rgba(255,255,255,.45)",
              fontWeight: 600,
            }}
          >
            {player.apps > 0 && <span>{player.apps} apps</span>}
            {player.pts > 0 && <span>{player.pts} pts</span>}
          </div>
        )}
      </div>
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
        background: "#161A22",
        borderRadius: 12,
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
            background: "rgba(255,255,255,.08)",
            fontSize: 16,
            fontWeight: 700,
            color: "rgba(255,255,255,.3)",
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
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: ".02em",
          }}
        >
          {coach.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,.45)",
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
          color: "rgba(255,255,255,.6)",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "rgba(255,255,255,.3)",
          background: "rgba(255,255,255,.06)",
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
  const forwards = players.filter((p) => FORWARD_POSITIONS.has(p.position));
  const backs = players.filter((p) => !FORWARD_POSITIONS.has(p.position));

  return (
    <div style={{ background: "#0B0E13", minHeight: "100vh" }}>
      {/* Hero section */}
      <section
        style={{
          background: `linear-gradient(135deg, ${team.colour}22 0%, #0B0E13 60%)`,
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
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
              color: "rgba(255,255,255,.4)",
              fontSize: 15,
              fontStyle: "italic",
            }}
          >
            Squad not yet announced
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {forwards.length > 0 && (
              <div>
                <SectionHeading
                  title="Forwards"
                  count={forwards.length}
                  color={team.colour}
                />
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  style={{ gap: 12 }}
                >
                  {forwards.map((p, idx) => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      bgColor={CARD_BGS[idx % CARD_BGS.length]}
                      teamColor={team.colour}
                    />
                  ))}
                </div>
              </div>
            )}

            {backs.length > 0 && (
              <div>
                <SectionHeading
                  title="Backs"
                  count={backs.length}
                  color={team.colour}
                />
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  style={{ gap: 12 }}
                >
                  {backs.map((p, idx) => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      bgColor={CARD_BGS[idx % CARD_BGS.length]}
                      teamColor={team.colour}
                    />
                  ))}
                </div>
              </div>
            )}

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

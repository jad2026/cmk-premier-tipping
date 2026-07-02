"use client";

import { useState } from "react";
import Image from "next/image";
import TeamBadge from "@/components/TeamBadge";
import type { Team, Player, CoachingStaff } from "@/lib/supabase/types";

type TeamWithData = {
  team: Team;
  players: Player[];
  coaches: CoachingStaff[];
};

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

function PlayerAvatar({
  player,
  size,
}: {
  player: Player;
  size: number;
}) {
  const initials =
    `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`.toUpperCase();
  if (player.photo_url) {
    return (
      <Image
        src={player.photo_url}
        alt={`${player.first_name} ${player.last_name}`}
        width={size}
        height={size}
        className="shrink-0"
        style={{
          borderRadius: "50%",
          objectFit: "cover",
          width: size,
          height: size,
        }}
      />
    );
  }
  return (
    <span
      className="shrink-0 flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,.12)",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: "rgba(255,255,255,.5)",
        textTransform: "uppercase",
      }}
    >
      {initials}
    </span>
  );
}

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
      {/* Photo area */}
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

        {/* Jersey number overlay */}
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

        {/* Captain badge */}
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

      {/* Info area */}
      <div style={{ padding: "10px 12px 12px" }}>
        {/* Position badge */}
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
  teams,
}: {
  teams: TeamWithData[];
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.team.id ?? "");

  const selected = teams.find((t) => t.team.id === selectedTeamId);
  if (!selected) {
    return (
      <div
        style={{
          background: "#0B0E13",
          padding: "80px 32px",
          textAlign: "center",
          color: "#8C93A0",
        }}
      >
        No teams available yet.
      </div>
    );
  }

  const { team, players, coaches } = selected;

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
          style={{ maxWidth: 1100, padding: "44px 32px 36px" }}
        >
          <div
            className="flex items-center gap-3"
            style={{ marginBottom: 18 }}
          >
            <div
              className="shrink-0"
              style={{
                width: 24,
                height: 3,
                borderRadius: 2,
                background: "var(--accent)",
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: "#C7CCD4",
              }}
            >
              Team rosters
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0, color: "#fff" }}
          >
            Squads<span style={{ color: "var(--accent)" }}>.</span>
          </h1>

          {/* Team hero info */}
          <div
            className="flex items-center gap-4 sm:gap-5"
            style={{ marginTop: 32 }}
          >
            <TeamBadge team={team} size="xl" />
            <div>
              <h2
                className="font-display uppercase"
                style={{
                  fontSize: 28,
                  lineHeight: 1.1,
                  margin: 0,
                  color: "#fff",
                }}
              >
                {team.name}
              </h2>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 6,
                  fontSize: 13,
                  color: "rgba(255,255,255,.5)",
                  fontWeight: 600,
                }}
              >
                <span>{players.length} players</span>
                {team.home_ground && <span>{team.home_ground}</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team selector pills */}
      <section
        style={{
          borderBottom: "1px solid rgba(255,255,255,.06)",
          background: "#0D1117",
        }}
      >
        <div
          className="mx-auto"
          style={{ maxWidth: 1100, padding: "0 32px" }}
        >
          <div
            className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              overflowX: "auto",
              padding: "14px 0",
              display: "flex",
              gap: 6,
            }}
          >
            {teams.map(({ team: t }) => {
              const isActive = t.id === selectedTeamId;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderRadius: 999,
                    border: isActive
                      ? `2px solid ${t.colour}`
                      : "1px solid rgba(255,255,255,.1)",
                    background: isActive
                      ? `${t.colour}18`
                      : "transparent",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all .15s",
                  }}
                >
                  <TeamBadge team={t} size="xs" />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isActive ? "#fff" : "rgba(255,255,255,.5)",
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                    }}
                  >
                    {t.short_name || t.name}
                  </span>
                </button>
              );
            })}
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
            {/* Forwards */}
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

            {/* Backs */}
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

            {/* Coaching Staff */}
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

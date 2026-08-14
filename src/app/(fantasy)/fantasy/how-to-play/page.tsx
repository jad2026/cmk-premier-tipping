import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "How to Play — Fantasy Rugby",
};

type ScoringRule = {
  action: string;
  points: number;
  position_group: string | null;
};

const DEFAULT_RULES: ScoringRule[] = [
  { action: "Try", points: 10, position_group: null },
  { action: "Try assist", points: 5, position_group: null },
  { action: "Conversion", points: 2, position_group: null },
  { action: "Penalty goal", points: 3, position_group: null },
  { action: "Drop goal", points: 5, position_group: null },
  { action: "Metres carried (per 10m)", points: 1, position_group: null },
  { action: "Clean break", points: 3, position_group: null },
  { action: "Defenders beaten", points: 2, position_group: null },
  { action: "Offload", points: 2, position_group: null },
  { action: "Tackle made", points: 1, position_group: "Forwards" },
  { action: "Tackle made", points: 0.5, position_group: "Backs" },
  { action: "Dominant tackle", points: 3, position_group: null },
  { action: "Turnover won", points: 5, position_group: null },
  { action: "Lineout won", points: 2, position_group: "Forwards" },
  { action: "Scrum won", points: 1, position_group: "Forwards" },
  { action: "Penalty conceded", points: -2, position_group: null },
  { action: "Missed tackle", points: -1, position_group: null },
  { action: "Handling error", points: -2, position_group: null },
  { action: "Turnover conceded", points: -1, position_group: null },
  { action: "Yellow card", points: -5, position_group: null },
  { action: "Red card", points: -10, position_group: null },
];

export default async function HowToPlayPage() {
  const supabase = await createClient();

  let rules: ScoringRule[] = DEFAULT_RULES;
  const result = (await supabase
    .from("fantasy_scoring_rules")
    .select("action, points, position_group")
    .order("points", { ascending: false })) as unknown as {
    data: ScoringRule[] | null;
  };
  if (result.data && result.data.length > 0) rules = result.data;

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        background: "#0B0E13",
        minHeight: "100vh",
        color: "#fff",
        paddingBottom: 1,
      }}
    >
      {/* ── Hero ── */}
      <section style={{ background: "#0B0E13" }}>
        <div className="mx-auto" style={{ maxWidth: 760, padding: "48px 24px 32px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "#2C9FD4" }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              Fantasy Rugby
            </span>
          </div>
          <h1 className="font-display uppercase" style={{ fontSize: 40, lineHeight: 0.9, margin: 0 }}>
            How to play<span style={{ color: "#2C9FD4" }}>.</span>
          </h1>
          <p style={{ color: "#8C93A0", fontSize: 14, marginTop: 12, maxWidth: 540, lineHeight: 1.6 }}>
            Build your dream XV, set your captain, and earn points based on real match performances.
            Here&rsquo;s everything you need to know.
          </p>
        </div>
      </section>

      {/* ── Content ── */}
      <section style={{ background: "#0B0E13" }}>
      <div className="mx-auto" style={{ maxWidth: 760, padding: "0 24px 80px" }}>

        {/* 1. Build your squad */}
        <Section number="01" title="Build your squad">
          <ul className="space-y-2" style={{ paddingLeft: 0, listStyle: "none" }}>
            <Li>Select <strong>15 players</strong> to fill jersey slots 1–15.</Li>
            <Li>Maximum <strong>3 players</strong> from any single team.</Li>
            <Li>Stay within the <strong>$100m salary cap</strong>.</Li>
            <Li>Each position has a set number of slots — 2 Props, 1 Hooker, 2 Locks, 3 Loose Forwards, 1 Halfback, 1 First Five, 2 Centres, 3 Outside Backs.</Li>
          </ul>
        </Section>

        {/* 2. Captain & Vice */}
        <Section number="02" title="Captain & vice-captain">
          <ul className="space-y-2" style={{ paddingLeft: 0, listStyle: "none" }}>
            <Li>Your <strong>captain</strong> earns <strong style={{ color: "#2C9FD4" }}>2&times;</strong> their match points.</Li>
            <Li>Your <strong>vice-captain</strong> earns <strong style={{ color: "#2C9FD4" }}>1.5&times;</strong> their match points.</Li>
            <Li>If your captain doesn&rsquo;t play, the vice-captain is promoted to captain and earns the 2&times; multiplier instead.</Li>
          </ul>
        </Section>

        {/* 3. Transfers */}
        <Section number="03" title="Transfers">
          <ul className="space-y-2" style={{ paddingLeft: 0, listStyle: "none" }}>
            <Li>You get <strong>2 free transfers</strong> each round.</Li>
            <Li>Additional transfers cost <strong style={{ color: "#B23A48" }}>-4 points</strong> each.</Li>
            <Li>Transfers lock when the first match of the round kicks off.</Li>
            <Li>Unused free transfers do not carry over.</Li>
          </ul>
        </Section>

        {/* 4. Scoring */}
        <Section number="04" title="Scoring">
          <p style={{ color: "#8C93A0", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Players earn fantasy points based on their real match stats. Some actions are weighted differently
            for forwards and backs.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <Th align="left">Action</Th>
                  <Th align="right">Points</Th>
                  <Th align="left">Position</Th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <Td>{r.action}</Td>
                    <Td align="right">
                      <span style={{ color: r.points >= 0 ? "#34D399" : "#F87171", fontWeight: 700 }}>
                        {r.points > 0 ? `+${r.points}` : r.points}
                      </span>
                    </Td>
                    <Td>
                      {r.position_group ? (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".04em",
                          textTransform: "uppercase",
                          color: "#8C93A0",
                          background: "rgba(255,255,255,0.06)",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}>
                          {r.position_group}
                        </span>
                      ) : (
                        <span style={{ color: "#555" }}>All</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 5. Matchday scoring */}
        <Section number="05" title="Matchday scoring">
          <ul className="space-y-2" style={{ paddingLeft: 0, listStyle: "none" }}>
            <Li>Points are calculated after each match using official Opta stats.</Li>
            <Li>Live scores update during the match and are finalised once the match is complete.</Li>
            <Li>Your round score is the sum of all 15 players&rsquo; points, plus captain/vice-captain multipliers, minus any transfer penalties.</Li>
          </ul>
        </Section>

        {/* 6. Leagues */}
        <Section number="06" title="Leagues">
          <ul className="space-y-2" style={{ paddingLeft: 0, listStyle: "none" }}>
            <Li>Everyone is automatically entered into the <strong>overall league</strong>.</Li>
            <Li>Create or join <strong>private leagues</strong> to compete with mates.</Li>
            <Li>League standings are based on total cumulative points across all rounds.</Li>
          </ul>
        </Section>

        {/* 7. Tips & strategy */}
        <Section number="07" title="Tips & strategy">
          <ul className="space-y-2" style={{ paddingLeft: 0, listStyle: "none" }}>
            <Li>Check the fixture list — players facing weaker opposition tend to score more.</Li>
            <Li>Forwards earn more from tackles, turnovers, and set piece — backs earn more from tries, metres, and clean breaks.</Li>
            <Li>Don&rsquo;t burn transfers early. Two per round is enough if you pick a balanced squad.</Li>
            <Li>Pick a captain who plays the full 80 — bench players rarely outscore starters.</Li>
          </ul>
        </Section>

        {/* CTA */}
        <div style={{ marginTop: 48, textAlign: "center" }}>
          <a
            href="/fantasy/picker"
            style={{
              display: "inline-block",
              background: "#2C9FD4",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              padding: "14px 36px",
              borderRadius: 10,
              textDecoration: "none",
              letterSpacing: ".02em",
            }}
          >
            Pick your squad &rarr;
          </a>
        </div>
      </div>
      </section>
    </div>
  );
}

/* ── Helper components ── */

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 40 }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#2C9FD4", fontFamily: "var(--font-archivo-black), sans-serif" }}>
          {number}
        </span>
        <h2 className="font-display uppercase" style={{ fontSize: 22, margin: 0, lineHeight: 1 }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3" style={{ fontSize: 14, color: "#C7CCD4", lineHeight: 1.6 }}>
      <span style={{ color: "#2C9FD4", fontSize: 10, marginTop: 6, flexShrink: 0 }}>&#9679;</span>
      <span>{children}</span>
    </li>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      textAlign: align,
      padding: "10px 12px",
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: ".12em",
      textTransform: "uppercase",
      color: "#8C93A0",
    }}>
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ textAlign: align, padding: "10px 12px", color: "#C7CCD4" }}>
      {children}
    </td>
  );
}

import { readFileSync, writeFileSync } from "fs";
import { XMLParser } from "fast-xml-parser";

const COMPETITION_ID = "bf6bb916-86c7-4cb1-8268-ba887a973c1f";

const TEAM_MAP = {
  "4350": "89a8babe-1962-4d39-952b-86497b2eb338", // Auckland
  "4400": "6e4ee3c5-807f-4695-91b2-7a4df26a5a30", // Bay of Plenty
  "4250": "bc699091-b209-4db5-8b69-04bc7a2996e8", // Canterbury
  "65":   "0f676072-3477-4a45-bf0d-52f2b6b07140", // Counties Manukau
  "66":   "7f88f80e-898a-4491-8f32-2fec4e7eac3f", // Hawke's Bay
  "4650": "b9fe9345-76ce-48eb-b765-6b3428a38b67", // Manawatu
  "4550": "22c73777-1697-4c13-852b-c92c549fe524", // North Harbour
  "4500": "84651a7d-52fc-4047-8468-18fb44c6ca11", // Northland
  "4100": "88027e58-f986-4d21-9eab-c222cfb27dcd", // Otago
  "4300": "4177c0ab-420c-486d-a299-234fd046702e", // Southland
  "4450": "2ca54d8f-3fc8-4ff4-b995-871c2c6c906c", // Taranaki
  "67":   "93456bc4-ab88-4080-8d12-88e0249b5823", // Tasman
  "4200": "7a4e5a50-4a45-4817-b913-a7e5ace58729", // Waikato
  "4150": "0d8d9c6f-4c60-4ba9-af9e-4d6070252b59", // Wellington
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "team" || name === "player",
});

const xml = readFileSync("src/scripts/ru10-squads.xml", "utf-8");
const parsed = parser.parse(xml);

// Navigate to team list — try common RU10 structures
const root = parsed.squads ?? parsed.squad ?? parsed;
const teams = root.team ?? root.teams?.team ?? [];

if (!Array.isArray(teams) || teams.length === 0) {
  console.error("No teams found. Root keys:", Object.keys(parsed));
  process.exit(1);
}

function esc(str) {
  return str.replace(/'/g, "''");
}

const lines = [];
let totalPlayers = 0;

for (const team of teams) {
  const optaTeamId = String(team["@_team_id"] ?? team["@_id"] ?? "");
  const teamName = team["@_team_name"] ?? team["@_name"] ?? optaTeamId;
  const platformTeamId = TEAM_MAP[optaTeamId];

  if (!platformTeamId) {
    console.warn(`⚠ Unmapped team: ${teamName} (opta_id=${optaTeamId}) — skipping`);
    continue;
  }

  const players = team.player ?? team.players?.player ?? [];
  if (!Array.isArray(players)) continue;

  let teamCount = 0;

  for (const p of players) {
    const position = p["@_position"] ?? "";
    if (position === "Unknown") continue;

    const name = p["@_player_known_name"] ?? p["@_known_name"] ?? p["@_player_name"] ?? "";
    const optaPlayerId = String(p["@_player_id"] ?? p["@_id"] ?? "");

    if (!name || !optaPlayerId) continue;

    lines.push(
      `INSERT INTO players (name, team_id, competition_id, is_active, opta_player_id) ` +
      `VALUES ('${esc(name)}', '${platformTeamId}', '${COMPETITION_ID}', true, '${esc(optaPlayerId)}') ` +
      `ON CONFLICT (opta_player_id) DO UPDATE SET name = EXCLUDED.name, team_id = EXCLUDED.team_id, is_active = EXCLUDED.is_active;`
    );
    teamCount++;
  }

  console.log(`${teamName}: ${teamCount} players`);
  totalPlayers += teamCount;
}

const sql = lines.join("\n") + "\n";
writeFileSync("src/scripts/import-squads.sql", sql);

console.log(`\nTotal: ${totalPlayers} players`);
console.log(`SQL written to src/scripts/import-squads.sql`);

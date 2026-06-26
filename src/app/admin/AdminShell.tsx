"use client";

import { useState } from "react";
import type { Team, Fixture } from "@/lib/supabase/types";
import AddFixtureForm from "./AddFixtureForm";
import BulkImportForm from "./BulkImportForm";
import EnterResultsForm from "./EnterResultsForm";
import TeamManagementPanel from "./TeamManagementPanel";
import ParticipantsPanel from "./ParticipantsPanel";
import ResultsHistoryPanel from "./ResultsHistoryPanel";
import SeasonManagementPanel from "./SeasonManagementPanel";
import ManageRoundsPanel from "./ManageRoundsPanel";
import SponsorsPanel from "./SponsorsPanel";
import TryOfTheWeekPanel from "./TryOfTheWeekPanel";

type Tab = "add" | "bulk" | "results" | "rounds" | "teams" | "participants" | "history" | "season" | "sponsors" | "try";

const TABS: { id: Tab; label: string }[] = [
  { id: "add", label: "Add Fixture" },
  { id: "bulk", label: "Bulk Import" },
  { id: "results", label: "Enter Results" },
  { id: "try", label: "Try of the Week" },
  { id: "rounds", label: "Manage Rounds" },
  { id: "teams", label: "Teams" },
  { id: "participants", label: "Participants" },
  { id: "history", label: "Results History" },
  { id: "season", label: "Season" },
  { id: "sponsors", label: "Sponsors" },
];

type Props = {
  teams: Team[];
  pendingFixtures: Fixture[];
  seasonComplete: boolean;
  seasonName: string;
  compId: string;
};

export default function AdminShell({ teams, pendingFixtures, seasonComplete, seasonName, compId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("add");

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* Dark header */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 0" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              Competition management
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: "0 0 28px" }}
          >
            Admin<span style={{ color: "var(--accent)" }}>.</span>
          </h1>

          {/* Tab bar */}
          <div style={{ overflowX: "auto", marginLeft: -32, marginRight: -32, paddingLeft: 32, paddingRight: 32 }}
            className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div style={{ display: "flex", minWidth: "max-content", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "12px 20px",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                    color: activeTab === tab.id ? "var(--accent)" : "rgba(255,255,255,.5)",
                    cursor: "pointer",
                    transition: "color .15s, border-color .15s",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {tab.label}
                  {tab.id === "results" && pendingFixtures.length > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 18, height: 18, borderRadius: "50%",
                      background: "var(--accent)", color: "var(--accent-text, #11151C)",
                      fontSize: 10, fontWeight: 800,
                    }}>
                      {pendingFixtures.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tab panels */}
      <section style={{ background: "#F2F0EA" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "28px 32px 60px" }}>
          {activeTab === "add" && <AddFixtureForm teams={teams} />}
          {activeTab === "bulk" && <BulkImportForm teams={teams} />}
          {activeTab === "results" && (
            <EnterResultsForm fixtures={pendingFixtures} teams={teams} />
          )}
          {activeTab === "rounds" && <ManageRoundsPanel teams={teams} />}
          {activeTab === "teams" && (
            <TeamManagementPanel initialTeams={teams} compId={compId} />
          )}
          {activeTab === "season" && (
            <SeasonManagementPanel seasonComplete={seasonComplete} seasonName={seasonName} />
          )}
          {activeTab === "participants" && <ParticipantsPanel />}
          {activeTab === "history" && <ResultsHistoryPanel />}
          {activeTab === "sponsors" && <SponsorsPanel compId={compId} />}
          {activeTab === "try" && <TryOfTheWeekPanel compId={compId} />}
        </div>
      </section>
    </div>
  );
}

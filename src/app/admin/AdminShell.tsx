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
  timezone: string;
  locale: string;
};

export default function AdminShell({ teams, pendingFixtures, seasonComplete, seasonName, compId, timezone, locale }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("add");

  return (
    <div
      className="-mx-4 sm:-mx-8 -mt-6 sm:-mt-8 -mb-6 sm:-mb-8"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* Dark header */}
      <section style={{ background: "#0B0E13", color: "#fff" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "44px 32px 36px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
            <div className="shrink-0" style={{ width: 24, height: 3, borderRadius: 2, background: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#C7CCD4" }}>
              Site management
            </span>
          </div>
          <h1
            className="font-display uppercase"
            style={{ fontSize: 60, lineHeight: 0.86, margin: 0 }}
          >
            Admin<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
        </div>
      </section>

      {/* Tab bar */}
      <section style={{ background: "#F2F0EA" }}>
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "24px 32px 0" }}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #E4E1D8",
              borderRadius: 12,
              padding: 4,
              overflowX: "auto",
            }}
            className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div style={{ display: "flex", minWidth: "max-content" }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: ".02em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    border: "none",
                    cursor: "pointer",
                    transition: "background .15s, color .15s",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: activeTab === tab.id ? "var(--accent)" : "transparent",
                    color: activeTab === tab.id ? "var(--accent-text, #11151C)" : "#8B8676",
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) e.currentTarget.style.background = "#F4F2EC";
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {tab.label}
                  {tab.id === "results" && pendingFixtures.length > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 18, height: 18, borderRadius: "50%",
                      background: activeTab === tab.id ? "rgba(0,0,0,.15)" : "var(--accent)",
                      color: activeTab === tab.id ? "#fff" : "var(--accent-text, #11151C)",
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

        {/* Tab panels */}
        <div className="mx-auto" style={{ maxWidth: 1100, padding: "28px 32px 60px" }}>
          {activeTab === "add" && <AddFixtureForm teams={teams} timezone={timezone} locale={locale} />}
          {activeTab === "bulk" && <BulkImportForm teams={teams} />}
          {activeTab === "results" && (
            <EnterResultsForm fixtures={pendingFixtures} teams={teams} timezone={timezone} locale={locale} />
          )}
          {activeTab === "rounds" && <ManageRoundsPanel teams={teams} timezone={timezone} locale={locale} />}
          {activeTab === "teams" && (
            <TeamManagementPanel initialTeams={teams} compId={compId} />
          )}
          {activeTab === "season" && (
            <SeasonManagementPanel seasonComplete={seasonComplete} seasonName={seasonName} />
          )}
          {activeTab === "participants" && <ParticipantsPanel timezone={timezone} locale={locale} />}
          {activeTab === "history" && <ResultsHistoryPanel />}
          {activeTab === "sponsors" && <SponsorsPanel compId={compId} />}
          {activeTab === "try" && <TryOfTheWeekPanel compId={compId} />}
        </div>
      </section>
    </div>
  );
}

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

type Tab = "add" | "bulk" | "results" | "rounds" | "teams" | "participants" | "history" | "season" | "sponsors";

const TABS: { id: Tab; label: string }[] = [
  { id: "add", label: "Add Fixture" },
  { id: "bulk", label: "Bulk Import" },
  { id: "results", label: "Enter Results" },
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">Admin</h1>
      </div>

      {/* Tab bar */}
      <div className="bg-brand rounded-xl overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-brand-gold text-brand-gold"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              {tab.label}
              {tab.id === "results" && pendingFixtures.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-gold text-white text-[10px] font-bold">
                  {pendingFixtures.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panels */}
      <div>
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
        {activeTab === "sponsors" && <SponsorsPanel />}
      </div>
    </div>
  );
}

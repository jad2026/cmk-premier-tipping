"use client";

import { useEffect, useState } from "react";
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

const STORAGE_KEY = "cmk_admin_authed";
const ADMIN_PASSWORD = "admin123";

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
};

export default function AdminShell({ teams, pendingFixtures, seasonComplete, seasonName }: Props) {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("add");

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") setAuthed(true);
  }, []);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  // ── Password gate ────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <div className="bg-white rounded-2xl shadow-md p-8">
          <h1 className="text-2xl font-bold text-brand mb-1 text-center">
            Admin
          </h1>
          <p className="text-sm text-gray-400 text-center mb-6">
            Enter the admin password to continue.
          </p>
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPwError(false);
              }}
              placeholder="Password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {pwError && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                Incorrect password.
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-brand hover:bg-brand-light text-white font-semibold py-2 rounded-lg text-sm transition-colors"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Admin UI ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">Admin</h1>
        <button
          onClick={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setAuthed(false);
          }}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Lock
        </button>
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
        {activeTab === "rounds" && <ManageRoundsPanel />}
        {activeTab === "teams" && (
          <TeamManagementPanel initialTeams={teams} />
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

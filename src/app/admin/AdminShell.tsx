"use client";

import { useEffect, useState } from "react";
import type { Team, Fixture } from "@/lib/supabase/types";
import AddFixtureForm from "./AddFixtureForm";
import BulkImportForm from "./BulkImportForm";
import EnterResultsForm from "./EnterResultsForm";
import TeamManagementPanel from "./TeamManagementPanel";

const STORAGE_KEY = "cmk_admin_authed";
const ADMIN_PASSWORD = "admin123";

type Tab = "add" | "bulk" | "results" | "teams";

const TABS: { id: Tab; label: string }[] = [
  { id: "add", label: "Add Fixture" },
  { id: "bulk", label: "Bulk Import" },
  { id: "results", label: "Enter Results" },
  { id: "teams", label: "Teams" },
];

type Props = {
  teams: Team[];
  pendingFixtures: Fixture[];
};

export default function AdminShell({ teams, pendingFixtures }: Props) {
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
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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

      {/* Tab panels */}
      <div>
        {activeTab === "add" && <AddFixtureForm teams={teams} />}
        {activeTab === "bulk" && <BulkImportForm teams={teams} />}
        {activeTab === "results" && (
          <EnterResultsForm fixtures={pendingFixtures} teams={teams} />
        )}
        {activeTab === "teams" && (
          <TeamManagementPanel initialTeams={teams} />
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

export default function LeaderboardTable({
  children,
  totalCount,
}: {
  children: React.ReactNode;
  totalCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = totalCount > 8;

  return (
    <>
      <div style={{ position: "relative" }}>
        <div
          style={{
            maxHeight: collapsible && !expanded ? 520 : undefined,
            overflowY: collapsible && !expanded ? "auto" : undefined,
          }}
        >
          {children}
        </div>
        {collapsible && !expanded && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 40,
              background: "linear-gradient(to bottom, transparent, #F2F0EA)",
              pointerEvents: "none",
              borderRadius: "0 0 17px 17px",
            }}
          />
        )}
      </div>
      {collapsible && (
        <div style={{ padding: "14px 22px 18px", borderTop: "1px solid #EFEDE6" }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--accent)",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: ".02em",
              padding: 0,
            }}
          >
            {expanded ? "Show less" : `See all ${totalCount} tippers`}
          </button>
        </div>
      )}
    </>
  );
}

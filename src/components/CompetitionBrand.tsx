"use client";

import { createContext, useContext } from "react";

// Lets client pages (login, signup…) use the competition's logo, which the
// root layout already fetches on the server. Provided in layout.tsx.
const CompetitionBrandContext = createContext<{ logoUrl: string | null }>({ logoUrl: null });

export function CompetitionBrandProvider({ logoUrl, children }: { logoUrl: string | null; children: React.ReactNode }) {
  return <CompetitionBrandContext.Provider value={{ logoUrl }}>{children}</CompetitionBrandContext.Provider>;
}

/** The competition's logo (~40px high) when it has one, otherwise the accent tick. */
export function BrandMark() {
  const { logoUrl } = useContext(CompetitionBrandContext);
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" style={{ height: 40, width: "auto", display: "block" }} />;
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="var(--accent)" />
      <path d="M7 9.5L8.5 11L11.5 7.5" stroke="var(--accent-text, #11151C)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

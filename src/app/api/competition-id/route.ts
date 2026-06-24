import { NextResponse } from "next/server";
import { getCurrentCompetitionId } from "@/lib/competition";

export const dynamic = "force-dynamic";

export async function GET() {
  const compId = await getCurrentCompetitionId();
  return NextResponse.json({ compId });
}

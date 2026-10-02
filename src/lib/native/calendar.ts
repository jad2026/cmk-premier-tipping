import { Capacitor } from "@capacitor/core";

async function getCalendarPlugin() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!Capacitor.isPluginAvailable("CapacitorCalendar")) return null;
  try {
    const mod = await import("@ebarooni/capacitor-calendar");
    return mod.CapacitorCalendar;
  } catch {
    return null;
  }
}

export async function isCalendarAvailable(): Promise<boolean> {
  const plugin = await getCalendarPlugin();
  return plugin !== null;
}

export async function requestCalendarPermission(): Promise<boolean> {
  const plugin = await getCalendarPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.requestWriteOnlyCalendarAccess();
    return result.result === "granted";
  } catch {
    return false;
  }
}

export type DeadlineEvent = {
  gameweekId: string;
  title: string;
  startDate: number;
  alertMinutesBefore: number;
};

const ADDED_KEY = "calendar_added_gameweeks";

function getAddedGameweeks(): Set<string> {
  try {
    const raw = localStorage.getItem(ADDED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveAddedGameweeks(ids: Set<string>) {
  try {
    localStorage.setItem(ADDED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Storage unavailable — deduplication won't persist
  }
}

export async function addDeadlinesToCalendar(events: DeadlineEvent[]): Promise<number> {
  const plugin = await getCalendarPlugin();
  if (!plugin) return 0;

  const granted = await requestCalendarPermission();
  if (!granted) return 0;

  const added = getAddedGameweeks();
  const toAdd = events.filter((e) => !added.has(e.gameweekId));
  if (toAdd.length === 0) return 0;

  let count = 0;
  for (const event of toAdd) {
    try {
      await plugin.createEvent({
        title: event.title,
        startDate: event.startDate,
        endDate: event.startDate + 30 * 60 * 1000,
        isAllDay: false,
        alerts: [-event.alertMinutesBefore],
      });
      added.add(event.gameweekId);
      count++;
    } catch {
      // Skip individual failures
    }
  }

  saveAddedGameweeks(added);
  return count;
}

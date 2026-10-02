import { Capacitor } from "@capacitor/core";

export async function isCalendarAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!Capacitor.isPluginAvailable("CapacitorCalendar")) return false;
  return true;
}

export async function requestCalendarPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!Capacitor.isPluginAvailable("CapacitorCalendar")) return false;
  try {
    const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
    const result = await CapacitorCalendar.requestWriteOnlyCalendarAccess();
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
    // Storage unavailable
  }
}

export async function addDeadlinesToCalendar(events: DeadlineEvent[]): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  if (!Capacitor.isPluginAvailable("CapacitorCalendar")) return 0;

  const granted = await requestCalendarPermission();
  if (!granted) return 0;

  const added = getAddedGameweeks();
  const toAdd = events.filter((e) => !added.has(e.gameweekId));
  if (toAdd.length === 0) return 0;

  let count = 0;
  try {
    const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
    for (const event of toAdd) {
      try {
        await CapacitorCalendar.createEvent({
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
  } catch {
    return 0;
  }

  saveAddedGameweeks(added);
  return count;
}

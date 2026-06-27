export type TzLocale = {
  timezone: string;
  locale: string;
};

export const DEFAULT_TZ_LOCALE: TzLocale = {
  timezone: "Pacific/Auckland",
  locale: "en-NZ",
};

export function fmtDeadline(iso: string, tz: TzLocale = DEFAULT_TZ_LOCALE): string {
  return new Date(iso).toLocaleString(tz.locale, {
    timeZone: tz.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string, tz: TzLocale = DEFAULT_TZ_LOCALE): string {
  return new Date(iso).toLocaleString(tz.locale, {
    timeZone: tz.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDateShort(iso: string, tz: TzLocale = DEFAULT_TZ_LOCALE): string {
  return new Date(iso).toLocaleDateString(tz.locale, {
    timeZone: tz.timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateLong(iso: string, tz: TzLocale = DEFAULT_TZ_LOCALE): string {
  return new Date(iso).toLocaleString(tz.locale, {
    timeZone: tz.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

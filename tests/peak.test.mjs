import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCountdown,
  formatDayScope,
  formatLocalScope,
  formatUtcWindows,
  isPeakAt,
  isBeforeEffectiveFrom,
  localIsoDate,
  localPeakByWeekday,
  nextTransition,
} from "../src/lib/peak.ts";

// Real `src/lib/peak.ts`, run through Node's type-stripping. All cases use fixed
// timestamps — no wall clock, so the results are deterministic.
//
// Semantik (identisch zu `ocgo-price-tracker/src/config/peakPricing.ts` und
// `cc-price-tracker`): the WINDOW is UTC hours, the WEEKDAY scope is evaluated in
// the rule's `timezone`, holidays (optional) are off-peak all day. No 调休 /
// `isWorkday` — DeepSeek says "Monday through Friday", so a make-up Saturday
// stays off-peak.

const RULE = {
  timezone: "Asia/Shanghai", // UTC+8
  peak: { days: [1, 2, 3, 4, 5], windowsUtc: [[1, 4], [6, 10]] },
  offPeak: { days: [6, 7], allDay: true },
};
const RULE_FROM = { ...RULE, effectiveFrom: "2026-08-23T00:00:00+08:00" };

const at = (iso) => Date.parse(iso);
const H = 3_600_000;

// 2026-10-02 is a Friday; 2026-10-03 Saturday; 2026-10-05 Monday.
const FRI = at("2026-10-02T00:00:00Z");
const SAT = at("2026-10-03T00:00:00Z");
const MON = at("2026-10-05T00:00:00Z");

test("isPeakAt: Werktag im Fenster → peak", () => {
  assert.equal(isPeakAt(RULE, null, at("2026-10-02T01:30:00Z")), true); // Fri 01:30 UTC
  assert.equal(isPeakAt(RULE, null, at("2026-10-02T06:00:00Z")), true); // window start is inclusive
  assert.equal(isPeakAt(RULE, null, at("2026-10-02T09:59:00Z")), true);
});

test("isPeakAt: Werktag außerhalb des Fensters → off-peak", () => {
  assert.equal(isPeakAt(RULE, null, at("2026-10-02T00:30:00Z")), false);
  assert.equal(isPeakAt(RULE, null, at("2026-10-02T04:30:00Z")), false); // gap 04–06
  assert.equal(isPeakAt(RULE, null, at("2026-10-02T10:00:00Z")), false); // end is exclusive
  assert.equal(isPeakAt(RULE, null, at("2026-10-02T23:00:00Z")), false);
});

test("isPeakAt: Wochenende ganztägig off-peak", () => {
  for (const h of [0, 1, 3, 6, 9, 12, 23]) {
    assert.equal(isPeakAt(RULE, null, at(`2026-10-03T${String(h).padStart(2, "0")}:00:00Z`)), false, `Sa ${h}:00 UTC`);
  }
});

test("isPeakAt: Zonengrenze — UTC-Samstag 17:00 ist in Shanghai schon Sonntag", () => {
  // 2026-10-03T17:00Z = 2026-10-04 01:00 Shanghai (Sunday) → off-peak anyway.
  // The decisive case is the opposite: UTC Friday 16:00 = Sat 00:00 Shanghai.
  assert.equal(isPeakAt(RULE, null, at("2026-10-02T16:30:00Z")), false); // Sat 00:30 Shanghai
  assert.equal(isPeakAt(RULE, null, at("2026-10-02T15:30:00Z")), false); // Fri 23:30 Shanghai, outside windows
});

test("isPeakAt: vor effectiveFrom kein peak", () => {
  assert.equal(isBeforeEffectiveFrom(RULE_FROM, MON), false);
  assert.equal(isBeforeEffectiveFrom(RULE_FROM, at("2026-08-20T00:00:00Z")), true);
  assert.equal(isPeakAt(RULE_FROM, null, at("2026-08-20T01:30:00Z")), false);
});

test("isPeakAt: optionaler Feiertagszweig (Quelle nennt aktuell keine)", () => {
  // 2026-10-01 is a Thursday inside the weekday scope — without a calendar it peaks.
  assert.equal(isPeakAt(RULE, null, at("2026-10-01T01:30:00Z")), true);
  // The branch only fires when the RULE declares holidays; a calendar alone is
  // inert (the rule is the contract — matches the trackers, where no source
  // names holidays, so `holidays` is never set and the calendars stay empty).
  const cal = { dates: ["2026-10-01"], coveredThrough: "2026-12-31" };
  assert.equal(isPeakAt(RULE, cal, at("2026-10-01T01:30:00Z")), true);
  // With the date marked as a holiday in the rule the whole day is off-peak.
  const ruleHoliday = { ...RULE, holidays: { policy: "off-peak", calendar: "china" } };
  for (const h of [0, 1, 2, 6, 9]) {
    assert.equal(isPeakAt(ruleHoliday, cal, at(`2026-10-01T${String(h).padStart(2, "0")}:30:00Z`)), false, `Feiertag ${h}:30 UTC`);
  }
  // A non-holiday day stays peak; and without the calendar the rule is inert.
  assert.equal(isPeakAt(ruleHoliday, cal, at("2026-10-02T01:30:00Z")), true);
  assert.equal(isPeakAt(ruleHoliday, null, at("2026-10-01T01:30:00Z")), true);
});

test("nextTransition: findet den nächsten Wechsel, hält den Zustand konsistent", () => {
  // Fri 05:00 UTC → off-peak, next change is 06:00 UTC.
  const next = nextTransition(RULE, null, at("2026-10-02T05:00:00Z"));
  assert.equal(next, at("2026-10-02T06:00:00Z"));
  assert.equal(isPeakAt(RULE, null, next - 1000), false);
  assert.equal(isPeakAt(RULE, null, next), true);
});

test("nextTransition: Freitag nach dem Fenster → Montag (Wochenende überspringen)", () => {
  // Fri 12:00 UTC → off-peak; next peak starts Mon 01:00 UTC.
  const next = nextTransition(RULE, null, at("2026-10-02T12:00:00Z"));
  assert.equal(next, at("2026-10-05T01:00:00Z"));
});

test("formatDayScope / formatUtcWindows / formatCountdown", () => {
  assert.equal(formatDayScope([1, 2, 3, 4, 5], "de"), "Mo–Fr");
  assert.equal(formatDayScope([1, 2, 3, 4, 5], "en"), "Mon–Fri");
  assert.equal(formatDayScope([1, 3, 5], "de"), "Mo, Mi, Fr");
  assert.equal(formatDayScope([1, 2, 3, 4, 5, 6, 7], "de"), "täglich");
  assert.equal(formatUtcWindows([[1, 4], [6, 10]]), "01:00–04:00 + 06:00–10:00");
  assert.equal(formatCountdown(2 * H + 30 * 60_000), "02:30:00");
  assert.equal(formatCountdown(26 * H), "1d 02:00:00");
});

test("localIsoDate / isoWeekday: lokales Datum in der Regel-Zone", () => {
  // 2026-10-02T17:00Z = 2026-10-03 01:00 Shanghai → Samstag.
  assert.equal(localIsoDate(at("2026-10-02T17:00:00Z"), "Asia/Shanghai"), "2026-10-03");
  assert.equal(localIsoDate(at("2026-10-02T15:00:00Z"), "Asia/Shanghai"), "2026-10-02");
  assert.equal(localIsoDate(at("2026-10-02T15:00:00Z"), "UTC"), "2026-10-02");
});

test("localPeakByWeekday: Fenster in der Browser-Zone (UTC+2, Europe/Berlin)", () => {
  const byWeekday = localPeakByWeekday(RULE, null, "Europe/Berlin", "2026-10-02");
  // 01:00–04:00 UTC → 03:00–06:00 Berlin; 06:00–10:00 UTC → 08:00–12:00 Berlin.
  assert.deepEqual(byWeekday.get(1), [[3, 6], [8, 12]]); // Mo
  assert.deepEqual(byWeekday.get(5), [[3, 6], [8, 12]]); // Fr
  assert.equal(byWeekday.get(6), undefined); // Sa
  assert.equal(byWeekday.get(7), undefined); // So
});

test("localPeakByWeekday: identische UTC-Fenster => gleiche lokalen Zeiten", () => {
  const utc = localPeakByWeekday(RULE, null, "UTC", "2026-10-02");
  assert.deepEqual(utc.get(1), [[1, 4], [6, 10]]);
  const tokyo = localPeakByWeekday(RULE, null, "Asia/Tokyo", "2026-10-02"); // UTC+9
  assert.deepEqual(tokyo.get(1), [[10, 13], [15, 19]]);
});

test("formatLocalScope: gleiche Intervalle werden über Wochentage zusammengefasst", () => {
  const byWeekday = localPeakByWeekday(RULE, null, "Europe/Berlin", "2026-10-02");
  assert.equal(formatLocalScope(byWeekday, "de"), "Mo–Fr 03:00–06:00 + 08:00–12:00");
  assert.equal(formatLocalScope(byWeekday, "en"), "Mon–Fri 03:00–06:00 + 08:00–12:00");
  assert.equal(formatLocalScope(new Map(), "de"), "");
});

test("formatLocalScope: taegliches Fenster → 'täglich'", () => {
  const daily = {
    timezone: "Asia/Shanghai",
    peak: { days: [1, 2, 3, 4, 5, 6, 7], windowsUtc: [[16, 24]] },
    offPeak: { days: [], allDay: true },
  };
  const byWeekday = localPeakByWeekday(daily, null, "Europe/Berlin", "2026-10-02"); // 18:00–02:00 lokal
  // Täglich 18:00–02:00 Europe/Berlin: der Peak läuft über Mitternacht, jedes
  // Lokal-Tag trägt also Abend- **und** Morgenstück — identische Signatur für alle
  // sieben Tage, deshalb fasst `formatLocalScope` das zu „täglich" zusammen.
  assert.deepEqual(byWeekday.get(1), [[0, 2], [18, 24]]);
  assert.deepEqual(byWeekday.get(7), [[0, 2], [18, 24]]);
  // „täglich" **mit** Fenstern — sonst ginge die Uhrzeit verloren.
  assert.equal(formatLocalScope(byWeekday, "de"), "täglich 00:00–02:00 + 18:00–24:00");
  assert.equal(formatLocalScope(byWeekday, "en"), "daily 00:00–02:00 + 18:00–24:00");
});

test("localPeakByWeekday: Fenster über Mitternacht landet am richtigen Wochentag", () => {
  const wrap = {
    timezone: "UTC",
    peak: { days: [1, 2, 3, 4, 5], windowsUtc: [[22, 24]] },
    offPeak: { days: [6, 7], allDay: true },
  };
  const byWeekday = localPeakByWeekday(wrap, null, "UTC", "2026-10-02");
  assert.deepEqual(byWeekday.get(1), [[22, 24]]); // Mo 22–24 UTC
  assert.equal(byWeekday.get(6), undefined);
});
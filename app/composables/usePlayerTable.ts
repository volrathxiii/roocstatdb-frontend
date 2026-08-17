import { h } from "vue";
import type { Column } from "@tanstack/vue-table";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface Snapshot {
  weekNumber: number;
  year: number;
  job: string;
  classRole: string;
  hp: number;
  patk: number;
  matk: number;
  ignorePdef: number;
  ignoreMdef: number;
  eqPdef: number;
  eqMdef: number;
  eqPdefPct: number;
  eqMdefPct: number;
  rawPdef: number;
  rawMdef: number;
  pDmgPct: number;
  pDmgReductionPct: number;
  mDmgPct: number;
  mDmgReductionPct: number;
  dmgVsDemiHuman: number;
  dmgReductionVsDemiHuman: number;
  dmgVsMedium: number;
  dmgReductionVsMedium: number;
  pvpDmg: number;
  pvpDmgReduction: number;
  healingDone: number;
  healingTaken: number;
}

/** Fields shared between rosters and applicants flat rows. */
export interface BasePlayerFlatRow {
  id: number;
  ign: string;
  playerId: string;
  role: string;
  isFirstPlayer: boolean;
  week: string;
  weekNumber: number | null;
  weekYear: number | null;
  jobClass: string;
  job: string;
  classRole: string;
  hp: number;
  patk: number;
  matk: number;
  ignorePdef: number;
  ignoreMdef: number;
  eqPdef: number;
  eqMdef: number;
  eqPdefPct: number;
  eqMdefPct: number;
  rawPdef: number;
  rawMdef: number;
  pDmgPct: number;
  pDmgReductionPct: number;
  mDmgPct: number;
  mDmgReductionPct: number;
  dmgVsDemiHuman: number;
  dmgReductionVsDemiHuman: number;
  dmgVsMedium: number;
  dmgReductionVsMedium: number;
  pvpDmg: number;
  pvpDmgReduction: number;
  healingDone: number;
  healingTaken: number;
}

// ── Staleness helpers ─────────────────────────────────────────────────────────

function isoWeekStartDate(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
  const weekStart = new Date(week1Monday);
  weekStart.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return weekStart;
}

function getIsoWeekParts(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

const _nowIso = getIsoWeekParts(new Date());
const _currentWeekStart = isoWeekStartDate(_nowIso.year, _nowIso.week);

/**
 * Returns true when the snapshot's week is 2+ weeks older than the current week.
 * Used to gray rows in the roster/applicant table and to count the sidebar badge.
 */
export function isSnapshotStale(weekYear: number | null, weekNumber: number | null): boolean {
  if (weekYear === null || weekNumber === null) return true;
  const snapshotWeekStart = isoWeekStartDate(weekYear, weekNumber);
  const diffMs = _currentWeekStart.getTime() - snapshotWeekStart.getTime();
  return diffMs >= 14 * 24 * 60 * 60 * 1000;
}

const ACTIVE_ROW_TEXT_CLASS = "text-sky-300";
const STALE_ROW_TEXT_CLASS  = "text-muted";

/** Returns the Tailwind text class for a row based on snapshot staleness. */
export function rowTextClass(weekYear: number | null, weekNumber: number | null): string {
  return isSnapshotStale(weekYear, weekNumber) ? STALE_ROW_TEXT_CLASS : ACTIVE_ROW_TEXT_CLASS;
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmtPct(v: number)  { return v === 0 ? "—" : `${v.toFixed(2)}%`; }
export function fmtFlat(v: number) { return v === 0 ? "—" : String(v); }
export function fmtFp(v: number)   { return v === 0 ? "—" : v.toFixed(2); }

// ── Stat column definitions ───────────────────────────────────────────────────

export type NumColDef = [string, string, (v: number) => string, boolean?];

export const numCols: NumColDef[] = [
  ["hp",                      "HP",               fmtFlat],
  ["patk",                    "PATK",             fmtFlat],
  ["matk",                    "MATK",             fmtFlat],
  ["ignorePdef",              "Ignore PDEF",      fmtFlat],
  ["ignoreMdef",              "Ignore MDEF",      fmtFlat],
  ["eqPdef",                  "EQ PDEF",          fmtFlat],
  ["eqMdef",                  "EQ MDEF",          fmtFlat],
  ["eqPdefPct",               "EQ PDEF %",        fmtPct],
  ["eqMdefPct",               "EQ MDEF %",        fmtPct],
  ["rawPdef",                 "Raw PDEF",         fmtFp, true],
  ["rawMdef",                 "Raw MDEF",         fmtFp, true],
  ["pDmgPct",                 "P DMG %",          fmtPct],
  ["pDmgReductionPct",        "P DMG Red %",      fmtPct],
  ["mDmgPct",                 "M DMG %",          fmtPct],
  ["mDmgReductionPct",        "M DMG Red %",      fmtPct],
  ["dmgVsDemiHuman",          "vs DH %",          fmtPct],
  ["dmgReductionVsDemiHuman", "vs DH Red %",      fmtPct],
  ["dmgVsMedium",             "vs Med %",         fmtPct],
  ["dmgReductionVsMedium",    "vs Med Red %",     fmtPct],
  ["pvpDmg",                  "PVP DMG",          fmtFlat],
  ["pvpDmgReduction",         "PVP Red",          fmtFlat],
  ["healingDone",             "Healing Done %",   fmtPct],
  ["healingTaken",            "Healing Taken %",  fmtPct],
];

// ── Column header builders ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sortIcon(col: Column<any>): string {
  const s = col.getIsSorted();
  if (s === "asc") return "i-lucide-arrow-up-narrow-wide";
  if (s === "desc") return "i-lucide-arrow-down-wide-narrow";
  return "i-lucide-arrow-up-down";
}

/**
 * Returns column header builder functions.
 * Pass the UIcon component resolved in the calling page's setup context
 * (via resolveComponent("UIcon")) so it uses the correct component registry.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePlayerTableHeaders(UIcon: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function sortableHeader(col: Column<any>, label: string) {
    return h("div", {
      class: "flex flex-col items-start gap-0.5 cursor-pointer select-none hover:text-slate-200",
      onClick: () => col.toggleSorting(col.getIsSorted() === "asc"),
    }, [
      h("span", { class: "leading-tight" }, label),
      h(UIcon, { name: sortIcon(col), class: "h-3 w-3 opacity-60" }),
    ]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function rightHeader(col: Column<any>, label: string) {
    return h("div", {
      class: "flex flex-col items-end gap-0.5 cursor-pointer select-none hover:text-slate-200",
      onClick: () => col.toggleSorting(col.getIsSorted() === "asc"),
    }, [
      h("span", { class: "leading-tight text-right" }, label),
      h(UIcon, { name: sortIcon(col), class: "h-3 w-3 opacity-60" }),
    ]);
  }

  return { sortableHeader, rightHeader };
}

// ── Snapshot mapper ───────────────────────────────────────────────────────────

interface PlayerBase {
  id: number;
  ign: string;
  playerId: string;
  role: string | null;
  isFirstPlayer: boolean;
}

/** Maps the common player + snapshot fields shared between rosters and applicants. */
export function mapSnapshotBase(p: PlayerBase, s: Snapshot | null): BasePlayerFlatRow {
  return {
    id: p.id,
    ign: p.ign,
    playerId: p.playerId,
    role: p.role ?? "—",
    isFirstPlayer: p.isFirstPlayer,
    week: s ? `W${s.weekNumber} ${s.year}` : "—",
    weekNumber: s?.weekNumber ?? null,
    weekYear: s?.year ?? null,
    jobClass: s ? `${s.job} — ${s.classRole}` : "—",
    job: s?.job ?? "—",
    classRole: s?.classRole ?? "—",
    hp: s?.hp ?? 0,
    patk: s?.patk ?? 0,
    matk: s?.matk ?? 0,
    ignorePdef: s?.ignorePdef ?? 0,
    ignoreMdef: s?.ignoreMdef ?? 0,
    eqPdef: s?.eqPdef ?? 0,
    eqMdef: s?.eqMdef ?? 0,
    eqPdefPct: s?.eqPdefPct ?? 0,
    eqMdefPct: s?.eqMdefPct ?? 0,
    rawPdef: s?.rawPdef ?? 0,
    rawMdef: s?.rawMdef ?? 0,
    pDmgPct: s?.pDmgPct ?? 0,
    pDmgReductionPct: s?.pDmgReductionPct ?? 0,
    mDmgPct: s?.mDmgPct ?? 0,
    mDmgReductionPct: s?.mDmgReductionPct ?? 0,
    dmgVsDemiHuman: s?.dmgVsDemiHuman ?? 0,
    dmgReductionVsDemiHuman: s?.dmgReductionVsDemiHuman ?? 0,
    dmgVsMedium: s?.dmgVsMedium ?? 0,
    dmgReductionVsMedium: s?.dmgReductionVsMedium ?? 0,
    pvpDmg: s?.pvpDmg ?? 0,
    pvpDmgReduction: s?.pvpDmgReduction ?? 0,
    healingDone: s?.healingDone ?? 0,
    healingTaken: s?.healingTaken ?? 0,
  };
}

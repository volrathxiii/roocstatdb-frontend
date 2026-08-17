import { describe, it, expect } from "vitest";
import {
  isSnapshotStale,
  rowTextClass,
  fmtPct,
  fmtFlat,
  fmtFp,
  numCols,
  mapSnapshotBase,
  type Snapshot,
} from "~/composables/usePlayerTable";
// ── isSnapshotStale ───────────────────────────────────────────────────────────

describe("isSnapshotStale", () => {
  it("returns true when weekYear is null", () => {
    expect(isSnapshotStale(null, null)).toBe(true);
  });

  it("returns false for the current week", () => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const year = d.getUTCFullYear();
    expect(isSnapshotStale(year, weekNumber)).toBe(false);
  });

  it("returns true for a snapshot 3 weeks old", () => {
    const past = new Date();
    past.setUTCDate(past.getUTCDate() - 21);
    const d = new Date(Date.UTC(past.getFullYear(), past.getMonth(), past.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const year = d.getUTCFullYear();
    expect(isSnapshotStale(year, weekNumber)).toBe(true);
  });

  it("returns true for a very old snapshot (2020 week 1)", () => {
    expect(isSnapshotStale(2020, 1)).toBe(true);
  });
});

// ── rowTextClass ──────────────────────────────────────────────────────────────

describe("rowTextClass", () => {
  it("returns muted class for stale snapshot", () => {
    expect(rowTextClass(2020, 1)).toBe("text-muted");
  });

  it("returns active class for current week", () => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    expect(rowTextClass(d.getUTCFullYear(), weekNumber)).toBe("text-sky-300");
  });
});

// ── Formatters ────────────────────────────────────────────────────────────────

describe("fmtPct", () => {
  it("returns '—' for 0", () => expect(fmtPct(0)).toBe("—"));
  it("formats non-zero with %", () => expect(fmtPct(25)).toBe("25.00%"));
});

describe("fmtFlat", () => {
  it("returns '—' for 0", () => expect(fmtFlat(0)).toBe("—"));
  it("returns string for non-zero", () => expect(fmtFlat(500)).toBe("500"));
});

describe("fmtFp", () => {
  it("returns '—' for 0", () => expect(fmtFp(0)).toBe("—"));
  it("formats to 2 decimal places", () => expect(fmtFp(10.567)).toBe("10.57"));
});

// ── numCols ───────────────────────────────────────────────────────────────────

describe("numCols", () => {
  it("contains 23 stat columns", () => {
    expect(numCols).toHaveLength(23);
  });

  it("first column is hp", () => {
    expect(numCols[0][0]).toBe("hp");
  });
});

// ── mapSnapshotBase ───────────────────────────────────────────────────────────

const PLAYER = { id: 1, ign: "Arcanist", playerId: "abc-001", role: "Member", isFirstPlayer: false };

const SNAPSHOT: Snapshot = {
  weekNumber: 33, year: 2026,
  job: "Mage", classRole: "DPS",
  hp: 120000,
  patk: 100, matk: 1500, ignorePdef: 5, ignoreMdef: 10,
  eqPdef: 500, eqMdef: 300, eqPdefPct: 20, eqMdefPct: 15,
  rawPdef: 416.67, rawMdef: 260.87,
  pDmgPct: 30, pDmgReductionPct: 8, mDmgPct: 25, mDmgReductionPct: 5,
  dmgVsDemiHuman: 15, dmgReductionVsDemiHuman: 0,
  dmgVsMedium: 10, dmgReductionVsMedium: 0,
  pvpDmg: 5, pvpDmgReduction: 3,
  healingDone: 0, healingTaken: 0,
};

describe("mapSnapshotBase", () => {
  it("maps player + snapshot to base flat row", () => {
    const row = mapSnapshotBase(PLAYER, SNAPSHOT);
    expect(row.ign).toBe("Arcanist");
    expect(row.week).toBe("W33 2026");
    expect(row.jobClass).toBe("Mage — DPS");
    expect(row.hp).toBe(120000);
    expect(row.matk).toBe(1500);
    expect(row.weekNumber).toBe(33);
    expect(row.weekYear).toBe(2026);
  });

  it("fills defaults when snapshot is null", () => {
    const row = mapSnapshotBase(PLAYER, null);
    expect(row.week).toBe("—");
    expect(row.jobClass).toBe("—");
    expect(row.patk).toBe(0);
    expect(row.hp).toBe(0);
    expect(row.weekNumber).toBeNull();
    expect(row.weekYear).toBeNull();
  });

  it("uses '—' for null role", () => {
    const row = mapSnapshotBase({ ...PLAYER, role: null }, SNAPSHOT);
    expect(row.role).toBe("—");
  });
});

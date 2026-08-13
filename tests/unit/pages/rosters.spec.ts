// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import RostersPage from "~/pages/rosters.vue";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const fetchMock = vi.hoisted(() => vi.fn());
mockNuxtImport("$fetch", () => fetchMock);

const navigateToMock = vi.hoisted(() => vi.fn());
mockNuxtImport("navigateTo", () => navigateToMock);

mockNuxtImport("useRuntimeConfig", () => () => ({
  public: { backendUrl: "http://localhost:4001" },
}));

mockNuxtImport("definePageMeta", () => vi.fn());

const mockSetSubtitle = vi.hoisted(() => vi.fn());
mockNuxtImport("usePageSubtitle", () => () => ({ setSubtitle: mockSetSubtitle }));

// Auth state — seeded per test
const authState = vi.hoisted(() => {
  const { ref } = require("vue");
  return ref<any>({
    player: { id: 1, ign: "TestOfficer", playerId: "off-001" },
    isMember: true,
    role: "Officer",
  });
});
mockNuxtImport("useAuth", () => () => ({ auth: authState }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPTY_MEMBERS = { players: [], total: 0 };

const MEMBER_LIST = {
  players: [
    {
      id: 1, ign: "Arcanist", playerId: "abc123", role: "Member",
      isFirstPlayer: false,
      snapshot: {
        weekNumber: 32, year: 2026,
        job: "Mage", classRole: "DPS",
        patk: 100, matk: 1200, ignorePdef: 5, ignoreMdef: 10,
        eqPdef: 500, eqMdef: 300, eqPdefPct: 20, eqMdefPct: 15,
        rawPdef: 416.67, rawMdef: 260.87,
        pDmgPct: 10, pDmgReductionPct: 5, mDmgPct: 25, mDmgReductionPct: 8,
        dmgVsDemiHuman: 15, dmgReductionVsDemiHuman: 0,
        dmgVsMedium: 10, dmgReductionVsMedium: 0,
        pvpDmg: 5, pvpDmgReduction: 3,
        healingDone: 0, healingTaken: 0,
      },
      scores: { physical: 4000, magic: 8500, defensive: 6000 },
      classScores: { physical: 3500, magic: 9000, defensive: 5500 },
    },
    {
      id: 2, ign: "Sentinel", playerId: "def456", role: "Officer",
      isFirstPlayer: true,
      snapshot: null,
      scores: null,
      classScores: null,
    },
  ],
  total: 2,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupDefaultFetches() {
  fetchMock
    .mockResolvedValueOnce([{ id: 1, name: "Mage" }])         // job-classes
    .mockResolvedValueOnce([{ id: 1, name: "DPS" }])           // class-roles
    .mockResolvedValueOnce(MEMBER_LIST);                        // members
}

// Mount the page and return both the wrapper and the inner component vm
async function mountPage() {
  setupDefaultFetches();
  const wrapper = await mountSuspended(RostersPage);
  await flushPromises();
  return wrapper;
}

// For tests that need direct vm access, seed empty fetches so onMounted completes
async function mountPageWithVm(snapshot = EMPTY_MEMBERS) {
  fetchMock
    .mockResolvedValueOnce([{ id: 1, name: "Mage" }])
    .mockResolvedValueOnce([{ id: 1, name: "DPS" }])
    .mockResolvedValueOnce(snapshot);
  const wrapper = await mountSuspended(RostersPage);
  await flushPromises();
  // Access inner component vm through Suspense boundary
  const vm = (wrapper.vm as any);
  return { wrapper, vm };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("rosters.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.value = {
      player: { id: 1, ign: "TestOfficer", playerId: "off-001" },
      isMember: true,
      role: "Officer",
    };
  });

  // ── Auth guards ─────────────────────────────────────────────────────────────
  // Auth guards are now handled by app/middleware/auth.ts (route middleware).
  // They cannot be tested at the page component level — the middleware runs
  // before the component mounts and is a Nuxt router concern.

  // ── Data fetching ────────────────────────────────────────────────────────────

  describe("data fetching", () => {
    it("fetches job classes, class roles, and members on mount", async () => {
      await mountPage();
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/ref-data/job-classes"), expect.anything());
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/ref-data/class-roles"), expect.anything());
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/players/members"), expect.anything());
    });

    it("shows an error when the members fetch fails", async () => {
      fetchMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("500"));
      const wrapper = await mountSuspended(RostersPage);
      await flushPromises();
      expect(wrapper.text()).toContain("Failed to load roster");
    });

    it("includes pagination params in the members request", async () => {
      await mountPage();
      const membersCall = fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/api/players/members")
      );
      expect(membersCall?.[0]).toContain("page=1");
      expect(membersCall?.[0]).toContain("pageSize=20");
    });
  });

  // ── tableData mapping ────────────────────────────────────────────────────────

  describe("tableData computed", () => {
    it("maps a player with a snapshot to a flat row", async () => {
      const { vm } = await mountPageWithVm(MEMBER_LIST);

      const row = vm.tableData[0];
      expect(row.ign).toBe("Arcanist");
      expect(row.week).toBe("W32 2026");
      expect(row.jobClass).toBe("Mage — DPS");
      expect(row.physicalScore).toBe(4000);
      expect(row.classMagicScore).toBe(9000);
    });

    it("fills missing snapshot fields with 0 or '—'", async () => {
      const { vm } = await mountPageWithVm(MEMBER_LIST);

      const row = vm.tableData[1]; // Sentinel — no snapshot
      expect(row.week).toBe("—");
      expect(row.jobClass).toBe("—");
      expect(row.patk).toBe(0);
      expect(row.physicalScore).toBe(0);
    });
  });

  // ── ISO week utilities ───────────────────────────────────────────────────────

  describe("ISO week utilities", () => {
    it("getIsoWeekParts returns correct week and year", async () => {
      const { vm } = await mountPageWithVm();
      // 2026-08-13 is week 33 of 2026
      const result = vm.getIsoWeekParts(new Date("2026-08-13"));
      expect(result.year).toBe(2026);
      expect(result.week).toBe(33);
    });

    it("isWeekOlderThanTwoWeeks returns true when null", async () => {
      const { vm } = await mountPageWithVm();
      expect(vm.isWeekOlderThanTwoWeeks(null, null)).toBe(true);
    });

    it("isWeekOlderThanTwoWeeks returns false for current week", async () => {
      const { vm } = await mountPageWithVm();
      const { year, week } = vm.getIsoWeekParts(new Date());
      expect(vm.isWeekOlderThanTwoWeeks(year, week)).toBe(false);
    });

    it("isWeekOlderThanTwoWeeks returns true for a snapshot from 3 weeks ago", async () => {
      const { vm } = await mountPageWithVm();
      const threeWeeksAgo = new Date();
      threeWeeksAgo.setUTCDate(threeWeeksAgo.getUTCDate() - 21);
      const { year, week } = vm.getIsoWeekParts(threeWeeksAgo);
      expect(vm.isWeekOlderThanTwoWeeks(year, week)).toBe(true);
    });
  });

  // ── Formatting helpers ────────────────────────────────────────────────────────

  describe("format helpers", () => {
    let vm: any;

    beforeEach(async () => {
      const result = await mountPageWithVm();
      vm = result.vm;
    });

    it("fmtPct returns '—' for 0", () => expect(vm.fmtPct(0)).toBe("—"));
    it("fmtPct formats a value with %", () => expect(vm.fmtPct(25)).toBe("25%"));

    it("fmtFlat returns '—' for 0", () => expect(vm.fmtFlat(0)).toBe("—"));
    it("fmtFlat returns string for non-zero", () => expect(vm.fmtFlat(500)).toBe("500"));

    it("fmtFp returns '—' for 0", () => expect(vm.fmtFp(0)).toBe("—"));
    it("fmtFp formats to 2 decimal places", () => expect(vm.fmtFp(10.567)).toBe("10.57"));

    it("fmtScore returns '—' for 0", () => expect(vm.fmtScore(0)).toBe("—"));
    it("fmtScore formats to 1 decimal place with %", () => expect(vm.fmtScore(8500)).toBe("8500.0%"));
  });

  // ── Pagination ────────────────────────────────────────────────────────────────

  describe("pagination", () => {
    it("pageLabel shows correct range for first page", async () => {
      const { vm } = await mountPageWithVm(MEMBER_LIST);
      expect(vm.pageLabel).toBe("1–2 of 2");
    });

    it("pageLabel shows 'No results' when total is 0", async () => {
      const { vm } = await mountPageWithVm();
      vm.total = 0;
      await vm.$nextTick();
      expect(vm.pageLabel).toBe("No results");
    });

    it("totalPages is at least 1 even with 0 results", async () => {
      const { vm } = await mountPageWithVm();
      vm.total = 0;
      expect(vm.totalPages).toBe(1);
    });

    it("totalPages calculates correctly for 45 results with pageSize 20", async () => {
      fetchMock
        .mockResolvedValueOnce([{ id: 1, name: "Mage" }])
        .mockResolvedValueOnce([{ id: 1, name: "DPS" }])
        .mockResolvedValueOnce({ players: [], total: 45 });
      const wrapper = await mountSuspended(RostersPage);
      await flushPromises();
      expect((wrapper.vm as any).totalPages).toBe(3);
    });
  });

  // ── Search / filter ───────────────────────────────────────────────────────────

  describe("fetchPlayers", () => {
    it("includes search param when search has a value", async () => {
      const { vm } = await mountPageWithVm();

      fetchMock.mockResolvedValueOnce(EMPTY_MEMBERS);
      // vm from mountSuspended exposes reactive refs directly
      vm.search.value = "Arcanist";
      await vm.fetchPlayers();

      const call = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(call).toContain("search=Arcanist");
    });

    it("includes outdatedOnly param when filter is active", async () => {
      const { vm } = await mountPageWithVm();

      fetchMock.mockResolvedValueOnce(EMPTY_MEMBERS);
      vm.filterOutdatedOnly.value = true;
      await vm.fetchPlayers();

      const call = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(call).toContain("outdatedOnly=1");
    });

    it("resets pageIndex to 0 when search changes", async () => {
      const { vm } = await mountPageWithVm();

      vm.pageIndex = 3;
      fetchMock.mockResolvedValueOnce(EMPTY_MEMBERS);
      vm.search = "SomePlayer";
      vm.pageIndex = 0;
      expect(vm.pageIndex).toBe(0);
    });
  });
});

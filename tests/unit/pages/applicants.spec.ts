// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import ApplicantsPage from "~/pages/applicants.vue";

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

const EMPTY_NON_MEMBERS = { players: [], total: 0 };

const APPLICANT_LIST = {
  players: [
    {
      id: 10, ign: "NewGuy", playerId: "new-001", role: "Applicant",
      isFirstPlayer: false,
      snapshot: {
        weekNumber: 33, year: 2026, job: "Novice", classRole: "DPS",
        patk: 50, matk: 50, ignorePdef: 0, ignoreMdef: 0,
        eqPdef: 100, eqMdef: 100, eqPdefPct: 0, eqMdefPct: 0,
        rawPdef: 100, rawMdef: 100,
        pDmgPct: 0, pDmgReductionPct: 0, mDmgPct: 0, mDmgReductionPct: 0,
        dmgVsDemiHuman: 0, dmgReductionVsDemiHuman: 0,
        dmgVsMedium: 0, dmgReductionVsMedium: 0,
        pvpDmg: 0, pvpDmgReduction: 0,
        healingDone: 0, healingTaken: 0,
      },
    },
    {
      id: 11, ign: "WLPlayer", playerId: "wl-001", role: "Waitlisted",
      isFirstPlayer: false, snapshot: null,
    },
  ],
  total: 2,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupDefaultFetches(data = APPLICANT_LIST) {
  fetchMock
    .mockResolvedValueOnce([{ id: 1, name: "Novice" }])   // job-classes
    .mockResolvedValueOnce([{ id: 1, name: "DPS" }])       // class-roles
    .mockResolvedValueOnce(data);                           // non-members
}

async function mountPage() {
  setupDefaultFetches();
  const wrapper = await mountSuspended(ApplicantsPage);
  await flushPromises();
  return wrapper;
}

async function mountPageWithVm(data = EMPTY_NON_MEMBERS) {
  fetchMock
    .mockResolvedValueOnce([{ id: 1, name: "Novice" }])
    .mockResolvedValueOnce([{ id: 1, name: "DPS" }])
    .mockResolvedValueOnce(data);
  const wrapper = await mountSuspended(ApplicantsPage);
  await flushPromises();
  return { wrapper, vm: wrapper.vm as any };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("applicants.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.value = {
      player: { id: 1, ign: "TestOfficer", playerId: "off-001" },
      isMember: true,
      role: "Officer",
    };
  });

  // ── Auth guards ─────────────────────────────────────────────────────────────
  // Auth guards are now handled by app/middleware/auth-officer.ts (route middleware).
  // They cannot be tested at the page component level — the middleware runs
  // before the component mounts and is a Nuxt router concern.

  // ── Data fetching ────────────────────────────────────────────────────────────

  describe("data fetching", () => {
    it("fetches job classes, class roles, and non-members on mount", async () => {
      await mountPage();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/ref-data/job-classes")
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/ref-data/class-roles")
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/players/non-members")
      );
    });

    it("shows error when non-members fetch fails", async () => {
      fetchMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("500"));
      const wrapper = await mountSuspended(ApplicantsPage);
      await flushPromises();
      expect(wrapper.text()).toContain("Failed to load applicants");
    });

    it("includes default pagination params", async () => {
      await mountPage();
      const call = fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/api/players/non-members")
      );
      expect(call?.[0]).toContain("page=1");
      expect(call?.[0]).toContain("pageSize=20");
    });
  });

  // ── tableData mapping ────────────────────────────────────────────────────────

  describe("tableData computed", () => {
    it("maps a player with a snapshot to a flat row", async () => {
      const { vm } = await mountPageWithVm(APPLICANT_LIST);
      const row = vm.tableData[0];
      expect(row.ign).toBe("NewGuy");
      expect(row.week).toBe("W33 2026");
      expect(row.jobClass).toBe("Novice — DPS");
      expect(row.role).toBe("Applicant");
    });

    it("fills missing snapshot with '—' and 0 defaults", async () => {
      const { vm } = await mountPageWithVm(APPLICANT_LIST);
      const row = vm.tableData[1]; // WLPlayer has no snapshot
      expect(row.week).toBe("—");
      expect(row.jobClass).toBe("—");
      expect(row.patk).toBe(0);
    });
  });

  // ── ISO week utilities ───────────────────────────────────────────────────────

  describe("ISO week utilities", () => {
    it("getIsoWeekParts: 2026-08-13 is week 33 of 2026", async () => {
      const { vm } = await mountPageWithVm();
      const result = vm.getIsoWeekParts(new Date("2026-08-13"));
      expect(result.year).toBe(2026);
      expect(result.week).toBe(33);
    });

    it("isWeekOlderThanTwoWeeks: null returns true", async () => {
      const { vm } = await mountPageWithVm();
      expect(vm.isWeekOlderThanTwoWeeks(null, null)).toBe(true);
    });

    it("isWeekOlderThanTwoWeeks: current week returns false", async () => {
      const { vm } = await mountPageWithVm();
      const { year, week } = vm.getIsoWeekParts(new Date());
      expect(vm.isWeekOlderThanTwoWeeks(year, week)).toBe(false);
    });

    it("isWeekOlderThanTwoWeeks: 3 weeks ago returns true", async () => {
      const { vm } = await mountPageWithVm();
      const old = new Date();
      old.setUTCDate(old.getUTCDate() - 21);
      const { year, week } = vm.getIsoWeekParts(old);
      expect(vm.isWeekOlderThanTwoWeeks(year, week)).toBe(true);
    });
  });

  // ── Pagination ────────────────────────────────────────────────────────────────

  describe("pagination", () => {
    it("pageLabel shows correct range for 2 results", async () => {
      const { vm } = await mountPageWithVm(APPLICANT_LIST);
      expect(vm.pageLabel).toBe("1–2 of 2");
    });

    it("pageLabel shows 'No results' when total is 0", async () => {
      const { vm } = await mountPageWithVm();
      expect(vm.pageLabel).toBe("No results");
    });

    it("totalPages is at least 1 when total is 0", async () => {
      const { vm } = await mountPageWithVm();
      expect(vm.totalPages).toBe(1);
    });

    it("totalPages is 3 for 45 results", async () => {
      fetchMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce({ players: [], total: 45 });
      const wrapper = await mountSuspended(ApplicantsPage);
      await flushPromises();
      expect((wrapper.vm as any).totalPages).toBe(3);
    });
  });

  // ── fetchPlayers params ───────────────────────────────────────────────────────

  describe("fetchPlayers", () => {
    it("includes search param when set", async () => {
      const { vm } = await mountPageWithVm();
      fetchMock.mockResolvedValueOnce(EMPTY_NON_MEMBERS);
      vm.search.value = "NewGuy";
      await vm.fetchPlayers();
      const call = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(call).toContain("search=NewGuy");
    });

    it("includes job filter when set", async () => {
      const { vm } = await mountPageWithVm();
      fetchMock.mockResolvedValueOnce(EMPTY_NON_MEMBERS);
      vm.filterJob.value = "Mage";
      await vm.fetchPlayers();
      const call = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(call).toContain("job=Mage");
    });

    it("does not include search param when search is empty", async () => {
      const { vm } = await mountPageWithVm();
      fetchMock.mockResolvedValueOnce(EMPTY_NON_MEMBERS);
      vm.search.value = "";
      await vm.fetchPlayers();
      const call = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(call).not.toContain("search=");
    });
  });
});

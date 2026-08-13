// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import PlayerProgressionModal from "~/components/PlayerProgressionModal.vue";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const fetchMock = vi.hoisted(() => vi.fn());
mockNuxtImport("$fetch", () => fetchMock);
mockNuxtImport("useRuntimeConfig", () => () => ({
  public: { backendUrl: "http://localhost:4001" },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SNAPSHOT_CURRENT = {
  weekNumber: 33, year: 2026, job: "Mage", classRole: "DPS",
  patk: 100, matk: 1500, ignorePdef: 5, ignoreMdef: 10,
  eqPdef: 500, eqMdef: 300, eqPdefPct: 20, eqMdefPct: 15,
  rawPdef: 416.67, rawMdef: 260.87,
  pDmgPct: 10, pDmgReductionPct: 5, mDmgPct: 30, mDmgReductionPct: 8,
  dmgVsDemiHuman: 15, dmgReductionVsDemiHuman: 0,
  dmgVsMedium: 10, dmgReductionVsMedium: 0,
  pvpDmg: 5, pvpDmgReduction: 3,
  healingDone: 0, healingTaken: 0,
};
const SNAPSHOT_PREVIOUS = { ...SNAPSHOT_CURRENT, weekNumber: 32, matk: 1400 };

const SCORES = {
  current:  { physical: 4000, magic: 8000, defensive: 5000 },
  previous: { physical: 3800, magic: 7500, defensive: 4800 },
};
const RANK = {
  physical:  { guild: { rank: 3, total: 20 }, classRole: { rank: 1, total: 5 } },
  magic:     { guild: { rank: 2, total: 20 }, classRole: { rank: 1, total: 5 } },
  defensive: { guild: { rank: 5, total: 20 }, classRole: { rank: 2, total: 5 } },
};

const DEFAULT_PROPS = {
  playerId: 1,
  playerStringId: "test-001",
  ign: "Arcanist",
};

function setupFetches(snapshots = [SNAPSHOT_CURRENT, SNAPSHOT_PREVIOUS], scores = SCORES, rank = RANK) {
  fetchMock
    .mockResolvedValueOnce(snapshots)
    .mockResolvedValueOnce(scores)
    .mockResolvedValueOnce(rank);
}

async function mountModal(props = DEFAULT_PROPS) {
  setupFetches();
  const wrapper = await mountSuspended(PlayerProgressionModal, { props });
  await flushPromises();
  return wrapper;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PlayerProgressionModal", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("on mount", () => {
    it("fetches snapshots, scores, and rank for the player", async () => {
      await mountModal();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/players/1/snapshots")
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/players/1/scores")
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/players/1/rank")
      );
    });

    it("shows error message when fetch fails", async () => {
      fetchMock.mockRejectedValue(new Error("500"));
      const wrapper = await mountSuspended(PlayerProgressionModal, { props: DEFAULT_PROPS });
      await flushPromises();
      expect(wrapper.text()).toContain("Failed to load progression data");
    });

    it("displays the player IGN in the header", async () => {
      const wrapper = await mountModal();
      expect(wrapper.text()).toContain("Arcanist");
    });
  });

  describe("snapshot display", () => {
    it("shows the current week label", async () => {
      const wrapper = await mountModal();
      expect(wrapper.text()).toContain("W33");
      expect(wrapper.text()).toContain("2026");
    });

    it("shows no snapshot message when snapshots list is empty", async () => {
      fetchMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(SCORES)
        .mockResolvedValueOnce(RANK);
      const wrapper = await mountSuspended(PlayerProgressionModal, { props: DEFAULT_PROPS });
      await flushPromises();
      expect(wrapper.text()).toContain("No snapshot");
    });
  });

  describe("computed values", () => {
    it("current is the first snapshot", async () => {
      const wrapper = await mountModal();
      const vm = wrapper.vm as any;
      expect(vm.current?.weekNumber).toBe(33);
    });

    it("previous is the second snapshot", async () => {
      const wrapper = await mountModal();
      const vm = wrapper.vm as any;
      expect(vm.previous?.weekNumber).toBe(32);
    });

    it("current is null when snapshots are empty", async () => {
      fetchMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(SCORES)
        .mockResolvedValueOnce(RANK);
      const wrapper = await mountSuspended(PlayerProgressionModal, { props: DEFAULT_PROPS });
      await flushPromises();
      expect((wrapper.vm as any).current).toBeNull();
    });
  });

  describe("format helpers", () => {
    let vm: any;
    beforeEach(async () => {
      const wrapper = await mountModal();
      vm = wrapper.vm;
    });

    it("fmtPct formats value with %", () => expect(vm.fmtPct(25)).toBe("25%"));
    it("fmtFp formats to 2 decimal places", () => expect(vm.fmtFp(10.567)).toBe("10.57"));
  });

  describe("filterClassGroups", () => {
    it("returns empty results when no job classes loaded", async () => {
      const wrapper = await mountModal();
      const vm = wrapper.vm as any;
      vm.filterClassGroups("mage");
      expect(vm.classGroupResults.value).toHaveLength(0);
    });

    it("filters by label when class groups are loaded", async () => {
      const wrapper = await mountModal();
      const vm = wrapper.vm as any;

      // Seed class group data directly
      vm.allJobClasses.value = [{ id: 1, name: "Mage" }, { id: 2, name: "Swordsman" }];
      vm.allClassRoles.value = [{ id: 1, name: "DPS" }];
      vm.classGroupCounts.value = new Map([["1:1", 5], ["2:1", 3]]);

      vm.filterClassGroups("mage");
      expect(vm.classGroupResults.value).toHaveLength(1);
      expect(vm.classGroupResults.value[0].label).toContain("Mage");
    });
  });
});

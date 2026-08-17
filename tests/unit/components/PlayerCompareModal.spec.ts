// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import PlayerCompareModal from "~/components/PlayerCompareModal.vue";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const fetchMock = vi.hoisted(() => vi.fn());
mockNuxtImport("$fetch", () => fetchMock);
mockNuxtImport("useRuntimeConfig", () => () => ({
  public: { backendUrl: "http://localhost:4001" },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SNAPSHOT_A = {
  weekNumber: 33, year: 2026,
  job: { name: "Mage" }, classRole: { name: "DPS" },
  patk: 100, matk: 1500, ignorePdef: 5, ignoreMdef: 10,
  eqPdef: 500, eqMdef: 300, eqPdefPct: 20, eqMdefPct: 15,
  rawPdef: 416.67, rawMdef: 260.87,
  pDmgPct: 30, pDmgReductionPct: 8, mDmgPct: 25, mDmgReductionPct: 5,
  dmgVsDemiHuman: 15, dmgReductionVsDemiHuman: 0,
  dmgVsMedium: 10, dmgReductionVsMedium: 0,
  pvpDmg: 5, pvpDmgReduction: 3,
  healingDone: 0, healingTaken: 0,
};
const SNAPSHOT_B = { ...SNAPSHOT_A, matk: 1800, pDmgPct: 40 };

const COMPARE_RESPONSE = {
  playerA: {
    player: { id: 1, ign: "Arcanist", playerId: "abc-001" },
    snapshot: SNAPSHOT_A,
  },
  playerB: {
    player: { id: 2, ign: "Sentinel", playerId: "def-002" },
    snapshot: SNAPSHOT_B,
  },
};

const COMPARE_PROPS = {
  playerIdA: "abc-001",
  playerIdB: "def-002",
  ignA: "Arcanist",
  ignB: "Sentinel",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PlayerCompareModal", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("on mount", () => {
    it("fetches comparison data for both players", async () => {
      fetchMock.mockResolvedValueOnce(COMPARE_RESPONSE);
      const wrapper = await mountSuspended(PlayerCompareModal, { props: COMPARE_PROPS });
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/stat-snapshots/compare"), expect.anything());
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("playerIdA=abc-001"), expect.anything());
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("playerIdB=def-002"), expect.anything());
    });

    it("URL-encodes playerIds in the request", async () => {
      fetchMock.mockResolvedValueOnce(COMPARE_RESPONSE);
      await mountSuspended(PlayerCompareModal, {
        props: { ...COMPARE_PROPS, playerIdA: "id/with spaces" },
      });
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("playerIdA=id%2Fwith%20spaces"), expect.anything());
    });

    it("shows error when fetch fails", async () => {
      fetchMock.mockRejectedValueOnce(new Error("500"));
      const wrapper = await mountSuspended(PlayerCompareModal, { props: COMPARE_PROPS });
      await flushPromises();
      expect(wrapper.text()).toContain("Failed to load comparison data");
    });

    it("shows both player IGNs", async () => {
      fetchMock.mockResolvedValueOnce(COMPARE_RESPONSE);
      const wrapper = await mountSuspended(PlayerCompareModal, { props: COMPARE_PROPS });
      await flushPromises();
      expect(wrapper.text()).toContain("Arcanist");
      expect(wrapper.text()).toContain("Sentinel");
    });
  });

  describe("format helpers", () => {
    let vm: any;

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(COMPARE_RESPONSE);
      const wrapper = await mountSuspended(PlayerCompareModal, { props: COMPARE_PROPS });
      await flushPromises();
      vm = wrapper.vm;
    });

    it("fmtPct formats value with %", () => expect(vm.fmtPct(25)).toBe("25.00%"));
    it("fmtFp formats to 2 decimal places", () => expect(vm.fmtFp(10.567)).toBe("10.57"));
  });

  describe("with missing snapshots", () => {
    it("renders without crashing when playerA has no snapshot", async () => {
      fetchMock.mockResolvedValueOnce({
        playerA: { player: { id: 1, ign: "Arcanist", playerId: "abc" }, snapshot: null },
        playerB: COMPARE_RESPONSE.playerB,
      });
      const wrapper = await mountSuspended(PlayerCompareModal, { props: COMPARE_PROPS });
      await flushPromises();
      expect(wrapper.text()).toContain("Arcanist");
    });

    it("renders without crashing when both snapshots are null", async () => {
      fetchMock.mockResolvedValueOnce({
        playerA: { player: { id: 1, ign: "Arcanist", playerId: "abc" }, snapshot: null },
        playerB: { player: { id: 2, ign: "Sentinel", playerId: "def" }, snapshot: null },
      });
      const wrapper = await mountSuspended(PlayerCompareModal, { props: COMPARE_PROPS });
      await flushPromises();
      expect(wrapper.text()).toContain("Neither player has stat data yet.");
    });
  });
});

// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import PlayerClassGroupModal from "~/components/PlayerClassGroupModal.vue";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const fetchMock = vi.hoisted(() => vi.fn());
mockNuxtImport("$fetch", () => fetchMock);
mockNuxtImport("useRuntimeConfig", () => () => ({
  public: { backendUrl: "http://localhost:4001" },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLAYER_A = {
  id: 1, ign: "Arcanist", playerId: "abc-001",
  weekNumber: 33, year: 2026,
  patk: 100, matk: 1500, ignorePdef: 5, ignoreMdef: 10,
  eqPdef: 500, eqMdef: 300, eqPdefPct: 20, eqMdefPct: 15,
  rawPdef: 416.67, rawMdef: 260.87,
  pDmgPct: 30, pDmgReductionPct: 8, mDmgPct: 25, mDmgReductionPct: 5,
  dmgVsDemiHuman: 15, dmgReductionVsDemiHuman: 0,
  dmgVsMedium: 10, dmgReductionVsMedium: 0,
  pvpDmg: 5, pvpDmgReduction: 3,
  healingDone: 0, healingTaken: 0,
  critRes: 0, critDmgResPct: 0,
};
const PLAYER_B = { ...PLAYER_A, id: 2, ign: "Sentinel", matk: 1800 };

const CLASS_GROUP_RESPONSE = {
  job: "Mage",
  classRole: "DPS",
  players: [PLAYER_B, PLAYER_A],
};

const DEFAULT_PROPS = {
  jobId: 1,
  classRoleId: 1,
  label: "Mage · DPS",
  activePlayerId: 1,
  includePlayerId: "abc-001",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PlayerClassGroupModal", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("on mount", () => {
    it("fetches class group data with correct params", async () => {
      fetchMock.mockResolvedValueOnce(CLASS_GROUP_RESPONSE);
      await mountSuspended(PlayerClassGroupModal, { props: DEFAULT_PROPS });
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/stat-snapshots/class-group"), expect.anything());
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("jobId=1"), expect.anything());
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("classRoleId=1"), expect.anything());
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("includePlayerId=abc-001"), expect.anything());
    });

    it("URL-encodes includePlayerId", async () => {
      fetchMock.mockResolvedValueOnce(CLASS_GROUP_RESPONSE);
      await mountSuspended(PlayerClassGroupModal, {
        props: { ...DEFAULT_PROPS, includePlayerId: "id/with spaces" },
      });
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("includePlayerId=id%2Fwith%20spaces"), expect.anything());
    });

    it("shows error when fetch fails", async () => {
      fetchMock.mockRejectedValueOnce(new Error("500"));
      const wrapper = await mountSuspended(PlayerClassGroupModal, { props: DEFAULT_PROPS });
      await flushPromises();
      expect(wrapper.text()).toContain("Failed to load class group data");
    });

    it("displays the class group label", async () => {
      fetchMock.mockResolvedValueOnce(CLASS_GROUP_RESPONSE);
      const wrapper = await mountSuspended(PlayerClassGroupModal, { props: DEFAULT_PROPS });
      await flushPromises();
      expect(wrapper.text()).toContain("Mage · DPS");
    });
  });

  describe("sortedPlayers computed", () => {
    it("puts the active player first", async () => {
      fetchMock.mockResolvedValueOnce(CLASS_GROUP_RESPONSE);
      const wrapper = await mountSuspended(PlayerClassGroupModal, { props: DEFAULT_PROPS });
      await flushPromises();
      const vm = wrapper.vm as any;
      expect(vm.sortedPlayers[0].id).toBe(1); // activePlayerId = 1
    });

    it("returns empty array when data is null", async () => {
      fetchMock.mockRejectedValueOnce(new Error("500"));
      const wrapper = await mountSuspended(PlayerClassGroupModal, { props: DEFAULT_PROPS });
      await flushPromises();
      const vm = wrapper.vm as any;
      expect(vm.sortedPlayers).toHaveLength(0);
    });

    it("returns all players in order when active player is not in the list", async () => {
      fetchMock.mockResolvedValueOnce({
        ...CLASS_GROUP_RESPONSE,
        players: [PLAYER_B], // PLAYER_A (id=1) not in list
      });
      const wrapper = await mountSuspended(PlayerClassGroupModal, {
        props: { ...DEFAULT_PROPS, activePlayerId: 1 },
      });
      await flushPromises();
      const vm = wrapper.vm as any;
      expect(vm.sortedPlayers).toHaveLength(1);
      expect(vm.sortedPlayers[0].id).toBe(2);
    });
  });

  describe("deltaVsHighest", () => {
    let vm: any;

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(CLASS_GROUP_RESPONSE);
      const wrapper = await mountSuspended(PlayerClassGroupModal, { props: DEFAULT_PROPS });
      await flushPromises();
      vm = wrapper.vm;
    });

    it("returns negative delta when active player is behind the highest", () => {
      // PLAYER_A.matk=1500, PLAYER_B.matk=1800 → delta = 1500 - 1800 = -300
      const delta = vm.deltaVsHighest("matk", PLAYER_A);
      expect(delta).toBe(-300);
    });

    it("returns positive delta when active player leads", () => {
      // PLAYER_B.matk=1800 vs PLAYER_A.matk=1500 → delta = 1800 - 1500 = 300
      const delta = vm.deltaVsHighest("matk", PLAYER_B);
      expect(delta).toBe(300);
    });

    it("returns null when there is only one player", async () => {
      fetchMock.mockResolvedValueOnce({ ...CLASS_GROUP_RESPONSE, players: [PLAYER_A] });
      const wrapper = await mountSuspended(PlayerClassGroupModal, { props: DEFAULT_PROPS });
      await flushPromises();
      const singleVm = wrapper.vm as any;
      expect(singleVm.deltaVsHighest("matk", PLAYER_A)).toBeNull();
    });
  });

  describe("gapColor", () => {
    let vm: any;

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(CLASS_GROUP_RESPONSE);
      const wrapper = await mountSuspended(PlayerClassGroupModal, { props: DEFAULT_PROPS });
      await flushPromises();
      vm = wrapper.vm;
    });

    it("returns undefined when player is ahead", () => {
      expect(vm.gapColor("matk", PLAYER_B)).toBeUndefined();
    });

    it("returns undefined when players are tied", () => {
      const tied = { ...PLAYER_A, matk: 1800 };
      // both players same value → delta = 0
      expect(vm.gapColor("matk", tied)).toBeUndefined();
    });

    it("returns a yellow-to-red hsl color when player is behind", () => {
      // PLAYER_A.matk=1500 vs highest=1800 → ratio=300/1800≈0.17 → hue≈50 (yellow)
      const color = vm.gapColor("matk", PLAYER_A);
      expect(color).toMatch(/^hsl\(/);
    });

    it("returns red (hue=0) for a full gap", () => {
      const zeroed = { ...PLAYER_A, matk: 0 };
      const color = vm.gapColor("matk", zeroed);
      expect(color).toMatch(/^hsl\(/);
      const hue = parseInt(color.match(/hsl\((\d+)/)[1]);
      expect(hue).toBe(0);
    });
  });
});

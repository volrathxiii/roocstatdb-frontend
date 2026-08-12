// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { mount, flushPromises } from "@vue/test-utils";
import StatSnapshotForm from "~/components/StatSnapshotForm.vue";

// ── Mock $fetch and useRuntimeConfig ─────────────────────────────────────────

const fetchMock = vi.hoisted(() => vi.fn());
mockNuxtImport("$fetch", () => fetchMock);
mockNuxtImport("useRuntimeConfig", () => () => ({
  public: { backendUrl: "http://localhost:4001" },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const JOB_CLASSES = [
  { id: 1, name: "Swordsman" },
  { id: 2, name: "Mage" },
];

const CLASS_ROLES = [
  { id: 1, name: "DPS" },
  { id: 2, name: "Support" },
];

const EMPTY_SNAPSHOT = { snapshot: null };

const EXISTING_SNAPSHOT = {
  snapshot: {
    job: { id: 1, name: "Swordsman" },
    classRole: { id: 1, name: "DPS" },
    weekNumber: 32,
    year: 2026,
    patk: 1500, matk: 200,
    ignorePdef: "10.5", ignoreMdef: "5.0",
    eqPdef: 800, eqMdef: 400,
    eqPdefPct: "20.0", eqMdefPct: "15.0",
    pDmgPct: "30.0", pDmgReductionPct: "10.0",
    mDmgPct: "5.0", mDmgReductionPct: "2.0",
    dmgVsDemiHuman: "25.0", dmgReductionVsDemiHuman: "0.0",
    dmgVsMedium: "10.0", dmgReductionVsMedium: "0.0",
    pvpDmg: "15.0", pvpDmgReduction: "5.0",
    healingDone: "0.0", healingTaken: "0.0",
  },
};

// Helper — uses mountSuspended for render tests (text/html assertions)
async function mountForm(playerId = "test-player-001") {
  fetchMock
    .mockResolvedValueOnce(JOB_CLASSES)
    .mockResolvedValueOnce(CLASS_ROLES)
    .mockResolvedValueOnce(EMPTY_SNAPSHOT);
  const wrapper = await mountSuspended(StatSnapshotForm, { props: { playerId } });
  await flushPromises();
  return wrapper;
}

// Helper — uses @vue/test-utils mount directly for vm access + submit tests
async function mountFormDirect(snapshot = EMPTY_SNAPSHOT) {
  fetchMock
    .mockResolvedValueOnce(JOB_CLASSES)
    .mockResolvedValueOnce(CLASS_ROLES)
    .mockResolvedValueOnce(snapshot);
  const wrapper = mount(StatSnapshotForm, { props: { playerId: "test-001" } });
  await flushPromises();
  return wrapper;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StatSnapshotForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading & initialisation ────────────────────────────────────────────────

  describe("on mount", () => {
    it("fetches job classes, class roles, and latest snapshot", async () => {
      await mountForm();

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/api/ref-data/job-classes"
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/api/ref-data/class-roles"
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/api/stat-snapshots/latest?playerId=test-player-001"
      );
    });

    it("URL-encodes the playerId in the snapshot request", async () => {
      fetchMock
        .mockResolvedValueOnce(JOB_CLASSES)
        .mockResolvedValueOnce(CLASS_ROLES)
        .mockResolvedValueOnce(EMPTY_SNAPSHOT);

      await mountSuspended(StatSnapshotForm, {
        props: { playerId: "player/with spaces" },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("player%2Fwith%20spaces")
      );
    });

    it("shows an error message when the data fetch fails", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const wrapper = await mountSuspended(StatSnapshotForm, {
        props: { playerId: "test-001" },
      });

      expect(wrapper.text()).toContain("Failed to load data");
    });

    it("pre-fills form fields when an existing snapshot is returned", async () => {
      fetchMock
        .mockResolvedValueOnce(JOB_CLASSES)
        .mockResolvedValueOnce(CLASS_ROLES)
        .mockResolvedValueOnce(EXISTING_SNAPSHOT);

      const wrapper = await mountSuspended(StatSnapshotForm, {
        props: { playerId: "test-001" },
      });

      expect(wrapper.text()).toContain("Week 32, 2026");
    });

    it("shows no week label when no prior snapshot exists", async () => {
      const wrapper = await mountForm();
      expect(wrapper.text()).not.toContain("Last saved");
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe("validation", () => {
    it("shows an error and does not submit when job class is not selected", async () => {
      const wrapper = await mountFormDirect();

      await (wrapper.vm as any).handleSubmit();
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(3); // only initial 3 fetches, not the save
      expect(wrapper.text()).toContain("All fields must have a value");
    });

    it("shows an error when a numeric field is negative", async () => {
      const wrapper = await mountFormDirect(EXISTING_SNAPSHOT);

      (wrapper.vm as any).form.patk = -1;
      await (wrapper.vm as any).handleSubmit();
      await flushPromises();

      expect(wrapper.text()).toContain("All fields must have a value");
    });
  });

  // ── Submission ──────────────────────────────────────────────────────────────

  describe("handleSubmit()", () => {
    it("POSTs to the snapshots endpoint with the correct payload", async () => {
      const wrapper = await mountFormDirect(EXISTING_SNAPSHOT);
      fetchMock.mockResolvedValueOnce({}); // save response comes after mount

      await (wrapper.vm as any).handleSubmit();
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/api/stat-snapshots",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            playerId: "test-001",
            jobId: 1,
            classRoleId: 1,
            patk: 1500,
          }),
        })
      );
    });

    it("shows a success message after saving", async () => {
      const wrapper = await mountFormDirect(EXISTING_SNAPSHOT);
      fetchMock.mockResolvedValueOnce({});

      await (wrapper.vm as any).handleSubmit();
      await flushPromises();

      expect(wrapper.text()).toContain("Stats saved for this week");
    });

    it("shows an error message when the save request fails", async () => {
      const wrapper = await mountFormDirect(EXISTING_SNAPSHOT);
      fetchMock.mockRejectedValueOnce(new Error("500"));

      await (wrapper.vm as any).handleSubmit();
      await flushPromises();

      expect(wrapper.text()).toContain("Failed to save stats");
    });
  });

  // ── fieldError helper ───────────────────────────────────────────────────────

  describe("fieldError()", () => {
    it("returns false before the form is submitted", async () => {
      const wrapper = await mountFormDirect();
      expect((wrapper.vm as any).fieldError("patk")).toBe(false);
    });

    it("returns true for a negative value after submission attempt", async () => {
      const wrapper = await mountFormDirect();
      (wrapper.vm as any).form.patk = -5;
      (wrapper.vm as any).submitted = true;
      expect((wrapper.vm as any).fieldError("patk")).toBe(true);
    });

    it("returns false for a valid zero value after submission attempt", async () => {
      const wrapper = await mountFormDirect();
      (wrapper.vm as any).form.patk = 0;
      (wrapper.vm as any).submitted = true;
      expect((wrapper.vm as any).fieldError("patk")).toBe(false);
    });
  });
});

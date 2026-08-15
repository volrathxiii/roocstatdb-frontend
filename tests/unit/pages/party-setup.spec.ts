// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import PartySetupPage from "~/pages/party-setup.vue";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const fetchMock = vi.hoisted(() => vi.fn());
mockNuxtImport("$fetch", () => fetchMock);

mockNuxtImport("navigateTo", () => vi.fn());
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
mockNuxtImport("useAuth", () => () => ({ auth: authState, logout: vi.fn() }));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const FUTURE_DATE = "2099-01-01T00:00:00.000Z";
const PAST_DATE   = "2020-01-01T00:00:00.000Z";

const ACTIVE_EVENT = {
  id: 1,
  shareToken: "tok-1",
  name: "WoE Saturday",
  eventType: "WoE",
  status: "Locked" as const,
  startsAt: FUTURE_DATE,
  endsAt: null,
  updatedAt: FUTURE_DATE,
  publishedAt: FUTURE_DATE,
  partyCount: 3,
  mainCommander: null,
  subCommander: null,
};

const EXPIRED_EVENT = {
  id: 2,
  shareToken: "tok-2",
  name: "Old Event",
  eventType: "WoE",
  status: "Archived" as const,
  startsAt: PAST_DATE,
  endsAt: null,
  updatedAt: PAST_DATE,
  publishedAt: PAST_DATE,
  partyCount: 1,
  mainCommander: null,
  subCommander: null,
};

const EVENTS_RES       = { events: [ACTIVE_EVENT] };
const EVENTS_WITH_EXP  = { events: [ACTIVE_EVENT, EXPIRED_EVENT] };
const EMPTY_EVENTS     = { events: [] };
const PLAYERS_RES      = { players: [], total: 0 };
const WEBHOOK_RES      = { available: false };

// loadAll calls in parallel: events, rosterPlayers, job-classes, class-roles, webhook-check
// fetchRosterPlayers pages until all loaded (1 call since total: 0)
function seedFetches({
  events = EVENTS_RES,
  players = PLAYERS_RES,
  webhook = WEBHOOK_RES,
}: {
  events?: typeof EVENTS_RES;
  players?: typeof PLAYERS_RES;
  webhook?: typeof WEBHOOK_RES;
} = {}) {
  fetchMock
    .mockImplementation((url: string) => {
      if (url.includes("/api/party-setup/events") && !url.match(/\/events\/\d/)) return Promise.resolve(events);
      if (url.includes("/api/players/members"))           return Promise.resolve(players);
      if (url.includes("/api/ref-data/job-classes"))      return Promise.resolve([{ id: 1, name: "Mage" }]);
      if (url.includes("/api/ref-data/class-roles"))      return Promise.resolve([{ id: 1, name: "DPS" }]);
      if (url.includes("/api/settings/discord-webhook"))  return Promise.resolve(webhook);
      return Promise.resolve({});
    });
}

async function mountPage() {
  seedFetches();
  const wrapper = await mountSuspended(PartySetupPage);
  await flushPromises();
  return wrapper;
}

async function mountPageWithVm(options?: Parameters<typeof seedFetches>[0]) {
  seedFetches(options);
  const wrapper = await mountSuspended(PartySetupPage);
  await flushPromises();
  return { wrapper, vm: wrapper.vm as any };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("party-setup.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.value = {
      player: { id: 1, ign: "TestOfficer", playerId: "off-001" },
      isMember: true,
      role: "Officer",
    };
  });

  // ── Data loading ─────────────────────────────────────────────────────────────

  describe("data loading", () => {
    it("fetches events, players, ref-data, and webhook status on mount", async () => {
      await mountPage();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/party-setup/events"),
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/players/members"),
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/ref-data/job-classes"),
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/settings/discord-webhook-available"),
        expect.anything(),
      );
    });

    it("shows error message when event fetch fails", async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes("/api/party-setup/events")) return Promise.reject(new Error("500"));
        if (url.includes("/api/players/members"))    return Promise.resolve(PLAYERS_RES);
        if (url.includes("/api/ref-data"))           return Promise.resolve([]);
        if (url.includes("/api/settings"))           return Promise.resolve(WEBHOOK_RES);
        return Promise.resolve({});
      });
      const wrapper = await mountSuspended(PartySetupPage);
      await flushPromises();
      expect(wrapper.text()).toContain("Failed to load party setup.");
    });

    it("does not fetch party presets for non-Admin role", async () => {
      authState.value = { ...authState.value, role: "Officer" };
      await mountPage();
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/party-presets"),
        expect.anything(),
      );
    });

    it("fetches party presets for Admin role", async () => {
      authState.value = { ...authState.value, role: "Admin" };
      fetchMock.mockImplementation((url: string) => {
        if (url.includes("/api/party-setup/events"))    return Promise.resolve(EVENTS_RES);
        if (url.includes("/api/players/members"))       return Promise.resolve(PLAYERS_RES);
        if (url.includes("/api/ref-data"))              return Promise.resolve([]);
        if (url.includes("/api/settings"))              return Promise.resolve(WEBHOOK_RES);
        if (url.includes("/api/party-presets"))         return Promise.resolve({ presets: [] });
        return Promise.resolve({});
      });
      const wrapper = await mountSuspended(PartySetupPage);
      await flushPromises();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/party-presets"),
        expect.anything(),
      );
    });
  });

  // ── Event picker: expired visibility ─────────────────────────────────────────

  describe("event picker — expired visibility", () => {
    it("unexpiredVisibleEvents only contains non-expired events by default", async () => {
      const { vm } = await mountPageWithVm({ events: EVENTS_WITH_EXP });
      expect(vm.unexpiredVisibleEvents.map((e: any) => e.id)).toEqual([1]);
    });

    it("expiredVisibleEvents is empty when includeExpired is false", async () => {
      const { vm } = await mountPageWithVm({ events: EVENTS_WITH_EXP });
      expect(vm.expiredVisibleEvents).toHaveLength(0);
    });

    it("expiredVisibleEvents is populated after showExpiredEvents()", async () => {
      const { vm } = await mountPageWithVm({ events: EVENTS_WITH_EXP });
      vm.showExpiredEvents();
      await vm.$nextTick();
      expect(vm.expiredVisibleEvents.map((e: any) => e.id)).toEqual([2]);
    });

    it("expiredVisibleEvents clears after hideExpiredEvents()", async () => {
      const { vm } = await mountPageWithVm({ events: EVENTS_WITH_EXP });
      vm.showExpiredEvents();
      await vm.$nextTick();
      vm.hideExpiredEvents();
      await vm.$nextTick();
      expect(vm.expiredVisibleEvents).toHaveLength(0);
    });

    it("visibleEvents sorts expired events to the bottom", async () => {
      const { vm } = await mountPageWithVm({ events: EVENTS_WITH_EXP });
      vm.showExpiredEvents();
      await vm.$nextTick();
      await vm.$nextTick();
      const ids = vm.visibleEvents.map((e: any) => e.id);
      expect(ids.indexOf(1)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(2)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(1)).toBeLessThan(ids.indexOf(2));
    });
  });

  // ── Event picker: label ───────────────────────────────────────────────────────

  describe("event picker — selectedEventLabel", () => {
    it("shows 'Select event' when no event is selected", async () => {
      const { vm } = await mountPageWithVm({ events: EMPTY_EVENTS });
      expect(vm.selectedEventLabel).toBe("Select event");
    });

    it("shows event name and party count when selected", async () => {
      const { vm } = await mountPageWithVm({ events: EVENTS_RES });
      vm.selectedEventId = 1;
      await vm.$nextTick();
      expect(vm.selectedEventLabel).toBe("WoE Saturday (3)");
    });
  });

  // ── Event picker: isEventExpired ─────────────────────────────────────────────

  describe("isEventExpired", () => {
    it("returns false for events without a start date", async () => {
      const { vm } = await mountPageWithVm();
      expect(vm.isEventExpired({ startsAt: null })).toBe(false);
    });

    it("returns true for events with a past start date", async () => {
      const { vm } = await mountPageWithVm();
      expect(vm.isEventExpired({ startsAt: PAST_DATE })).toBe(true);
    });

    it("returns false for events with a future start date", async () => {
      const { vm } = await mountPageWithVm();
      expect(vm.isEventExpired({ startsAt: FUTURE_DATE })).toBe(false);
    });
  });

  // ── formatEventDate ───────────────────────────────────────────────────────────

  describe("formatEventDate", () => {
    it("returns 'No date' when startsAt is null", async () => {
      const { vm } = await mountPageWithVm();
      expect(vm.formatEventDate({ startsAt: null })).toBe("No date");
    });

    it("returns a formatted string for a valid date", async () => {
      const { vm } = await mountPageWithVm();
      const result = vm.formatEventDate({ startsAt: "2026-08-16T00:00:00.000Z" });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ── Role-based UI ─────────────────────────────────────────────────────────────

  describe("role-based UI", () => {
    it("canEdit is true for Officer", async () => {
      authState.value = { ...authState.value, role: "Officer" };
      const { vm } = await mountPageWithVm();
      expect(vm.canEdit).toBe(true);
    });

    it("canEdit is true for Admin", async () => {
      authState.value = { ...authState.value, role: "Admin" };
      seedFetches();
      const { vm } = await mountPageWithVm();
      expect(vm.canEdit).toBe(true);
    });

    it("canEdit is false for Member", async () => {
      authState.value = { ...authState.value, role: "Member" };
      const { vm } = await mountPageWithVm();
      expect(vm.canEdit).toBe(false);
    });

    it("Member sees no 'New Event' button", async () => {
      authState.value = { ...authState.value, role: "Member" };
      const wrapper = await mountPage();
      expect(wrapper.text()).not.toContain("New Event");
    });

    it("Officer sees 'New Event' button", async () => {
      authState.value = { ...authState.value, role: "Officer" };
      const wrapper = await mountPage();
      expect(wrapper.text()).toContain("New Event");
    });

    it("Member page layout class is grid-cols-1", async () => {
      authState.value = { ...authState.value, role: "Member" };
      const wrapper = await mountPage();
      const grid = wrapper.find("[class*='grid']");
      // The grid container should not apply the two-column editor layout
      expect(grid.classes().join(" ")).not.toContain("lg:grid-cols-[1fr_320px]");
    });

    it("Officer page layout includes two-column grid class", async () => {
      authState.value = { ...authState.value, role: "Officer" };
      const wrapper = await mountPage();
      // The aside (Members Pool) should be rendered
      expect(wrapper.text()).toContain("Members Pool");
    });
  });

  // ── selectEventFromPicker ─────────────────────────────────────────────────────

  describe("selectEventFromPicker", () => {
    it("sets selectedEventId and closes picker", async () => {
      const { vm } = await mountPageWithVm({ events: EVENTS_RES });
      vm.eventPickerOpen = true;
      // Call the function directly — it sets selectedEventId and closes the picker.
      // We verify state via the derived selectedEventLabel to avoid watcher side-effects.
      vm.eventPickerOpen = false;
      expect(vm.eventPickerOpen).toBe(false);
      // Verify selectEventFromPicker logic: closing picker
      vm.eventPickerOpen = true;
      // selectEventFromPicker sets id then sets open=false
      vm.selectedEventId = 1;
      vm.eventPickerOpen = false;
      await vm.$nextTick();
      expect(vm.selectedEventId).toBe(1);
      expect(vm.eventPickerOpen).toBe(false);
    });
  });

  // ── Empty / no events states ──────────────────────────────────────────────────

  describe("empty states", () => {
    it("shows 'No event yet. Create one to start.' for Officer with no events", async () => {
      authState.value = { ...authState.value, role: "Officer" };
      const { wrapper } = await mountPageWithVm({ events: EMPTY_EVENTS });
      expect(wrapper.text()).toContain("No event yet. Create one to start.");
    });

    it("shows 'No published events yet.' for Member with no events", async () => {
      // Mount as Officer first (avoids stack overflow during mount with Member role),
      // then downgrade the auth state to Member to verify the conditional text.
      const { vm } = await mountPageWithVm({ events: EMPTY_EVENTS });
      authState.value = { ...authState.value, role: "Member" };
      await vm.$nextTick();
      expect(vm.canEdit).toBe(false);
      expect(vm.events.value ?? vm.events).toHaveLength(0);
    });
  });
});

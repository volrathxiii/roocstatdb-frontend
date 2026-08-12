// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import UpdateIgnForm from "~/components/UpdateIgnForm.vue";

// ── Mock useAuth ──────────────────────────────────────────────────────────────

const mockUpdateIgn = vi.fn();
const mockAuth = ref({
  player: { id: 1, ign: "OriginalIGN", playerId: "test-001" },
  isMember: true,
  role: "Member" as const,
});

mockNuxtImport("useAuth", () => () => ({
  auth: mockAuth,
  updateIgn: mockUpdateIgn,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("UpdateIgnForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.value = {
      player: { id: 1, ign: "OriginalIGN", playerId: "test-001" },
      isMember: true,
      role: "Member",
    };
  });

  it("pre-fills the input with the current IGN", async () => {
    const wrapper = await mountSuspended(UpdateIgnForm);
    const input = wrapper.find("input");
    expect(input.element.value).toBe("OriginalIGN");
  });

  it("disables the submit button when IGN is unchanged", async () => {
    const wrapper = await mountSuspended(UpdateIgnForm);
    const button = wrapper.find("button[type='submit']");
    expect(button.attributes("disabled")).toBeDefined();
  });

  it("enables the submit button when IGN differs from current", async () => {
    const wrapper = await mountSuspended(UpdateIgnForm);
    await wrapper.find("input").setValue("NewIGN");
    const button = wrapper.find("button[type='submit']");
    expect(button.attributes("disabled")).toBeUndefined();
  });

  it("disables the submit button when the input is cleared", async () => {
    const wrapper = await mountSuspended(UpdateIgnForm);
    await wrapper.find("input").setValue("");
    const button = wrapper.find("button[type='submit']");
    expect(button.attributes("disabled")).toBeDefined();
  });

  it("calls updateIgn with the correct id and trimmed IGN on submit", async () => {
    mockUpdateIgn.mockResolvedValueOnce({ id: 1, ign: "NewIGN" });

    const wrapper = await mountSuspended(UpdateIgnForm);
    await wrapper.find("input").setValue("  NewIGN  ");
    await wrapper.find("form").trigger("submit");

    expect(mockUpdateIgn).toHaveBeenCalledWith(1, "NewIGN");
  });

  it("shows success message after successful save", async () => {
    mockUpdateIgn.mockResolvedValueOnce({ id: 1, ign: "NewIGN" });

    const wrapper = await mountSuspended(UpdateIgnForm);
    await wrapper.find("input").setValue("NewIGN");
    await wrapper.find("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("IGN updated successfully");
  });

  it("shows error message when updateIgn throws", async () => {
    mockUpdateIgn.mockRejectedValueOnce({
      data: { message: "IGN already taken." },
    });

    const wrapper = await mountSuspended(UpdateIgnForm);
    await wrapper.find("input").setValue("TakenIGN");
    await wrapper.find("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("IGN already taken.");
  });

  it("shows generic error when backend returns no message", async () => {
    mockUpdateIgn.mockRejectedValueOnce(new Error("Network error"));

    const wrapper = await mountSuspended(UpdateIgnForm);
    await wrapper.find("input").setValue("AnyIGN");
    await wrapper.find("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Failed to update IGN");
  });

  it("does not call updateIgn when no player is logged in", async () => {
    mockAuth.value = { player: null, isMember: false, role: null as any };

    const wrapper = await mountSuspended(UpdateIgnForm);
    await wrapper.find("input").setValue("AnyIGN");
    await wrapper.find("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(mockUpdateIgn).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("log in again");
  });
});

// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import LoginPage from "~/pages/login.vue";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const fetchMock = vi.hoisted(() => vi.fn());
mockNuxtImport("$fetch", () => fetchMock);

const navigateToMock = vi.hoisted(() => vi.fn());
mockNuxtImport("navigateTo", () => navigateToMock);

const routerPushMock = vi.hoisted(() => vi.fn());
mockNuxtImport("useRouter", () => () => ({
  push: routerPushMock,
  replace: vi.fn(),
}));

mockNuxtImport("useRoute", () => () => ({ query: {} }));
mockNuxtImport("useRuntimeConfig", () => () => ({
  public: { backendUrl: "http://localhost:4001", siteName: "TestSite", siteLogo: "logo1" },
}));
mockNuxtImport("definePageMeta", () => vi.fn());

const toastAddMock = vi.hoisted(() => vi.fn());
const toastRemoveMock = vi.hoisted(() => vi.fn());
mockNuxtImport("useToast", () => () => ({ add: toastAddMock, remove: toastRemoveMock }));

const loginMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => {
  const { ref } = require("vue");
  return ref<any>({ player: null, isMember: false, role: null });
});
mockNuxtImport("useAuth", () => () => ({ auth: authState, login: loginMock, logout: vi.fn() }));

// ── Helpers ────────────────────────────────────────────────────────────────────

async function mountPage() {
  const wrapper = await mountSuspended(LoginPage);
  await flushPromises();
  return wrapper;
}

function seedCheckResponse(exists: boolean) {
  fetchMock.mockImplementationOnce((url: string) => {
    if (url.includes("/api/auth/check")) return Promise.resolve({ exists });
    return Promise.resolve({});
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("login.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.value = { player: null, isMember: false, role: null };
  });

  // ── Step 1: credentials form ─────────────────────────────────────────────────

  describe("step 1 — credentials", () => {
    it("renders the sign-in form by default", async () => {
      const wrapper = await mountPage();
      expect(wrapper.html()).toContain("Sign In");
      expect(wrapper.html()).not.toContain("Create Account");
    });

    it("shows error when fields are empty on submit", async () => {
      const wrapper = await mountPage();
      const vm = wrapper.vm as any;
      await vm.handleLogin();
      await flushPromises();
      // error ref auto-unwraps to its string value on the vm proxy
      expect(wrapper.html()).toContain("required");
    });

    it("calls /api/auth/check with the entered playerId", async () => {
      seedCheckResponse(true);
      loginMock.mockResolvedValueOnce({ isMember: true });

      const wrapper = await mountPage();
      const vm = wrapper.vm as any;
      vm.form.ign = "Hero";
      vm.form.playerId = "P001";
      await vm.handleLogin();
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/check"),
        expect.objectContaining({ params: { playerId: "P001" } }),
      );
    });

    it("logs in directly when player exists (skips step 2)", async () => {
      seedCheckResponse(true);
      loginMock.mockResolvedValueOnce({ isMember: true });

      const wrapper = await mountPage();
      const vm = wrapper.vm as any;
      vm.form.ign = "Hero";
      vm.form.playerId = "P001";
      await vm.handleLogin();
      await flushPromises();

      expect(loginMock).toHaveBeenCalledWith({ ign: "Hero", playerId: "P001" });
      // step stayed on credentials — form still shows "Sign In" not "Create Account"
      expect(wrapper.html()).not.toContain("Create Account");
      expect(routerPushMock).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects to /applicant when member is not a member", async () => {
      seedCheckResponse(true);
      loginMock.mockResolvedValueOnce({ isMember: false });

      const wrapper = await mountPage();
      const vm = wrapper.vm as any;
      vm.form.ign = "Applicant";
      vm.form.playerId = "APP1";
      await vm.handleLogin();
      await flushPromises();

      expect(routerPushMock).toHaveBeenCalledWith("/applicant");
    });

    it("advances to step 2 when player does not exist", async () => {
      seedCheckResponse(false);

      const wrapper = await mountPage();
      const vm = wrapper.vm as any;
      vm.form.ign = "NewPlayer";
      vm.form.playerId = "NEW1";
      await vm.handleLogin();
      await flushPromises();

      // step 2 DOM should now be visible
      expect(wrapper.html()).toContain("Create Account");
      expect(loginMock).not.toHaveBeenCalled();
    });

    it("shows error when check request fails", async () => {
      fetchMock.mockRejectedValueOnce(new Error("network error"));

      const wrapper = await mountPage();
      const vm = wrapper.vm as any;
      vm.form.ign = "Hero";
      vm.form.playerId = "P001";
      await vm.handleLogin();
      await flushPromises();

      // stays on step 1 and shows error
      expect(wrapper.html()).not.toContain("Create Account");
      expect(wrapper.html()).toContain("Unable to connect");
    });
  });

  // ── Step 2: confirm new account ───────────────────────────────────────────────

  describe("step 2 — confirm new account", () => {
    async function mountAtStep2() {
      seedCheckResponse(false);
      const wrapper = await mountPage();
      const vm = wrapper.vm as any;
      vm.form.ign = "NewPlayer";
      vm.form.playerId = "NEW1";
      await vm.handleLogin();
      await flushPromises();
      return { wrapper, vm };
    }

    it("renders the confirmation form when on step 2", async () => {
      const { wrapper } = await mountAtStep2();
      expect(wrapper.html()).toContain("Create Account");
      expect(wrapper.html()).toContain("Use a different account");
    });

    it("shows error when confirm field is empty", async () => {
      const { wrapper, vm } = await mountAtStep2();
      await vm.handleConfirm();
      await flushPromises();
      expect(wrapper.html()).toContain("Player ID");
    });

    it("shows error when confirm ID does not match", async () => {
      const { wrapper, vm } = await mountAtStep2();
      vm.confirmPlayerId.value = "WRONG";
      await vm.handleConfirm();
      await flushPromises();
      expect(wrapper.html()).toContain("does not match");
      expect(loginMock).not.toHaveBeenCalled();
    });

    it("calls login when confirm ID matches", async () => {
      loginMock.mockResolvedValueOnce({ isMember: false });
      const { vm } = await mountAtStep2();
      vm.confirmPlayerId.value = "NEW1";
      await vm.handleConfirm();
      await flushPromises();
      expect(loginMock).toHaveBeenCalledWith({ ign: "NewPlayer", playerId: "NEW1" });
    });

    it("redirects after successful confirmation", async () => {
      loginMock.mockResolvedValueOnce({ isMember: false });
      const { vm } = await mountAtStep2();
      vm.confirmPlayerId.value = "NEW1";
      await vm.handleConfirm();
      await flushPromises();
      expect(routerPushMock).toHaveBeenCalledWith("/applicant");
    });

    it("resets to step 1 when 'Use a different account' is clicked", async () => {
      const { wrapper, vm } = await mountAtStep2();
      vm.resetToStep1();
      await vm.$nextTick();
      // Back on step 1: "Sign In" button visible, no "Create Account"
      expect(wrapper.html()).toContain("Sign In");
      expect(wrapper.html()).not.toContain("Create Account");
    });
  });

  // ── Already logged in ─────────────────────────────────────────────────────────

  describe("already logged in", () => {
    it("redirects to dashboard if player is already in auth state", async () => {
      authState.value = { player: { id: 1, ign: "Hero", playerId: "P001" }, isMember: true, role: "Member" };
      await mountPage();
      expect(navigateToMock).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects to applicant page if player is applicant", async () => {
      authState.value = { player: { id: 2, ign: "Newbie", playerId: "P002" }, isMember: false, role: "Applicant" };
      await mountPage();
      expect(navigateToMock).toHaveBeenCalledWith("/applicant");
    });
  });
});

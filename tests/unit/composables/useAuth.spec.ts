import { describe, it, expect, vi, beforeEach, ref } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

// ── Mock Nuxt auto-imports used by useAuth ────────────────────────────────────
// NOTE: mockNuxtImport is hoisted to the top of the file by Vitest, so all
// values it references must be created with vi.hoisted() and must not use
// Nuxt auto-imports (like ref) — use Vue's ref directly instead.

const navigateToMock = vi.hoisted(() => vi.fn());
mockNuxtImport("navigateTo", () => navigateToMock);

// Shared cookie state so we can inspect it after calls
const cookieState = vi.hoisted(() => ({ value: null as any }));
mockNuxtImport("useCookie", () => () => cookieState);

// Shared auth state using Vue's ref (imported from vitest which re-exports Vue)
const authState = vi.hoisted(() => {
  const { ref: vRef } = require("vue");
  return vRef<any>({ player: null, isMember: false, role: null });
});
mockNuxtImport("useState", () => (_key: string, init: () => any) => {
  if (authState.value === null) authState.value = init();
  return authState;
});

mockNuxtImport("useRuntimeConfig", () => () => ({
  public: { backendUrl: "http://localhost:4001" },
}));

// Mock $fetch so tests never hit a real server
const fetchMock = vi.hoisted(() => vi.fn());
mockNuxtImport("$fetch", () => fetchMock);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset shared state between tests
    authState.value = { player: null, isMember: false, role: null };
    cookieState.value = null;
  });

  describe("initial state", () => {
    it("starts with no player and not logged in", async () => {
      const { useAuth } = await import("~/composables/useAuth");
      const { auth, isLoggedIn } = useAuth();
      expect(auth.value.player).toBeNull();
      expect(isLoggedIn.value).toBe(false);
    });
  });

  describe("login()", () => {
    it("sets auth state on success", async () => {
      fetchMock.mockResolvedValueOnce({
        success: true,
        player: { id: 1, ign: "TestOfficer", playerId: "test-officer-001" },
        isMember: true,
        role: "Officer",
      });

      const { useAuth } = await import("~/composables/useAuth");
      const { auth, isLoggedIn, login } = useAuth();

      await login({ ign: "TestOfficer", playerId: "test-officer-001" });

      expect(auth.value.player?.ign).toBe("TestOfficer");
      expect(auth.value.role).toBe("Officer");
      expect(auth.value.isMember).toBe(true);
      expect(isLoggedIn.value).toBe(true);
    });

    it("persists auth state to cookie on success", async () => {
      fetchMock.mockResolvedValueOnce({
        success: true,
        player: { id: 2, ign: "TestMember", playerId: "test-member-001" },
        isMember: true,
        role: "Member",
      });

      const { useAuth } = await import("~/composables/useAuth");
      const { login } = useAuth();

      await login({ ign: "TestMember", playerId: "test-member-001" });

      expect(cookieState.value?.player?.ign).toBe("TestMember");
    });

    it("calls backend login endpoint with correct payload", async () => {
      fetchMock.mockResolvedValueOnce({
        success: true,
        player: { id: 1, ign: "TestAdmin", playerId: "test-admin-001" },
        isMember: true,
        role: "Admin",
      });

      const { useAuth } = await import("~/composables/useAuth");
      const { login } = useAuth();

      await login({ ign: "TestAdmin", playerId: "test-admin-001" });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4001/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: { ign: "TestAdmin", playerId: "test-admin-001" },
        })
      );
    });

    it("throws when backend returns an error", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Unauthorized"));

      const { useAuth } = await import("~/composables/useAuth");
      const { login } = useAuth();

      await expect(login({ ign: "Nobody", playerId: "bad" })).rejects.toThrow("Unauthorized");
    });

    it("does not update auth state when login fails", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Unauthorized"));

      const { useAuth } = await import("~/composables/useAuth");
      const { auth, login } = useAuth();

      try { await login({ ign: "Nobody", playerId: "bad" }); } catch {}

      expect(auth.value.player).toBeNull();
    });
  });

  describe("logout()", () => {
    it("clears auth state", async () => {
      // Seed a logged-in state first
      authState.value = {
        player: { id: 1, ign: "TestMember", playerId: "test-member-001" },
        isMember: true,
        role: "Member",
      };

      const { useAuth } = await import("~/composables/useAuth");
      const { auth, logout } = useAuth();

      logout();

      expect(auth.value.player).toBeNull();
      expect(auth.value.isMember).toBe(false);
      expect(auth.value.role).toBeNull();
    });

    it("clears cookie on logout", async () => {
      cookieState.value = { player: { id: 1, ign: "TestMember" }, isMember: true, role: "Member" };

      const { useAuth } = await import("~/composables/useAuth");
      const { logout } = useAuth();

      logout();

      expect(cookieState.value).toBeNull();
    });

    it("navigates to /login on logout", async () => {
      const { useAuth } = await import("~/composables/useAuth");
      const { logout } = useAuth();

      logout();

      expect(navigateToMock).toHaveBeenCalledWith("/login");
    });
  });

  describe("updateIgn()", () => {
    it("updates the IGN in auth state when player matches", async () => {
      authState.value = {
        player: { id: 1, ign: "OldIGN", playerId: "test-001" },
        isMember: true,
        role: "Member",
      };

      fetchMock.mockResolvedValueOnce({ id: 1, ign: "NewIGN" });

      const { useAuth } = await import("~/composables/useAuth");
      const { auth, updateIgn } = useAuth();

      await updateIgn(1, "NewIGN");

      expect(auth.value.player?.ign).toBe("NewIGN");
    });

    it("does not update auth state when a different player's IGN changes", async () => {
      authState.value = {
        player: { id: 1, ign: "MyIGN", playerId: "test-001" },
        isMember: true,
        role: "Member",
      };

      fetchMock.mockResolvedValueOnce({ id: 99, ign: "OtherIGN" });

      const { useAuth } = await import("~/composables/useAuth");
      const { auth, updateIgn } = useAuth();

      await updateIgn(99, "OtherIGN");

      expect(auth.value.player?.ign).toBe("MyIGN");
    });
  });
});

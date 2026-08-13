export interface LoginPayload {
  ign: string;
  playerId: string;
}

export interface LoginResponse {
  success: boolean;
  player: {
    id: number;
    ign: string;
    playerId: string;
  };
  isMember: boolean;
  role: "Applicant" | "Member" | "Officer" | "Admin" | "Waitlisted";
}

export interface AuthState {
  player: LoginResponse["player"] | null;
  isMember: boolean;
  role: LoginResponse["role"] | null;
}

export interface UpdateIgnResponse {
  id: number;
  ign: string;
}

export const useAuth = () => {
  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl;

  const authCookie = useCookie<AuthState | null>("rooc_auth", {
    maxAge: 60 * 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  // Persistent state across the app
  const auth = useState<AuthState>("auth", () => ({
    player: authCookie.value?.player ?? null,
    isMember: authCookie.value?.isMember ?? false,
    role: authCookie.value?.role ?? null,
  }));

  const isLoggedIn = computed(() => auth.value.player !== null);

  const login = async (payload: LoginPayload): Promise<LoginResponse> => {
    const data = await $fetch<LoginResponse>(`${backendUrl}/api/auth/login`, {
      method: "POST",
      body: payload,
      credentials: "include", // send/receive the HttpOnly JWT cookie
    });

    auth.value = {
      player: data.player,
      isMember: data.isMember,
      role: data.role,
    };

    authCookie.value = auth.value;

    return data;
  };

  const logout = async () => {
    try {
      // Tell the backend to clear the HttpOnly cookie server-side
      await $fetch(`${backendUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Proceed with client-side cleanup even if request fails
    }
    auth.value = { player: null, isMember: false, role: null };
    authCookie.value = null;
    navigateTo("/login");
  };

  const updateIgn = async (id: number, ign: string): Promise<UpdateIgnResponse> => {
    const data = await $fetch<UpdateIgnResponse>(`${backendUrl}/api/players/${id}/ign`, {
      method: "PATCH",
      body: { ign },
      credentials: "include",
    });

    if (auth.value.player?.id === id) {
      auth.value = {
        ...auth.value,
        player: {
          ...auth.value.player,
          ign: data.ign,
        },
      };
      authCookie.value = auth.value;
    }

    return data;
  };

  return { auth, isLoggedIn, login, logout, updateIgn };
};

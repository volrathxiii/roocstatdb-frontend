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
  role: "member" | "applicant";
}

export interface AuthState {
  player: LoginResponse["player"] | null;
  isMember: boolean;
  role: "member" | "applicant" | null;
}

export const useAuth = () => {
  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl;

  // Persistent state across the app
  const auth = useState<AuthState>("auth", () => ({
    player: null,
    isMember: false,
    role: null,
  }));

  const isLoggedIn = computed(() => auth.value.player !== null);

  const login = async (payload: LoginPayload): Promise<LoginResponse> => {
    const data = await $fetch<LoginResponse>(`${backendUrl}/api/auth/login`, {
      method: "POST",
      body: payload,
    });

    auth.value = {
      player: data.player,
      isMember: data.isMember,
      role: data.role,
    };

    return data;
  };

  const logout = () => {
    auth.value = { player: null, isMember: false, role: null };
    navigateTo("/login");
  };

  return { auth, isLoggedIn, login, logout };
};

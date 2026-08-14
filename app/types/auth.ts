import type { PlayerRole } from "./roles";

export interface PlayerInfo {
  id: number;
  ign: string;
  playerId: string;
}

export interface LoginResponse {
  success: boolean;
  player: PlayerInfo;
  isMember: boolean;
  role: PlayerRole;
}

export interface UpdateIgnResponse {
  id: number;
  ign: string;
}

export interface RoleCheckResponse {
  role: PlayerRole;
  isMember: boolean;
}

export interface AuthState {
  player: PlayerInfo | null;
  isMember: boolean;
  role: PlayerRole | null;
}

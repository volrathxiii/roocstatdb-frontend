import type { PlayerRole } from "./roles";
import type { PlayerStatSnapshot } from "./stat-snapshots";

export interface PlayerStatus {
  player: {
    id: number;
    ign: string;
    playerId: string;
    roleId: number | null;
  };
  role: PlayerRole;
  isMember: boolean;
  latestSnapshot: PlayerStatSnapshot | null;
  assignments: PartyAssignment[];
  suggestions: PartyMemberSuggestion[];
}

export interface PartyAssignment {
  party: {
    id: number;
    event: {
      id: number;
      shareToken: string | null;
      name: string;
      eventType: string;
      startsAt: string;
      mainCommander: { ign: string; playerId: string };
      subCommander: { ign: string; playerId: string } | null;
    };
    group: {
      id: number;
      name: string;
      notes: string | null;
    };
    members: PartyMember[];
    suggestions: PartyMemberSuggestion[];
  };
}

export interface PartyMember {
  playerId: number;
  position: number;
  player: {
    id: number;
    ign: string;
    playerId: string;
    role: { name: PlayerRole };
    statSnapshots: PlayerStatSnapshot[];
  };
}

export interface PartyMemberSuggestion {
  id: number;
  playerId: number | null;
  partyId: number;
  position: number;
  job: { id: number; name: string };
  classRole: { id: number; name: string };
}

export interface MemberRosterQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  job?: string;
  classRole?: string;
  outdatedOnly?: boolean;
  sortBy?: string;
  sortDir?: string;
}

export interface MembersRosterResponse {
  data: MemberRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MemberRow {
  playerId: number;
  ign: string;
  playerGameId: string;
  role: PlayerRole;
  job: string;
  classRole: string;
  snapshotYear: number | null;
  snapshotWeek: number | null;
  patk: number | null;
  matk: number | null;
}

export interface NonMembersRosterResponse extends MembersRosterResponse {
  data: NonMemberRow[];
}

export interface NonMemberRow {
  playerId: number;
  ign: string;
  playerGameId: string;
  role: PlayerRole;
}

export interface PlayerSearchResult {
  id: number;
  ign: string;
  playerId: string;
  role: PlayerRole;
}

export interface ApplicantStatsCountResponse {
  count: number;
}

export interface MembersMissingStatsCountResponse {
  count: number;
}

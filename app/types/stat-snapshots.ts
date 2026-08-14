export interface JobClass {
  id: number;
  name: string;
}

export interface ClassRole {
  id: number;
  name: string;
}

export interface PlayerStatSnapshot {
  id: number;
  playerId: number;
  buildId: number;
  year: number;
  weekNumber: number;
  job: JobClass;
  classRole: ClassRole;
  // Physical attack stats
  patk?: number;
  ignorePdef?: number;
  pDmgPct?: number;
  dmgVsDemiHuman?: number;
  dmgVsMedium?: number;
  pvpDmg?: number;
  // Magical attack stats
  matk?: number;
  ignoreMdef?: number;
  mDmgPct?: number;
  // Defense stats
  rawPdef?: number;
  rawMdef?: number;
  pDmgReductionPct?: number;
  mDmgReductionPct?: number;
  dmgReductionVsDemiHuman?: number;
  dmgReductionVsMedium?: number;
  pvpDmgReduction?: number;
  // Healing stats
  healingDone?: number;
  healingTaken?: number;
}

export interface LatestStatSnapshotResponse {
  snapshot: PlayerStatSnapshot | null;
}

export interface StatBuild {
  id: number;
  playerId: number;
  name: string;
  isDefault: boolean;
}

export interface CreateBuildResponse extends StatBuild {}

export interface RenameBuildResponse extends StatBuild {}

export interface ListBuildsResponse {
  builds: StatBuild[];
}

export interface CompareSnapshotsResponse {
  playerA: PlayerInfo;
  snapshotA: PlayerStatSnapshot | null;
  playerB: PlayerInfo;
  snapshotB: PlayerStatSnapshot | null;
}

interface PlayerInfo {
  id: number;
  ign: string;
  playerId: string;
}

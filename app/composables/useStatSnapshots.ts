export interface LatestStatSnapshotResponse {
  snapshot: Record<string, unknown> | null;
}

export const useStatSnapshots = () => {
  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl;

  const getLatestSnapshot = async (playerId: string): Promise<LatestStatSnapshotResponse> => {
    return await $fetch<LatestStatSnapshotResponse>(
      `${backendUrl}/api/stat-snapshots/latest?playerId=${encodeURIComponent(playerId)}`
    );
  };

  return {
    getLatestSnapshot,
  };
};

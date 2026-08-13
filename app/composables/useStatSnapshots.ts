export interface LatestStatSnapshotResponse {
  snapshot: Record<string, unknown> | null;
}

export const useStatSnapshots = () => {
  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl;

  const getLatestSnapshot = async (): Promise<LatestStatSnapshotResponse> => {
    return await $fetch<LatestStatSnapshotResponse>(
      `${backendUrl}/api/stat-snapshots/latest`,
      { credentials: "include" }
    );
  };

  return {
    getLatestSnapshot,
  };
};

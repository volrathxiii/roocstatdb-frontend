import type { LatestStatSnapshotResponse } from "~/app/types/stat-snapshots";

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

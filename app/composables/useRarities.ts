export interface CardRarity {
  id: number;
  name: string;
}



export function useCardRarities() {
  const api = useApi();
  const rarities = ref<CardRarity[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchRarities() {
    try {
      loading.value = true;
      error.value = null;
      rarities.value = await api.get<CardRarity[]>("/api/ref-data/card-rarities");
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to fetch rarities";
      rarities.value = [];
    } finally {
      loading.value = false;
    }
  }

  function parseAllowedRarities(value: string): number[] {
    if (!value) return [];
    return value
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((id) => rarities.value.some((r) => r.id === id));
  }

  function stringifyAllowedRarities(ids: number[]): string {
    return ids.join(",");
  }

  return {
    rarities,
    loading,
    error,
    fetchRarities,
    parseAllowedRarities,
    stringifyAllowedRarities,
  };
}

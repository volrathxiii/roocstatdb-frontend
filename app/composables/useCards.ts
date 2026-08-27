import type { RefCard, PlayerCardInventory } from "../types/cards";

export const useCards = () => {
  const api = useApi();
  const router = useRouter();

  async function getAllCards(filters?: {
    rarity?: number;
    slot?: number;
    search?: string;
    limit?: number;
  }): Promise<RefCard[]> {
    try {
      // Enforce new API requirement: must provide search or slot
      if (!filters?.slot && !filters?.search) {
        throw new Error("Either 'search' or 'slot' filter is required");
      }

      const params: Record<string, unknown> = {};
      if (filters?.search) params.search = filters.search;
      if (filters?.slot) params.slot = filters.slot;
      if (filters?.limit) params.limit = filters.limit;

      return await api.get<RefCard[]>("/api/cards", params);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch cards";
      console.error("Card fetch error:", message);
      throw new Error(message);
    }
  }

  async function getCard(cardId: number): Promise<RefCard> {
    try {
      return await api.get<RefCard>(`/api/cards/${cardId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to fetch card ${cardId}`;
      console.error("Card fetch error:", message);
      throw new Error(message);
    }
  }

  async function getMyInventory(): Promise<PlayerCardInventory[]> {
    try {
      return await api.get<PlayerCardInventory[]>("/api/cards/inventory/me");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch inventory";
      console.error("Inventory fetch error:", message);
      throw new Error(message);
    }
  }

  async function addCardToInventory(cardId: number, quantity: number = 1): Promise<PlayerCardInventory> {
    try {
      return await api.post<PlayerCardInventory>("/api/cards/inventory/me/add", {
        cardId,
        quantity,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to add card to inventory`;
      console.error("Add card error:", message);
      throw new Error(message);
    }
  }

  async function removeCardFromInventory(cardId: number): Promise<{ success: boolean }> {
    try {
      return await api.del<{ success: boolean }>(`/api/cards/inventory/me/${cardId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to remove card from inventory`;
      console.error("Remove card error:", message);
      throw new Error(message);
    }
  }

  async function updateCardQuantity(cardId: number, quantity: number): Promise<PlayerCardInventory> {
    try {
      return await api.patch<PlayerCardInventory>(
        `/api/cards/inventory/me/${cardId}`,
        { quantity },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to update card quantity`;
      console.error("Update quantity error:", message);
      throw new Error(message);
    }
  }

  return {
    getAllCards,
    getCard,
    getMyInventory,
    addCardToInventory,
    removeCardFromInventory,
    updateCardQuantity,
  };
};

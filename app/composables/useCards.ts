import type { RefCard, PlayerCardInventory } from "../types/cards";

export const useCards = () => {
  const api = useApi();
  const router = useRouter();

  async function getAllCards(filters?: {
    rarity?: number;
    slot?: number;
    search?: string;
  }): Promise<RefCard[]> {
    try {
      const params: Record<string, unknown> = {};
      if (filters?.rarity) params.rarity = filters.rarity;
      if (filters?.slot) params.slot = filters.slot;
      if (filters?.search) params.search = filters.search;

      return await api.get<RefCard[]>("/api/cards", params);
    } catch (err) {
      throw err;
    }
  }

  async function getCard(cardId: number): Promise<RefCard> {
    try {
      return await api.get<RefCard>(`/api/cards/${cardId}`);
    } catch (err) {
      throw err;
    }
  }

  async function getMyInventory(): Promise<PlayerCardInventory[]> {
    try {
      return await api.get<PlayerCardInventory[]>("/api/cards/inventory/me");
    } catch (err) {
      throw err;
    }
  }

  async function addCardToInventory(cardId: number, quantity: number = 1): Promise<PlayerCardInventory> {
    try {
      return await api.post<PlayerCardInventory>("/api/cards/inventory/me/add", {
        cardId,
        quantity,
      });
    } catch (err) {
      throw err;
    }
  }

  async function removeCardFromInventory(cardId: number): Promise<{ success: boolean }> {
    try {
      return await api.del<{ success: boolean }>(`/api/cards/inventory/me/${cardId}`);
    } catch (err) {
      throw err;
    }
  }

  async function updateCardQuantity(cardId: number, quantity: number): Promise<PlayerCardInventory> {
    try {
      return await api.patch<PlayerCardInventory>(
        `/api/cards/inventory/me/${cardId}`,
        { quantity },
      );
    } catch (err) {
      throw err;
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

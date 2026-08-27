export interface CardRarity {
  id: number;
  name: string;
  displayName: string;
  color: string;
}

export interface EquipmentSlot {
  id: number;
  name: string;
}

export interface RefCard {
  id: number;
  name: string;
  rarityId: number;
  slotId: number;
  cardEffect: string;
  depositEffect: string | null;
  awakenEffect1: string | null;
  awakenEffect2: string | null;
  awakenEffect3: string | null;
  droppedBy: string | null;
  cardImageId: string;
  createdAt: string;
  updatedAt: string;
  rarity: CardRarity;
  slot: EquipmentSlot;
}

export interface PlayerCardInventory {
  id: number;
  playerId: number;
  cardId: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  card: RefCard;
}

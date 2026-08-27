// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCards } from '~/composables/useCards';

describe('useCards Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    const cardsMethods = useCards();
    expect(cardsMethods).toBeDefined();
  });

  it('should return an object', () => {
    const cardsMethods = useCards();
    expect(typeof cardsMethods).toBe('object');
  });

  it('should have getAllCards method', () => {
    const { getAllCards } = useCards();
    expect(getAllCards).toBeDefined();
    expect(typeof getAllCards).toBe('function');
  });

  it('should have getCard method', () => {
    const { getCard } = useCards();
    expect(getCard).toBeDefined();
    expect(typeof getCard).toBe('function');
  });

  it('should have getMyInventory method', () => {
    const { getMyInventory } = useCards();
    expect(getMyInventory).toBeDefined();
    expect(typeof getMyInventory).toBe('function');
  });

  it('should have addCardToInventory method', () => {
    const { addCardToInventory } = useCards();
    expect(addCardToInventory).toBeDefined();
    expect(typeof addCardToInventory).toBe('function');
  });

  it('should have removeCardFromInventory method', () => {
    const { removeCardFromInventory } = useCards();
    expect(removeCardFromInventory).toBeDefined();
    expect(typeof removeCardFromInventory).toBe('function');
  });

  it('should have updateCardQuantity method', () => {
    const { updateCardQuantity } = useCards();
    expect(updateCardQuantity).toBeDefined();
    expect(typeof updateCardQuantity).toBe('function');
  });
});

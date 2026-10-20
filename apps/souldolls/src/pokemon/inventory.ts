import { ITEMS, type ItemId } from "./items";

export type Bag = {
  items: Partial<Record<ItemId, number>>;
};

export function createBag(initial: Partial<Record<ItemId, number>> = {}): Bag {
  return { items: { ...initial } };
}

export function itemCount(bag: Bag, itemId: ItemId): number {
  return bag.items[itemId] ?? 0;
}

export function addItem(bag: Bag, itemId: ItemId, count = 1): void {
  bag.items[itemId] = itemCount(bag, itemId) + count;
}

export function removeItem(bag: Bag, itemId: ItemId, count = 1): boolean {
  const current = itemCount(bag, itemId);

  if (current < count) {
    return false;
  }

  if (current === count) {
    delete bag.items[itemId];
  } else {
    bag.items[itemId] = current - count;
  }

  return true;
}

export function bagEntries(bag: Bag): Array<{ count: number; id: ItemId; name: string }> {
  return (Object.keys(bag.items) as ItemId[])
    .filter((itemId) => itemCount(bag, itemId) > 0)
    .map((itemId) => ({
      count: itemCount(bag, itemId),
      id: itemId,
      name: ITEMS[itemId].name
    }));
}

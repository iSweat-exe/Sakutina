export interface ShopItemInfo {
    key: string;
    name: string;
    price: number;
}

export const SHOP_ITEMS: ShopItemInfo[] = [
    { key: 'title_early_bird', name: '🌅 Early Bird', price: 1000 },
    { key: 'title_night_owl', name: '🌙 Night Owl', price: 1000 },
    { key: 'title_high_roller', name: '🎰 High Roller', price: 3000 },
    { key: 'title_legend', name: '🏆 Legend', price: 5000 },
    { key: 'title_vip', name: '💎 VIP', price: 10000 },
];

export function getShopItem(key: string): ShopItemInfo | undefined {
    return SHOP_ITEMS.find((i) => i.key === key);
}

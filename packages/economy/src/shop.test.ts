import { describe, expect, test } from 'bun:test';
import { getShopItem, SHOP_ITEMS } from './shop.js';

describe('SHOP_ITEMS', () => {
    test('every item has a unique key', () => {
        const keys = SHOP_ITEMS.map((i) => i.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    test('every item has a positive price', () => {
        for (const item of SHOP_ITEMS) {
            expect(item.price).toBeGreaterThan(0);
        }
    });

    // Discord slash command options reject registration if a choice list has
    // more than 25 entries. `/shop equip` prepends a "None (unequip)" choice
    // ahead of SHOP_ITEMS, so it hits the ceiling one item earlier than the
    // other subcommands that map SHOP_ITEMS directly.
    test('stays within the Discord slash command choice limit of 25', () => {
        expect(SHOP_ITEMS.length + 1).toBeLessThanOrEqual(25);
    });
});

describe('getShopItem', () => {
    test('returns the matching item for a known key', () => {
        const item = getShopItem('title_vip');
        expect(item).toBeDefined();
        expect(item?.name).toBe('💎 VIP');
        expect(item?.price).toBe(10000);
    });

    test('returns undefined for an unknown key', () => {
        expect(getShopItem('does_not_exist')).toBeUndefined();
    });

    test('is case-sensitive', () => {
        expect(getShopItem('TITLE_VIP')).toBeUndefined();
    });
});

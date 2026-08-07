import { eq, and } from 'drizzle-orm';
import { db, users, userInventory } from '@sakutina/db';
import { EconomyService } from './EconomyService.js';
import { InsufficientFundsError, ShopError } from '../utils/errors.js';
import { SHOP_ITEMS } from '../modules/economy/constants.js';
import type { ShopItemInfo } from '../modules/economy/types.js';

export class ShopService {
    public static getCatalog(): ShopItemInfo[] {
        return SHOP_ITEMS;
    }

    public static getItem(key: string): ShopItemInfo | undefined {
        return SHOP_ITEMS.find((i) => i.key === key);
    }

    /**
     * Get all items owned by a user in a guild.
     */
    public static async getInventory(discordId: string, guildId: string) {
        return db
            .select()
            .from(userInventory)
            .where(
                and(
                    eq(userInventory.discordId, discordId),
                    eq(userInventory.guildId, guildId)
                )
            );
    }

    public static async ownsItem(
        discordId: string,
        guildId: string,
        itemKey: string
    ): Promise<boolean> {
        const owned = await db
            .select()
            .from(userInventory)
            .where(
                and(
                    eq(userInventory.discordId, discordId),
                    eq(userInventory.guildId, guildId),
                    eq(userInventory.itemKey, itemKey)
                )
            )
            .then((res) => res[0]);
        return !!owned;
    }

    /**
     * Buy a cosmetic item. Atomically checks funds, deducts balance,
     * and grants the item.
     */
    public static async buyItem(
        discordId: string,
        guildId: string,
        itemKey: string
    ): Promise<ShopItemInfo> {
        const item = this.getItem(itemKey);
        if (!item) throw new ShopError('NOT_FOUND');

        await EconomyService.ensureUser(discordId, guildId);

        if (await this.ownsItem(discordId, guildId, itemKey)) {
            throw new ShopError('ALREADY_OWNED');
        }

        await db.transaction(async (tx) => {
            const debited = await EconomyService.tryDebit(
                discordId,
                guildId,
                item.price,
                tx
            );
            if (!debited) throw new InsufficientFundsError();

            await tx.insert(userInventory).values({
                discordId,
                guildId,
                itemKey,
            });

            await EconomyService.logTransaction(
                discordId,
                guildId,
                'shop_purchase',
                -item.price,
                `Bought ${item.name}`,
                tx
            );
        });

        return item;
    }

    /**
     * Equip a purchased title (or unequip with itemKey = null).
     */
    public static async equipTitle(
        discordId: string,
        guildId: string,
        itemKey: string | null
    ): Promise<void> {
        await EconomyService.ensureUser(discordId, guildId);

        if (itemKey && !(await this.ownsItem(discordId, guildId, itemKey))) {
            throw new ShopError('NOT_OWNED');
        }

        await db
            .update(users)
            .set({ equippedTitle: itemKey, updatedAt: new Date() })
            .where(
                and(eq(users.discordId, discordId), eq(users.guildId, guildId))
            );
    }
}

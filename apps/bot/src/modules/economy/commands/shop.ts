import { createCommandHandler } from '../../../utils/index.js';
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { ShopService } from '../../../services/ShopService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { ShopError, InsufficientFundsError } from '../../../utils/errors.js';
import { SHOP_ITEMS } from '../constants.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Buy cosmetic titles with your coins')
        .setDescriptionLocalizations({
            fr: 'Acheter des titres cosmétiques avec vos pièces',
        })
        .addSubcommand((sub) =>
            sub
                .setName('list')
                .setDescription('List all items in the shop')
                .setDescriptionLocalizations({
                    fr: 'Lister tous les articles de la boutique',
                })
        )
        .addSubcommand((sub) =>
            sub
                .setName('buy')
                .setDescription('Buy an item')
                .setDescriptionLocalizations({ fr: 'Acheter un article' })
                .addStringOption((option) =>
                    option
                        .setName('item')
                        .setDescription('The item to buy')
                        .setDescriptionLocalizations({
                            fr: "L'article à acheter",
                        })
                        .setRequired(true)
                        .addChoices(
                            SHOP_ITEMS.map((item) => ({
                                name: `${item.name} (${item.price})`,
                                value: item.key,
                            }))
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('inventory')
                .setDescription('View your owned items')
                .setDescriptionLocalizations({
                    fr: 'Voir vos articles possédés',
                })
        )
        .addSubcommand((sub) =>
            sub
                .setName('equip')
                .setDescription('Equip a title (or unequip)')
                .setDescriptionLocalizations({
                    fr: 'Équiper un titre (ou le retirer)',
                })
                .addStringOption((option) =>
                    option
                        .setName('item')
                        .setDescription('The item to equip')
                        .setDescriptionLocalizations({
                            fr: 'Le titre à équiper',
                        })
                        .setRequired(true)
                        .addChoices([
                            { name: 'None (unequip)', value: 'none' },
                            ...SHOP_ITEMS.map((item) => ({
                                name: item.name,
                                value: item.key,
                            })),
                        ])
                )
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const guildId = interaction.guildId ?? 'dm';
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'list') {
                const title = I18nService.translate('economy:SHOP_TITLE', {
                    lng: lang,
                });
                const desc = ShopService.getCatalog()
                    .map(
                        (item) =>
                            `**${item.name}** — ${item.price} \`${item.key}\``
                    )
                    .join('\n');
                const embed = EmbedUtils.base({
                    title,
                    description: desc,
                    color: '#9B59B6',
                    user: interaction.user,
                });
                await interaction.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'inventory') {
                const inventory = await ShopService.getInventory(
                    interaction.user.id,
                    guildId
                );
                const title = I18nService.translate(
                    'economy:SHOP_INVENTORY_TITLE',
                    { lng: lang }
                );
                if (inventory.length === 0) {
                    const embed = EmbedUtils.info(
                        I18nService.translate('economy:SHOP_INVENTORY_EMPTY', {
                            lng: lang,
                        }),
                        title,
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                const desc = inventory
                    .map((row) => {
                        const item = ShopService.getItem(row.itemKey);
                        return `• ${item ? item.name : row.itemKey}`;
                    })
                    .join('\n');
                const embed = EmbedUtils.base({
                    title,
                    description: desc,
                    color: '#9B59B6',
                    user: interaction.user,
                });
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (subcommand === 'buy') {
                const itemKey = interaction.options.getString('item', true);
                try {
                    const item = await ShopService.buyItem(
                        interaction.user.id,
                        guildId,
                        itemKey
                    );
                    const msg = I18nService.translate(
                        'economy:SHOP_BUY_SUCCESS',
                        { lng: lang, item: item.name, price: item.price }
                    );
                    const embed = EmbedUtils.success(
                        msg,
                        'Purchase Successful',
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                } catch (error: unknown) {
                    let msg = I18nService.translate('common:ERROR_GENERIC', {
                        lng: lang,
                    });
                    if (error instanceof InsufficientFundsError) {
                        msg = I18nService.translate(
                            'economy:INSUFFICIENT_FUNDS',
                            { lng: lang }
                        );
                    } else if (error instanceof ShopError) {
                        if (error.code === 'SHOP_ERR_ALREADY_OWNED') {
                            msg = I18nService.translate(
                                'economy:SHOP_ERR_ALREADY_OWNED',
                                { lng: lang }
                            );
                        } else if (error.code === 'SHOP_ERR_NOT_FOUND') {
                            msg = I18nService.translate(
                                'economy:SHOP_ERR_NOT_FOUND',
                                { lng: lang }
                            );
                        }
                    }
                    const embed = EmbedUtils.error(
                        msg,
                        'Error',
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return;
            }

            if (subcommand === 'equip') {
                const itemKey = interaction.options.getString('item', true);
                try {
                    const targetKey = itemKey === 'none' ? null : itemKey;
                    await ShopService.equipTitle(
                        interaction.user.id,
                        guildId,
                        targetKey
                    );
                    const item = targetKey
                        ? ShopService.getItem(targetKey)
                        : undefined;
                    const msg = item
                        ? I18nService.translate('economy:SHOP_EQUIP_SUCCESS', {
                              lng: lang,
                              item: item.name,
                          })
                        : I18nService.translate(
                              'economy:SHOP_UNEQUIP_SUCCESS',
                              { lng: lang }
                          );
                    const embed = EmbedUtils.success(
                        msg,
                        'Title Updated',
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (error: unknown) {
                    const msg =
                        error instanceof ShopError &&
                        error.code === 'SHOP_ERR_NOT_OWNED'
                            ? I18nService.translate(
                                  'economy:SHOP_ERR_NOT_OWNED',
                                  { lng: lang }
                              )
                            : I18nService.translate('common:ERROR_GENERIC', {
                                  lng: lang,
                              });
                    const embed = EmbedUtils.error(
                        msg,
                        'Error',
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        }
    ),
};

export default command;



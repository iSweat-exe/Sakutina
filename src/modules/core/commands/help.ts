import { createCommandHandler } from '../../../utils/index.js';
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { GuildConfigService } from '../../../services/GuildConfigService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import type { BotClient } from '../../../bot.js';

const CATEGORIES = {
    config: ['config'],
    core: ['dev', 'help'],
    economy: ['balance', 'bank', 'casino', 'daily', 'leaderboard', 'pay', 'quests', 'rob', 'work'],
    fun: ['ping', '8ball', 'interact', 'ask'],
    moderation: ['mod'],
    users: ['profile', 'remindme'],
} as const;

type CategoryKey = keyof typeof CATEGORIES;

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display the list of commands')
        .setDescriptionLocalizations({ fr: 'Afficher la liste des commandes' }),

    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        const title = I18nService.translate('common:HELP_TITLE', { lng: lang });
        const desc = I18nService.translate('common:HELP_DESC', { lng: lang });
        const placeholder = I18nService.translate(
            'common:HELP_SELECT_PLACEHOLDER',
            { lng: lang }
        );
        const embed = EmbedUtils.base({
            title,
            description: desc,
            color: '#3498DB',
            user: interaction.user,
        });
        const select = new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder(placeholder)
            .addOptions([
                {
                    label: I18nService.translate('common:HELP_CAT_CONFIG', {
                        lng: lang,
                    }),
                    value: 'config',
                    description: 'Configuration & Settings',
                },
                {
                    label: I18nService.translate('common:HELP_CAT_CORE', {
                        lng: lang,
                    }),
                    value: 'core',
                    description: 'System & Developer',
                },
                {
                    label: I18nService.translate('common:HELP_CAT_ECON', {
                        lng: lang,
                    }),
                    value: 'economy',
                    description: 'Currency, Jobs & Games',
                },
                {
                    label: I18nService.translate('common:HELP_CAT_FUN', {
                        lng: lang,
                    }),
                    value: 'fun',
                    description: 'Minigames & Fun',
                },
                {
                    label: I18nService.translate('common:HELP_CAT_MOD', {
                        lng: lang,
                    }),
                    value: 'moderation',
                    description: 'Server Moderation',
                },
                {
                    label: I18nService.translate('common:HELP_CAT_USERS', {
                        lng: lang,
                    }),
                    value: 'users',
                    description: 'User Profiles',
                },
            ]);
        const row =
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                select
            );
        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
        const collector = response.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60000,
            componentType: ComponentType.StringSelect,
        });
        collector.on('collect', async (i) => {
            const selectedCategory = i.values[0] as CategoryKey;
            const categoryCommandNames = CATEGORIES[selectedCategory];
            const client = interaction.client as BotClient;
            const allCommands = client.commandLoader.commands;
            let categoryDesc = '';
            for (const cmdName of categoryCommandNames) {
                const cmd = allCommands.get(cmdName);
                if (cmd) {
                    // Fallback mechanism to get local description
                    let cmdDesc = cmd.data.description;
                    const dataJson = cmd.data.toJSON();
                    if (
                        lang === 'fr' &&
                        dataJson.description_localizations &&
                        dataJson.description_localizations['fr']
                    ) {
                        cmdDesc = dataJson.description_localizations['fr'];
                    }
                    categoryDesc += `**\`/${cmdName}\`** - ${cmdDesc}\n\n`;
                }
            }
            const categoryTitle = I18nService.translate(
                `common:HELP_CAT_${selectedCategory.toUpperCase()}`,
                { lng: lang }
            );
            const categoryEmbed = EmbedUtils.info(
                categoryDesc || 'No commands found.',
                `📂 ${categoryTitle}`,
                interaction.user
            );
            await i.update({ embeds: [categoryEmbed], components: [row] });
        });
        collector.on('end', async () => {
            // Clean up the components after timeout
            try {
                await interaction.editReply({ components: [] });
            } catch (err) {
                // message might be deleted, ignore
            }
        });
    }),
};

export default command;

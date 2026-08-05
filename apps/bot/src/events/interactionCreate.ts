import type { Interaction } from 'discord.js';
import type { BotClient } from '../bot.js';
import type { Event } from '../types/Event.js';
import { logger } from '../utils/logger.js';
import {
    MessageFlags,
    DiscordAPIError,
    type InteractionReplyOptions,
} from 'discord.js';
import { I18nService } from '../services/I18nService.js';
import { GuildConfigService } from '../services/GuildConfigService.js';
import { GiveawayService } from '../services/GiveawayService.js';
import { AppError } from '../utils/errors.js';
import { handleInvestButton } from '../modules/economy/commands/invest.js';

const event: Event<'interactionCreate'> = {
    name: 'interactionCreate',
    async execute(interaction: Interaction) {
        if (interaction.isAutocomplete()) {
            const client = interaction.client as BotClient;
            const command = client.commandLoader.commands.get(
                interaction.commandName
            );
            if (command && command.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    logger.error(
                        `[Command:${interaction.commandName}] Autocomplete error:`,
                        error
                    );
                }
            }
            return;
        }

        if (interaction.isButton()) {
            const [namespace, action, rawId] = interaction.customId.split(':');
            if (namespace === 'giveaway' && action === 'join') {
                const giveawayId = Number(rawId);
                const lang = interaction.guildId
                    ? await GuildConfigService.getGuildLanguage(
                          interaction.guildId
                      )
                    : 'en';

                if (Number.isNaN(giveawayId)) {
                    logger.warn(
                        `[Button] Malformed giveaway customId: ${interaction.customId}`
                    );
                    return;
                }

                try {
                    const memberRoleIds = interaction.inCachedGuild()
                        ? interaction.member.roles.cache.map((r) => r.id)
                        : [];
                    const giveaway = await GiveawayService.enter(
                        giveawayId,
                        interaction.user.id,
                        memberRoleIds
                    );
                    const msg = I18nService.translate(
                        'social:GIVEAWAY_ENTER_SUCCESS',
                        { lng: lang, prize: giveaway.prize }
                    );
                    await interaction.reply({
                        content: msg,
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (error) {
                    // The generic AppError->embed fallback in commandHandler.ts
                    // only checks the 'common' namespace, so button-driven
                    // errors (which live in 'social') must be translated here.
                    const msg =
                        error instanceof AppError
                            ? I18nService.translate(`social:${error.code}`, {
                                  lng: lang,
                                  ...error.meta,
                              })
                            : I18nService.translate('common:ERROR_GENERIC', {
                                  lng: lang,
                              });
                    await interaction
                        .reply({
                            content: msg,
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => null);
                    if (!(error instanceof AppError)) {
                        logger.error(
                            '[Button:giveaway:join] Unexpected error:',
                            error
                        );
                    }
                }
            } else if (namespace === 'invest') {
                const lang = interaction.guildId
                    ? await GuildConfigService.getGuildLanguage(
                          interaction.guildId
                      )
                    : 'en';
                await handleInvestButton(interaction, lang);
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const client = interaction.client as BotClient;
        const command = client.commandLoader.commands.get(
            interaction.commandName
        );
        if (!command) {
            logger.warn(
                `[Command] Unknown command: ${interaction.commandName}`
            );
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            if (
                error instanceof DiscordAPIError &&
                (error.code === 10062 || error.code === 40060)
            ) {
                logger.warn(
                    `[Command:${interaction.commandName}] Interaction expired or already acknowledged.`
                );
                return;
            }

            logger.error(
                `[Command:${interaction.commandName}] Execution error:`,
                error
            );

            const lang = interaction.guildId
                ? await GuildConfigService.getGuildLanguage(interaction.guildId)
                : 'en';
            const replyPayload: InteractionReplyOptions = {
                content: I18nService.translate('common:ERR_COMMAND_EXECUTION', {
                    lng: lang,
                }),
                flags: MessageFlags.Ephemeral,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyPayload).catch(() => null);
            } else {
                await interaction.reply(replyPayload).catch(() => null);
            }
        }
    },
};

export default event;

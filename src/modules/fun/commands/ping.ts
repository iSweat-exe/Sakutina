import { MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { GuildConfigService } from '../../../services/GuildConfigService.js';

import { EmbedUtils } from '../../../utils/EmbedUtils.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!')
        .setNameLocalizations({ fr: 'latence' })
        .setDescriptionLocalizations({
            fr: 'Répond avec Pong et donne la latence',
        }),
    async execute(interaction: ChatInputCommandInteraction) {
        const lang = await GuildConfigService.getGuildLanguage(
            interaction.guildId
        );
        const message = I18nService.translate('common:PING_RESPONSE', {
            lng: lang,
        });
        const ping = interaction.client.ws.ping;

        const embed = EmbedUtils.info(
            `${message}\n\n**Websocket:** ${ping}ms`,
            '🏓 Pong!',
            interaction.user
        );

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default command;

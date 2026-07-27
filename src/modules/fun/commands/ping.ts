import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../types/Command.js";
import { I18nService } from "../../../services/I18nService.js";
import { GuildConfigService } from "../../../services/GuildConfigService.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
  async execute(interaction: ChatInputCommandInteraction) {
    const lang = await GuildConfigService.getGuildLanguage(interaction.guildId);
    const message = I18nService.translate("common:PING_RESPONSE", { lng: lang });
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
  },
};

export default command;

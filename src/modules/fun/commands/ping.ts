import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../types/Command.js";
import { I18nService } from "../../../services/I18nService.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
  async execute(interaction: ChatInputCommandInteraction) {
    // In a real scenario, you'd get the guild's language from a DB repo
    const lang = "fr";
    const message = I18nService.translate("common:PING_RESPONSE", { lng: lang });
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
  },
};

export default command;

import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../types/Command.js";
import { I18nService } from "../../../services/I18nService.js";
import { GuildConfigService } from "../../../services/GuildConfigService.js";
import { EconomyService } from "../../../services/EconomyService.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily reward"),
  async execute(interaction: ChatInputCommandInteraction) {
    const lang = await GuildConfigService.getGuildLanguage(interaction.guildId);

    try {
      // User choice: default is 500
      const newBalance = await EconomyService.claimDaily(interaction.user.id, 500);
      const msg = I18nService.translate("common:DAILY_SUCCESS", { lng: lang, amount: 500, balance: newBalance });
      await interaction.reply({ content: msg });
    } catch (error: any) {
      if (error.message.startsWith("COOLDOWN:")) {
        const hours = error.message.split(":")[1];
        const msg = I18nService.translate("common:DAILY_COOLDOWN", { lng: lang, hours });
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      } else {
        const msg = I18nService.translate("common:ERROR_GENERIC", { lng: lang });
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export default command;

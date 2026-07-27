import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../types/Command.js";
import { I18nService } from "../../../services/I18nService.js";
import { GuildConfigService } from "../../../services/GuildConfigService.js";
import { EconomyService } from "../../../services/EconomyService.js";
import { EmbedUtils } from "../../../utils/EmbedUtils.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setNameLocalizations({ fr: "payer" })
    .setDescription("Pay another user some coins")
    .setDescriptionLocalizations({ fr: "Payer quelques pièces à un autre utilisateur" })
    .addUserOption(option => 
      option
        .setName("user")
    .setNameLocalizations({ fr: "utilisateur" })
        .setDescription("The user to pay")
    .setDescriptionLocalizations({ fr: "L'utilisateur à payer" })
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
    .setNameLocalizations({ fr: "montant" })
        .setDescription("Amount to pay")
    .setDescriptionLocalizations({ fr: "Montant à payer" })
        .setRequired(true)
        .setMinValue(1)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const lang = await GuildConfigService.getGuildLanguage(interaction.guildId);
    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (targetUser.bot) {
      const msg = I18nService.translate("common:PAY_BOT_ERROR", { lng: lang });
      const embed = EmbedUtils.error(msg, "❌ Error", interaction.user);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      await EconomyService.payUser(interaction.user.id, targetUser.id, amount);
      const msg = I18nService.translate("common:PAY_SUCCESS", { lng: lang, amount, user: targetUser.toString() });
      const embed = EmbedUtils.success(msg, "✅ Payment Sent", interaction.user);
      await interaction.reply({ embeds: [embed] });
    } catch (error: any) {
      if (error.message === "CANNOT_PAY_SELF") {
        const msg = I18nService.translate("common:PAY_SELF_ERROR", { lng: lang });
        const embed = EmbedUtils.error(msg, "❌ Error", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (error.message === "INSUFFICIENT_FUNDS") {
        const msg = I18nService.translate("common:INSUFFICIENT_FUNDS", { lng: lang });
        const embed = EmbedUtils.error(msg, "❌ Insufficient Funds", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        const msg = I18nService.translate("common:ERROR_GENERIC", { lng: lang });
        const embed = EmbedUtils.error(msg, "❌ Error", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export default command;

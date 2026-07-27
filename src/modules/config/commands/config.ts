import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ChannelType } from "discord.js";
import type { Command } from "../../../types/Command.js";
import { I18nService } from "../../../services/I18nService.js";
import { GuildConfigService } from "../../../services/GuildConfigService.js";
import { EmbedUtils } from "../../../utils/EmbedUtils.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setNameLocalizations({ fr: "config" })
    .setDescription("Manage server configuration")
    .setDescriptionLocalizations({ fr: "Gérer la configuration du serveur" })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
    .setNameLocalizations({ fr: "voir" })
        .setDescription("View current server configuration")
    .setDescriptionLocalizations({ fr: "Voir la configuration actuelle du serveur" })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("language")
    .setNameLocalizations({ fr: "langue" })
        .setDescription("Change the server language")
    .setDescriptionLocalizations({ fr: "Changer la langue du serveur" })
        .addStringOption((option) =>
          option
            .setName("lang")
    .setNameLocalizations({ fr: "langue" })
            .setDescription("The language to set")
    .setDescriptionLocalizations({ fr: "La langue à définir" })
            .setRequired(true)
            .addChoices(
              { name: "English (en)", value: "en" },
              { name: "Français (fr)", value: "fr" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("modlog")
    .setNameLocalizations({ fr: "logs_modo" })
        .setDescription("Set the moderation log channel")
    .setDescriptionLocalizations({ fr: "Définir le salon des logs de modération" })
        .addChannelOption((option) =>
          option
            .setName("channel")
    .setNameLocalizations({ fr: "salon" })
            .setDescription("The channel to send moderation logs to")
    .setDescriptionLocalizations({ fr: "Le salon où envoyer les logs de modération" })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false) // leave empty to disable
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("maxwarns")
    .setNameLocalizations({ fr: "max_avertissements" })
        .setDescription("Set the max warnings before auto-ban")
    .setDescriptionLocalizations({ fr: "Définir le maximum d'avertissements avant un auto-ban" })
        .addIntegerOption((option) =>
          option
            .setName("amount")
    .setNameLocalizations({ fr: "montant" })
            .setDescription("Number of warnings (default 3)")
    .setDescriptionLocalizations({ fr: "Nombre d'avertissements (défaut 3)" })
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("modlog_warning")
    .setNameLocalizations({ fr: "alerte_logs_modo" })
        .setDescription("Toggle the reminder to set up a modlog channel")
    .setDescriptionLocalizations({ fr: "Activer ou désactiver le rappel pour configurer un salon de logs" })
        .addBooleanOption((option) =>
          option
            .setName("enabled")
    .setNameLocalizations({ fr: "active" })
            .setDescription("True to enable the warning, False to disable")
    .setDescriptionLocalizations({ fr: "Vrai pour activer l'alerte, Faux pour la désactiver" })
            .setRequired(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      const embed = EmbedUtils.error(I18nService.translate("common:ERR_ONLY_SERVER", { lng: "en" }), "❌ Error", interaction.user);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const currentLang = await GuildConfigService.getGuildLanguage(interaction.guildId);

    // Explicitly check for permissions just in case
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      const errorMsg = I18nService.translate("common:CONFIG_NO_PERM", { lng: currentLang });
      const embed = EmbedUtils.error(errorMsg, "❌ Access Denied", interaction.user);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "view") {
      const config = await GuildConfigService.getGuildSettings(interaction.guildId);
      const title = I18nService.translate("common:CONFIG_VIEW_TITLE", { lng: currentLang });
      const desc = I18nService.translate("common:CONFIG_VIEW_DESC", { lng: currentLang });
      const langLabel = I18nService.translate("common:CONFIG_VIEW_LANG", { lng: currentLang });

      const embed = EmbedUtils.base({
        title,
        description: desc,
        user: interaction.user
      }).addFields(
          { name: `🌐 ${langLabel}`, value: currentLang === "fr" ? "Français (fr)" : "English (en)", inline: true },
          { name: `🛡️ Mod Log`, value: config.modLogChannel ? `<#${config.modLogChannel}>` : "Disabled", inline: true },
          { name: `⚠️ Max Warns`, value: `${config.maxWarns} warns (Auto-Ban)`, inline: true }
        );

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } 
    else if (subcommand === "language") {
      const newLang = interaction.options.getString("lang", true) as "en" | "fr";
      await GuildConfigService.setLanguage(interaction.guildId, newLang);
      
      const successMsg = I18nService.translate("common:CONFIG_LANG_SUCCESS", { 
        lng: newLang, 
        lang: newLang === "fr" ? "Français" : "English" 
      });

      const embed = EmbedUtils.success(successMsg, "✅ Configuration Updated", interaction.user);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    else if (subcommand === "modlog") {
      const channel = interaction.options.getChannel("channel");
      await GuildConfigService.setModLogChannel(interaction.guildId, channel ? channel.id : null);
      const embed = EmbedUtils.success(
        I18nService.translate("common:CONFIG_MODLOG_SUCCESS", { lng: currentLang, state: channel ? `<#${channel.id}>` : "Disabled" }),
        "✅ Configuration Updated",
        interaction.user
      );
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    else if (subcommand === "maxwarns") {
      const amount = interaction.options.getInteger("amount", true);
      await GuildConfigService.setMaxWarns(interaction.guildId, amount);
      const embed = EmbedUtils.success(
        I18nService.translate("common:CONFIG_MAXWARNS_SUCCESS", { lng: currentLang, amount }),
        "✅ Configuration Updated",
        interaction.user
      );
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    else if (subcommand === "modlog_warning") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await GuildConfigService.setModLogWarning(interaction.guildId, enabled);
      const embed = EmbedUtils.success(
        I18nService.translate("common:CONFIG_MODLOG_WARNING_SUCCESS", { lng: currentLang, state: enabled ? "Enabled" : "Disabled" }),
        "✅ Configuration Updated",
        interaction.user
      );
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;

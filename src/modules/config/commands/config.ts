import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ChannelType } from "discord.js";
import type { Command } from "../../../types/Command.js";
import { I18nService } from "../../../services/I18nService.js";
import { GuildConfigService } from "../../../services/GuildConfigService.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Manage server configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View current server configuration")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("language")
        .setDescription("Change the server language")
        .addStringOption((option) =>
          option
            .setName("lang")
            .setDescription("The language to set")
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
        .setDescription("Set the moderation log channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to send moderation logs to")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false) // leave empty to disable
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("maxwarns")
        .setDescription("Set the max warnings before auto-ban")
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setDescription("Number of warnings (default 3)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("modlog_warning")
        .setDescription("Toggle the reminder to set up a modlog channel")
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("True to enable the warning, False to disable")
            .setRequired(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const currentLang = await GuildConfigService.getGuildLanguage(interaction.guildId);

    // Explicitly check for permissions just in case
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      const errorMsg = I18nService.translate("common:CONFIG_NO_PERM", { lng: currentLang });
      await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "view") {
      const config = await GuildConfigService.getGuildSettings(interaction.guildId);
      const title = I18nService.translate("common:CONFIG_VIEW_TITLE", { lng: currentLang });
      const desc = I18nService.translate("common:CONFIG_VIEW_DESC", { lng: currentLang });
      const langLabel = I18nService.translate("common:CONFIG_VIEW_LANG", { lng: currentLang });

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor("#5865F2")
        .addFields(
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

      await interaction.reply({ content: successMsg, flags: MessageFlags.Ephemeral });
    }
    else if (subcommand === "modlog") {
      const channel = interaction.options.getChannel("channel");
      await GuildConfigService.setModLogChannel(interaction.guildId, channel ? channel.id : null);
      await interaction.reply({ 
        content: I18nService.translate("common:CONFIG_MODLOG_SUCCESS", { lng: currentLang, state: channel ? `<#${channel.id}>` : "Disabled" }), 
        flags: MessageFlags.Ephemeral 
      });
    }
    else if (subcommand === "maxwarns") {
      const amount = interaction.options.getInteger("amount", true);
      await GuildConfigService.setMaxWarns(interaction.guildId, amount);
      await interaction.reply({ 
        content: I18nService.translate("common:CONFIG_MAXWARNS_SUCCESS", { lng: currentLang, amount }), 
        flags: MessageFlags.Ephemeral 
      });
    }
    else if (subcommand === "modlog_warning") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await GuildConfigService.setModLogWarning(interaction.guildId, enabled);
      await interaction.reply({ 
        content: I18nService.translate("common:CONFIG_MODLOG_WARNING_SUCCESS", { lng: currentLang, state: enabled ? "Enabled" : "Disabled" }), 
        flags: MessageFlags.Ephemeral 
      });
    }
  },
};

export default command;

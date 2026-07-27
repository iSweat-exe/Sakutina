import { MessageFlags, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../../types/Command.js";
import { I18nService } from "../../../services/I18nService.js";
import { GuildConfigService } from "../../../services/GuildConfigService.js";
import { ModerationService } from "../../../services/ModerationService.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("mod")
    .setNameLocalizations({ fr: "mod" })
    .setDescription("Moderation commands")
    .setDescriptionLocalizations({ fr: "Commandes de modération" })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => 
      sub
        .setName("warn")
    .setNameLocalizations({ fr: "avertir" })
        .setDescription("Warn a user")
    .setDescriptionLocalizations({ fr: "Avertir un utilisateur" })
        .addUserOption(opt => opt.setName("user")
    .setNameLocalizations({ fr: "utilisateur" }).setDescription("User to warn")
    .setDescriptionLocalizations({ fr: "Utilisateur à avertir" }).setRequired(true))
        .addStringOption(opt => opt.setName("reason")
    .setNameLocalizations({ fr: "raison" }).setDescription("Reason for the warning")
    .setDescriptionLocalizations({ fr: "Raison de l'avertissement" }).setRequired(false))
    )
    .addSubcommand(sub => 
      sub
        .setName("warnings")
    .setNameLocalizations({ fr: "avertissements" })
        .setDescription("View a user's warnings")
    .setDescriptionLocalizations({ fr: "Voir les avertissements d'un utilisateur" })
        .addUserOption(opt => opt.setName("user")
    .setNameLocalizations({ fr: "utilisateur" }).setDescription("User to check")
    .setDescriptionLocalizations({ fr: "Utilisateur à vérifier" }).setRequired(true))
    )
    .addSubcommand(sub => 
      sub
        .setName("stats")
    .setNameLocalizations({ fr: "statistiques" })
        .setDescription("View moderation statistics for a user")
    .setDescriptionLocalizations({ fr: "Voir les statistiques de modération d'un utilisateur" })
        .addUserOption(opt => opt.setName("user")
    .setNameLocalizations({ fr: "utilisateur" }).setDescription("User to check")
    .setDescriptionLocalizations({ fr: "Utilisateur à vérifier" }).setRequired(true))
    )
    .addSubcommand(sub => 
      sub
        .setName("clearwarns")
    .setNameLocalizations({ fr: "effaceravertissements" })
        .setDescription("Clear all warnings for a user")
    .setDescriptionLocalizations({ fr: "Effacer tous les avertissements d'un utilisateur" })
        .addUserOption(opt => opt.setName("user")
    .setNameLocalizations({ fr: "utilisateur" }).setDescription("User to clear")
    .setDescriptionLocalizations({ fr: "Utilisateur à effacer" }).setRequired(true))
    )
    .addSubcommand(sub => 
      sub
        .setName("mute")
    .setNameLocalizations({ fr: "rendre_muet" })
        .setDescription("Timeout a user")
    .setDescriptionLocalizations({ fr: "Rendre un utilisateur muet" })
        .addUserOption(opt => opt.setName("user")
    .setNameLocalizations({ fr: "utilisateur" }).setDescription("User to mute")
    .setDescriptionLocalizations({ fr: "Utilisateur à rendre muet" }).setRequired(true))
        .addIntegerOption(opt => opt.setName("duration")
    .setNameLocalizations({ fr: "duree" }).setDescription("Duration in minutes")
    .setDescriptionLocalizations({ fr: "Durée en minutes" }).setRequired(true))
        .addStringOption(opt => opt.setName("reason")
    .setNameLocalizations({ fr: "raison" }).setDescription("Reason for the mute")
    .setDescriptionLocalizations({ fr: "Raison de la mise sous silence" }).setRequired(false))
    )
    .addSubcommand(sub => 
      sub
        .setName("unmute")
    .setNameLocalizations({ fr: "retirer_muet" })
        .setDescription("Remove timeout from a user")
    .setDescriptionLocalizations({ fr: "Retirer le mode muet d'un utilisateur" })
        .addUserOption(opt => opt.setName("user")
    .setNameLocalizations({ fr: "utilisateur" }).setDescription("User to unmute")
    .setDescriptionLocalizations({ fr: "Utilisateur à ne plus rendre muet" }).setRequired(true))
        .addStringOption(opt => opt.setName("reason")
    .setNameLocalizations({ fr: "raison" }).setDescription("Reason")
    .setDescriptionLocalizations({ fr: "Raison" }).setRequired(false))
    )
    .addSubcommand(sub => 
      sub
        .setName("kick")
    .setNameLocalizations({ fr: "expulser" })
        .setDescription("Kick a user")
    .setDescriptionLocalizations({ fr: "Expulser un utilisateur" })
        .addUserOption(opt => opt.setName("user")
    .setNameLocalizations({ fr: "utilisateur" }).setDescription("User to kick")
    .setDescriptionLocalizations({ fr: "Utilisateur à expulser" }).setRequired(true))
        .addStringOption(opt => opt.setName("reason")
    .setNameLocalizations({ fr: "raison" }).setDescription("Reason for the kick")
    .setDescriptionLocalizations({ fr: "Raison de l'expulsion" }).setRequired(false))
    )
    .addSubcommand(sub => 
      sub
        .setName("ban")
    .setNameLocalizations({ fr: "bannir" })
        .setDescription("Ban a user")
    .setDescriptionLocalizations({ fr: "Bannir un utilisateur" })
        .addUserOption(opt => opt.setName("user")
    .setNameLocalizations({ fr: "utilisateur" }).setDescription("User to ban")
    .setDescriptionLocalizations({ fr: "Utilisateur à bannir" }).setRequired(true))
        .addStringOption(opt => opt.setName("reason")
    .setNameLocalizations({ fr: "raison" }).setDescription("Reason for the ban")
    .setDescriptionLocalizations({ fr: "Raison du bannissement" }).setRequired(false))
    )
    .addSubcommand(sub => 
      sub
        .setName("softban")
    .setNameLocalizations({ fr: "softban" })
        .setDescription("Ban and immediately unban a user (deletes recent messages)")
    .setDescriptionLocalizations({ fr: "Bannir et débannir immédiatement pour effacer les messages" })
        .addUserOption(opt => opt.setName("user")
    .setNameLocalizations({ fr: "utilisateur" }).setDescription("User to softban")
    .setDescriptionLocalizations({ fr: "Utilisateur à softban" }).setRequired(true))
        .addStringOption(opt => opt.setName("reason")
    .setNameLocalizations({ fr: "raison" }).setDescription("Reason")
    .setDescriptionLocalizations({ fr: "Raison" }).setRequired(false))
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const lang = await GuildConfigService.getGuildLanguage(interaction.guildId);
    const config = await GuildConfigService.getGuildSettings(interaction.guild.id);
    
    let warningMsg = "";
    if (config.modLogWarning && !config.modLogChannel) {
      warningMsg = "\n\n" + I18nService.translate("common:MOD_LOG_WARNING", { lng: lang });
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("user", true);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const reason = interaction.options.getString("reason") || "No reason provided";

    if (targetUser.id === interaction.client.user.id || targetUser.id === interaction.guild.ownerId) {
      await interaction.reply({ content: I18nService.translate("common:MOD_ERR_INVALID_TARGET", { lng: lang }), flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "warn") {
      if (!targetMember) {
        await interaction.reply({ content: I18nService.translate("common:MOD_ERR_NOT_IN_GUILD", { lng: lang }), flags: MessageFlags.Ephemeral });
        return;
      }
      
      const res = await ModerationService.warn(interaction.guild, targetMember, interaction.user, reason);
      
      let replyContent = I18nService.translate("common:MOD_WARN_SUCCESS", { lng: lang, user: targetUser.tag, reason, warns: res.warnsCount, max: res.maxWarns });
      if (res.autobanned) {
        replyContent += "\n" + I18nService.translate("common:MOD_AUTOBAN_TRIGGERED", { lng: lang, user: targetUser.tag });
      }

      await interaction.reply({ content: replyContent + warningMsg, flags: MessageFlags.Ephemeral });
    } 
    else if (subcommand === "warnings") {
      const warns = await ModerationService.getWarnings(interaction.guild.id, targetUser.id);
      if (warns.length === 0) {
        await interaction.reply({ content: I18nService.translate("common:MOD_WARNINGS_EMPTY", { lng: lang, user: targetUser.tag }), flags: MessageFlags.Ephemeral });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(I18nService.translate("common:MOD_WARNINGS_TITLE", { lng: lang, user: targetUser.tag }))
        .setColor("#F1C40F");

      let desc = "";
      for (const w of warns) {
        desc += `**ID:** ${w.id} | **Mod:** <@${w.moderatorId}>\n**Reason:** ${w.reason}\n**Date:** <t:${Math.floor(w.createdAt.getTime() / 1000)}:f>\n\n`;
      }
      embed.setDescription(desc);

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    else if (subcommand === "stats") {
      const stats = await ModerationService.getModStats(targetUser.id);
      const warns = await ModerationService.getWarnings(interaction.guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle(I18nService.translate("common:MOD_STATS_TITLE", { lng: lang, user: targetUser.tag }))
        .setColor("#3498DB")
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: "⚠️ Warnings", value: `${warns.length}`, inline: true },
          { name: "🔇 Mutes", value: `${stats.mutes}`, inline: true },
          { name: "👢 Kicks", value: `${stats.kicks}`, inline: true },
          { name: "🔨 Bans", value: `${stats.bans}`, inline: true }
        );

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    else if (subcommand === "clearwarns") {
      const deleted = await ModerationService.clearWarnings(interaction.guild, targetUser, interaction.user, reason);
      await interaction.reply({ 
        content: I18nService.translate("common:MOD_CLEARWARNS_SUCCESS", { lng: lang, user: targetUser.tag, count: deleted }) + warningMsg, 
        flags: MessageFlags.Ephemeral 
      });
    }
    else if (subcommand === "mute") {
      if (!targetMember) return;
      const duration = interaction.options.getInteger("duration", true);
      
      try {
        await targetMember.timeout(duration * 60 * 1000, reason);
        await ModerationService.sendLog(interaction.guild, "MUTE", targetUser, interaction.user, reason, `Duration: ${duration} minutes`);
        await ModerationService.logModActionStats(targetUser.id, "MUTE");
        await interaction.reply({ 
          content: I18nService.translate("common:MOD_MUTE_SUCCESS", { lng: lang, user: targetUser.tag, duration, reason }) + warningMsg, 
          flags: MessageFlags.Ephemeral 
        });
      } catch (e) {
        await interaction.reply({ content: I18nService.translate("common:MOD_ERR_NO_PERM", { lng: lang }), flags: MessageFlags.Ephemeral });
      }
    }
    else if (subcommand === "unmute") {
      if (!targetMember) return;
      try {
        await targetMember.timeout(null, reason);
        await ModerationService.sendLog(interaction.guild, "UNMUTE", targetUser, interaction.user, reason);
        await interaction.reply({ 
          content: I18nService.translate("common:MOD_UNMUTE_SUCCESS", { lng: lang, user: targetUser.tag, reason }) + warningMsg, 
          flags: MessageFlags.Ephemeral 
        });
      } catch (e) {
        await interaction.reply({ content: I18nService.translate("common:MOD_ERR_NO_PERM", { lng: lang }), flags: MessageFlags.Ephemeral });
      }
    }
    else if (subcommand === "kick") {
      if (!targetMember) return;
      try {
        await targetMember.kick(reason);
        await ModerationService.sendLog(interaction.guild, "KICK", targetUser, interaction.user, reason);
        await ModerationService.logModActionStats(targetUser.id, "KICK");
        await interaction.reply({ 
          content: I18nService.translate("common:MOD_KICK_SUCCESS", { lng: lang, user: targetUser.tag, reason }) + warningMsg, 
          flags: MessageFlags.Ephemeral 
        });
      } catch (e) {
        await interaction.reply({ content: I18nService.translate("common:MOD_ERR_NO_PERM", { lng: lang }), flags: MessageFlags.Ephemeral });
      }
    }
    else if (subcommand === "ban") {
      try {
        await interaction.guild.members.ban(targetUser, { reason });
        await ModerationService.sendLog(interaction.guild, "BAN", targetUser, interaction.user, reason);
        await ModerationService.logModActionStats(targetUser.id, "BAN");
        await interaction.reply({ 
          content: I18nService.translate("common:MOD_BAN_SUCCESS", { lng: lang, user: targetUser.tag, reason }) + warningMsg, 
          flags: MessageFlags.Ephemeral 
        });
      } catch (e) {
        await interaction.reply({ content: I18nService.translate("common:MOD_ERR_NO_PERM", { lng: lang }), flags: MessageFlags.Ephemeral });
      }
    }
    else if (subcommand === "softban") {
      try {
        await interaction.guild.members.ban(targetUser, { reason, deleteMessageSeconds: 604800 }); // 7 days
        await interaction.guild.members.unban(targetUser, "Softban complete");
        await ModerationService.sendLog(interaction.guild, "SOFTBAN", targetUser, interaction.user, reason);
        await ModerationService.logModActionStats(targetUser.id, "BAN");
        await interaction.reply({ 
          content: I18nService.translate("common:MOD_SOFTBAN_SUCCESS", { lng: lang, user: targetUser.tag, reason }) + warningMsg, 
          flags: MessageFlags.Ephemeral 
        });
      } catch (e) {
        await interaction.reply({ content: I18nService.translate("common:MOD_ERR_NO_PERM", { lng: lang }), flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export default command;

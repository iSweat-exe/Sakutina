import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from "discord.js";
import type { Command } from "../../../types/Command.js";
import { I18nService } from "../../../services/I18nService.js";
import { GuildConfigService } from "../../../services/GuildConfigService.js";
import { AVAILABLE_JOBS, WorkService } from "../../../services/WorkService.js";
import { EmbedUtils } from "../../../utils/EmbedUtils.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setNameLocalizations({ fr: "travail" })
    .setDescription("Work system commands")
    .setDescriptionLocalizations({ fr: "Commandes du système de travail" })
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
    .setNameLocalizations({ fr: "liste" })
        .setDescription("List available jobs")
    .setDescriptionLocalizations({ fr: "Lister les métiers disponibles" })
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("join")
    .setNameLocalizations({ fr: "rejoindre" })
        .setDescription("Join a job")
        .setDescriptionLocalizations({ fr: "Rejoindre un métier" })
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("leave")
    .setNameLocalizations({ fr: "quitter" })
        .setDescription("Leave your current job")
    .setDescriptionLocalizations({ fr: "Quitter votre métier actuel" })
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("stats")
    .setNameLocalizations({ fr: "statistiques" })
        .setDescription("View your work statistics")
    .setDescriptionLocalizations({ fr: "Voir vos statistiques de travail" })
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("shift")
    .setNameLocalizations({ fr: "service" })
        .setDescription("Work a shift to earn money")
    .setDescriptionLocalizations({ fr: "Faire un service pour gagner de l'argent" })
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const lang = await GuildConfigService.getGuildLanguage(interaction.guildId);
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === "list") {
        const title = I18nService.translate("common:WORK_LIST_TITLE", { lng: lang });
        const embed = EmbedUtils.base({
          title,
          color: "#3498DB",
          user: interaction.user
        });
        
        let desc = "";
        for (const job of AVAILABLE_JOBS) {
          desc += `**${job.title}** (ID: \`${job.id}\`)\n`;
          desc += `└ Exp required: ${job.minExperience} | Salary: ${job.salaryMin}-${job.salaryMax}\n\n`;
        }
        embed.setDescription(desc);
        
        await interaction.reply({ embeds: [embed] });
      } 
      else if (subcommand === "join") {
        const stats = await WorkService.getStats(interaction.user.id);
        const embed = EmbedUtils.base({
          title: "Job Application",
          color: "#3498DB",
          user: interaction.user
        }).setDescription(lang === "fr" ? "Veuillez sélectionner le métier que vous souhaitez rejoindre ci-dessous." : "Please select the job you wish to join below.");

        const select = new StringSelectMenuBuilder()
          .setCustomId("work_join_select")
          .setPlaceholder(lang === "fr" ? "Choisissez un métier..." : "Choose a job...")
          .addOptions(AVAILABLE_JOBS.map(j => ({
            label: j.title,
            description: `Salary: ${j.salaryMin}-${j.salaryMax} | Req Exp: ${j.minExperience}`,
            value: j.id
          })));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

        const response = await interaction.reply({ embeds: [embed], components: [row] });

        try {
          const confirmation = await response.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60000,
            componentType: ComponentType.StringSelect
          });

          const jobId = confirmation.values[0]!;
          
          try {
            const job = await WorkService.joinJob(interaction.user.id, jobId);
            const msg = I18nService.translate("common:WORK_JOIN_SUCCESS", { lng: lang, job: job!.title });
            const successEmbed = EmbedUtils.success(msg, "Job Joined", interaction.user);
            await confirmation.update({ embeds: [successEmbed], components: [] });
          } catch (err: any) {
            let errorMsg = I18nService.translate("common:ERROR_GENERIC", { lng: lang });
            if (err.message === "ALREADY_HAVE_JOB") errorMsg = I18nService.translate("common:WORK_ERR_ALREADY", { lng: lang });
            else if (err.message === "INSUFFICIENT_EXPERIENCE") errorMsg = I18nService.translate("common:WORK_ERR_EXP", { lng: lang });
            else if (err.message === "JOB_NOT_FOUND") errorMsg = I18nService.translate("common:WORK_ERR_NOT_FOUND", { lng: lang });
            
            const errEmbed = EmbedUtils.error(errorMsg, "Error", interaction.user);
            await confirmation.update({ embeds: [errEmbed], components: [] });
          }
        } catch (e) {
          const timeoutEmbed = EmbedUtils.warn(lang === "fr" ? "Temps écoulé pour choisir un métier." : "You took too long to select a job.", "Timeout", interaction.user);
          await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
        }
      } 
      else if (subcommand === "leave") {
        await WorkService.leaveJob(interaction.user.id);
        const msg = I18nService.translate("common:WORK_LEAVE_SUCCESS", { lng: lang });
        const embed = EmbedUtils.success(msg, "Job Left", interaction.user);
        await interaction.reply({ embeds: [embed] });
      }
      else if (subcommand === "stats") {
        const stats = await WorkService.getStats(interaction.user.id);
        const title = I18nService.translate("common:WORK_STATS_TITLE", { lng: lang });
        
        const embed = EmbedUtils.base({
          title,
          color: "#9B59B6",
          user: interaction.user
        })
          .addFields(
            { name: "Current Job", value: stats.currentJob || "None", inline: true },
            { name: "Experience", value: `${stats.experience}`, inline: true },
            { name: "Total Shifts", value: `${stats.shiftsDone}`, inline: true }
          );
          
        await interaction.reply({ embeds: [embed] });
      }
      else if (subcommand === "shift") {
        const result = await WorkService.workShift(interaction.user.id);
        const msg = I18nService.translate("common:WORK_SHIFT_SUCCESS", { 
          lng: lang, 
          job: result.jobTitle, 
          salary: result.salary, 
          exp: result.expGain 
        });
        const embed = EmbedUtils.success(msg, "Work Shift Complete", interaction.user);
        await interaction.reply({ embeds: [embed] });
      }
    } catch (error: any) {
      if (error.message === "JOB_NOT_FOUND") {
        const msg = I18nService.translate("common:WORK_ERR_NOT_FOUND", { lng: lang });
        const embed = EmbedUtils.error(msg, "Error", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (error.message === "ALREADY_HAVE_JOB") {
        const msg = I18nService.translate("common:WORK_ERR_ALREADY", { lng: lang });
        const embed = EmbedUtils.error(msg, "Error", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (error.message === "INSUFFICIENT_EXPERIENCE") {
        const msg = I18nService.translate("common:WORK_ERR_EXP", { lng: lang });
        const embed = EmbedUtils.error(msg, "Error", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (error.message === "NO_JOB") {
        const msg = I18nService.translate("common:WORK_ERR_NO_JOB", { lng: lang });
        const embed = EmbedUtils.error(msg, "Error", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (error.message === "JOB_REMOVED") {
        const msg = I18nService.translate("common:WORK_ERR_REMOVED", { lng: lang });
        const embed = EmbedUtils.error(msg, "Error", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else if (error.message.startsWith("COOLDOWN:")) {
        const seconds = error.message.split(":")[1];
        const msg = I18nService.translate("common:WORK_ERR_COOLDOWN", { lng: lang, seconds });
        const embed = EmbedUtils.warn(msg, "Cooldown", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        const msg = I18nService.translate("common:ERROR_GENERIC", { lng: lang });
        const embed = EmbedUtils.error(msg, "Error", interaction.user);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export default command;

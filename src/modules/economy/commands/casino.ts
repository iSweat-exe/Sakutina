import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../types/Command.js";
import { I18nService } from "../../../services/I18nService.js";
import { GuildConfigService } from "../../../services/GuildConfigService.js";
import { CasinoService } from "../../../services/CasinoService.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("casino")
    .setNameLocalizations({ fr: "casino" })
    .setDescription("Play casino minigames")
    .setDescriptionLocalizations({ fr: "Jouer aux mini-jeux du casino" })
    .addSubcommand(subcommand =>
      subcommand
        .setName("doubleornothing")
    .setNameLocalizations({ fr: "quitteoudouble" })
        .setDescription("50% chance to double your bet")
    .setDescriptionLocalizations({ fr: "50% de chance de doubler votre mise" })
        .addIntegerOption(option => 
          option
            .setName("bet")
    .setNameLocalizations({ fr: "mise" })
            .setDescription("Amount to bet")
    .setDescriptionLocalizations({ fr: "Montant à miser" })
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("coinflip")
    .setNameLocalizations({ fr: "pileouface" })
        .setDescription("Bet on heads or tails")
    .setDescriptionLocalizations({ fr: "Parier sur pile ou face" })
        .addStringOption(option => 
          option
            .setName("choice")
    .setNameLocalizations({ fr: "choix" })
            .setDescription("Heads or tails")
    .setDescriptionLocalizations({ fr: "Pile ou face" })
            .setRequired(true)
            .addChoices(
              { name: "Heads", value: "heads" },
              { name: "Tails", value: "tails" }
            )
        )
        .addIntegerOption(option => 
          option
            .setName("bet")
    .setNameLocalizations({ fr: "mise" })
            .setDescription("Amount to bet")
    .setDescriptionLocalizations({ fr: "Montant à miser" })
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("rps")
    .setNameLocalizations({ fr: "pfc" })
        .setDescription("Rock Paper Scissors against the bot")
    .setDescriptionLocalizations({ fr: "Pierre Papier Ciseaux contre le bot" })
        .addStringOption(option => 
          option
            .setName("choice")
    .setNameLocalizations({ fr: "choix" })
            .setDescription("Rock, paper, or scissors")
    .setDescriptionLocalizations({ fr: "Pierre, papier ou ciseaux" })
            .setRequired(true)
            .addChoices(
              { name: "Rock", value: "rock" },
              { name: "Paper", value: "paper" },
              { name: "Scissors", value: "scissors" }
            )
        )
        .addIntegerOption(option => 
          option
            .setName("bet")
    .setNameLocalizations({ fr: "mise" })
            .setDescription("Amount to bet")
    .setDescriptionLocalizations({ fr: "Montant à miser" })
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("slots")
    .setNameLocalizations({ fr: "machineasous" })
        .setDescription("Play the slot machine")
    .setDescriptionLocalizations({ fr: "Jouer à la machine à sous" })
        .addIntegerOption(option => 
          option
            .setName("bet")
    .setNameLocalizations({ fr: "mise" })
            .setDescription("Amount to bet")
    .setDescriptionLocalizations({ fr: "Montant à miser" })
            .setRequired(true)
            .setMinValue(1)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const lang = await GuildConfigService.getGuildLanguage(interaction.guildId);
    const subcommand = interaction.options.getSubcommand();
    const bet = interaction.options.getInteger("bet", true);

    try {
      if (subcommand === "doubleornothing") {
        const result = await CasinoService.doubleOrNothing(interaction.user.id, bet);
        
        if (result.win) {
          const msg = I18nService.translate("common:CASINO_DON_WIN", { lng: lang, bet, won: result.amount });
          await interaction.reply({ content: msg });
        } else {
          const msg = I18nService.translate("common:CASINO_DON_LOSE", { lng: lang, bet });
          await interaction.reply({ content: msg });
        }
      } 
      else if (subcommand === "coinflip") {
        const choice = interaction.options.getString("choice", true) as "heads" | "tails";
        const result = await CasinoService.coinflip(interaction.user.id, bet, choice);
        
        const localizedResult = I18nService.translate(`common:CASINO_COIN_${result.result.toUpperCase()}`, { lng: lang });
        
        if (result.win) {
          const msg = I18nService.translate("common:CASINO_COIN_WIN", { lng: lang, bet, result: localizedResult, won: result.amount });
          await interaction.reply({ content: msg });
        } else {
          const msg = I18nService.translate("common:CASINO_COIN_LOSE", { lng: lang, bet, result: localizedResult });
          await interaction.reply({ content: msg });
        }
      }
      else if (subcommand === "rps") {
        const choice = interaction.options.getString("choice", true) as "rock" | "paper" | "scissors";
        const result = await CasinoService.rps(interaction.user.id, bet, choice);
        
        const botChoiceLoc = I18nService.translate(`common:CASINO_RPS_${result.botChoice!.toUpperCase()}`, { lng: lang });
        const userChoiceLoc = I18nService.translate(`common:CASINO_RPS_${choice.toUpperCase()}`, { lng: lang });

        if (result.state === "win") {
          const msg = I18nService.translate("common:CASINO_RPS_WIN", { lng: lang, bot: botChoiceLoc, user: userChoiceLoc, won: result.returnAmount });
          await interaction.reply({ content: msg });
        } else if (result.state === "lose") {
          const msg = I18nService.translate("common:CASINO_RPS_LOSE", { lng: lang, bot: botChoiceLoc, user: userChoiceLoc, bet });
          await interaction.reply({ content: msg });
        } else {
          const msg = I18nService.translate("common:CASINO_RPS_TIE", { lng: lang, bot: botChoiceLoc, user: userChoiceLoc });
          await interaction.reply({ content: msg });
        }
      }
      else if (subcommand === "slots") {
        const result = await CasinoService.slots(interaction.user.id, bet);
        
        const embed = new EmbedBuilder()
          .setTitle("🎰 SLOTS 🎰")
          .setColor(result.win ? "#2ECC71" : "#E74C3C")
          .setDescription(`
**[ ${result.reels.join(" | ")} ]**

${result.win 
  ? I18nService.translate("common:CASINO_SLOTS_WIN", { lng: lang, won: result.winAmount }) 
  : I18nService.translate("common:CASINO_SLOTS_LOSE", { lng: lang, bet })}
`);

        await interaction.reply({ embeds: [embed] });
      }
    } catch (error: any) {
      if (error.message === "INSUFFICIENT_FUNDS") {
        const msg = I18nService.translate("common:INSUFFICIENT_FUNDS", { lng: lang });
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      } else {
        const msg = I18nService.translate("common:ERROR_GENERIC", { lng: lang });
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export default command;

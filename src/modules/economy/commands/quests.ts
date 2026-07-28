import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { createCommandHandler } from '../../../utils/index.js';
import { QuestService, QUESTS_CONFIG } from '../../../services/QuestService.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('quests')
        .setDescription('View your daily and weekly quests')
        .setNameLocalizations({ fr: 'quetes' })
        .setDescriptionLocalizations({ fr: 'Voir vos quêtes quotidiennes et hebdomadaires' }),
    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        const userQuests = await QuestService.getUserQuests(interaction.user.id);
        
        const embed = EmbedUtils.base({
            title: I18nService.translate('common:QUESTS_TITLE', { lng: lang }),
            color: '#9B59B6',
            user: interaction.user,
        });

        const dailyQuests = userQuests.filter(q => q.type === 'daily');
        const weeklyQuests = userQuests.filter(q => q.type === 'weekly');

        const formatQuest = (q: any, configList: any[]) => {
            const config = configList.find(c => c.id === q.questId);
            if (!config) return 'Unknown quest';
            const status = q.completed ? '✅' : `(${q.progress}/${q.target})`;
            const rewardText = I18nService.translate('common:QUEST_REWARD', { lng: lang, reward: config.reward });
            const desc = I18nService.translate(`common:QUEST_DESC_${config.id}`, { lng: lang });
            return `**${desc}** - ${status}\n${rewardText}`;
        };

        let dailyDesc = dailyQuests.length > 0 
            ? dailyQuests.map(q => formatQuest(q, QUESTS_CONFIG.daily)).join('\n\n')
            : I18nService.translate('common:QUESTS_NO_DAILY', { lng: lang });
        
        let weeklyDesc = weeklyQuests.length > 0 
            ? weeklyQuests.map(q => formatQuest(q, QUESTS_CONFIG.weekly)).join('\n\n')
            : I18nService.translate('common:QUESTS_NO_WEEKLY', { lng: lang });

        embed.addFields(
            { name: I18nService.translate('common:QUESTS_DAILY_LABEL', { lng: lang }), value: dailyDesc },
            { name: I18nService.translate('common:QUESTS_WEEKLY_LABEL', { lng: lang }), value: weeklyDesc }
        );

        await interaction.reply({ embeds: [embed] });
    }),
};

export default command;

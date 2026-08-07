import {
    ChatInputCommandInteraction,
    GuildMember,
    MessageFlags,
    User,
} from 'discord.js';
import { I18nService } from '@/services/I18nService.js';
import { ModerationService } from '@/services/ModerationService.js';
import { EmbedUtils } from './EmbedUtils.js';
import { logger } from './logger.js';

export type ModActionType = 'MUTE' | 'UNMUTE' | 'KICK' | 'BAN' | 'SOFTBAN';

export interface PerformModActionOptions {
    interaction: ChatInputCommandInteraction;
    lang: string;
    targetUser: User;
    /** Fetched guild member for the target, when required (e.g. mute/unmute). */
    targetMember?: GuildMember | null;
    /** If true and targetMember is missing, the action is silently skipped. */
    requireMember?: boolean;
    reason: string;
    warningMsg: string;
    action: ModActionType;
    /** Performs the actual Discord API call (timeout, kick, ban, ...). */
    apiCall: () => Promise<unknown>;
    /** Extra detail appended to the mod-log embed, e.g. mute duration. */
    logDetails?: string;
    /** When the action expires (mute), passed through to logAction. */
    expiresAt?: Date;
    successKey: string;
    successVars?: Record<string, unknown>;
    successTitle: string;
}

/**
 * Shared "fetch target -> call Discord API -> log -> success embed" flow
 * used by every /mod sub-command that performs a moderation action
 * (mute/unmute/kick/ban/softban). On failure it logs the error and replies
 * with the generic "no permission" embed.
 */
export async function performModAction(
    options: PerformModActionOptions
): Promise<void> {
    const {
        interaction,
        lang,
        targetUser,
        targetMember,
        requireMember,
        reason,
        warningMsg,
        action,
        apiCall,
        logDetails,
        expiresAt,
        successKey,
        successVars,
        successTitle,
    } = options;

    if (requireMember && !targetMember) return;

    const guild = interaction.guild!;
    try {
        await apiCall();
        await ModerationService.sendLog(
            guild,
            action,
            targetUser,
            interaction.user,
            reason,
            logDetails
        );
        await ModerationService.logAction(
            guild.id,
            targetUser.id,
            interaction.user.id,
            action,
            reason,
            expiresAt
        );
        const embed = EmbedUtils.success(
            I18nService.translate(successKey, {
                lng: lang,
                user: targetUser.tag,
                reason,
                ...successVars,
            }) + warningMsg,
            successTitle,
            interaction.user
        );
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    } catch (e) {
        logger.error(
            `[Mod:${action.toLowerCase()}] Failed to ${action.toLowerCase()} ${targetUser.id} in ${guild.id}`,
            e
        );
        const embed = EmbedUtils.error(
            I18nService.translate('mod:MOD_ERR_NO_PERM', { lng: lang }),
            'Error',
            interaction.user
        );
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}

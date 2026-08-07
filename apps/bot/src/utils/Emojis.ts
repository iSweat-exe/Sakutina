import { formatEmoji } from 'discord.js';

type EmojiDefinition = string | { id: string; animated?: boolean };

/**
 * Registry of custom emojis uploaded to the bot's application (Developer
 * Portal → Emojis). To add a new one, paste its snowflake id here — value can
 * be the id directly, or `{ id, animated: true }` for animated emojis.
 */
const EMOJI_IDS = {
    Coins: '1535213368753782794',
} as const satisfies Record<string, EmojiDefinition>;

function normalize(def: EmojiDefinition): { id: string; animated?: boolean } {
    return typeof def === 'string' ? { id: def } : def;
}

function buildEmojis<T extends Record<string, EmojiDefinition>>(
    defs: T
): Record<keyof T, string> {
    const entries = Object.entries(defs).map(([name, def]) => {
        const { id, animated } = normalize(def);
        return [name, formatEmoji({ id, name, animated })];
    });
    return Object.fromEntries(entries) as Record<keyof T, string>;
}

/**
 * Pre-formatted custom emoji tags (e.g. `<:Coins:1535213368753782794>`),
 * ready to drop into embeds/messages directly or as i18next interpolation
 * values, e.g. `I18nService.translate('economy:KEY', { lng, coinsIcon: Emojis.Coins })`
 * with `"KEY": "You earned {{amount}} {{coinsIcon}}"` in the locale file.
 */
export const Emojis = buildEmojis(EMOJI_IDS);

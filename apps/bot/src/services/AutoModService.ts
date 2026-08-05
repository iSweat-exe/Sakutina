const SPAM_WINDOW_MS = 6000;
const SPAM_THRESHOLD = 5;
const LINK_REGEX = /https?:\/\/\S+/i;

export class AutoModService {
    private static messageTimestamps = new Map<string, number[]>();

    /**
     * Records a message from a user and returns true if they've crossed
     * the spam threshold (N messages within the sliding window).
     */
    public static checkSpam(guildId: string, userId: string): boolean {
        const key = `${guildId}:${userId}`;
        const now = Date.now();
        const recent = (this.messageTimestamps.get(key) ?? []).filter(
            (t) => now - t < SPAM_WINDOW_MS
        );
        recent.push(now);
        this.messageTimestamps.set(key, recent);
        return recent.length >= SPAM_THRESHOLD;
    }

    public static containsLink(content: string): boolean {
        return LINK_REGEX.test(content);
    }
}

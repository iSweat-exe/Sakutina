const SPAM_WINDOW_MS = 6000;
const SPAM_THRESHOLD = 5;
const LINK_REGEX = /https?:\/\/\S+/i;
const SWEEP_INTERVAL_MS = 60_000;

export class AutoModService {
    private static messageTimestamps = new Map<string, number[]>();

    static {
        // Evict entries whose timestamps have all fallen outside the spam
        // window, so users who stop messaging don't accumulate forever in
        // this map over the bot's process lifetime.
        setInterval(() => {
            const now = Date.now();
            for (const [key, timestamps] of this.messageTimestamps) {
                const recent = timestamps.filter(
                    (t) => now - t < SPAM_WINDOW_MS
                );
                if (recent.length === 0) {
                    this.messageTimestamps.delete(key);
                } else if (recent.length !== timestamps.length) {
                    this.messageTimestamps.set(key, recent);
                }
            }
        }, SWEEP_INTERVAL_MS).unref();
    }

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

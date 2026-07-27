import { eq } from "drizzle-orm";
import { db } from "../repositories/db.js";
import { guildSettings } from "../repositories/schema.js";

export interface GuildSettings {
  id: number;
  guildId: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export class GuildConfigService {
  private static cache = new Map<string, GuildSettings>();

  /**
   * Get guild settings from cache or database.
   * If they don't exist, create default settings.
   */
  public static async getGuildSettings(guildId: string): Promise<GuildSettings> {
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId)!;
    }

    let settings = await db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).then(res => res[0]);

    if (!settings) {
      settings = (await db.insert(guildSettings).values({
        guildId,
        language: "en",
      }).returning().then(res => res[0]))!;
    }

    this.cache.set(guildId, settings);
    return settings;
  }

  /**
   * Update the language for a guild.
   */
  public static async setLanguage(guildId: string, language: "en" | "fr"): Promise<GuildSettings> {
    const updated = (await db.insert(guildSettings)
      .values({ guildId, language })
      .onConflictDoUpdate({
        target: guildSettings.guildId,
        set: { language, updatedAt: new Date() },
      })
      .returning().then(res => res[0]))!;

    this.cache.set(guildId, updated);
    return updated;
  }

  /**
   * Helper to quickly get the guild's configured language.
   * Defaults to "en" if no guildId is provided (e.g. for DMs).
   */
  public static async getGuildLanguage(guildId?: string | null): Promise<string> {
    if (!guildId) return "en";
    const settings = await this.getGuildSettings(guildId);
    return settings.language;
  }
}

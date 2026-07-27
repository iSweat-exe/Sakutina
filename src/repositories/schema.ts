import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  experience: integer("experience").default(0).notNull(),
  balance: integer("balance").default(0).notNull(),
  bank: integer("bank").default(0).notNull(),
  dailyLastClaim: timestamp("daily_last_claim"),
  currentJob: text("current_job"),
  workShiftsDone: integer("work_shifts_done").default(0).notNull(),
  workLastShift: timestamp("work_last_shift"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const guildSettings = pgTable("guild_settings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  language: text("language").default("en").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

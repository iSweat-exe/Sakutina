CREATE TABLE "marriages" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user1_id" text NOT NULL,
	"user2_id" text NOT NULL,
	"married_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"item_key" text NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "auto_mod_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "level_role_id" text;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "level_role_threshold" integer;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "leaderboard_channel" text;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "repeat_minutes" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "equipped_title" text;--> statement-breakpoint
CREATE INDEX "marriages_guild_user1_idx" ON "marriages" USING btree ("guild_id","user1_id");--> statement-breakpoint
CREATE INDEX "marriages_guild_user2_idx" ON "marriages" USING btree ("guild_id","user2_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_inventory_item_unique" ON "user_inventory" USING btree ("discord_id","guild_id","item_key");--> statement-breakpoint
CREATE INDEX "user_inventory_user_guild_idx" ON "user_inventory" USING btree ("discord_id","guild_id");
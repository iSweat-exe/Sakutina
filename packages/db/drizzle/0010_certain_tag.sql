CREATE TABLE "activity_hourly" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"hour" integer NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "voice_channel_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"total_seconds" integer DEFAULT 0 NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"current_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "activity_hourly_guild_hour_unique" ON "activity_hourly" USING btree ("guild_id","hour");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_activity_guild_channel_unique" ON "channel_activity" USING btree ("guild_id","channel_id");--> statement-breakpoint
CREATE INDEX "channel_activity_guild_idx" ON "channel_activity" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_channel_stats_guild_channel_unique" ON "voice_channel_stats" USING btree ("guild_id","channel_id");--> statement-breakpoint
CREATE INDEX "voice_channel_stats_guild_idx" ON "voice_channel_stats" USING btree ("guild_id");
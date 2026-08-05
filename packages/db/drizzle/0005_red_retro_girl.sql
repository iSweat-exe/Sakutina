CREATE TABLE "guild_event_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interaction_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"interaction_type" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"action_type" text NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message" text NOT NULL,
	"remind_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_quests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"target" integer NOT NULL,
	"type" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_discord_id_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "guild_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bonus_xp_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bonus_money_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bonus_job_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rob_last_attempt" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "user_interaction_unique" ON "interaction_stats" USING btree ("user_id","guild_id","interaction_type");--> statement-breakpoint
CREATE INDEX "mod_actions_guild_user_idx" ON "mod_actions" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "reminders_remind_at_idx" ON "reminders" USING btree ("remind_at");--> statement-breakpoint
CREATE INDEX "transactions_user_guild_idx" ON "transactions" USING btree ("user_id","guild_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_quests_user_guild_idx" ON "user_quests" USING btree ("user_id","guild_id","completed");--> statement-breakpoint
CREATE INDEX "user_quests_type_idx" ON "user_quests" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_guild_unique" ON "users" USING btree ("discord_id","guild_id");--> statement-breakpoint
CREATE INDEX "warns_guild_user_idx" ON "warns" USING btree ("guild_id","user_id");

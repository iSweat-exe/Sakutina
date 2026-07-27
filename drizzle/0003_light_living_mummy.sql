CREATE TABLE "warns" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "mod_log_channel" text;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "max_warns" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "mod_log_warning" boolean DEFAULT true NOT NULL;
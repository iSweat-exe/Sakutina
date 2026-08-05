ALTER TABLE "users" ADD COLUMN "mod_kicks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mod_bans" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mod_mutes" integer DEFAULT 0 NOT NULL;

ALTER TABLE "users" ADD COLUMN "casino_games_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "casino_wins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "casino_losses" integer DEFAULT 0 NOT NULL;

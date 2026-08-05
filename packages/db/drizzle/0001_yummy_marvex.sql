ALTER TABLE "users" ADD COLUMN "balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bank" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_last_claim" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_job" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "work_shifts_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "work_last_shift" timestamp;

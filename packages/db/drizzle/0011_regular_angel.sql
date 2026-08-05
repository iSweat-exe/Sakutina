CREATE TABLE "giveaway_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"giveaway_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"entered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giveaway_winners" (
	"id" serial PRIMARY KEY NOT NULL,
	"giveaway_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"rerolled" boolean DEFAULT false NOT NULL,
	"won_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giveaways" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text,
	"host_id" text NOT NULL,
	"prize" text NOT NULL,
	"winner_count" integer DEFAULT 1 NOT NULL,
	"required_role_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"ends_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"price" integer NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"previous_price" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stocks_ticker_unique" UNIQUE("ticker")
);
--> statement-breakpoint
CREATE TABLE "user_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"ticker" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"avg_buy_price" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "giveaway_entries_giveaway_user_unique" ON "giveaway_entries" USING btree ("giveaway_id","user_id");--> statement-breakpoint
CREATE INDEX "giveaway_winners_giveaway_idx" ON "giveaway_winners" USING btree ("giveaway_id");--> statement-breakpoint
CREATE INDEX "giveaways_status_ends_at_idx" ON "giveaways" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "stock_price_history_ticker_recorded_idx" ON "stock_price_history" USING btree ("ticker","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_holdings_user_ticker_unique" ON "user_holdings" USING btree ("discord_id","guild_id","ticker");
DROP INDEX "marriages_guild_user1_idx";--> statement-breakpoint
DROP INDEX "marriages_guild_user2_idx";--> statement-breakpoint
CREATE INDEX "marriages_user1_idx" ON "marriages" USING btree ("user1_id");--> statement-breakpoint
CREATE INDEX "marriages_user2_idx" ON "marriages" USING btree ("user2_id");--> statement-breakpoint
ALTER TABLE "marriages" DROP COLUMN "guild_id";

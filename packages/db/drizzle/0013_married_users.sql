CREATE TABLE "married_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"marriage_id" integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "married_users_user_id_unique" ON "married_users" USING btree ("user_id");
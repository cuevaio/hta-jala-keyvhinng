ALTER TABLE "users" DROP CONSTRAINT "users_account_credentials";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_account_credentials" CHECK (("users"."email" IS NULL) = ("users"."password_hash" IS NULL AND "users"."google_sub" IS NULL));
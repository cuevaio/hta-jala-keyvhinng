CREATE TYPE "public"."delegate_preference" AS ENUM('delegate', 'passenger');--> statement-breakpoint
CREATE TYPE "public"."fee_entry_type" AS ENUM('platform_fee', 'free_ride_waiver');--> statement-breakpoint
CREATE TYPE "public"."party_member_status" AS ENUM('invited', 'confirmed', 'verified', 'dropped_off', 'no_show', 'left');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('waiting', 'matched', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."party_role" AS ENUM('delegate', 'passenger');--> statement-breakpoint
CREATE TYPE "public"."place_kind" AS ENUM('venue', 'university', 'mall', 'transit', 'other');--> statement-breakpoint
CREATE TYPE "public"."place_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."ride_party_status" AS ENUM('forming', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ride_provider" AS ENUM('manual', 'uber');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('pending', 'requested', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('open', 'matching', 'matched', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"password_hash" text,
	"phone" text,
	"completed_rides" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_completed_rides_nonneg" CHECK ("users"."completed_rides" >= 0),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_account_credentials" CHECK (("users"."email" IS NULL) = ("users"."password_hash" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "place_kind" DEFAULT 'other' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"status" "place_status" DEFAULT 'active' NOT NULL,
	"is_fictional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_latitude_range" CHECK (latitude BETWEEN -90 AND 90),
	CONSTRAINT "places_longitude_range" CHECK (longitude BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "meeting_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_points_latitude_range" CHECK (latitude BETWEEN -90 AND 90),
	CONSTRAINT "meeting_points_longitude_range" CHECK (longitude BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "session_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"destination_label" text NOT NULL,
	"destination_latitude" double precision NOT NULL,
	"destination_longitude" double precision NOT NULL,
	"delegate_preference" "delegate_preference" DEFAULT 'passenger' NOT NULL,
	"status" "participant_status" DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_participants_session_user_uq" UNIQUE("session_id","user_id"),
	CONSTRAINT "session_participants_destination_latitude_range" CHECK (destination_latitude BETWEEN -90 AND 90),
	CONSTRAINT "session_participants_destination_longitude_range" CHECK (destination_longitude BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "session_status" DEFAULT 'open' NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"vehicle_capacity" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_capacity_range" CHECK ("sessions"."vehicle_capacity" BETWEEN 2 AND 8),
	CONSTRAINT "sessions_closes_after_opens" CHECK ("sessions"."closes_at" > "sessions"."opens_at")
);
--> statement-breakpoint
CREATE TABLE "ride_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"meeting_point_id" uuid,
	"route_plan" jsonb,
	"status" "ride_party_status" DEFAULT 'forming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_party_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "party_role" DEFAULT 'passenger' NOT NULL,
	"status" "party_member_status" DEFAULT 'invited' NOT NULL,
	"drop_off_order" integer,
	"fare_share_bps" integer,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ride_party_members_party_user_uq" UNIQUE("party_id","user_id"),
	CONSTRAINT "ride_party_members_participant_uq" UNIQUE("participant_id"),
	CONSTRAINT "ride_party_members_fare_bps_range" CHECK ("ride_party_members"."fare_share_bps" IS NULL OR "ride_party_members"."fare_share_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "ride_party_members_drop_off_positive" CHECK ("ride_party_members"."drop_off_order" IS NULL OR "ride_party_members"."drop_off_order" >= 1)
);
--> statement-breakpoint
CREATE TABLE "rides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"provider" "ride_provider" DEFAULT 'manual' NOT NULL,
	"external_ref" text,
	"status" "ride_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ride_id" uuid NOT NULL,
	"entry_type" "fee_entry_type" NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'PEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_ledger_amount_nonneg" CHECK ("fee_ledger_entries"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "browser_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_points" ADD CONSTRAINT "meeting_points_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_parties" ADD CONSTRAINT "ride_parties_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_parties" ADD CONSTRAINT "ride_parties_meeting_point_id_meeting_points_id_fk" FOREIGN KEY ("meeting_point_id") REFERENCES "public"."meeting_points"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_party_members" ADD CONSTRAINT "ride_party_members_party_id_ride_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."ride_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_party_members" ADD CONSTRAINT "ride_party_members_participant_id_session_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."session_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_party_members" ADD CONSTRAINT "ride_party_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_party_id_ride_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."ride_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_ledger_entries" ADD CONSTRAINT "fee_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_ledger_entries" ADD CONSTRAINT "fee_ledger_entries_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "places_slug_uq" ON "places" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "places_status_kind_idx" ON "places" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "meeting_points_place_idx" ON "meeting_points" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "session_participants_session_status_idx" ON "session_participants" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "session_participants_user_idx" ON "session_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_place_status_idx" ON "sessions" USING btree ("place_id","status");--> statement-breakpoint
CREATE INDEX "ride_parties_session_status_idx" ON "ride_parties" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "ride_parties_meeting_point_idx" ON "ride_parties" USING btree ("meeting_point_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ride_party_members_one_delegate_uq" ON "ride_party_members" USING btree ("party_id") WHERE "ride_party_members"."role" = 'delegate';--> statement-breakpoint
CREATE INDEX "ride_party_members_user_idx" ON "ride_party_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rides_party_uq" ON "rides" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "rides_status_idx" ON "rides" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fee_ledger_user_idx" ON "fee_ledger_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fee_ledger_ride_idx" ON "fee_ledger_entries" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX "browser_sessions_user_idx" ON "browser_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "browser_sessions_expires_idx" ON "browser_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rate_limits_reset_idx" ON "rate_limits" USING btree ("reset_at");
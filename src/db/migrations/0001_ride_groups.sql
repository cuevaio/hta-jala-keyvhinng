ALTER TABLE "sessions" DROP CONSTRAINT "sessions_place_id_places_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "place_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session_participants" ADD COLUMN "origin_label" text;--> statement-breakpoint
ALTER TABLE "session_participants" ADD COLUMN "origin_latitude" double precision;--> statement-breakpoint
ALTER TABLE "session_participants" ADD COLUMN "origin_longitude" double precision;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pickup_label" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pickup_latitude" double precision;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pickup_longitude" double precision;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "destination_label" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "destination_latitude" double precision;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "destination_longitude" double precision;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "departs_at" timestamp with time zone;--> statement-breakpoint
-- Existing rooms predate pickup/destination anchors: anchor them on their place.
UPDATE "sessions" s SET
  "pickup_label" = COALESCE(mp."name", p."name"),
  "pickup_latitude" = COALESCE(mp."latitude", p."latitude"),
  "pickup_longitude" = COALESCE(mp."longitude", p."longitude"),
  "destination_label" = p."name",
  "destination_latitude" = p."latitude",
  "destination_longitude" = p."longitude",
  "departs_at" = s."opens_at"
FROM "places" p
LEFT JOIN LATERAL (
  SELECT "name", "latitude", "longitude" FROM "meeting_points"
  WHERE "place_id" = p."id" ORDER BY "created_at", "id" LIMIT 1
) mp ON true
WHERE p."id" = s."place_id";--> statement-breakpoint
UPDATE "session_participants" sp SET
  "origin_label" = s."pickup_label",
  "origin_latitude" = s."pickup_latitude",
  "origin_longitude" = s."pickup_longitude"
FROM "sessions" s WHERE s."id" = sp."session_id";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "pickup_label" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "pickup_latitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "pickup_longitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "destination_label" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "destination_latitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "destination_longitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "departs_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_participants" ALTER COLUMN "origin_label" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_participants" ALTER COLUMN "origin_latitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_participants" ALTER COLUMN "origin_longitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_status_departs_idx" ON "sessions" USING btree ("status","departs_at");--> statement-breakpoint
CREATE INDEX "sessions_pickup_idx" ON "sessions" USING btree ("pickup_latitude","pickup_longitude");--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_origin_latitude_range" CHECK (origin_latitude BETWEEN -90 AND 90);--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_origin_longitude_range" CHECK (origin_longitude BETWEEN -180 AND 180);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_pickup_latitude_range" CHECK (pickup_latitude BETWEEN -90 AND 90);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_pickup_longitude_range" CHECK (pickup_longitude BETWEEN -180 AND 180);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_destination_latitude_range" CHECK (destination_latitude BETWEEN -90 AND 90);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_destination_longitude_range" CHECK (destination_longitude BETWEEN -180 AND 180);
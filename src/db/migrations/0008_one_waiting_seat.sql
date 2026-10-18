-- Concurrent joins could leave one account waiting in two rooms. Keep each account's
-- most recent waiting seat and withdraw the rest, so the unique index can be built.
UPDATE "session_participants" AS sp
SET "status" = 'withdrawn', "updated_at" = now()
WHERE sp."status" = 'waiting'
  AND EXISTS (
    SELECT 1 FROM "session_participants" AS newer
    WHERE newer."user_id" = sp."user_id"
      AND newer."status" = 'waiting'
      AND (newer."updated_at", newer."id") > (sp."updated_at", sp."id")
  );--> statement-breakpoint
CREATE UNIQUE INDEX "session_participants_one_waiting_per_user_uq" ON "session_participants" USING btree ("user_id") WHERE "session_participants"."status" = 'waiting';

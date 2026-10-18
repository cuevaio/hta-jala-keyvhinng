CREATE TABLE "party_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "party_messages_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"party_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "party_messages_seq_uq" UNIQUE("seq"),
	CONSTRAINT "party_messages_body_length" CHECK (char_length("party_messages"."body") BETWEEN 1 AND 500)
);
--> statement-breakpoint
ALTER TABLE "party_messages" ADD CONSTRAINT "party_messages_party_id_ride_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."ride_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_messages" ADD CONSTRAINT "party_messages_participant_id_session_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."session_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "party_messages_party_seq_idx" ON "party_messages" USING btree ("party_id","seq");
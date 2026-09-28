CREATE TYPE "public"."channel" AS ENUM('whatsapp', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant', 'tool');--> statement-breakpoint
CREATE TYPE "public"."coin_status" AS ENUM('sent', 'claimed', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('public', 'innercircle');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('submitted', 'in_review', 'approved', 'waitlisted', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('guest', 'crew', 'admin');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('not_submitted', 'pending_review', 'confirmed', 'waitlisted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'offered', 'claimed', 'expired', 'left');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"parts" jsonb,
	"mood" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"guest_id" uuid,
	"intended_phone" text,
	"request_id" uuid,
	"event_id" uuid,
	"season" text NOT NULL,
	"serial" integer NOT NULL,
	"engraving" text NOT NULL,
	"plus_ones" integer DEFAULT 0 NOT NULL,
	"status" "coin_status" DEFAULT 'sent' NOT NULL,
	"rsvp_status" "rsvp_status" DEFAULT 'not_submitted' NOT NULL,
	"claim_details" jsonb,
	"rsvp_reviewed_by" uuid,
	"rsvp_reviewed_at" timestamp with time zone,
	"issued_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coins_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "coins_plus_ones_non_negative" CHECK ("coins"."plus_ones" >= 0)
);
--> statement-breakpoint
CREATE TABLE "demo_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" "event_kind" NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"tagline" text,
	"description" text,
	"theme" text DEFAULT 'vault' NOT NULL,
	"sound_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"lineup" text[] DEFAULT '{}'::text[] NOT NULL,
	"partners" text[] DEFAULT '{}'::text[] NOT NULL,
	"dress_code" text,
	"door_policy" text,
	"min_age" integer,
	"capacity" integer DEFAULT 40 NOT NULL,
	"confirmed_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"time_tbc" boolean DEFAULT false NOT NULL,
	"drop_at" timestamp with time zone,
	"drop_fired_at" timestamp with time zone,
	"venue_id" uuid,
	"poster_key" text,
	"sortmyscene_url" text,
	"instagram_url" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "events_ends_after_start" CHECK ("events"."ends_at" > "events"."starts_at"),
	CONSTRAINT "events_capacity_valid" CHECK ("events"."confirmed_count" >= 0 and "events"."confirmed_count" <= "events"."capacity")
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"event_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faqs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"name" text,
	"instagram_handle" text,
	"role" "role" DEFAULT 'guest' NOT NULL,
	"consent" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "guests_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "invite_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"event_id" uuid,
	"season" text NOT NULL,
	"name" text NOT NULL,
	"instagram_handle" text,
	"answers" jsonb NOT NULL,
	"vouch_code" text,
	"status" "request_status" DEFAULT 'submitted' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"ai_summary" jsonb,
	"crew_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages_out" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid,
	"to_phone" text NOT NULL,
	"channel" "channel" DEFAULT 'whatsapp' NOT NULL,
	"template" text NOT NULL,
	"body" text NOT NULL,
	"vars" jsonb,
	"event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"area" text,
	"city" text NOT NULL,
	"address" text,
	"maps_url" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"offered_at" timestamp with time zone,
	"offer_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coins" ADD CONSTRAINT "coins_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coins" ADD CONSTRAINT "coins_request_id_invite_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."invite_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coins" ADD CONSTRAINT "coins_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coins" ADD CONSTRAINT "coins_rsvp_reviewed_by_guests_id_fk" FOREIGN KEY ("rsvp_reviewed_by") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coins" ADD CONSTRAINT "coins_issued_by_guests_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_requests" ADD CONSTRAINT "invite_requests_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_requests" ADD CONSTRAINT "invite_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_requests" ADD CONSTRAINT "invite_requests_reviewed_by_guests_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages_out" ADD CONSTRAINT "messages_out_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages_out" ADD CONSTRAINT "messages_out_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_log" ADD CONSTRAINT "status_log_actor_id_guests_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_created_at_index" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coins_season_serial_index" ON "coins" USING btree ("season","serial");--> statement-breakpoint
CREATE INDEX "coins_guest_id_index" ON "coins" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "events_kind_starts_at_index" ON "events" USING btree ("kind","starts_at");--> statement-breakpoint
CREATE INDEX "invite_requests_status_created_at_index" ON "invite_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "invite_requests_guest_id_index" ON "invite_requests" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "messages_out_guest_id_created_at_index" ON "messages_out" USING btree ("guest_id","created_at");--> statement-breakpoint
CREATE INDEX "otp_challenges_phone_created_at_index" ON "otp_challenges" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "status_log_entity_entity_id_index" ON "status_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "waitlist_entries_event_id_status_created_at_index" ON "waitlist_entries" USING btree ("event_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_one_active_per_guest" ON "waitlist_entries" USING btree ("event_id","guest_id") WHERE "waitlist_entries"."status" in ('waiting', 'offered');
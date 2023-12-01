DO $$ BEGIN
 CREATE TYPE "sessionStatus" AS ENUM('active', 'ended', 'removed', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Ave-Maria-Admin_post" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT now(),
	"author_id" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Ave-Maria-Admin_user" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text DEFAULT '',
	"last_name" text DEFAULT '',
	"image_url" text DEFAULT '',
	"email" text DEFAULT '',
	"tenant_id" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Ave-Maria-Admin_user_email_unique" UNIQUE("email"),
	CONSTRAINT "Ave-Maria-Admin_user_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Ave-Maria-Admin_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" varchar(256) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Ave-Maria-Admin_session" (
	"session_id" text PRIMARY KEY NOT NULL,
	"expire_at" timestamp,
	"client_id" text NOT NULL,
	"abandon_at" timestamp,
	"last_active_at" timestamp,
	"status" "sessionStatus",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"tenant_id" text DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "name_idx" ON "Ave-Maria-Admin_post" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_idx" ON "Ave-Maria-Admin_user" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_id_idx" ON "Ave-Maria-Admin_user" ("tenant_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Ave-Maria-Admin_post" ADD CONSTRAINT "Ave-Maria-Admin_post_author_id_Ave-Maria-Admin_user_tenant_id_fk" FOREIGN KEY ("author_id") REFERENCES "Ave-Maria-Admin_user"("tenant_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Ave-Maria-Admin_session" ADD CONSTRAINT "Ave-Maria-Admin_session_tenant_id_Ave-Maria-Admin_user_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "Ave-Maria-Admin_user"("tenant_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."company_status" AS ENUM('active', 'paused', 'retired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "status" "company_status" DEFAULT 'active' NOT NULL;
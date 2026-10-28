-- CreateEnum
CREATE TYPE "GenderPolicy" AS ENUM ('MALE', 'FEMALE', 'CO_LIVING');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('CHECKIN_ANNIVERSARY', 'FIXED_DAY');

-- CreateEnum
CREATE TYPE "LateFeeType" AS ENUM ('NONE', 'FLAT', 'PER_DAY');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'DORM');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('VACANT', 'OCCUPIED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'STAFF', 'RESIDENT');

-- CreateEnum
CREATE TYPE "ResidentStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'MOVED_OUT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "OccupationType" AS ENUM ('STUDENT', 'WORKING', 'OTHER');

-- CreateEnum
CREATE TYPE "IdDocumentType" AS ENUM ('AADHAAR', 'VOTER_ID', 'PASSPORT', 'DRIVING_LICENCE', 'PAN', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'WEEKLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UPCOMING', 'DUE', 'OVERDUE', 'PAID', 'PARTIALLY_PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI_DIRECT', 'CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'VOIDED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "gstin" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostels" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" VARCHAR(6) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "phone" VARCHAR(13) NOT NULL,
    "gender_policy" "GenderPolicy" NOT NULL,
    "amenities" JSONB NOT NULL DEFAULT '[]',
    "is_listed_publicly" BOOLEAN NOT NULL DEFAULT false,
    "upi_vpa" TEXT,
    "rules_text" TEXT NOT NULL DEFAULT '',
    "billing_mode" "BillingMode" NOT NULL DEFAULT 'CHECKIN_ANNIVERSARY',
    "fixed_due_day" SMALLINT,
    "grace_days" SMALLINT NOT NULL DEFAULT 5,
    "invoice_lead_days" SMALLINT NOT NULL DEFAULT 7,
    "late_fee_type" "LateFeeType" NOT NULL DEFAULT 'NONE',
    "late_fee_paise" BIGINT NOT NULL DEFAULT 0,
    "late_fee_cap_paise" BIGINT,
    "allow_partial_payments" BOOLEAN NOT NULL DEFAULT false,
    "default_security_deposit_paise" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "hostels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "hostel_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "floor" SMALLINT NOT NULL,
    "type" "RoomType" NOT NULL,
    "capacity" SMALLINT NOT NULL,
    "monthly_rent_paise" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "hostel_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'VACANT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(13) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "hostel_id" UUID,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "hostel_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ(3),
    "max_uses" INTEGER,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "onboarding_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "hostel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "ResidentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "full_name" TEXT NOT NULL,
    "dob" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "phone" VARCHAR(13) NOT NULL,
    "alt_phone" VARCHAR(13),
    "email" TEXT,
    "permanent_address" JSONB NOT NULL,
    "occupation_type" "OccupationType" NOT NULL,
    "institution_or_company" TEXT,
    "emergency_contact_name" TEXT NOT NULL,
    "emergency_contact_phone" VARCHAR(13) NOT NULL,
    "emergency_contact_relation" TEXT NOT NULL,
    "photo_key" TEXT,
    "consent_accepted_at" TIMESTAMPTZ(3) NOT NULL,
    "consent_version" TEXT NOT NULL,
    "check_in_date" DATE,
    "check_out_date" DATE,
    "bed_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "residents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "type" "IdDocumentType" NOT NULL,
    "number_masked" TEXT NOT NULL,
    "number_encrypted" BYTEA,
    "front_key" TEXT NOT NULL,
    "back_key" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "identity_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rent_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "monthly_rent_paise" BIGINT NOT NULL,
    "security_deposit_paise" BIGINT NOT NULL,
    "billing_anchor_day" SMALLINT NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rent_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "hostel_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "late_fee_paise" BIGINT NOT NULL DEFAULT 0,
    "paid_paise" BIGINT NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UPCOMING',
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "hostel_id" UUID NOT NULL,
    "resident_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "paid_on" DATE NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "idempotency_key" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "hostels_organization_id_idx" ON "hostels"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "hostels_organization_id_slug_key" ON "hostels"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "hostels_id_organization_id_key" ON "hostels"("id", "organization_id");

-- CreateIndex
CREATE INDEX "rooms_organization_id_idx" ON "rooms"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_hostel_id_number_key" ON "rooms"("hostel_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_id_hostel_id_organization_id_key" ON "rooms"("id", "hostel_id", "organization_id");

-- CreateIndex
CREATE INDEX "beds_organization_id_idx" ON "beds"("organization_id");

-- CreateIndex
CREATE INDEX "beds_hostel_id_status_idx" ON "beds"("hostel_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "beds_room_id_label_key" ON "beds"("room_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "beds_id_hostel_id_organization_id_key" ON "beds"("id", "hostel_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE INDEX "memberships_organization_id_idx" ON "memberships"("organization_id");

-- CreateIndex
CREATE INDEX "memberships_hostel_id_idx" ON "memberships"("hostel_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_links_token_key" ON "onboarding_links"("token");

-- CreateIndex
CREATE INDEX "onboarding_links_organization_id_idx" ON "onboarding_links"("organization_id");

-- CreateIndex
CREATE INDEX "onboarding_links_hostel_id_is_active_idx" ON "onboarding_links"("hostel_id", "is_active");

-- CreateIndex
CREATE INDEX "residents_organization_id_idx" ON "residents"("organization_id");

-- CreateIndex
CREATE INDEX "residents_hostel_id_status_idx" ON "residents"("hostel_id", "status");

-- CreateIndex
CREATE INDEX "residents_user_id_idx" ON "residents"("user_id");

-- CreateIndex
CREATE INDEX "residents_bed_id_idx" ON "residents"("bed_id");

-- CreateIndex
CREATE UNIQUE INDEX "residents_id_organization_id_key" ON "residents"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "residents_id_hostel_id_organization_id_key" ON "residents"("id", "hostel_id", "organization_id");

-- CreateIndex
CREATE INDEX "identity_documents_organization_id_idx" ON "identity_documents"("organization_id");

-- CreateIndex
CREATE INDEX "identity_documents_resident_id_idx" ON "identity_documents"("resident_id");

-- CreateIndex
CREATE INDEX "rent_plans_organization_id_idx" ON "rent_plans"("organization_id");

-- CreateIndex
CREATE INDEX "rent_plans_resident_id_effective_from_idx" ON "rent_plans"("resident_id", "effective_from");

-- CreateIndex
CREATE INDEX "invoices_organization_id_idx" ON "invoices"("organization_id");

-- CreateIndex
CREATE INDEX "invoices_hostel_id_status_idx" ON "invoices"("hostel_id", "status");

-- CreateIndex
CREATE INDEX "invoices_hostel_id_due_date_idx" ON "invoices"("hostel_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_resident_id_period_start_key" ON "invoices"("resident_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_id_resident_id_hostel_id_organization_id_key" ON "invoices"("id", "resident_id", "hostel_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_organization_id_idx" ON "payments"("organization_id");

-- CreateIndex
CREATE INDEX "payments_hostel_id_paid_on_idx" ON "payments"("hostel_id", "paid_on");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_resident_id_idx" ON "payments"("resident_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- AddForeignKey
ALTER TABLE "hostels" ADD CONSTRAINT "hostels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hostel_id_organization_id_fkey" FOREIGN KEY ("hostel_id", "organization_id") REFERENCES "hostels"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_room_id_hostel_id_organization_id_fkey" FOREIGN KEY ("room_id", "hostel_id", "organization_id") REFERENCES "rooms"("id", "hostel_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_hostel_id_organization_id_fkey" FOREIGN KEY ("hostel_id", "organization_id") REFERENCES "hostels"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_hostel_id_organization_id_fkey" FOREIGN KEY ("hostel_id", "organization_id") REFERENCES "hostels"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_documents" ADD CONSTRAINT "identity_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_documents" ADD CONSTRAINT "identity_documents_resident_id_organization_id_fkey" FOREIGN KEY ("resident_id", "organization_id") REFERENCES "residents"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_documents" ADD CONSTRAINT "identity_documents_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_plans" ADD CONSTRAINT "rent_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_plans" ADD CONSTRAINT "rent_plans_resident_id_organization_id_fkey" FOREIGN KEY ("resident_id", "organization_id") REFERENCES "residents"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_plans" ADD CONSTRAINT "rent_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_resident_id_hostel_id_organization_id_fkey" FOREIGN KEY ("resident_id", "hostel_id", "organization_id") REFERENCES "residents"("id", "hostel_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_resident_id_hostel_id_organization_id_fkey" FOREIGN KEY ("invoice_id", "resident_id", "hostel_id", "organization_id") REFERENCES "invoices"("id", "resident_id", "hostel_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written constraints Prisma cannot express (see the add-core-data-model design).
-- ---------------------------------------------------------------------------

-- Tenant integrity for optional relations: Postgres skips the check when a column is NULL
-- (MATCH SIMPLE), so organisation-wide memberships and unassigned residents still work.
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_hostel_tenant_fkey"
  FOREIGN KEY ("hostel_id", "organization_id") REFERENCES "hostels"("id", "organization_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "residents" ADD CONSTRAINT "residents_bed_tenant_fkey"
  FOREIGN KEY ("bed_id", "hostel_id", "organization_id") REFERENCES "beds"("id", "hostel_id", "organization_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- One membership per user, organisation and hostel; NULL hostel (organisation-wide) counts as a value.
CREATE UNIQUE INDEX "memberships_user_org_hostel_key"
  ON "memberships" ("user_id", "organization_id", "hostel_id") NULLS NOT DISTINCT;

-- At most one ACTIVE resident per bed; moved-out residents keep their historical bed.
CREATE UNIQUE INDEX "residents_one_active_per_bed"
  ON "residents" ("bed_id") WHERE "status" = 'ACTIVE' AND "bed_id" IS NOT NULL;

-- Hostel billing settings.
ALTER TABLE "hostels"
  ADD CONSTRAINT "hostels_fixed_due_day_range" CHECK ("fixed_due_day" IS NULL OR "fixed_due_day" BETWEEN 1 AND 28),
  ADD CONSTRAINT "hostels_fixed_day_requires_due_day" CHECK ("billing_mode" <> 'FIXED_DAY' OR "fixed_due_day" IS NOT NULL),
  ADD CONSTRAINT "hostels_grace_days_non_negative" CHECK ("grace_days" >= 0),
  ADD CONSTRAINT "hostels_invoice_lead_days_non_negative" CHECK ("invoice_lead_days" >= 0),
  ADD CONSTRAINT "hostels_late_fee_non_negative" CHECK ("late_fee_paise" >= 0),
  ADD CONSTRAINT "hostels_late_fee_cap_non_negative" CHECK ("late_fee_cap_paise" IS NULL OR "late_fee_cap_paise" >= 0),
  ADD CONSTRAINT "hostels_deposit_non_negative" CHECK ("default_security_deposit_paise" >= 0),
  ADD CONSTRAINT "hostels_pincode_format" CHECK ("pincode" ~ '^[1-9][0-9]{5}$');

ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_capacity_positive" CHECK ("capacity" >= 1),
  ADD CONSTRAINT "rooms_rent_non_negative" CHECK ("monthly_rent_paise" >= 0);

ALTER TABLE "onboarding_links"
  ADD CONSTRAINT "onboarding_links_use_count_non_negative" CHECK ("use_count" >= 0),
  ADD CONSTRAINT "onboarding_links_max_uses_positive" CHECK ("max_uses" IS NULL OR "max_uses" >= 1);

ALTER TABLE "rent_plans"
  ADD CONSTRAINT "rent_plans_rent_non_negative" CHECK ("monthly_rent_paise" >= 0),
  ADD CONSTRAINT "rent_plans_deposit_non_negative" CHECK ("security_deposit_paise" >= 0),
  ADD CONSTRAINT "rent_plans_anchor_day_range" CHECK ("billing_anchor_day" BETWEEN 1 AND 31),
  ADD CONSTRAINT "rent_plans_effective_range" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_amount_non_negative" CHECK ("amount_paise" >= 0),
  ADD CONSTRAINT "invoices_late_fee_non_negative" CHECK ("late_fee_paise" >= 0),
  ADD CONSTRAINT "invoices_paid_non_negative" CHECK ("paid_paise" >= 0),
  ADD CONSTRAINT "invoices_period_range" CHECK ("period_end" >= "period_start");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive" CHECK ("amount_paise" > 0),
  ADD CONSTRAINT "payments_void_complete" CHECK (
    ("status" = 'VOIDED') = ("voided_at" IS NOT NULL AND "void_reason" IS NOT NULL)
  );

-- Next rent due date is derived, never stored on the resident (build guide §4).
CREATE VIEW "resident_billing_status" AS
SELECT
  r."id" AS "resident_id",
  r."organization_id",
  r."hostel_id",
  MIN(i."due_date") FILTER (
    WHERE i."status" IN ('UPCOMING', 'DUE', 'OVERDUE', 'PARTIALLY_PAID')
  ) AS "next_due_date",
  COUNT(i."id") FILTER (WHERE i."status" = 'OVERDUE') AS "overdue_invoice_count"
FROM "residents" r
LEFT JOIN "invoices" i ON i."resident_id" = r."id"
GROUP BY r."id", r."organization_id", r."hostel_id";

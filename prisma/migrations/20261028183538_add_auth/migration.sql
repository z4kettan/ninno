-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'SIGNUP');

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(13) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "locked_at" TIMESTAMPTZ(3),
    "last_sent_at" TIMESTAMPTZ(3) NOT NULL,
    "send_window_start" TIMESTAMPTZ(3) NOT NULL,
    "send_count_in_window" SMALLINT NOT NULL DEFAULT 1,
    "delivered" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "rotated_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "otp_challenges_phone_purpose_key" ON "otp_challenges"("phone", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written constraints (Prisma ignores CHECKs when diffing).
ALTER TABLE "otp_challenges"
  ADD CONSTRAINT "otp_challenges_attempts_range" CHECK ("attempts" BETWEEN 0 AND 5),
  ADD CONSTRAINT "otp_challenges_send_count_positive" CHECK ("send_count_in_window" >= 1),
  ADD CONSTRAINT "otp_challenges_phone_e164" CHECK ("phone" ~ '^\+91[6-9][0-9]{9}$');

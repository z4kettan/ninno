-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_hostel_id_fkey";

-- DropForeignKey
ALTER TABLE "residents" DROP CONSTRAINT "residents_bed_id_fkey";

-- RenameForeignKey
ALTER TABLE "memberships" RENAME CONSTRAINT "memberships_hostel_tenant_fkey" TO "memberships_hostel_id_organization_id_fkey";

-- RenameForeignKey
ALTER TABLE "residents" RENAME CONSTRAINT "residents_bed_tenant_fkey" TO "residents_bed_id_hostel_id_organization_id_fkey";

-- RenameIndex
ALTER INDEX "memberships_user_org_hostel_key" RENAME TO "memberships_user_id_organization_id_hostel_id_key";

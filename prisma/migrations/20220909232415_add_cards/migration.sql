/*
  Warnings:

  - The values [editor] on the enum `Roles` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "Status" AS ENUM ('approved', 'pending', 'denied');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'pending', 'invited', 'revoked', 'deleted', 'deactivated');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('approved', 'pending', 'denied', 'completed');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('active', 'closed', 'deleted', 'finished');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('newCard', 'withdrawal', 'contributions');

-- AlterEnum
BEGIN;
CREATE TYPE "Roles_new" AS ENUM ('admin', 'agent', 'user', 'guest');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Roles_new" USING ("role"::text::"Roles_new");
ALTER TYPE "Roles" RENAME TO "Roles_old";
ALTER TYPE "Roles_new" RENAME TO "Roles";
DROP TYPE "Roles_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
COMMIT;

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "RequestType" NOT NULL DEFAULT 'contributions',
    "cardId" TEXT,
    "info" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_createdAt_key" ON "Card"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Card_updatedAt_key" ON "Card"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_createdAt_key" ON "Contribution"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_updatedAt_key" ON "Contribution"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Request_createdAt_key" ON "Request"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Request_updatedAt_key" ON "Request"("updatedAt");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

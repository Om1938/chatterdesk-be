-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('RECEIVED', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "topic" VARCHAR(128) NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "processingError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_contacts" (
    "id" TEXT NOT NULL,
    "waId" VARCHAR(32) NOT NULL,
    "profileName" VARCHAR(256),
    "phoneNumber" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "waMessageId" VARCHAR(128) NOT NULL,
    "waId" VARCHAR(32) NOT NULL,
    "direction" "Direction" NOT NULL,
    "messageType" VARCHAR(32) NOT NULL,
    "content" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_status_updates" (
    "id" TEXT NOT NULL,
    "waMessageId" VARCHAR(128) NOT NULL,
    "recipientId" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "errorCode" INTEGER,
    "errorTitle" VARCHAR(256),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_status_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_events_source_receivedAt_idx" ON "webhook_events"("source", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "webhook_events_topic_receivedAt_idx" ON "webhook_events"("topic", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "webhook_events_processedAt_idx" ON "webhook_events"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contacts_waId_key" ON "whatsapp_contacts"("waId");

-- CreateIndex
CREATE INDEX "whatsapp_contacts_waId_idx" ON "whatsapp_contacts"("waId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_waMessageId_key" ON "whatsapp_messages"("waMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_waId_timestamp_idx" ON "whatsapp_messages"("waId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "whatsapp_messages_status_idx" ON "whatsapp_messages"("status");

-- CreateIndex
CREATE INDEX "whatsapp_status_updates_waMessageId_idx" ON "whatsapp_status_updates"("waMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_status_updates_recipientId_timestamp_idx" ON "whatsapp_status_updates"("recipientId", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_waId_fkey" FOREIGN KEY ("waId") REFERENCES "whatsapp_contacts"("waId") ON DELETE RESTRICT ON UPDATE CASCADE;

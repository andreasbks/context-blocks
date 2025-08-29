-- CreateEnum
CREATE TYPE "public"."BlockKind" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "public"."RelationType" AS ENUM ('follows', 'references');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Graph" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Graph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContextBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "public"."BlockKind" NOT NULL,
    "content" JSONB NOT NULL,
    "model" TEXT,
    "tokenCount" INTEGER,
    "checksum" TEXT,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GraphNode" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "GraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BlockEdge" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "parentNodeId" TEXT NOT NULL,
    "childNodeId" TEXT NOT NULL,
    "relation" "public"."RelationType" NOT NULL,
    "ord" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BlockEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Branch" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootNodeId" TEXT NOT NULL,
    "tipNodeId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdempotencyRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "headers" JSONB,
    "body" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "public"."User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Graph_userId_idx" ON "public"."Graph"("userId");

-- CreateIndex
CREATE INDEX "Graph_lastActivityAt_idx" ON "public"."Graph"("lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContextBlock_checksum_key" ON "public"."ContextBlock"("checksum");

-- CreateIndex
CREATE INDEX "GraphNode_graphId_blockId_idx" ON "public"."GraphNode"("graphId", "blockId");

-- CreateIndex
CREATE INDEX "BlockEdge_graphId_parentNodeId_relation_ord_idx" ON "public"."BlockEdge"("graphId", "parentNodeId", "relation", "ord");

-- CreateIndex
CREATE INDEX "BlockEdge_graphId_childNodeId_idx" ON "public"."BlockEdge"("graphId", "childNodeId");

-- CreateIndex
CREATE INDEX "Branch_graphId_idx" ON "public"."Branch"("graphId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_graphId_name_key" ON "public"."Branch"("graphId", "name");

-- CreateIndex
CREATE INDEX "IdempotencyRequest_createdAt_idx" ON "public"."IdempotencyRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRequest_userId_method_path_key_key" ON "public"."IdempotencyRequest"("userId", "method", "path", "key");

-- AddForeignKey
ALTER TABLE "public"."Graph" ADD CONSTRAINT "Graph_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContextBlock" ADD CONSTRAINT "ContextBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GraphNode" ADD CONSTRAINT "GraphNode_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "public"."Graph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GraphNode" ADD CONSTRAINT "GraphNode_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "public"."ContextBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlockEdge" ADD CONSTRAINT "BlockEdge_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "public"."Graph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlockEdge" ADD CONSTRAINT "BlockEdge_parentNodeId_fkey" FOREIGN KEY ("parentNodeId") REFERENCES "public"."GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlockEdge" ADD CONSTRAINT "BlockEdge_childNodeId_fkey" FOREIGN KEY ("childNodeId") REFERENCES "public"."GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "public"."Graph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_rootNodeId_fkey" FOREIGN KEY ("rootNodeId") REFERENCES "public"."GraphNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_tipNodeId_fkey" FOREIGN KEY ("tipNodeId") REFERENCES "public"."GraphNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

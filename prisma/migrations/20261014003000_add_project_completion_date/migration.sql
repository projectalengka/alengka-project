-- Record the real date a project is marked complete.
-- Leave existing rows NULL rather than fabricating completion dates from updatedAt.
ALTER TABLE "projects" ADD COLUMN "completedAt" TIMESTAMP(3);
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Bookmark" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" TEXT NOT NULL,
        "courseId" TEXT NOT NULL,
        CONSTRAINT "Bookmark_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User" ("id")
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Bookmark_courseId_fkey"
          FOREIGN KEY ("courseId") REFERENCES "Course" ("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await transaction.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_courseId_key"
      ON "Bookmark"("userId", "courseId")
    `)

    await transaction.$executeRawUnsafe(`
      INSERT OR IGNORE INTO "Bookmark" ("id", "createdAt", "userId", "courseId")
      SELECT "id", "createdAt", "userId", "courseId"
      FROM "Enrollment"
      WHERE "status" = 'favorite'
    `)
    await transaction.$executeRawUnsafe(`
      DELETE FROM "Enrollment"
      WHERE "status" = 'favorite'
    `)

    await transaction.$executeRawUnsafe(`
      DELETE FROM "Enrollment" AS "inProgress"
      WHERE "inProgress"."status" = 'in_progress'
        AND EXISTS (
          SELECT 1
          FROM "Enrollment" AS "completed"
          WHERE "completed"."userId" = "inProgress"."userId"
            AND "completed"."courseId" = "inProgress"."courseId"
            AND "completed"."status" = 'completed'
        )
    `)

    const enrollmentColumns = await transaction.$queryRawUnsafe(
      'PRAGMA table_info("Enrollment")',
    )
    if (!enrollmentColumns.some((column) => column.name === 'completedAt')) {
      await transaction.$executeRawUnsafe(
        'ALTER TABLE "Enrollment" ADD COLUMN "completedAt" DATETIME',
      )
    }
    await transaction.$executeRawUnsafe(`
      UPDATE "Enrollment"
      SET "completedAt" = "updatedAt"
      WHERE "status" = 'completed' AND "completedAt" IS NULL
    `)

    await transaction.$executeRawUnsafe(
      'DROP INDEX IF EXISTS "Enrollment_userId_courseId_status_key"',
    )
    await transaction.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Enrollment_userId_courseId_key"
      ON "Enrollment"("userId", "courseId")
    `)
  })

  console.warn('Migrated favorites to Bookmark and normalized Enrollment records.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

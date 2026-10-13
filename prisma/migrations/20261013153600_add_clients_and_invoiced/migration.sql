-- Klien menjadi data tersendiri + penanda "sudah ditagih".
--
-- Migrasi ini MENGANGKUT data yang sudah ada, bukan sekadar mengubah bentuk
-- tabel: setiap `clientName` yang berbeda di tabel projects diubah menjadi satu
-- baris di tabel clients, lalu proyek dihubungkan ke kliennya. Kolom lama baru
-- dihapus SETELAH semua proyek punya klien, sehingga tidak ada nama klien yang
-- hilang.
--
-- ID dibuat dari md5(random()+clock_timestamp()) dan bukan gen_random_uuid(),
-- supaya migrasi ini tidak bergantung pada ekstensi apa pun.

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- Backfill: satu klien per nama klien yang berbeda (spasi tepi diabaikan)
INSERT INTO "clients" ("id", "name", "contact", "address", "notes", "createdAt", "updatedAt")
SELECT
    (md5(random()::text || clock_timestamp()::text)::uuid)::text,
    s.trimmed,
    '', '', '', NOW(), NOW()
FROM (
    SELECT DISTINCT btrim("clientName") AS trimmed
    FROM "projects"
    WHERE btrim("clientName") <> ''
) AS s;

-- Klien penampung untuk proyek yang nama kliennya kosong, hanya bila diperlukan
INSERT INTO "clients" ("id", "name", "contact", "address", "notes", "createdAt", "updatedAt")
SELECT
    (md5(random()::text || clock_timestamp()::text)::uuid)::text,
    'Tanpa Nama',
    '', '', '', NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM "projects" WHERE btrim("clientName") = '');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "clientId" TEXT;
ALTER TABLE "projects" ADD COLUMN "invoicedAt" TIMESTAMP(3);

-- Hubungkan tiap proyek ke kliennya
UPDATE "projects" p
SET "clientId" = c."id"
FROM "clients" c
WHERE c."name" = btrim(p."clientName");

-- Sisa yang belum terhubung (nama kosong) masuk ke klien penampung
UPDATE "projects" p
SET "clientId" = (SELECT "id" FROM "clients" WHERE "name" = 'Tanpa Nama' LIMIT 1)
WHERE p."clientId" IS NULL;

-- Baru sekarang kolom lama boleh hilang: tidak ada data yang tersisa di sana
ALTER TABLE "projects" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "projects" DROP COLUMN "clientName";

-- CreateIndex
CREATE INDEX "projects_clientId_idx" ON "projects"("clientId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Status bawaan proyek baru: mulai dari tahap "Masuk", bukan langsung dikerjakan
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'Masuk';

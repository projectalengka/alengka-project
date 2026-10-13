-- Menambah tahap paling awal alur kerja: brief desain yang baru masuk.
--
-- Sengaja dipisah ke migrasi tersendiri. Postgres mengizinkan
-- `ALTER TYPE ... ADD VALUE` di dalam transaksi (sejak PG 12), TETAPI nilai
-- barunya belum boleh DIPAKAI sampai transaksi itu commit. Prisma membungkus
-- tiap berkas migrasi dalam satu transaksi, jadi menaruh "ADD VALUE" dan
-- "SET DEFAULT 'Masuk'" di berkas yang sama akan gagal. Baris DEFAULT-nya
-- karena itu dipindahkan ke migrasi berikutnya.

-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'Masuk';

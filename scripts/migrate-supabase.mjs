/*
 * Jalankan migrasi Prisma ke Supabase lewat POOLER SESSION mode (port 5432).
 *
 * Kenapa script ini ada:
 *
 * 1. Host direct Supabase (`db.<ref>.supabase.co`) hanya mengembalikan alamat
 *    IPv6. Di jaringan yang tidak punya route IPv6, koneksi ke host itu SELALU
 *    gagal ("could not translate host name"). Yang selalu bisa dihubungi adalah
 *    host pooler (IPv4): aws-0-<region>.pooler.supabase.com.
 *
 * 2. `prisma migrate deploy` TIDAK BISA lewat pooler transaction mode (port 6543).
 *    Terbukti: saat `vercel-build` masih memakai `prisma migrate deploy`, build
 *    Vercel menggantung tanpa batas tepat setelah mengumumkan datasource :6543
 *    (dibiarkan >20 menit, tidak ada progres sama sekali sampai dibatalkan).
 *    Migrate butuh session yang stabil, jadi WAJIB lewat port 5432 (session mode).
 *
 * 3. Karena build serverless tidak boleh menahan build demi migrasi, migrasi
 *    dipisahkan dari `vercel-build`. Jalankan script ini secara sadar saat schema
 *    berubah, bukan otomatis setiap deploy.
 *
 * Pemakaian:
 *   npm run db:migrate:supabase
 *
 * Script membaca kredensial dari DATABASE_URL (yang berisi mode pooler
 * :6543) lalu menurunkan varian session :5432 secara otomatis. Bisa juga
 * ditimpa eksplisit lewat MIGRATE_DATABASE_URL.
 */
import { spawnSync } from "node:child_process"

const source = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL
if (!source) {
  console.error("[db:migrate:supabase] DATABASE_URL tidak diset.")
  process.exit(1)
}

let url
try {
  url = new URL(source)
} catch {
  console.error("[db:migrate:supabase] DATABASE_URL bukan URL yang valid.")
  process.exit(1)
}

const isPooler = url.hostname.includes("pooler.supabase.com")
const isTxMode = url.port === "6543"

if (isPooler && isTxMode) {
  url.port = "5432"
  // Parameter transaction-mode tidak berlaku di session mode.
  url.searchParams.delete("pgbouncer")
  url.searchParams.delete("connection_limit")
  console.log("[db:migrate:supabase] Pooler transaction (6543) -> session (5432).")
  console.log(`[db:migrate:supabase] Target: ${url.hostname}:${url.port}`)
} else {
  console.log(`[db:migrate:supabase] Pakai DATABASE_URL apa adanya (${url.hostname}:${url.port}).`)
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url.toString() },
})

process.exit(result.status ?? 1)

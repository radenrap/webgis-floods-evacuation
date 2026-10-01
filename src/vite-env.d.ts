/// <reference types="vite/client" />

// Tipe variabel lingkungan (Vite). Menjaga akses import.meta.env tetap `string`
// (bukan `any`) sehingga klien Supabase type-safe. Lihat .env.example.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  /** Kunci publishable (penamaan baru Supabase, pengganti anon). Disarankan. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Kunci anon lama (fallback bila publishable tidak ada). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

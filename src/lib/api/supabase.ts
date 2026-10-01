// Inisialisasi klien Supabase (PostgREST + RPC). Lihat spec 20 §7.3.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Supabase baru memakai VITE_SUPABASE_PUBLISHABLE_KEY (pengganti anon); fallback ke anon lama.
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

// Penanganan error dasar: gagal cepat bila konfigurasi lingkungan belum lengkap.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Konfigurasi Supabase belum lengkap: isi VITE_SUPABASE_URL dan ' +
      'VITE_SUPABASE_PUBLISHABLE_KEY (atau VITE_SUPABASE_ANON_KEY) di .env / .env.local.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

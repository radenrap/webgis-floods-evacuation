// Inisialisasi klien Supabase (PostgREST + RPC). Lihat spec 20 §7.3.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Penanganan error dasar: gagal cepat bila konfigurasi lingkungan belum lengkap.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Konfigurasi Supabase belum lengkap: isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY ' +
      'di .env.local (salin dari .env.example).',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

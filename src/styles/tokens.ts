// Token warna & opacity (satu-satunya sumber kebenaran palet).
// Nilai persis dari spec 30 §2 (rujukan 10 §7 / 00 §9.2). JANGAN diubah di tempat lain.

export const RISK_COLOR = {
  RENDAH: '#2e7d32',
  SEDANG: '#f9a825',
  TINGGI: '#c62828',
} as const;

export const RISK_FILL_OPACITY = {
  RENDAH: 0.35,
  SEDANG: 0.45,
  TINGGI: 0.55,
} as const;

export const SHELTER_STATUS_COLOR = {
  SIAP: '#2e7d32',
  SIAGA: '#f9a825',
  PENUH: '#ef6c00',
  NONAKTIF: '#9e9e9e',
} as const;

export type RiskClass = keyof typeof RISK_COLOR;
export type ShelterStatus = keyof typeof SHELTER_STATUS_COLOR;

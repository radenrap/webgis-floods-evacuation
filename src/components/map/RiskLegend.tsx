import { RISK_COLOR } from '../../styles/tokens';
import type { RiskClass } from '../../styles/tokens';

const ROWS: Array<{ key: RiskClass; label: string; skor: string }> = [
  { key: 'RENDAH', label: 'Rawan Rendah', skor: '0-33' },
  { key: 'SEDANG', label: 'Rawan Sedang', skor: '34-66' },
  { key: 'TINGGI', label: 'Rawan Tinggi', skor: '67-100' },
];

/** Legenda warna risiko (spec 30 §6.1). Warna dari tokens (satu sumber kebenaran). */
export default function RiskLegend() {
  return (
    <div className="risk-legend" role="group" aria-label="Legenda kelas rawan banjir">
      {ROWS.map((r) => (
        <div key={r.key} className="risk-legend-row">
          <span
            className="swatch"
            style={{ backgroundColor: RISK_COLOR[r.key] }}
            aria-hidden="true"
          />
          <span>
            {r.label} (skor {r.skor})
          </span>
        </div>
      ))}
    </div>
  );
}

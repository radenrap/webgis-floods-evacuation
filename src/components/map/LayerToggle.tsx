import { useState } from 'react';
import { LAYER_GROUPS, LAYERS } from '../../styles/mapStyle';
import type { RiskClass } from '../../styles/tokens';

const ALL_RISKS: RiskClass[] = ['RENDAH', 'SEDANG', 'TINGGI'];

export interface LayerToggleProps {
  onToggle: (layerId: string, visible: boolean) => void;
  onRiskFilter: (classes: RiskClass[]) => void;
}

/** Kontrol toggle visibilitas lapisan per grup + filter kelas rawan (spec 30 §6.2). */
export default function LayerToggle({ onToggle, onRiskFilter }: LayerToggleProps) {
  const initial: Record<string, boolean> = {};
  for (const layer of LAYERS) {
    const vis = (layer.layout as { visibility?: string } | undefined)?.visibility;
    initial[layer.id] = vis !== 'none';
  }
  const [visible, setVisible] = useState(initial);
  const [risks, setRisks] = useState<RiskClass[]>(ALL_RISKS);

  const toggleLayer = (id: string) => {
    const next = !visible[id];
    setVisible((v) => ({ ...v, [id]: next }));
    onToggle(id, next);
  };

  const toggleRisk = (rc: RiskClass) => {
    const next = risks.includes(rc) ? risks.filter((x) => x !== rc) : [...risks, rc];
    setRisks(next);
    onRiskFilter(next);
  };

  return (
    <div className="layer-toggle" role="group" aria-label="Kontrol lapisan peta">
      {Object.entries(LAYER_GROUPS).map(([group, ids]) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {ids.map((id) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={visible[id] ?? true}
                onChange={() => toggleLayer(id)}
              />
              {id}
            </label>
          ))}
        </fieldset>
      ))}
      <fieldset>
        <legend>Kelas Rawan</legend>
        {ALL_RISKS.map((rc) => (
          <label key={rc}>
            <input type="checkbox" checked={risks.includes(rc)} onChange={() => toggleRisk(rc)} />
            {rc}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

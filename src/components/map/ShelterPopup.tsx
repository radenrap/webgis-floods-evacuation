import type { EvacuationShelterProperties } from '../../lib/api';

export interface ShelterPopupProps {
  shelter: EvacuationShelterProperties;
  routeLoading: boolean;
  onRoute: () => void;
  onClose: () => void;
}

/** Panel info shelter + aksi "Rute ke sini" (spec 30 §5.2, 40 §7.1). */
export default function ShelterPopup({
  shelter,
  routeLoading,
  onRoute,
  onClose,
}: ShelterPopupProps) {
  return (
    <div className="shelter-popup" role="dialog" aria-label={`Info shelter ${shelter.nama}`}>
      <h3>{shelter.nama}</h3>
      <dl>
        <dt>Jenis</dt>
        <dd>{shelter.jenis}</dd>
        <dt>Kapasitas</dt>
        <dd>{shelter.kapasitas} jiwa</dd>
        <dt>Status</dt>
        <dd>{shelter.status}</dd>
        {shelter.kontak ? (
          <>
            <dt>Kontak</dt>
            <dd>{shelter.kontak}</dd>
          </>
        ) : null}
      </dl>
      <button type="button" onClick={onRoute} disabled={routeLoading}>
        {routeLoading ? 'Menghitung…' : 'Rute ke sini'}
      </button>
      <button type="button" onClick={onClose}>
        Tutup
      </button>
    </div>
  );
}

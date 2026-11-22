export function PersisteMark() {
  return <span className="persiste-mark" aria-hidden="true"><span /><span /><span /></span>;
}

export function PersisteBrand({ compact = false }: { compact?: boolean }) {
  return <span className="persiste-brand" aria-label="Persiste">
    <PersisteMark />
    {!compact && <span className="persiste-wordmark" aria-hidden="true">persiste</span>}
  </span>;
}

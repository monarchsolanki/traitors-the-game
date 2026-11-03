/** The name on a Deco tower fin, one letter a storey. Purely a picture: pages carry the name as real text too. */
export function TowerSign({ cell, className = "" }: { cell: string; className?: string }) {
  return (
    <div className={`tower ${className}`} style={{ "--cell": cell } as React.CSSProperties} aria-hidden="true">
      {"TRAITORS".split("").map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}

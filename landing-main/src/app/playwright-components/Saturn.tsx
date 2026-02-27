import './Saturn.css';

interface SaturnProps {
  left: number;
  top: number;
  scale?: number;
}

export default function Saturn({ left, top, scale = 0.3 }: SaturnProps) {
  return (
    <div
      id="saturn"
      className="saturn-wrap"
      aria-hidden
      style={{
        left: `${left}px`,
        top: `${top}px`,
        transform: `translate(-50%, -50%) rotateZ(-15deg) scale(${scale})`,
      }}
    >
      <div className="planet bottom planet-bg" />
      <div className="rings" />
      <div className="planet top planet-bg" />
    </div>
  );
}

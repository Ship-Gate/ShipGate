interface BadgeProps {
  text: string;
  color: string;
  bg: string;
}

export function Badge({ text, color, bg }: BadgeProps) {
  return (
    <span
      className="font-mono text-[10px] font-bold py-0.5 px-2 rounded-[3px]"
      style={{
        color,
        background: bg,
        border: `1px solid ${color}33`,
      }}
    >
      {text}
    </span>
  );
}

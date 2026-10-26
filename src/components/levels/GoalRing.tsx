import type { ReactNode } from 'react';

interface GoalRingProps {
  value: number;
  goal: number;
  size?: number;
  children?: ReactNode;
}

/** A ring that fills toward the daily XP goal, with an icon in the middle. */
const GoalRing = ({ value, goal, size = 40, children }: GoalRingProps) => {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(value / Math.max(goal, 1), 1);
  const done = f >= 1;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={done ? 'Daily goal met' : `Daily goal: ${value} of ${goal} XP`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  );
};

export default GoalRing;

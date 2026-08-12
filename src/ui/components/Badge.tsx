import type { ReactNode } from 'react';

type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  accent: 'bg-accent/15 text-accent-hover border-accent/30',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  neutral: 'bg-bg-raised text-text-muted border-border',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

export function confidenceTone(score: number): Tone {
  if (score >= 90) return 'success';
  if (score >= 50) return 'accent';
  if (score >= 25) return 'warning';
  return 'danger';
}

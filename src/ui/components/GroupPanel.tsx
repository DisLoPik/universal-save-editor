import type { FieldValue, LeafFieldInstance } from '../../core/field/field-codec';
import { FieldRenderer } from './FieldRenderer';

interface GroupPanelProps {
  groupName: string;
  instances: LeafFieldInstance[];
  values: Map<string, FieldValue>;
  errors: Map<string, string>;
  searchTerm: string;
  isFieldVisible: (instance: LeafFieldInstance) => boolean;
  isFieldDirty: (instanceId: string) => boolean;
  onChange: (instanceId: string, value: FieldValue) => void;
  onReset: (instanceId: string) => void;
  defaultOpen?: boolean;
}

export function GroupPanel({
  groupName,
  instances,
  values,
  errors,
  searchTerm,
  isFieldVisible,
  isFieldDirty,
  onChange,
  onReset,
  defaultOpen = true,
}: GroupPanelProps) {
  const term = searchTerm.trim().toLowerCase();
  const visibleInstances = instances.filter((instance) => {
    if (!isFieldVisible(instance)) return false;
    if (!term) return true;
    return instance.name.toLowerCase().includes(term) || instance.instanceId.toLowerCase().includes(term);
  });

  if (visibleInstances.length === 0) return null;

  return (
    <details open={defaultOpen} className="group rounded-xl border border-border bg-bg-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3.5 select-none">
        <span className="text-sm font-semibold text-text">{groupName}</span>
        <span className="flex items-center gap-3 text-xs text-text-faint">
          {visibleInstances.length} field{visibleInstances.length === 1 ? '' : 's'}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="divide-y divide-border/60 border-t border-border px-5">
        {visibleInstances.map((instance) => (
          <FieldRenderer
            key={instance.instanceId}
            instance={instance}
            value={values.get(instance.instanceId)}
            error={errors.get(instance.instanceId)}
            isDirty={isFieldDirty(instance.instanceId)}
            onChange={(value) => onChange(instance.instanceId, value)}
            onReset={() => onReset(instance.instanceId)}
          />
        ))}
      </div>
    </details>
  );
}

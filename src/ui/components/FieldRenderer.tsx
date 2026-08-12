import { useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { FieldValue, LeafFieldInstance } from '../../core/field/field-codec';
import { bytesToHex, hexToBytes } from '../../utils/bytes';

interface FieldRendererProps {
  instance: LeafFieldInstance;
  value: FieldValue | undefined;
  error?: string;
  isDirty: boolean;
  onChange: (value: FieldValue) => void;
  onReset: () => void;
}

function FieldShell({
  instance,
  error,
  isDirty,
  onReset,
  children,
}: {
  instance: LeafFieldInstance;
  error?: string;
  isDirty: boolean;
  onReset: () => void;
  children: ReactNode;
}) {
  const inputId = `field-${instance.instanceId}`;
  return (
    <div className="grid grid-cols-1 gap-1.5 py-2.5 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center sm:gap-4">
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm text-text-muted">
        {instance.name}
        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Modified" aria-label="Modified" />}
      </label>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {children}
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        {isDirty && (
          <button
            type="button"
            onClick={onReset}
            className="mt-0.5 shrink-0 rounded-md px-2 py-1 text-xs text-text-faint hover:bg-bg-raised hover:text-text"
            title="Reset to original value"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-border bg-bg-inset px-3 py-1.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50';

export function FieldRenderer({ instance, value, error, isDirty, onChange, onReset }: FieldRendererProps) {
  const { field } = instance;
  const readOnly = field.readOnly ?? false;

  if (field.type === 'boolean') {
    return (
      <FieldShell instance={instance} error={error} isDirty={isDirty} onReset={onReset}>
        <input
          id={`field-${instance.instanceId}`}
          type="checkbox"
          checked={Boolean(value)}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-bg-inset text-accent focus:ring-1 focus:ring-accent/50"
        />
      </FieldShell>
    );
  }

  if (field.type === 'enum') {
    const values = field.values ?? {};
    const current = String(value ?? '');
    return (
      <FieldShell instance={instance} error={error} isDirty={isDirty} onReset={onReset}>
        <select
          id={`field-${instance.instanceId}`}
          className={inputClass}
          value={current}
          disabled={readOnly}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(Number(e.target.value))}
        >
          {!(current in values) && <option value={current}>Unknown ({current})</option>}
          {Object.entries(values).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (field.type === 'hexBytes') {
    return <HexBytesInput instance={instance} value={value} error={error} isDirty={isDirty} onChange={onChange} onReset={onReset} />;
  }

  if (field.type === 'string') {
    return (
      <FieldShell instance={instance} error={error} isDirty={isDirty} onReset={onReset}>
        <input
          id={`field-${instance.instanceId}`}
          type="text"
          className={`${inputClass} font-mono`}
          value={String(value ?? '')}
          disabled={readOnly}
          maxLength={field.length}
          onChange={(e) => onChange(e.target.value)}
        />
      </FieldShell>
    );
  }

  if (field.type === 'uint64' || field.type === 'int64') {
    return (
      <FieldShell instance={instance} error={error} isDirty={isDirty} onReset={onReset}>
        <input
          id={`field-${instance.instanceId}`}
          type="text"
          inputMode="numeric"
          pattern={field.type === 'int64' ? '-?[0-9]*' : '[0-9]*'}
          className={`${inputClass} font-mono`}
          value={String(value ?? '0')}
          disabled={readOnly}
          onChange={(e) => {
            const trimmed = e.target.value.trim();
            if (/^-?\d*$/.test(trimmed)) onChange(trimmed === '' || trimmed === '-' ? 0n : BigInt(trimmed));
          }}
        />
      </FieldShell>
    );
  }

  // Remaining numeric types: uint8/16/32, int8/16/32, float32/64, bitfield.
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  const showSlider =
    field.min !== undefined && field.max !== undefined && field.max - field.min > 0 && field.max - field.min <= 1000;
  const step = field.step ?? (field.type === 'float32' || field.type === 'float64' ? 0.01 : 1);

  return (
    <FieldShell instance={instance} error={error} isDirty={isDirty} onReset={onReset}>
      <div className="flex items-center gap-3">
        {showSlider && (
          <input
            type="range"
            className="h-1.5 flex-1 accent-accent"
            min={field.min}
            max={field.max}
            step={step}
            value={numericValue}
            disabled={readOnly}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        )}
        <input
          id={`field-${instance.instanceId}`}
          type="number"
          className={`${inputClass} ${showSlider ? 'w-28 shrink-0' : ''} font-mono`}
          value={Number.isFinite(numericValue) ? numericValue : ''}
          min={field.min}
          max={field.max}
          step={step}
          disabled={readOnly}
          onChange={(e) => {
            const parsed = e.target.valueAsNumber;
            onChange(Number.isNaN(parsed) ? 0 : parsed);
          }}
        />
      </div>
    </FieldShell>
  );
}

function HexBytesInput({
  instance,
  value,
  error,
  isDirty,
  onChange,
  onReset,
}: {
  instance: LeafFieldInstance;
  value: FieldValue | undefined;
  error?: string;
  isDirty: boolean;
  onChange: (value: FieldValue) => void;
  onReset: () => void;
}) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(0);
  const [text, setText] = useState(() => bytesToHex(bytes));
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setText(bytesToHex(bytes));
    setParseError(null);
    // Only re-sync from upstream value changes (e.g. undo/reset), not on every local keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <FieldShell instance={instance} error={error ?? parseError ?? undefined} isDirty={isDirty} onReset={onReset}>
      <textarea
        id={`field-${instance.instanceId}`}
        className={`${inputClass} min-h-[2.25rem] font-mono text-xs`}
        value={text}
        disabled={instance.field.readOnly}
        rows={Math.max(1, Math.ceil(bytes.length / 16))}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = hexToBytes(e.target.value);
            if (instance.field.length !== undefined && parsed.length !== instance.field.length) {
              setParseError(`Expected exactly ${instance.field.length} bytes, got ${parsed.length}`);
              return;
            }
            setParseError(null);
            onChange(parsed);
          } catch (err) {
            setParseError((err as Error).message);
          }
        }}
      />
    </FieldShell>
  );
}

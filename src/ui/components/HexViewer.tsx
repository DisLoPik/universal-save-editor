import { useState } from 'react';
import { hexToBytes, indexOfBytes } from '../../utils/bytes';
import { Button } from './Button';

const BYTES_PER_ROW = 16;
const ROWS_PER_PAGE = 32;
const PAGE_BYTES = BYTES_PER_ROW * ROWS_PER_PAGE;

interface HexViewerProps {
  data: Uint8Array;
}

export function HexViewer({ data }: HexViewerProps) {
  const [page, setPage] = useState(0);
  const [searchMode, setSearchMode] = useState<'hex' | 'ascii'>('hex');
  const [search, setSearch] = useState('');
  const [match, setMatch] = useState<{ offset: number; length: number } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_BYTES));

  const runSearch = () => {
    setNotFound(false);
    let needle: Uint8Array;
    try {
      needle = searchMode === 'hex' ? hexToBytes(search) : new TextEncoder().encode(search);
    } catch {
      setNotFound(true);
      return;
    }
    if (needle.length === 0) return;
    const from = match ? match.offset + 1 : 0;
    let idx = indexOfBytes(data, needle, from);
    if (idx < 0 && from > 0) idx = indexOfBytes(data, needle, 0); // wrap around
    if (idx < 0) {
      setMatch(null);
      setNotFound(true);
      return;
    }
    setMatch({ offset: idx, length: needle.length });
    setPage(Math.floor(idx / PAGE_BYTES));
  };

  const start = page * PAGE_BYTES;
  const end = Math.min(data.length, start + PAGE_BYTES);
  const rowStarts: number[] = [];
  for (let r = start; r < end; r += BYTES_PER_ROW) rowStarts.push(r);

  return (
    <div className="rounded-xl border border-border bg-bg-inset">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <select
          value={searchMode}
          onChange={(e) => setSearchMode(e.target.value as 'hex' | 'ascii')}
          className="rounded-md border border-border bg-bg-panel px-2 py-1 text-xs text-text"
        >
          <option value="hex">Hex</option>
          <option value="ascii">Text</option>
        </select>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setMatch(null);
            setNotFound(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder={searchMode === 'hex' ? 'e.g. 45 58 41 4D' : 'search text'}
          className="min-w-0 flex-1 rounded-md border border-border bg-bg-panel px-2 py-1 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
        <Button size="sm" variant="secondary" onClick={runSearch}>
          Find next
        </Button>
        {notFound && <span className="text-xs text-danger">Not found</span>}
        {match && <span className="text-xs text-text-faint">at offset 0x{match.offset.toString(16).toUpperCase()}</span>}
        <div className="ml-auto flex items-center gap-2 text-xs text-text-muted">
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-bg-raised disabled:opacity-30"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>
          <span>
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-bg-raised disabled:opacity-30"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
      <div className="overflow-x-auto p-3 font-mono text-xs leading-6">
        {rowStarts.map((rowStart) => {
          const rowBytes = data.subarray(rowStart, Math.min(data.length, rowStart + BYTES_PER_ROW));
          return (
            <div key={rowStart} className="flex gap-4 whitespace-pre">
              <span className="text-text-faint">{rowStart.toString(16).padStart(8, '0').toUpperCase()}</span>
              <span>
                {Array.from(rowBytes).map((b, i) => {
                  const offset = rowStart + i;
                  const isMatch = match && offset >= match.offset && offset < match.offset + match.length;
                  return (
                    <span key={i} className={isMatch ? 'rounded bg-accent/40 text-text' : 'text-text-muted'}>
                      {b.toString(16).padStart(2, '0').toUpperCase()}{' '}
                    </span>
                  );
                })}
              </span>
              <span className="text-text-faint">
                {Array.from(rowBytes)
                  .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
                  .join('')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

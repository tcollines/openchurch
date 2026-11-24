import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronLeft, Search, X } from 'lucide-react';
import { SearchField } from './kit';

/**
 * Check-in search. On desktop it is a normal search box. On a phone, tapping it moves the
 * search bar to the top of the screen and shows the results between the bar and the
 * keyboard, so people can see the suggestions while they type.
 */
export const SearchTakeover: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** One line under the bar, e.g. the service being checked in to. */
  context?: React.ReactNode;
  /** Number of matches, shown above the results. */
  count?: number;
  /** The results; rendered only while searching on a phone. */
  children: React.ReactNode;
}> = ({ value, onChange, placeholder, context, count, children }) => {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const openSearch = () => {
    // Render synchronously so the input can take focus inside the tap (needed for iOS keyboards).
    flushSync(() => setOpen(true));
    input.current?.focus();
  };
  const close = () => {
    setOpen(false);
    input.current?.blur();
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <div className="hidden md:block">
        <SearchField value={value} onChange={onChange} placeholder={placeholder} />
      </div>
      <button
        type="button"
        onClick={openSearch}
        className="md:hidden w-full flex items-center gap-2.5 h-[52px] px-4 rounded-2xl bg-white text-left"
      >
        <Search className="w-5 h-5 shrink-0 text-church-muted" strokeWidth={1.8} />
        <span className={`flex-1 min-w-0 truncate text-base ${value ? 'text-church-text' : 'text-church-faint'}`}>{value || placeholder}</span>
        {value && <span className="oc-sub shrink-0">{count ?? ''} found</span>}
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Search" className="md:hidden fixed inset-0 z-40 bg-church-canvas flex flex-col h-[100dvh]">
          <div className="shrink-0 bg-church-canvas px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 flex flex-col gap-2.5 shadow-[0_6px_16px_-10px_rgba(15,36,24,0.25)]">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                className="oc-press w-11 h-11 shrink-0 rounded-[14px] bg-white flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <label className="flex-1 min-w-0 flex items-center gap-2.5 h-[50px] pl-3.5 pr-2.5 rounded-2xl bg-white border-2 border-church-forest text-church-muted">
                <Search className="w-5 h-5 shrink-0" strokeWidth={1.8} />
                <input
                  ref={input}
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  aria-label={placeholder}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 min-w-0 bg-transparent outline-none text-base text-church-text placeholder:text-church-faint [&::-webkit-search-cancel-button]:hidden"
                />
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('');
                      input.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="w-[26px] h-[26px] shrink-0 rounded-full bg-[#E2E5DF] text-[#3E4741] flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </label>
            </div>
            {context && (
              <span className="flex items-center gap-2 text-[13px] font-semibold text-church-muted">
                <span className="w-2 h-2 rounded-full bg-church-lime shrink-0" />
                <span className="truncate">{context}</span>
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-1 pb-6 flex flex-col gap-3">
            {count !== undefined && (
              <span className="oc-sub pt-1.5">
                {value.trim() ? `${count} ${count === 1 ? 'match' : 'matches'}` : 'Start typing a name, phone or area'}
              </span>
            )}
            {children}
          </div>
        </div>
      )}
    </>
  );
};

/** Bold the part of a name that matches what was typed. */
export const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b className="bg-[#EEF8DC] text-church-text rounded font-bold">{text.slice(i, i + q.length)}</b>
      {text.slice(i + q.length)}
    </>
  );
};

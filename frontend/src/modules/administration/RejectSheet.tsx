import React, { useEffect, useState } from 'react';
import { FileText, Send } from 'lucide-react';
import { MobileSheet } from '@/components/ui/FormControls';

const QUICK = ['Quantities too high', 'Needs a quote', 'Not in the workplan', 'Wrong month', 'Prices look too high'];

/** Administration sends a requisition or workplan back. A comment is required. */
export const RejectSheet: React.FC<{
  target: { title: string; sub: string; dept: string } | null;
  onClose: () => void;
  onReject: (comment: string) => void;
}> = ({ target, onClose, onReject }) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setComment('');
    setError('');
  }, [target?.title]);
  if (!target) return null;
  const add = (q: string) => setComment((c) => (c.trim() ? `${c.trim().replace(/[.]?$/, '.')} ${q}.` : `${q}.`));
  return (
    <MobileSheet open onClose={onClose} title={`Send back to ${target.dept}?`} subtitle="A comment is required so they know what to fix.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (comment.trim().length < 5) return setError('Write a short comment explaining what to change.');
          onReject(comment.trim());
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#F6F7F3]">
          <span className="w-10 h-10 rounded-xl bg-[#FCEFD9] text-[#7A4300] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold truncate">{target.title}</span>
            <span className="oc-sub truncate">{target.sub}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => add(q)} className="oc-press h-[34px] px-3 rounded-full bg-church-canvas text-[13px] font-semibold">
              {q}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="oc-label">Why are you sending it back?</span>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setError('');
            }}
            placeholder="e.g. Welcome cards are too many — 60 is enough. Please get a quote for the table cloths."
            className="rounded-[14px] border-[1.5px] border-church-forest bg-white px-3.5 py-3 text-base leading-[1.45] outline-none resize-none"
          />
        </label>
        <span className="oc-sub -mt-2">The head of {target.dept} will see this, make the changes and resubmit.</span>
        {error && (
          <p role="alert" className="m-0 text-sm font-medium text-church-neg">
            {error}
          </p>
        )}
        <button type="submit" className="oc-btn w-full bg-church-neg text-white">
          <Send className="w-5 h-5" /> Reject &amp; send back
        </button>
        <button type="button" onClick={onClose} className="oc-btn-ghost w-full">
          Cancel
        </button>
      </form>
    </MobileSheet>
  );
};

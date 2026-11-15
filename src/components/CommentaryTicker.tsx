import { Mic } from 'lucide-react';

interface CommentaryTickerProps {
  commentary: string;
  isLoading: boolean;
  error: string | null;
  ballNumber: number | null;
}

export function CommentaryTicker({
  commentary,
  isLoading,
  error,
  ballNumber,
}: CommentaryTickerProps) {
  const safeError =
    error &&
    !error.includes('429') &&
    !error.includes('RESOURCE_EXHAUSTED') &&
    !error.trim().startsWith('{')
      ? error
      : null;

  const safeCommentary =
    commentary &&
    !commentary.includes('RESOURCE_EXHAUSTED') &&
    !commentary.includes('"code":429') &&
    !commentary.trim().startsWith('{')
      ? commentary
      : '';

  if (!safeCommentary && !isLoading && !safeError) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto w-full max-w-3xl rounded-xl border border-white/12 bg-[#070d19]/94 px-4 py-2.5 shadow-2xl"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex shrink-0 items-center gap-1.5 text-[11px] font-bold tracking-wider text-amber-400">
          <Mic className="h-3.5 w-3.5" />
          <span>{ballNumber ? `BALL ${ballNumber}` : 'LIVE'}</span>
        </div>

        <div className="min-w-0 flex-1 text-xs leading-relaxed text-slate-200 sm:text-sm">
          {safeError ? (
            <span className="line-clamp-2 break-words text-rose-300">{safeError}</span>
          ) : isLoading ? (
            <span className="text-slate-400">
              Calling the action from the commentary box...
            </span>
          ) : (
            <span className="line-clamp-3 break-words">{safeCommentary}</span>
          )}
        </div>
      </div>
    </div>
  );
}

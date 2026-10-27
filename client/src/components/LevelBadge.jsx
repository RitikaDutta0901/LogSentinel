const LEVEL_STYLES = {
  ERROR: 'bg-red-500/10 text-red-400 ring-red-500/25',
  WARN: 'bg-amber-500/10 text-amber-400 ring-amber-500/25',
  INFO: 'bg-sky-500/10 text-sky-400 ring-sky-500/25',
};

export const LevelBadge = ({ level }) => (
  <span
    className={`inline-flex w-14 justify-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider ring-1 ring-inset ${
      LEVEL_STYLES[level] ?? 'bg-slate-500/10 text-slate-400 ring-slate-500/25'
    }`}
  >
    {level}
  </span>
);

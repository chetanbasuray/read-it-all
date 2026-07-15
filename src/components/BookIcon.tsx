export function BookIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M16 9 Q10 5 4 7 L4 24 Q10 22 16 26 Z"
        className="fill-blue-600 dark:fill-blue-400"
      />
      <path
        d="M16 9 Q22 5 28 7 L28 24 Q22 22 16 26 Z"
        className="fill-blue-600 dark:fill-blue-400"
      />
      <line
        x1="16"
        y1="9"
        x2="16"
        y2="26"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="stroke-blue-700 dark:stroke-blue-300"
      />
    </svg>
  );
}

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  size = 20,
  color = "currentColor",
  className = "",
  label = "",
}: LoadingSpinnerProps) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`animate-spin ${className}`}
        style={{ color }}
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.25"
        />

        <path
          d="M21 12a9 9 0 0 0-9-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label.length && <span>{label}</span>}
    </span>
  );
}

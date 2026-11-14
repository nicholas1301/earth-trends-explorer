import type { ReactNode } from "react";

export function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="status" role="status">
      <span className="spinner" />
      {children}
    </div>
  );
}

export function ErrorMessage({ children, onRetry, retryLabel = "Try again" }: { children: ReactNode; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="status error" role="alert">
      {children}{" "}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="status">{children}</div>;
}

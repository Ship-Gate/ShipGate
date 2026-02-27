export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-10 h-10 rounded-full bg-sg-noship/10 flex items-center justify-center mb-3">
        <span className="text-sg-noship text-lg">!</span>
      </div>
      <h3 className="text-sm font-semibold text-sg-text1 mb-1">Something went wrong</h3>
      <p className="text-xs text-sg-text3 max-w-sm mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-sg-accent hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

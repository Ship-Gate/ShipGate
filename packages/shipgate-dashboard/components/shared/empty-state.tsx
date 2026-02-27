export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <span className="text-3xl mb-3 opacity-50">{icon}</span>}
      <h3 className="text-sm font-semibold text-sg-text1 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-sg-text3 max-w-sm">{description}</p>
      )}
    </div>
  );
}

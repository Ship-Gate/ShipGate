import { clsx } from "clsx";
import { Info, AlertTriangle, CheckCircle, XCircle, Lightbulb } from "lucide-react";
import { ReactNode } from "react";

type CalloutType = "info" | "warning" | "tip" | "danger" | "success";

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

const calloutConfig: Record<CalloutType, { icon: typeof Info; className: string; defaultTitle: string }> = {
  info: {
    icon: Info,
    className: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    defaultTitle: "Info",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    defaultTitle: "Warning",
  },
  tip: {
    icon: Lightbulb,
    className: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300",
    defaultTitle: "Tip",
  },
  danger: {
    icon: XCircle,
    className: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
    defaultTitle: "Danger",
  },
  success: {
    icon: CheckCircle,
    className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    defaultTitle: "Success",
  },
};

export function Callout({ type = "info", title, children }: CalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;
  const displayTitle = title || config.defaultTitle;

  return (
    <div
      className={clsx(
        "my-6 flex gap-3 rounded-lg border p-4",
        config.className
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {displayTitle && (
          <p className="font-semibold mb-1">{displayTitle}</p>
        )}
        <div className="text-sm [&>p]:mb-0 [&>p:last-child]:mb-0">
          {children}
        </div>
      </div>
    </div>
  );
}

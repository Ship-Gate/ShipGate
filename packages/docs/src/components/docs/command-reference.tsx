import { ReactNode } from "react";
import { Terminal } from "lucide-react";

interface Flag {
  name: string;
  alias?: string;
  type: string;
  description: string;
  default?: string;
  required?: boolean;
}

interface CommandReferenceProps {
  command: string;
  description: string;
  usage: string;
  flags?: Flag[];
  examples?: { description: string; code: string }[];
  children?: ReactNode;
}

export function CommandReference({
  command,
  description,
  usage,
  flags = [],
  examples = [],
  children,
}: CommandReferenceProps) {
  return (
    <div className="my-8">
      {/* Command Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Terminal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-mono font-semibold">{command}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Usage */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
          Usage
        </h4>
        <div className="bg-card border border-border rounded-lg p-3 font-mono text-sm">
          {usage}
        </div>
      </div>

      {/* Flags Table */}
      {flags.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            Flags
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-semibold">Flag</th>
                  <th className="text-left py-2 px-3 font-semibold">Type</th>
                  <th className="text-left py-2 px-3 font-semibold">Description</th>
                  <th className="text-left py-2 px-3 font-semibold">Default</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.name} className="border-b border-border/50">
                    <td className="py-2 px-3">
                      <code className="text-primary font-mono">
                        --{flag.name}
                        {flag.alias && (
                          <span className="text-muted-foreground">
                            , -{flag.alias}
                          </span>
                        )}
                      </code>
                      {flag.required && (
                        <span className="ml-2 text-xs text-red-500">required</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      <code className="text-xs">{flag.type}</code>
                    </td>
                    <td className="py-2 px-3">{flag.description}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {flag.default || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Examples */}
      {examples.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            Examples
          </h4>
          <div className="space-y-4">
            {examples.map((example, i) => (
              <div key={i}>
                <p className="text-sm text-muted-foreground mb-2">
                  {example.description}
                </p>
                <div className="bg-card border border-border rounded-lg p-3 font-mono text-sm overflow-x-auto">
                  <code>{example.code}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Content */}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

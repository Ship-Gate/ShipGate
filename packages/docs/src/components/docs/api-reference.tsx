import { ReactNode } from "react";
import { Code2 } from "lucide-react";

interface Parameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  default?: string;
}

interface ReturnType {
  type: string;
  description: string;
}

interface APIReferenceProps {
  name: string;
  description: string;
  signature?: string;
  parameters?: Parameter[];
  returns?: ReturnType;
  throws?: { type: string; description: string }[];
  example?: string;
  children?: ReactNode;
}

export function APIReference({
  name,
  description,
  signature,
  parameters = [],
  returns,
  throws = [],
  example,
  children,
}: APIReferenceProps) {
  return (
    <div className="my-8 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <code className="text-lg font-semibold font-mono">{name}</code>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="p-4 space-y-6">
        {/* Signature */}
        {signature && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
              Signature
            </h4>
            <div className="bg-card border border-border rounded-lg p-3 font-mono text-sm overflow-x-auto">
              <code>{signature}</code>
            </div>
          </div>
        )}

        {/* Parameters */}
        {parameters.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Parameters
            </h4>
            <div className="space-y-3">
              {parameters.map((param) => (
                <div
                  key={param.name}
                  className="flex flex-col sm:flex-row sm:items-start gap-2 pb-3 border-b border-border/50 last:border-0 last:pb-0"
                >
                  <div className="sm:w-1/3">
                    <code className="text-primary font-mono">{param.name}</code>
                    {param.required && (
                      <span className="ml-2 text-xs text-red-500">required</span>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <code>{param.type}</code>
                    </div>
                  </div>
                  <div className="sm:w-2/3 text-sm">
                    <p>{param.description}</p>
                    {param.default && (
                      <p className="text-muted-foreground mt-1">
                        Default: <code>{param.default}</code>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Returns */}
        {returns && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
              Returns
            </h4>
            <div className="flex items-start gap-2">
              <code className="text-sm text-muted-foreground">{returns.type}</code>
              <span className="text-sm">{returns.description}</span>
            </div>
          </div>
        )}

        {/* Throws */}
        {throws.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
              Throws
            </h4>
            <div className="space-y-2">
              {throws.map((error, i) => (
                <div key={i} className="flex items-start gap-2">
                  <code className="text-sm text-red-500">{error.type}</code>
                  <span className="text-sm text-muted-foreground">
                    {error.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Example */}
        {example && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
              Example
            </h4>
            <div className="bg-card border border-border rounded-lg p-3 font-mono text-sm overflow-x-auto">
              <pre>{example}</pre>
            </div>
          </div>
        )}

        {/* Additional Content */}
        {children}
      </div>
    </div>
  );
}

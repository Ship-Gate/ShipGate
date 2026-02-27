# @isl-lang/codegen-k8s

Generate Kubernetes manifests (Deployment, Service, ConfigMap, Secret, Ingress) from ISL domain definitions. All output is deterministic and dry-run validated.

## Installation

```bash
pnpm add @isl-lang/codegen-k8s
```

## Usage

```typescript
import { generate, generateCombined } from '@isl-lang/codegen-k8s';

// Produce individual manifest files
const result = generate(domain, {
  namespace: 'production',
  imageRegistry: 'ghcr.io/myorg',
  replicas: 3,
});

for (const file of result.files) {
  console.log(file.path, file.content);
}

// Or produce a single multi-doc YAML
const yaml = generateCombined(domain);
```

## What Gets Inferred

| ISL Concept | K8s Resource | Inference Rule |
|---|---|---|
| Domain name + version | All resources | `metadata.name` = kebab-cased domain name; `app.kubernetes.io/version` = domain version |
| Entity fields | ConfigMap `data` | Each entity field becomes an env-var key (`ENTITY_FIELD`). Defaults are inferred from type (Boolean → `"false"`, numeric → `"0"`, others → `""`) |
| Fields with `[secret]` / `[sensitive]` annotations or names containing `password`, `token`, `key`, `secret`, `credential` | Secret `stringData` | Moved from ConfigMap to Secret with a `CHANGE_ME_*` placeholder value |
| Behaviors (any present) | Deployment container port | Port defaults to `8080` when behaviors exist (HTTP service assumed) |
| Behavior names | Ingress paths | Each behavior name is kebab-cased into an Ingress path rule (e.g., `Login` → `/login`) |
| Domain version | Container image tag | `image: <slug>:<domain.version>` unless `imageTag` is overridden |

## Override Annotations

ISL-level annotations on the domain or entities can override inferred values:

| Annotation | Effect | Example |
|---|---|---|
| `@port(<n>)` on domain | Sets the container port | `@port(3000)` |
| `[secret]` on field | Promotes field to Secret instead of ConfigMap | `password: String [secret]` |
| `[sensitive]` on field | Same as `[secret]` | `token: String [sensitive]` |

## GenerateOptions Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `namespace` | `string` | _none_ | K8s namespace for all resources |
| `imageRegistry` | `string` | _none_ | Container image registry prefix (e.g. `ghcr.io/myorg`) |
| `imageTag` | `string` | domain version | Container image tag |
| `replicas` | `number` | `2` | Deployment replica count |
| `containerPort` | `number` | `8080` | Container port (overrides inference) |
| `ingress.enabled` | `boolean` | `false` | Generate an Ingress resource |
| `ingress.className` | `string` | `nginx` | Ingress class |
| `ingress.host` | `string` | `<slug>.local` | Ingress hostname |
| `ingress.tlsSecret` | `string` | _none_ | TLS secret name |
| `ingress.annotations` | `Record` | _none_ | Extra ingress annotations |
| `extraLabels` | `Record` | _none_ | Labels merged into every resource |
| `extraAnnotations` | `Record` | _none_ | Annotations merged into every resource |
| `resources` | `ResourceSpec` | 100m/128Mi req, 500m/256Mi lim | Container resource requests/limits |
| `format` | `yaml \| json` | `yaml` | Output format |

## Generated Resources

For a domain called `UserAuthentication v1.0.0`:

```
user-authentication-configmap.yaml   # ConfigMap with entity-derived env vars
user-authentication-secret.yaml      # Secret with sensitive fields
user-authentication-deployment.yaml  # Deployment with probes, env, resources
user-authentication-service.yaml     # ClusterIP Service → container port
user-authentication-ingress.yaml     # (optional) Ingress with behavior paths
```

All resources share consistent labels:

```yaml
app.kubernetes.io/name: user-authentication
app.kubernetes.io/component: <resource-type>
app.kubernetes.io/version: 1.0.0
app.kubernetes.io/managed-by: isl-codegen-k8s
```

## Validation

Tests run schema-level dry-run validation equivalent to `kubectl apply --dry-run=client`:

- Every manifest has valid `apiVersion`, `kind`, `metadata.name`
- Names are DNS-compatible (lowercase, hyphens, ≤253 chars)
- Deployment selector labels are a subset of pod template labels
- Service selector matches Deployment selector
- Ingress has valid rules with backend references

## Development

```bash
pnpm build        # Build the package
pnpm test         # Run tests
pnpm typecheck    # Type-check without emit
pnpm clean        # Remove dist/
```

## License

MIT

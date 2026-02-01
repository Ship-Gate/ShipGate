// ============================================================================
// Helm Chart Generator
// ============================================================================

import type { Domain, K8sGeneratorOptions, GeneratedFile } from './types.js';

/**
 * Generate Helm chart files
 */
export function generateHelmChart(domain: Domain, options: Required<K8sGeneratorOptions>): GeneratedFile[] {
  const name = domain.name.toLowerCase();
  const chartPath = `charts/${name}`;
  const files: GeneratedFile[] = [];

  // Chart.yaml
  files.push({
    path: `${chartPath}/Chart.yaml`,
    content: generateChartYaml(domain),
  });

  // values.yaml
  files.push({
    path: `${chartPath}/values.yaml`,
    content: generateValuesYaml(domain, options),
  });

  // templates/_helpers.tpl
  files.push({
    path: `${chartPath}/templates/_helpers.tpl`,
    content: generateHelpers(domain),
  });

  // templates/deployment.yaml
  files.push({
    path: `${chartPath}/templates/deployment.yaml`,
    content: generateDeploymentTemplate(domain),
  });

  // templates/service.yaml
  files.push({
    path: `${chartPath}/templates/service.yaml`,
    content: generateServiceTemplate(domain),
  });

  // templates/ingress.yaml
  files.push({
    path: `${chartPath}/templates/ingress.yaml`,
    content: generateIngressTemplate(domain),
  });

  // templates/configmap.yaml
  files.push({
    path: `${chartPath}/templates/configmap.yaml`,
    content: generateConfigMapTemplate(domain),
  });

  // templates/hpa.yaml
  if (options.includeHPA) {
    files.push({
      path: `${chartPath}/templates/hpa.yaml`,
      content: generateHPATemplate(domain),
    });
  }

  // templates/pdb.yaml
  if (options.includePDB) {
    files.push({
      path: `${chartPath}/templates/pdb.yaml`,
      content: generatePDBTemplate(domain),
    });
  }

  // templates/serviceaccount.yaml
  files.push({
    path: `${chartPath}/templates/serviceaccount.yaml`,
    content: generateServiceAccountTemplate(domain),
  });

  // templates/servicemonitor.yaml (Prometheus)
  if (options.includeMonitoring) {
    files.push({
      path: `${chartPath}/templates/servicemonitor.yaml`,
      content: generateServiceMonitorTemplate(domain),
    });
  }

  return files;
}

function generateChartYaml(domain: Domain): string {
  return `apiVersion: v2
name: ${domain.name.toLowerCase()}
description: ${domain.description ?? `${domain.name} service`}
type: application
version: ${domain.version ?? '1.0.0'}
appVersion: "${domain.version ?? '1.0.0'}"

maintainers:
  - name: ISL Generator
    email: isl@intentos.dev

keywords:
  - isl
  - ${domain.name.toLowerCase()}

home: https://github.com/intentos/${domain.name.toLowerCase()}
`;
}

function generateValuesYaml(domain: Domain, options: Required<K8sGeneratorOptions>): string {
  const name = domain.name.toLowerCase();
  
  return `# Default values for ${name}
# Auto-generated from ISL specification

replicaCount: ${options.replicas}

image:
  repository: ${options.imageRegistry ? options.imageRegistry + '/' : ''}${name}
  pullPolicy: IfNotPresent
  tag: "${options.imageTag}"

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "${domain.config?.port ?? 8080}"
  prometheus.io/path: "/metrics"

podSecurityContext:
  fsGroup: 1000

securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL

service:
  type: ClusterIP
  port: 80
  targetPort: ${domain.config?.port ?? 8080}

ingress:
  enabled: false
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: ${name}.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${name}-tls
      hosts:
        - ${name}.example.com

resources:
  limits:
    cpu: ${options.resources.limits.cpu}
    memory: ${options.resources.limits.memory}
  requests:
    cpu: ${options.resources.requests.cpu}
    memory: ${options.resources.requests.memory}

autoscaling:
  enabled: true
  minReplicas: ${options.replicas}
  maxReplicas: ${options.replicas * 5}
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

pdb:
  enabled: true
  minAvailable: 50%

nodeSelector: {}

tolerations: []

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: ${name}
          topologyKey: kubernetes.io/hostname

livenessProbe:
  httpGet:
    path: ${domain.config?.livenessPath ?? '/health/live'}
    port: http
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: ${domain.config?.readinessPath ?? '/health/ready'}
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

env: {}

secrets:
  databaseUrl: ""
  apiKey: ""

config:
  service: ${name}
  logLevel: info
`;
}

function generateHelpers(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `{{/*
Expand the name of the chart.
*/}}
{{- define "${name}.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "${name}.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "${name}.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "${name}.labels" -}}
helm.sh/chart: {{ include "${name}.chart" . }}
{{ include "${name}.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "${name}.selectorLabels" -}}
app.kubernetes.io/name: {{ include "${name}.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "${name}.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "${name}.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
`;
}

function generateDeploymentTemplate(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "${name}.fullname" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "${name}.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      {{- with .Values.podAnnotations }}
      annotations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      labels:
        {{- include "${name}.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "${name}.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            {{- toYaml .Values.livenessProbe | nindent 12 }}
          readinessProbe:
            {{- toYaml .Values.readinessProbe | nindent 12 }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          env:
            - name: SERVICE_NAME
              value: {{ include "${name}.fullname" . }}
            {{- range $key, $value := .Values.env }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: tmp
          emptyDir: {}
        - name: config
          configMap:
            name: {{ include "${name}.fullname" . }}-config
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
`;
}

function generateServiceTemplate(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `apiVersion: v1
kind: Service
metadata:
  name: {{ include "${name}.fullname" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
      protocol: TCP
      name: http
  selector:
    {{- include "${name}.selectorLabels" . | nindent 4 }}
`;
}

function generateIngressTemplate(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "${name}.fullname" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "${name}.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
`;
}

function generateConfigMapTemplate(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "${name}.fullname" . }}-config
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
data:
  config.json: |
    {{- .Values.config | toPrettyJson | nindent 4 }}
`;
}

function generateHPATemplate(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "${name}.fullname" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "${name}.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    {{- if .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    {{- end }}
    {{- if .Values.autoscaling.targetMemoryUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
    {{- end }}
{{- end }}
`;
}

function generatePDBTemplate(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `{{- if .Values.pdb.enabled }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "${name}.fullname" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
spec:
  minAvailable: {{ .Values.pdb.minAvailable }}
  selector:
    matchLabels:
      {{- include "${name}.selectorLabels" . | nindent 6 }}
{{- end }}
`;
}

function generateServiceAccountTemplate(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `{{- if .Values.serviceAccount.create -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "${name}.serviceAccountName" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
  {{- with .Values.serviceAccount.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end }}
`;
}

function generateServiceMonitorTemplate(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "${name}.fullname" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
spec:
  selector:
    matchLabels:
      {{- include "${name}.selectorLabels" . | nindent 6 }}
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
`;
}

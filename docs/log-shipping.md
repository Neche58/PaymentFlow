# Centralised Log Shipping (#371)

## Overview

PaymentFlow deploys a **Fluent Bit DaemonSet** to every Kubernetes node to collect
all pod stdout/stderr logs, parse structured JSON fields, enrich with Kubernetes
metadata, and forward to a central observability platform (Loki by default;
Elasticsearch and Datadog are also supported).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Kubernetes Node                                     │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ API Pod  │  │ Worker   │  │ Migr. Job│           │
│  │ (stdout) │  │ (stdout) │  │ (stdout) │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │              │              │                │
│       ▼              ▼              ▼                │
│  /var/log/containers/*.log  (container runtime)     │
│       │                                              │
│       ▼                                              │
│  ┌──────────────────────────────────────────────┐  │
│  │  Fluent Bit DaemonSet (1 pod per node)        │  │
│  │  • Tail /var/log/containers/*.log              │  │
│  │  • Parse JSON (Winston structured output)     │  │
│  │  • Enrich with pod/namespace labels            │  │
│  │  • Tag by log level (debug/info/warn/error)   │  │
│  └──────────────────┬───────────────────────────┘  │
│                     │                              │
└─────────────────────┼──────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │     Loki       │
              │  (or ES/DD)    │
              │  per-level     │
              │  streams      │
              └───────────────┘
```

## Log Retention Policy

| Level   | Retention | Rationale                                     |
|---------|-----------|-----------------------------------------------|
| DEBUG   | 3 days    | High volume, only needed for recent debugging |
| INFO    | 14 days   | Operational visibility for a sprint cycle     |
| WARN    | 90 days   | Security investigations, trend analysis       |
| ERROR   | 90 days   | Incident post-mortems, compliance audits      |

Retention is enforced by Loki stream retention rules (see
`deploy/k8s/logging/kustomization.yaml` for the configuration snippet).

## Indexed Fields

The Fluent Bit `kubernetes` filter enriches every log record with:
- `namespace_name` — Kubernetes namespace
- `pod_name` — pod name
- `container_name` — container within the pod
- `labels` — pod labels (e.g. `app=backend`)

The `paymentflow_json` parser and `Merge_Log` promote the Winston JSON
fields to top-level queryable fields:
- `correlationId` — cross-service correlation ID (indexed as a Loki label)
- `schoolId` — tenant school identifier
- `studentId` — student reference (when present)
- `txHash` — Stellar transaction hash (when present)
- `level` → `log_level` — log severity (used for retention tagging)
- `msg` — human-readable log message
- `requestId` — per-request unique ID

## Log-Based Alerts

Defined in `monitoring/alerts/log_shipping.yml`:

| Alert                       | Trigger                                        | Severity |
|-----------------------------|-------------------------------------------------|----------|
| `FluentBitInputStalled`     | No bytes read from kube.* input for 5m         | warning  |
| `FluentBitOutputErrors`     | Output error rate > 0 for 5m                    | warning  |
| `PaymentBackendRepeatedErrors` | ERROR log rate > 2/s for 3m                | warning  |
| `AuthFailureSpike`          | WARN log rate > 10/s for 2m                     | warning  |
| `PaymentProcessingErrors`   | ERROR log rate > 1/s for 5m                     | critical |

## Deployment

### Prerequisites

1. Create the `logging` namespace and Fluent Bit Secret:

```bash
kubectl create namespace logging

kubectl -n logging create secret generic fluent-bit-secrets \
  --from-literal=LOKI_HOST=loki.monitoring.svc.cluster.local \
  --from-literal=LOKI_PORT=3100 \
  --from-literal=LOKI_USERNAME=paymentflow \
  --from-literal=LOKI_PASSWORD=<your-loki-token>
```

2. Configure Loki retention rules (see `kustomization.yaml` comments for
   the per-stream retention configuration).

### Apply

```bash
kubectl apply -k deploy/k8s/logging
```

### Verify

```bash
# DaemonSet running on all nodes
kubectl -n logging get ds fluent-bit

# Logs flowing
kubectl -n logging logs -l app=fluent-bit --tail=20

# Prometheus metrics
curl http://<fluent-bit-pod>:2020/api/v1/metrics/prometheus
```

## Querying Logs in Loki

```logql
# All ERROR logs from the backend in the last hour
{job="paymentflow", level="error"} | json | line_format "{{.msg}}"

# Correlate by correlationId across services
{job="paymentflow"} | json | correlationId="corr_abc123"

# Auth failures in the last 24h
{job="paymentflow", level="warn"} | json | msg =~ "(?i)auth|unauthori[sz]ed|forbidden"

# Payment processing errors by school
{job="paymentflow", level="error"} | json
  | msg =~ "(?i)payment|transaction|stellar|horizon"
  | schoolId="SCH-DEFAULT"
```

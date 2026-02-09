# Shipgate CI Templates

This directory contains CI integration templates for all major CI providers.

## Quick Start

1. **Choose your CI provider** from the table below
2. **Copy the template** into your repository
3. **Customize** the `path` and `fail_on` options as needed

## Templates

| Provider | Template | Format | Documentation |
|----------|----------|--------|---------------|
| GitLab CI | `gitlab/.gitlab-ci.yml` | GitLab Code Quality JSON | [docs/guides/ci-integration.md](../../docs/guides/ci-integration.md#gitlab-ci) |
| Bitbucket | `bitbucket/bitbucket-pipelines.yml` | JUnit XML | [docs/guides/ci-integration.md](../../docs/guides/ci-integration.md#bitbucket-pipelines) |
| CircleCI | `circleci/.circleci/config.yml` | JUnit XML | [docs/guides/ci-integration.md](../../docs/guides/ci-integration.md#circleci) |
| Jenkins | `jenkins/Jenkinsfile` | JUnit XML | [docs/guides/ci-integration.md](../../docs/guides/ci-integration.md#jenkins) |
| Azure DevOps | `azure/azure-pipelines.yml` | JUnit XML | [docs/guides/ci-integration.md](../../docs/guides/ci-integration.md#azure-devops) |
| Generic | `generic/shipgate-ci.sh` | JSON | [docs/guides/ci-integration.md](../../docs/guides/ci-integration.md#generic-ci-docker--bash) |

## Docker Image

All templates use:

```bash
ghcr.io/shipgate/shipgate:v1
```

## Configuration

Templates auto-detect `.shipgate.yml` in your repository root. See [docs/guides/ci-integration.md](../../docs/guides/ci-integration.md#configuration) for details.

## Support

- **Documentation:** [docs/guides/ci-integration.md](../../docs/guides/ci-integration.md)
- **Docker Image:** `ghcr.io/shipgate/shipgate:v1`
- **Website:** https://shipgate.dev

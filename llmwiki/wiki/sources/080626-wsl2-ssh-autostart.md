# WSL2 SSH & Service Auto-Start: Best Practices

**Type:** source
**Date:** 2026-06-08
**Tags:** wsl2, ssh, docker, tailscale, autostart, ops

## Context

K8S1 (Ubuntu WSL2 on Windows, Tailscale IP 100.97.8.41) — after every WSL restart, SSH unreachable because sshd + tailscaled + dockerd all die. This doc captures root causes and the working fix.

---

## Root Causes

### 1. Old WSL doesn't support `systemd=true`
- Requires WSL ≥ 0.67.6 (Store version)
- Symptom: `wsl.conf` has `systemd=true` but `ps -p 1 -o comm=` shows `init`, not `systemd`
- Check: `wsl.exe --version` — if "Invalid command line option" → old WSL, no systemd
- Old WSL also lacks `--version` flag

### 2. Services not in boot path
Without systemd, **nothing starts on WSL boot**: tailscaled, sshd, containerd, dockerd all dead.

### 3. SSH unreachable = Tailscale IP timeout
- `sshd` not running → port 22 not listening → SSH times out (not "connection refused")
- `tailscaled` not running → Tailscale IP becomes unreachable entirely
- Must start tailscaled BEFORE sshd for Tailscale IP to be accessible

### 4. `wsl.exe` name collision
Inside WSL, `/usr/bin/wsl` (WS-Management Shell CLI tool) shadows Windows `wsl.exe`.
Use full path: `/mnt/c/Windows/System32/wsl.exe --shutdown`

---

## The Fix: `[boot] command=` in wsl.conf

Old WSL supports `[boot] command=` — runs a command as root on WSL boot, before any user shell.

### `/etc/wsl.conf`
```ini
[boot]
command=/usr/local/bin/start-docker.sh
```

### `/usr/local/bin/start-docker.sh`
```bash
#!/bin/bash
/usr/sbin/tailscaled --tun=userspace-networking > /tmp/tailscaled.log 2>&1 &
sleep 3
tailscale up --accept-routes > /tmp/tailscale-up.log 2>&1 &
sleep 2
/usr/sbin/sshd
/usr/bin/containerd > /tmp/containerd.log 2>&1 &
sleep 4
rm -f /var/run/docker.pid
/usr/bin/dockerd --host=unix:///var/run/docker.sock > /tmp/dockerd.log 2>&1 &
```

Order matters:
1. `tailscaled` first → creates Tailscale interface
2. `sleep 3` → wait for daemon
3. `tailscale up` → bring up VPN
4. `sleep 2` → wait for IP assignment
5. `sshd` → now listens on Tailscale IP
6. `containerd` → socket at `/run/containerd/containerd.sock`
7. `sleep 4` → wait for containerd
8. `dockerd` → connects to containerd socket

### Apply
```bash
sudo chmod +x /usr/local/bin/start-docker.sh
# Confirm wsl.conf
cat /etc/wsl.conf
# Shutdown WSL from Windows
/mnt/c/Windows/System32/wsl.exe --shutdown
```

---

## Docker Containers with `--restart=unless-stopped`

All containers declared with `--restart=unless-stopped` auto-start when dockerd comes up.
No extra logic needed.

---

## Diagnosing SSH Timeout

| Symptom | Cause | Fix |
|---------|-------|-----|
| SSH times out (no response) | sshd not running OR Tailscale down | `sudo service ssh start` + `sudo tailscaled &` |
| SSH "connection refused" | sshd up but wrong port/bind | Check `ss -tlnp \| grep 22` |
| Tailscale IP unreachable | tailscaled not running | `sudo tailscaled --tun=userspace-networking &` then `tailscale up` |
| `tailscale status` → daemon not found | tailscaled.sock missing | Start tailscaled first |
| `systemctl` → "not booted with systemd" | Old WSL, systemd not PID 1 | Use `service` command or manual start |

---

## Verify After Boot

```bash
# From remote machine
ssh ubuntu@100.97.8.41

# On K8S1
tailscale ip          # → 100.97.8.41
docker ps             # all 4 containers Up
curl localhost:9100/metrics | head -1   # node-exporter
curl localhost:8888/metrics | grep container_last_seen | head -3  # cadvisor
```

---

## Docker CE vs docker.io

K8S1 migrated from Ubuntu `docker.io` to official `docker-ce` + `containerd.io`.

- `docker.io` (Ubuntu package): no `/run/containerd/containerd.sock` → cAdvisor v0.47+ fails
- `docker-ce` (Docker official): proper containerd, socket at `/run/containerd/containerd.sock`
- cAdvisor v0.55 requires containerd socket for Docker factory registration

Install:
```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable' > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io
```

---

## Origin
- **Source:** Session 2026-06-07/08, K8S1 Docker CE migration + monitoring setup
- **Commit:** _(filled by verify-before-commit)_

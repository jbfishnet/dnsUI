# dnsmasq Manager

A web UI for managing a [dnsmasq](https://thekelleys.org.uk/dnsmasq/doc.html) DNS/DHCP server running on a Raspberry Pi (or any Linux host). Provides full CRUD for DNS address entries and DHCP static leases, with changes written directly to `/etc/dnsmasq.conf` and dnsmasq reloaded automatically via systemd — no SSH required.

## Features

- **DNS entries** — add, edit, delete `address=/hostname/ip` entries; paste multiple hostnames at once for bulk creation
- **DHCP static leases** — add, edit, delete `dhcp-host=mac,ip[,hostname]` entries
- **Service control** — start, stop, restart dnsmasq from the UI with a live colour-coded status badge
- **Copy buttons** — one-click copy on every form field
- **HTTPS by default** — self-signed cert generated at build time; HTTP redirects to HTTPS
- **Non-destructive config editing** — comments, directives, and blank lines are preserved on every write
- **194 automated tests** — 110 backend (pytest) + 84 frontend (vitest)

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Raspberry Pi Host                                       │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Docker Compose                                 │    │
│  │                                                 │    │
│  │  ┌──────────────┐      ┌──────────────────────┐ │    │
│  │  │   frontend   │      │      backend         │ │    │
│  │  │  nginx       │─────▶│  FastAPI / Python    │ │    │
│  │  │  HTTPS :443  │      │  uvicorn :8000       │ │    │
│  │  └──────────────┘      └──────────┬───────────┘ │    │
│  │  :9123 (HTTPS)                    │ nsenter      │    │
│  │  :9180 (HTTP→redirect)            │              │    │
│  └───────────────────────────────────┼─────────────┘    │
│                                      ▼                   │
│                          /etc/dnsmasq.conf               │
│                          systemd ◀── systemctl           │
│                          dnsmasq (host process)          │
└──────────────────────────────────────────────────────────┘
```

The backend reaches the host's systemd via `nsenter -t 1` (enters PID 1's namespaces), so no D-Bus socket mount is needed.

---

## Host Requirements

| Requirement | Minimum version | Notes |
|---|---|---|
| Linux (Debian/Ubuntu/Raspberry Pi OS) | any current | Tested on Raspberry Pi OS Bookworm (64-bit) |
| **dnsmasq** | any | Must be managed by systemd (`systemctl status dnsmasq`) |
| **Docker Engine** | 20.10+ | [Install guide](https://docs.docker.com/engine/install/) |
| **Docker Compose** | v2.0+ (`docker compose`) | Bundled with Docker Desktop; on Pi install `docker-compose-plugin` |
| `/etc/dnsmasq.conf` | — | Must exist and be readable/writable by root |
| git | any | Only needed if cloning the repo manually |

> **Raspberry Pi OS quick-check:**
> ```bash
> docker --version        # Docker version 24+
> docker compose version  # Docker Compose version v2+
> systemctl is-active dnsmasq  # active
> ```

### Docker on Raspberry Pi

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in
sudo apt-get install -y docker-compose-plugin
```

---

## One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/jbfishnet/dnsUI/main/install.sh | bash
```

The script checks prerequisites, clones the repo to `~/dnsUI`, builds the containers, and starts the services.

After install, open **https://\<pi-ip\>:9123** in your browser (accept the self-signed certificate warning).

---

## Manual Install

```bash
git clone https://github.com/jbfishnet/dnsUI.git
cd dnsUI
docker compose up -d --build
```

---

## Ports

| Port | Protocol | Purpose |
|---|---|---|
| `9123` | HTTPS | Web UI (default) |
| `9180` | HTTP | Redirects to HTTPS |
| `9124` | HTTP | Backend API (internal; exposed for debugging) |

Override any port without editing files:

```bash
HTTPS_PORT=8443 HTTP_PORT=8080 BACKEND_PORT=9000 docker compose up -d
```

---

## Updating

```bash
cd ~/dnsUI
git pull
docker compose down
docker compose up -d --build
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DNSMASQ_CONF` | `/etc/dnsmasq.conf` | Path to the dnsmasq config file |
| `HTTPS_PORT` | `9123` | Host port for HTTPS |
| `HTTP_PORT` | `9180` | Host port for HTTP (redirects to HTTPS) |
| `BACKEND_PORT` | `9124` | Host port for the backend API |

### Volume Mounts

| Host path | Purpose |
|---|---|
| `/etc/dnsmasq.conf` | Config file — read and written by the backend |

The backend container runs with `privileged: true` and `pid: host` so it can reach host systemd via `nsenter`. No additional socket mounts are required.

---

## How the Config File Is Managed

The backend parses `/etc/dnsmasq.conf` on every request. It recognises two line types:

| Line format | Meaning |
|---|---|
| `address=/hostname/ip` | DNS entry |
| `dhcp-host=mac,ip[,hostname]` | DHCP static lease |

**All other lines** — comments (`#`), blank lines, and directives like `domain-needed`, `dhcp-range`, `interface=` — are **preserved verbatim** on every write. The managed lines are stripped and re-appended after the preserved content.

After any write the backend calls `systemctl restart dnsmasq` via `nsenter` so the change takes effect immediately.

Entry IDs are URL-safe slugs: `router.local` → `router-local`, `AA:BB:CC:DD:EE:FF` → `aa-bb-cc-dd-ee-ff`.

---

## API Reference

All endpoints are under `/api/` and proxied by nginx from the frontend container.

### DNS Entries

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/dns` | — | List all entries |
| `POST` | `/api/dns` | `{hostname, ip}` | Create one entry |
| `POST` | `/api/dns/bulk` | `{hostnames: [...], ip}` | Create multiple entries for one IP |
| `PUT` | `/api/dns/{id}` | `{hostname, ip}` | Update entry |
| `DELETE` | `/api/dns/{id}` | — | Delete entry (204) |

### DHCP Static Leases

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/dhcp` | — | List all leases |
| `POST` | `/api/dhcp` | `{mac, ip, hostname?}` | Create lease |
| `PUT` | `/api/dhcp/{id}` | `{mac, ip, hostname?}` | Update lease |
| `DELETE` | `/api/dhcp/{id}` | — | Delete lease (204) |

### Service Control

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/service/status` | Returns `{status: "active"\|"inactive"\|"failed"\|"unknown"}` |
| `POST` | `/api/service/start` | Start dnsmasq |
| `POST` | `/api/service/stop` | Stop dnsmasq |
| `POST` | `/api/service/restart` | Restart dnsmasq |

### Health

```
GET /health  →  {"status": "ok"}
```

---

## Development Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
DNSMASQ_CONF=/tmp/test.conf uvicorn app.main:app --reload
```

```bash
python -m pytest backend/tests/ -v
```

### Frontend

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

```bash
npm test
```

---

## CI / CD

Every pull request targeting `main` must pass:

1. **Backend tests** — `pytest` (Python 3.11)
2. **Frontend tests** — `tsc --noEmit` type-check + `vitest run`
3. **Docker build** — both images build cleanly

On a new version tag (`v*`), the **release workflow** additionally:

- Builds and pushes Docker images to GitHub Container Registry (ghcr.io)
- Tags images as both `:latest` and `:<version>`
- Creates a GitHub Release with changelog

Images:
- `ghcr.io/jbfishnet/dnsui-backend`
- `ghcr.io/jbfishnet/dnsui-frontend`

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `dnsmasq: unknown` status badge | Container can't reach host systemd | Verify `privileged: true` and `pid: host` are in docker-compose.yml; rebuild |
| `Failed to load DNS entries` | API URL wrong or backend not running | Check `docker compose ps`; verify nginx proxy config |
| Changes not taking effect in DNS | dnsmasq not reloading | Check `docker compose logs backend`; verify dnsmasq is managed by systemd |
| Port already in use | Another service on 9123/9180/9124 | Override ports: `HTTPS_PORT=8443 docker compose up -d` |
| Certificate warning in browser | Self-signed cert | Expected — click "Advanced → Proceed". To use your own cert, replace `/etc/nginx/certs/` in the frontend image |

---

## License

MIT — see [LICENSE](LICENSE).

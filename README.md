# dnsmasq Manager

A web UI for managing a dnsmasq DNS/DHCP server running on a Raspberry Pi. Provides full CRUD for DNS address entries and DHCP static leases, with changes written directly to `/etc/dnsmasq.conf` and dnsmasq reloaded automatically via systemd.

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
│  │  │  nginx:80    │─────▶│  FastAPI:8000        │ │    │
│  │  │  React/Vite  │      │  Python 3.11         │ │    │
│  │  └──────────────┘      └──────────┬───────────┘ │    │
│  │                                   │             │    │
│  └───────────────────────────────────┼─────────────┘    │
│                                      │ volume mounts     │
│                          ┌───────────▼──────────────┐   │
│                          │  /etc/dnsmasq.conf       │   │
│                          │  systemd (dbus socket)   │   │
│                          └──────────────────────────┘   │
│                                      │                   │
│                          ┌───────────▼──────────────┐   │
│                          │  dnsmasq (host process)  │   │
│                          └──────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

## Prerequisites

- Docker and Docker Compose
- dnsmasq running on the host (managed by systemd)
- `/etc/dnsmasq.conf` exists and is writable by the Docker user

## Quick Start

```bash
git clone <repo-url> dnsUI
cd dnsUI
docker compose up -d
```

Open [http://localhost](http://localhost) in your browser.

## Development Setup

### Backend (local)

```bash
cd backend
pip install -r requirements.txt
DNSMASQ_CONF=/tmp/test-dnsmasq.conf uvicorn app.main:app --reload
```

Run tests:

```bash
python -m pytest backend/tests/ -v
```

### Frontend (local)

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

Run tests:

```bash
npm test
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DNSMASQ_CONF` | `/etc/dnsmasq.conf` | Path to the dnsmasq config file |
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL (build-time) |

### Volume Mounts (docker-compose.yml)

| Host path | Container path | Purpose |
|---|---|---|
| `/etc/dnsmasq.conf` | `/etc/dnsmasq.conf` | Config file read/write |
| `/run/systemd/private` | `/run/systemd/private` | systemd socket access |
| `/var/run/dbus/system_bus_socket` | `/var/run/dbus/system_bus_socket` | D-Bus socket for systemctl |

## API Reference

### DNS Entries

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dns` | List all DNS entries |
| `POST` | `/api/dns` | Create a DNS entry |
| `PUT` | `/api/dns/{id}` | Update a DNS entry |
| `DELETE` | `/api/dns/{id}` | Delete a DNS entry |

**DNS Entry schema:**
```json
{
  "id": "mydevice-local",
  "hostname": "mydevice.local",
  "ip": "192.168.1.100"
}
```

### DHCP Static Leases

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dhcp` | List all DHCP static leases |
| `POST` | `/api/dhcp` | Create a DHCP lease |
| `PUT` | `/api/dhcp/{id}` | Update a DHCP lease |
| `DELETE` | `/api/dhcp/{id}` | Delete a DHCP lease |

**DHCP Lease schema:**
```json
{
  "id": "aa-bb-cc-dd-ee-ff",
  "mac": "aa:bb:cc:dd:ee:ff",
  "ip": "192.168.1.100",
  "hostname": "mydevice"
}
```

### Health Check

```
GET /health  ->  {"status": "ok"}
```

## How dnsmasq.conf Is Managed

The backend parses `/etc/dnsmasq.conf` on every request. Managed lines are:

- **DNS entries:** `address=/hostname/ip`
- **DHCP static leases:** `dhcp-host=mac,ip,hostname`

All other lines (comments, blank lines, directives like `dhcp-range`, `domain-needed`, etc.) are **preserved as-is** when writing back. The parser strips managed lines and re-appends them after the preserved content.

After any write operation the backend calls `systemctl restart dnsmasq` (with `check=False` so development environments without systemd do not fail).

Entry IDs are URL-safe slugs derived from the hostname (DNS) or MAC address (DHCP): `router.local` -> `router-local`, `aa:bb:cc:dd:ee:ff` -> `aa-bb-cc-dd-ee-ff`.

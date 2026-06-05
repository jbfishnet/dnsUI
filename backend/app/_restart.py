import subprocess
from typing import Literal


ServiceAction = Literal["start", "stop", "restart"]
ServiceStatus = Literal["active", "inactive", "failed", "unknown"]


def _systemctl(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["systemctl", *args, "dnsmasq"],
        capture_output=True,
        text=True,
    )


def restart_dnsmasq() -> None:
    """Restart dnsmasq after a config write. Silently ignores failures in dev."""
    _systemctl("restart")


def service_action(action: ServiceAction) -> tuple[bool, str]:
    """Run start/stop/restart. Returns (success, error_message)."""
    result = _systemctl(action)
    if result.returncode == 0:
        return True, ""
    return False, (result.stderr or result.stdout).strip()


def service_status() -> ServiceStatus:
    result = _systemctl("is-active")
    state = result.stdout.strip()
    if state in ("active", "inactive", "failed"):
        return state  # type: ignore[return-value]
    return "unknown"

import subprocess


def restart_dnsmasq() -> None:
    """Reload dnsmasq via systemctl. Silently ignores failures (e.g. dev environment)."""
    subprocess.run(
        ["systemctl", "restart", "dnsmasq"],
        check=False,
        capture_output=True,
    )

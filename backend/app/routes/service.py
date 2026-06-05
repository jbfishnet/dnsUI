from fastapi import APIRouter, HTTPException
from .._restart import ServiceAction, service_action, service_status

router = APIRouter(prefix="/api/service", tags=["service"])


@router.get("/status")
def get_status():
    return {"status": service_status()}


@router.post("/{action}")
def run_action(action: ServiceAction):
    ok, err = service_action(action)
    if not ok:
        raise HTTPException(status_code=500, detail=err or f"systemctl {action} dnsmasq failed")
    past = {"start": "started", "stop": "stopped", "restart": "restarted"}
    return {"status": past[action], "service": "dnsmasq"}

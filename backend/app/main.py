from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.dns import router as dns_router
from .routes.dhcp import router as dhcp_router

app = FastAPI(title="dnsmasq Manager", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dns_router)
app.include_router(dhcp_router)


@app.get("/health")
def health():
    return {"status": "ok"}

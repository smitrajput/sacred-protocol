"""Read-only HTTP API for the frontend. It serves convenience data only: every action a
trader or depositor needs in order to exit is a direct contract call and works with
this server switched off."""
from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .points import all_points


def create_app(chain, indexer) -> FastAPI:
    app = FastAPI(title="Destiny")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])

    @app.get("/health")
    def health():
        return {"ok": True, "block": chain.head(), "indexed": indexer.cursor()}

    @app.get("/bucket")
    def bucket():
        return chain.bucket()

    @app.get("/tickets")
    def tickets(owner: str | None = None):
        out = [asdict(chain.ticket(i)) for i in range(1, chain.ticket_count() + 1)]
        if owner:
            out = [t for t in out if t["owner"].lower() == owner.lower()]
        return out

    @app.get("/tickets/{ticket_id}")
    def ticket(ticket_id: int):
        if ticket_id < 1 or ticket_id > chain.ticket_count():
            raise HTTPException(404, "no such ticket")
        return asdict(chain.ticket(ticket_id))

    @app.get("/points")
    def points():
        indexer.sync(chain)
        return all_points(indexer.events())

    @app.get("/points/{address}")
    def points_for(address: str):
        indexer.sync(chain)
        return all_points(indexer.events()).get(address.lower(), {"trading": 0.0, "depositing": 0.0, "total": 0.0})

    return app


def app_from_env() -> FastAPI:
    from .chain import Chain
    from .config import Config
    from .indexer import Indexer

    config = Config.from_env()
    return create_app(Chain(config), Indexer(config.db_path))

"""Settings, read from the environment."""
import json
import os
import pathlib
from dataclasses import dataclass

ROOT = pathlib.Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Config:
    rpc_url: str
    addresses: dict
    keeper_key: str | None
    db_path: str
    poll_seconds: int

    @staticmethod
    def from_env() -> "Config":
        deployment = os.environ.get("DEPLOYMENT", str(ROOT / "deployments" / "local.json"))
        return Config(
            rpc_url=os.environ.get("RPC_URL", "http://127.0.0.1:8545"),
            addresses=json.loads(pathlib.Path(deployment).read_text()),
            keeper_key=os.environ.get("KEEPER_KEY"),
            db_path=os.environ.get("DB_PATH", "destiny.sqlite"),
            poll_seconds=int(os.environ.get("POLL_SECONDS", "30")),
        )


def load_abi(name: str) -> list:
    return json.loads((ROOT / "abi" / f"{name}.json").read_text())

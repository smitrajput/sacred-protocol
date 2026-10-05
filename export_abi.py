"""Copy the ABIs the server and the frontend need out of the Foundry build."""
import json, pathlib
root = pathlib.Path(__file__).parent
SOURCES = {
    "Vault": "Vault.sol", "Desk": "Desk.sol", "Oracle": "Oracle.sol", "BackstopFund": "BackstopFund.sol",
    "StakedBackstopFund": "StakedBackstopFund.sol", "Reserve": "Reserve.sol", "ReserveSale": "ReserveSale.sol",
    "MockERC20": "Mocks.sol", "MockFeed": "Mocks.sol", "MockRouter": "Mocks.sol",
}
for name, src in SOURCES.items():
    art = json.loads((root / "contracts" / "out" / src / f"{name}.json").read_text())
    (root / "abi" / f"{name}.json").write_text(json.dumps(art["abi"], indent=1))
    (root / "frontend" / "abi" / f"{name}.json").write_text(json.dumps(art["abi"]))
local = root / "deployments" / "local.json"
if local.exists():
    (root / "frontend" / "lib" / "local.json").write_text(local.read_text())
print("ABIs written to abi/ and frontend/abi/")

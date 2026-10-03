"""Copy the ABIs the server and the frontend need out of the Foundry build."""
import json, pathlib
root = pathlib.Path(__file__).parent
for name in ["Vault", "Desk", "BackstopFund", "Oracle", "MockERC20", "MockFeed", "MockRouter"]:
    src = "Mocks.sol" if name.startswith("Mock") else f"{name}.sol"
    art = json.loads((root / "contracts" / "out" / src / f"{name}.json").read_text())
    (root / "abi" / f"{name}.json").write_text(json.dumps(art["abi"], indent=1))
    (root / "frontend" / "abi" / f"{name}.json").write_text(json.dumps(art["abi"]))
local = root / "deployments" / "local.json"
if local.exists():
    (root / "frontend" / "lib" / "local.json").write_text(local.read_text())
print("ABIs written to abi/ and frontend/abi/")

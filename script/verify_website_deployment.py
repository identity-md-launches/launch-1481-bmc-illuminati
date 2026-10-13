#!/usr/bin/env python3
"""Read-only code/ABI comparison. Run forge build --offline first. Never broadcasts or reads keys."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RECORDED = json.loads((ROOT / 'docs/CHAIN-VERIFICATION.json').read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--rpc', default=RECORDED['publicRpc'])
parser.add_argument('--block', default=hex(RECORDED['block']), help='Hex block number or latest')
args = parser.parse_args()


def rpc(method, params):
    request = urllib.request.Request(args.rpc, json.dumps({
        'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params,
    }).encode(), {'Content-Type': 'application/json'})
    response = json.load(urllib.request.urlopen(request, timeout=30))
    if 'error' in response:
        raise RuntimeError(response['error'])
    return response['result']


if rpc('eth_chainId', []) != '0x1':
    raise SystemExit('Refusing a non-Ethereum endpoint.')
artifact = json.loads((ROOT / 'out/BMCIlluminatiPass.sol/BMCIlluminatiPass.json').read_text())
canonical = json.dumps(artifact['abi'], sort_keys=True, separators=(',', ':'))
abi_hash = subprocess.check_output(['cast', 'keccak', canonical], text=True).strip()
if abi_hash != RECORDED['abiCanonicalKeccak']:
    raise SystemExit('ABI does not match the pinned deployment attestation.')
print('ABI matches pinned canonical Keccak:', abi_hash)
local = bytearray.fromhex(artifact['deployedBytecode']['object'].removeprefix('0x'))
for references in artifact['deployedBytecode']['immutableReferences'].values():
    for reference in references:
        value = bytes.fromhex(RECORDED['bmc']['address'][2:]).rjust(reference['length'], b'\0')
        local[reference['start']:reference['start'] + reference['length']] = value
for deployment in RECORDED['deployments']:
    runtime = bytes.fromhex(rpc('eth_getCode', [deployment['address'], args.block])[2:])
    print(deployment['role'], deployment['address'], 'bytes:', len(runtime),
          'SHA256:', hashlib.sha256(runtime).hexdigest(), 'matches local source:', runtime == local)
    if deployment['role'] == 'pinned' and runtime != local:
        raise SystemExit('Pinned runtime mismatch. Keep transactions disabled.')
token = bytes.fromhex(rpc('eth_getCode', [RECORDED['bmc']['address'], args.block])[2:])
if hashlib.sha256(token).hexdigest() != RECORDED['bmc']['runtimeSha256']:
    raise SystemExit('BMC runtime mismatch.')
print('BMC matches recorded Sourcify/RPC bytecode. No writes were requested.')
print('This comparison does not resolve the deployment conflict or authorize public minting.')

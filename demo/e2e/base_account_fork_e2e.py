"""E2E: the Sessions page's "Fund the agent from a Base Account" card, driven by Playwright against a
local anvil fork of Base Sepolia. Nothing is sent to Base Sepolia.

A mock EIP-1193 wallet is injected into the page (the page cannot tell it from a Base Account):
  - eth_* are forwarded to the fork
  - wallet_sendCalls      -> a throwaway owner key sends the smart wallet's executeBatch(calls) on the fork
  - wallet_getCallsStatus -> the receipt, EIP-5792 2.0.0 shape
  - eth_signTypedData_v4  -> the owner signs the wallet's replaySafeHash(digest), wrapped as
                             SignatureWrapper(ownerIndex, sig): what a Coinbase Smart Wallet returns

Scenarios:
  existing  the Base Account from the recorded run (demo/SPEND_PERMISSIONS_RUN.md); SpendPermissionManager
            is already an owner. The throwaway key is added as an owner on the fork (impersonating the
            real owner there), so no real key is used.
  fresh     a new Coinbase Smart Wallet whose only owner is the throwaway key: the page must add
            SpendPermissionManager as an owner inside the same batch.
  reject    like existing, but the wallet declines wallet_sendCalls (EIP-1193 4001): the page must say
            so, must not ask the wallet a second time, and the button must work again.
  undeployed  the worst case for an account that does not exist yet: the wallet reports atomic batches,
            and on wallet_sendCalls it first creates the account through the factory with the throwaway
            key as its only owner (no SpendPermissionManager), then runs the batch. The page must send
            the 3-call batch (no addOwnerAddress), notice afterwards that SpendPermissionManager is not an
            owner, and fix it with a single-call wallet_sendCalls from its remedy button.

After the page reports "Done", the script checks the fork state (session, top-up agent, SpendPermissionManager
approval of the exact JSON the page shows), has the agent top up margin with that permission, signs the
session's credential from the list, and verifies it with ERC-1271 and with the agent's own verifier.

setup:  anvil --fork-url https://base-sepolia-rpc.publicnode.com --chain-id 84532 --block-time 1
        pip install playwright eth-account && python -m playwright install chromium
        (cd agent && npm ci)
usage:  python demo/e2e/base_account_fork_e2e.py <existing|fresh|reject|undeployed> [site]
"""
import json
import subprocess
import re
import secrets
import sys
import time
import urllib.request
from pathlib import Path

from eth_abi import decode as abi_decode
from eth_abi import encode as abi_encode
from eth_account import Account
from eth_account.messages import _hash_eip191_message, encode_typed_data
from eth_utils import keccak, to_checksum_address
from playwright.sync_api import sync_playwright

RPC = 'http://127.0.0.1:8545'
SCENARIO = sys.argv[1] if len(sys.argv) > 1 else 'existing'
SITE = (sys.argv[2] if len(sys.argv) > 2 else 'https://zuemen.github.io/pepelab-colosseum').rstrip('/')
OUT = Path(__file__).parent / 'out' / SCENARIO
OUT.mkdir(parents=True, exist_ok=True)
AGENT_DIR = Path(__file__).resolve().parents[2] / 'agent'

SPM = '0xf85210B21cC50302F477BA56686d2019dC9b67Ad'
FACTORY = '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a'
FUNDER = '0x20277169a755C690b98F0894EF57AF835469C9Af'
ASM = '0x71125e25c903AD4e198e1863d5Bf26df97926CDe'
USDC = '0x0910e965B06845BD3871860d522952a44a574058'
EXCHANGE = '0xC45dEd77F4A30658e3c52E6fB4809E502e3D3B0E'
AGENT = '0xd3c6a11ef5aF3D197Ecd0C9C44B15a23138d0EB7'
EXISTING_ACCOUNT = '0x56D83fEe6cf6F0BFf345640C7527a1869677435F'
EXISTING_OWNER = '0x2F188C934ffFa25D2af8354eb18fAE65038F5467'  # owner index 0 of EXISTING_ACCOUNT (impersonated on the fork only)
CHAIN_ID = 84532
PERMISSION_T = '(address,address,address,uint160,uint48,uint48,uint48,uint256,bytes)'

checks: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = '') -> None:
    checks.append((name, ok, detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''), flush=True)


# ── JSON-RPC to anvil ──────────────────────────────────────────────────────────
_id = 0


def rpc_raw(method: str, params: list) -> dict:
    global _id
    _id += 1
    body = json.dumps({'jsonrpc': '2.0', 'id': _id, 'method': method, 'params': params}).encode()
    req = urllib.request.Request(RPC, body, {'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def rpc(method: str, params: list):
    res = rpc_raw(method, params)
    if 'error' in res:
        raise RuntimeError(f'{method}: {res["error"]}')
    return res['result']


def sel(sig: str) -> bytes:
    return keccak(text=sig)[:4]


def calldata(sig: str, types: list[str], args: list) -> str:
    return '0x' + (sel(sig) + abi_encode(types, args)).hex()


def eth_call(to: str, data: str) -> bytes:
    return bytes.fromhex(rpc('eth_call', [{'to': to, 'data': data}, 'latest'])[2:])


def wait_receipt(h: str, timeout: float = 60) -> dict:
    end = time.time() + timeout
    while time.time() < end:
        r = rpc('eth_getTransactionReceipt', [h])
        if r:
            return r
        time.sleep(0.5)
    raise TimeoutError(h)


def send_as(frm: str, to: str, data: str) -> dict:
    """Send a tx on the fork as `frm` without its key (anvil impersonation)."""
    rpc('anvil_impersonateAccount', [frm])
    rpc('anvil_setBalance', [frm, hex(10**18)])
    try:
        h = rpc('eth_sendTransaction', [{'from': frm, 'to': to, 'data': data}])
    finally:
        rpc('anvil_stopImpersonatingAccount', [frm])
    r = wait_receipt(h)
    if int(r['status'], 16) != 1:
        raise RuntimeError(f'setup tx reverted: {h}')
    return r


# ── the mock wallet's key and account ───────────────────────────────────────────
owner = Account.create()
rpc('anvil_setBalance', [owner.address, hex(10**18)])
wallet_state = {'account': None, 'owner_index': None}


def perm_tuple_of(permission: dict) -> tuple:
    return (to_checksum_address(permission['account']), to_checksum_address(permission['spender']), to_checksum_address(permission['token']),
            int(permission['allowance']), permission['period'], permission['start'], permission['end'], int(permission['salt']), b'')


def fund(account: str, amount: int) -> None:
    """Give the account at least `amount` mUSDC (faucet to the throwaway key, then transfer)."""
    bal = abi_decode(['uint256'], eth_call(USDC, calldata('balanceOf(address)', ['address'], [account])))[0]
    if bal < amount:
        send_as(owner.address, USDC, calldata('faucet()', [], []))
        send_as(owner.address, USDC, calldata('transfer(address,uint256)', ['address', 'uint256'], [account, amount - bal]))


def top_up(perm_tuple: tuple, amount: int) -> dict:
    return send_as(AGENT, FUNDER, calldata(f'topUp({PERMISSION_T},uint160)', [PERMISSION_T, 'uint160'], [perm_tuple, amount]))


def is_owner(account: str, who: str) -> bool:
    return abi_decode(['bool'], eth_call(account, calldata('isOwnerAddress(address)', ['address'], [who])))[0]


def setup_account() -> None:
    if SCENARIO == 'undeployed':
        # Counterfactual address only: the mock wallet creates it on the first wallet_sendCalls.
        owners = [abi_encode(['address'], [owner.address])]
        nonce = int.from_bytes(secrets.token_bytes(8), 'big')
        account = to_checksum_address(abi_decode(['address'], eth_call(FACTORY, calldata('getAddress(bytes[],uint256)', ['bytes[]', 'uint256'], [owners, nonce])))[0])
        check('fork setup: the account does not exist yet', rpc('eth_getCode', [account, 'latest']) == '0x', account)
        wallet_state.update(account=account, owner_index=0, deploy=(owners, nonce))
        return
    if SCENARIO in ('existing', 'reject'):
        account = EXISTING_ACCOUNT
        idx = abi_decode(['uint256'], eth_call(account, calldata('nextOwnerIndex()', [], [])))[0]
        # The existing owner adds the throwaway key as an owner (fork only).
        send_as(EXISTING_OWNER, account, calldata('addOwnerAddress(address)', ['address'], [owner.address]))
    else:
        # A new Coinbase Smart Wallet whose only owner is the throwaway key: SpendPermissionManager is
        # not an owner yet, so the page must add it inside the batch.
        owners = [abi_encode(['address'], [owner.address])]
        nonce = int.from_bytes(secrets.token_bytes(8), 'big')
        account = to_checksum_address(abi_decode(['address'], eth_call(FACTORY, calldata('getAddress(bytes[],uint256)', ['bytes[]', 'uint256'], [owners, nonce])))[0])
        send_as(owner.address, FACTORY, calldata('createAccount(bytes[],uint256)', ['bytes[]', 'uint256'], [owners, nonce]))
        idx = 0
    check('fork setup: throwaway key is an owner of the account', is_owner(account, owner.address), account)
    spm_owner = is_owner(account, SPM)
    check('fork setup: SpendPermissionManager owner state matches scenario', spm_owner == (SCENARIO != 'fresh'), f'isOwner(SPM)={spm_owner}')
    wallet_state['account'] = account
    wallet_state['owner_index'] = idx


def send_batch(calls: list[dict]) -> str:
    account = wallet_state['account']
    if wallet_state.get('deploy') and rpc('eth_getCode', [account, 'latest']) == '0x':
        # What a wallet does for a new account, minus SpendPermissionManager in its owners (the worst case).
        owners, nonce = wallet_state['deploy']
        send_as(owner.address, FACTORY, calldata('createAccount(bytes[],uint256)', ['bytes[]', 'uint256'], [owners, nonce]))
    batch = [(to_checksum_address(c['to']), int(c.get('value', '0x0'), 16), bytes.fromhex(c['data'][2:])) for c in calls]
    data = calldata('executeBatch((address,uint256,bytes)[])', ['(address,uint256,bytes)[]'], [batch])
    tx = {'from': owner.address, 'to': account, 'data': data, 'value': '0x0'}
    gas = int(rpc('eth_estimateGas', [tx]), 16)
    block = rpc('eth_getBlockByNumber', ['latest', False])
    base = int(block['baseFeePerGas'], 16)
    signed = owner.sign_transaction({
        'chainId': CHAIN_ID, 'nonce': int(rpc('eth_getTransactionCount', [owner.address, 'pending']), 16),
        'to': account, 'data': data, 'value': 0, 'gas': gas * 2,
        'maxFeePerGas': base * 2 + 10**6, 'maxPriorityFeePerGas': 10**6, 'type': 2,
    })
    return rpc('eth_sendRawTransaction', ['0x' + signed.raw_transaction.hex().removeprefix('0x')])


def sign_typed(typed_json: str) -> str:
    typed = json.loads(typed_json)
    digest = _hash_eip191_message(encode_typed_data(full_message=typed))
    safe = eth_call(wallet_state['account'], calldata('replaySafeHash(bytes32)', ['bytes32'], [digest]))
    sig = owner.unsafe_sign_hash(safe)
    raw = sig.r.to_bytes(32, 'big') + sig.s.to_bytes(32, 'big') + bytes([sig.v])
    wrapped = abi_encode(['(uint256,bytes)'], [(wallet_state['owner_index'], raw)])
    wallet_state['last_typed'] = typed
    wallet_state['last_digest'] = '0x' + digest.hex()
    return '0x' + wrapped.hex()


rpc_log: list[str] = []


def handle(method: str, params_json: str) -> str:
    params = json.loads(params_json) if params_json else []
    rpc_log.append(method)
    try:
        account = wallet_state['account']
        if method in ('eth_requestAccounts', 'eth_accounts'):
            return json.dumps({'result': [account]})
        if method == 'eth_chainId':
            return json.dumps({'result': hex(CHAIN_ID)})
        if method == 'net_version':
            return json.dumps({'result': str(CHAIN_ID)})
        if method == 'wallet_getCapabilities':
            return json.dumps({'result': {hex(CHAIN_ID): {'atomic': {'status': 'supported'}}}})
        if method == 'wallet_sendCalls':
            req = params[0]
            wallet_state.setdefault('send_requests', []).append(req)
            wallet_state['send_count'] = wallet_state.get('send_count', 0) + 1
            if SCENARIO == 'reject':
                return json.dumps({'error': {'code': 4001, 'message': 'User rejected the request.'}})
            h = send_batch(req['calls'])
            return json.dumps({'result': {'id': h}})
        if method == 'wallet_getCallsStatus':
            h = params[0]
            r = rpc('eth_getTransactionReceipt', [h])
            if not r:
                return json.dumps({'result': {'version': '2.0.0', 'id': h, 'chainId': hex(CHAIN_ID), 'status': 100, 'atomic': True}})
            ok = int(r['status'], 16) == 1
            return json.dumps({'result': {'version': '2.0.0', 'id': h, 'chainId': hex(CHAIN_ID), 'status': 200 if ok else 500, 'atomic': True,
                                          'receipts': [{'status': r['status'], 'transactionHash': r['transactionHash'], 'blockHash': r['blockHash'],
                                                        'blockNumber': r['blockNumber'], 'gasUsed': r['gasUsed'], 'logs': []}]}})
        if method in ('eth_signTypedData_v4', 'eth_signTypedData'):
            return json.dumps({'result': sign_typed(params[1])})
        if method in ('wallet_switchEthereumChain', 'wallet_addEthereumChain'):
            return json.dumps({'result': None})
        res = rpc_raw(method, params)
        return json.dumps({'error': res['error']} if 'error' in res else {'result': res['result']})
    except Exception as e:  # surfaced to the page as an EIP-1193 error
        return json.dumps({'error': {'code': -32603, 'message': f'mock wallet: {e}'}})


INIT = """
(() => {
  const listeners = {};
  window.ethereum = {
    isMetaMask: false,
    request: async ({ method, params }) => {
      const out = JSON.parse(await window.__pepeRpc(method, JSON.stringify(params ?? [])));
      if (out.error) { const e = new Error(out.error.message); e.code = out.error.code; e.data = out.error.data; throw e; }
      return out.result;
    },
    on: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    removeListener: (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter(f => f !== fn); },
  };
})();
"""


PAGES_SITE = 'https://zuemen.github.io/pepelab-colosseum'


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(['git', *args], cwd=AGENT_DIR.parent, capture_output=True, text=True)


def gh_api(path: str, jq: str) -> str:
    return subprocess.run(['gh', 'api', path, '--jq', jq], capture_output=True, text=True).stdout.strip()


def tested_build(page) -> dict:
    """Which frontend was tested: the bundle the page ran, this checkout, and for the Pages site the commit
    of the latest *successful* Pages deployment. Pages only deploys pushes that touch frontend/ or its
    workflow, so what must match is the frontend tree (as checked out, uncommitted edits included), not the commit."""
    build = {'site_scripts': page.evaluate("[...document.querySelectorAll('script[src]')].map(s => s.src)"),
             'repo_head': git('rev-parse', 'HEAD').stdout.strip(),
             'repo_dirty': bool(git('status', '--porcelain').stdout.strip())}
    if SITE == PAGES_SITE:
        deployed = None
        for line in gh_api('repos/zuemen/pepelab-colosseum/deployments?environment=github-pages&per_page=10', '.[] | "\(.id) \(.sha)"').splitlines():
            dep_id, sha = line.split()
            if gh_api(f'repos/zuemen/pepelab-colosseum/deployments/{dep_id}/statuses?per_page=1', '.[0].state') == 'success':
                deployed = sha
                break
        build['pages_deployed_sha'] = deployed
        # `git diff <commit> -- paths` compares with the working tree.
        build['pages_matches_checkout'] = bool(deployed) and git('diff', '--quiet', deployed, '--', 'frontend', '.github/workflows/pages.yml').returncode == 0
    return build


def write_result(**extra) -> int:
    (OUT / 'result.json').write_text(json.dumps({'scenario': SCENARIO, 'site': SITE, **extra,
                                                 'checks': [{'name': n, 'ok': o, 'detail': d} for n, o, d in checks]}, indent=2))
    failed_n = sum(1 for _, o, _ in checks if not o)
    session = f", session #{extra['session']}" if 'session' in extra else ''
    print(f"\n{len(checks) - failed_n}/{len(checks)} checks passed — scenario {SCENARIO}, account {extra.get('account')}{session}")
    return 1 if failed_n else 0


def main() -> int:
    setup_account()
    account = wallet_state['account']
    before_next = abi_decode(['uint256'], eth_call(ASM, calldata('nextSessionId()', [], [])))[0]

    console_errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': 1366, 'height': 900})
        ctx.expose_function('__pepeRpc', handle)
        ctx.add_init_script(INIT)
        page = ctx.new_page()
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
        not_found: list[str] = []
        page.on('response', lambda r: not_found.append(r.url) if r.status >= 400 else None)
        def open_sessions() -> None:
            page.goto(f'{SITE}/sessions', wait_until='domcontentloaded', timeout=60_000)
            connected = page.get_by_text(account[:6], exact=False).first
            connect = page.locator('button:visible', has_text='Connect Wallet').first
            # A reload may restore the connection silently (then the page stays on /sessions).
            connected.or_(connect).wait_for(timeout=60_000)
            if not connected.is_visible():
                # The header re-renders while route chunks load, so the button can detach mid-click: retry.
                for attempt in range(4):
                    try:
                        connect.click(timeout=15_000)
                        page.get_by_text('Connect with MetaMask').click(timeout=10_000)
                        break
                    except Exception:
                        if attempt == 3:
                            raise
                        page.wait_for_timeout(1_000)
                connected.wait_for(timeout=30_000)
            if not page.url.rstrip('/').endswith('/sessions'):
                # Connecting lands on Portfolio; go to Agent Sessions through the sidebar (keeps the in-memory connection).
                page.get_by_role('link', name='Agent Sessions').first.click(timeout=15_000)

        def watch_checking() -> None:
            # From here on the status must never go back to "Checking…": re-reads keep the last result.
            card.evaluate("""c => { window.__checkingSeen = false; new MutationObserver(() => {
                if (/Checking/i.test(c.querySelector('.MuiAlert-root')?.textContent ?? '')) window.__checkingSeen = true
            }).observe(c, { subtree: true, childList: true, characterData: true }) }""")

        open_sessions()
        card = page.locator('.MuiCard-root', has_text='Fund the agent from a Base Account').first
        try:
            card.wait_for(timeout=30_000)
        except Exception:
            page.screenshot(path=str(OUT / '0_no_card.png'), full_page=True)
            print('rpc methods so far:', sorted(set(rpc_log)), 'console errors:', console_errors[:5])
            raise
        status = card.locator('.MuiAlert-root').first
        page.wait_for_function("el => !/Checking/i.test(el.textContent)", arg=status.element_handle(), timeout=30_000)
        status_text = status.inner_text()
        expected = {'fresh': 'Coinbase Smart Wallet detected. The batch also adds SpendPermissionManager',
                    'undeployed': 'This wallet can batch calls; the Base Account will be created by this batch.'}.get(SCENARIO, 'Coinbase Smart Wallet detected.')
        check('card recognises the account', status_text.strip().startswith(expected) and (SCENARIO == 'fresh' or 'also adds' not in status_text), status_text[:140])
        build = tested_build(page)
        if 'pages_matches_checkout' in build:
            check("the site's latest successful Pages build has this checkout's frontend", build['pages_matches_checkout'],
                  f"deployed {str(build['pages_deployed_sha'])[:7]}, HEAD {build['repo_head'][:7]}{' + uncommitted edits' if build['repo_dirty'] else ''}")
        page.screenshot(path=str(OUT / '1_connected.png'), full_page=True)

        page.get_by_placeholder('0x… or click Generate agent key on the right').fill(AGENT)
        cta = card.get_by_role('button', name='Set up with one Base Account batch')
        check('CTA enabled once the agent is filled', cta.is_enabled(), cta.inner_text())
        watch_checking()
        cta.click()
        done = card.locator('.MuiAlert-root', has_text='Done')
        page.wait_for_function(
            "c => /Done:|The batch failed|not confirmed after|You declined/.test(c.textContent)", arg=card.element_handle(), timeout=120_000)
        if SCENARIO == 'reject':
            page.wait_for_timeout(3_000)  # a second wallet request, if the page made one, would arrive now
            declined = card.locator('.MuiAlert-root', has_text='You declined the request in your wallet. Nothing was sent.')
            check('page reports the rejection', declined.count() == 1, ' '.join(card.inner_text().split())[:200])
            # The mock refuses before sending anything, so the chain cannot tell us more; what matters is
            # that the page asked once and left the button usable.
            check('wallet asked exactly once (no retry after a rejection)', wallet_state.get('send_count') == 1, f"wallet_sendCalls x{wallet_state.get('send_count')}")
            check('CTA usable again', cta.is_enabled(), cta.inner_text())
            check('status never flashed "Checking…" after the first read', not page.evaluate('window.__checkingSeen'))
            page.screenshot(path=str(OUT / '2_rejected.png'), full_page=True)
            browser.close()
            return write_result(account=account, build=build)
        ok_done = done.count() > 0
        check('batch confirmed in the UI (Done alert)', ok_done, (done.first.inner_text() if ok_done else card.inner_text())[:300])
        page.screenshot(path=str(OUT / '2_done.png'), full_page=True)
        if not ok_done:
            browser.close()
            return write_result(account=account, build=build) or 1

        if SCENARIO == 'undeployed':
            # The wallet created the account without SpendPermissionManager: the batch itself succeeded,
            # but the agent could not spend until the page's remedy adds it.
            check('SpendPermissionManager is not an owner after the batch (worst case reproduced)', not is_owner(account, SPM))
            # Why the remedy matters: with money in the account, the agent's top-up still reverts.
            fund(account, 5 * 10**18)
            # Simulated from the agent (eth_call), so the answer is the contract's own revert.
            sim = rpc_raw('eth_call', [{'from': AGENT, 'to': FUNDER, 'data': calldata(f'topUp({PERMISSION_T},uint160)', [PERMISSION_T, 'uint160'],
                                        [perm_tuple_of(json.loads(card.locator('pre').inner_text())), 5 * 10**18])}, 'latest'])
            sim_err = sim.get('error') or {}
            unauthorized = '0x' + sel('Unauthorized()').hex()  # the account refusing SpendPermissionManager's execute
            check("before the remedy, the agent's topUp reverts with the account's Unauthorized()",
                  str(sim_err.get('data', '')).lower().startswith(unauthorized), f"{sim_err.get('message', 'no error')} data={str(sim_err.get('data', ''))[:74]}")
            fix = card.get_by_role('button', name='Add SpendPermissionManager as owner')
            try:
                fix.wait_for(timeout=30_000)
            except Exception:
                page.screenshot(path=str(OUT / '2_no_remedy.png'), full_page=True)
            warning = card.locator('.MuiAlert-root', has_text='without SpendPermissionManager as an owner')
            check('remedy button appears after the batch', fix.count() == 1,
                  ' '.join((warning.first.inner_text() if warning.count() else card.inner_text()).split())[:200])
            pending = status.inner_text().strip()
            check('until the fix, the status points to it and the main button is disabled (no second session)',
                  pending.startswith('One step left') and not cta.is_enabled(), pending[:120])
            shown = card.locator('pre').inner_text()
            open_sessions()  # a reload (reconnects the mock wallet if the page does not restore it)
            card.wait_for(timeout=30_000)
            # The restored fix shows at once; wait for the balance line, which only a completed read of the
            # account renders, so the checks below hold after the page has read the account again (and the
            # disabled button is down to the pending fix, not to a read in progress).
            try:
                card.get_by_text('mUSDC in this account').wait_for(timeout=30_000)
            except Exception:
                pass
            # The agent field is empty after a reload, which alone would disable the button: fill it again.
            page.get_by_placeholder('0x… or click Generate agent key on the right').fill(AGENT)
            kept = card.locator('pre')
            survived = (card.get_by_text('mUSDC in this account').count() == 1 and fix.count() == 1 and kept.count() == 1
                        and kept.inner_text() == shown and not cta.is_enabled() and status.inner_text().strip().startswith('One step left'))
            check('after a reload and a fresh read the fix is still offered, with the same Spend Permission JSON', survived,
                  ' '.join(status.inner_text().split())[:120])
            if not survived:
                page.screenshot(path=str(OUT / '2_after_reload.png'), full_page=True)
                browser.close()
                return write_result(account=account, build=build)
            watch_checking()
            card.scroll_into_view_if_needed()
            card.screenshot(path=str(OUT / 'card_remedy.png'))
            if fix.count() != 1:
                browser.close()
                return write_result(account=account, build=build)
            sessions_before_fix = abi_decode(['uint256'], eth_call(ASM, calldata('nextSessionId()', [], [])))[0]
            fix.click()
            page.wait_for_function(
                "c => /is now an owner of this account|The batch failed|not confirmed after|You declined/.test(c.textContent)", arg=card.element_handle(), timeout=120_000)
            fixed = card.locator('.MuiAlert-root', has_text='SpendPermissionManager is now an owner of this account.')
            check('page reports the remedy confirmed', fixed.count() == 1,
                  ' '.join((fixed.first.inner_text() if fixed.count() else card.inner_text()).split())[:200])
            fix_req = wallet_state['send_requests'][-1]
            one = fix_req['calls'][0] if len(fix_req['calls']) == 1 else {}
            want = calldata('addOwnerAddress(address)', ['address'], [SPM])
            check('remedy is a single call: the account calls addOwnerAddress(SpendPermissionManager)',
                  wallet_state.get('send_count') == 2 and to_checksum_address(one.get('to', '0x' + '0' * 40)) == account and one.get('data', '').lower() == want.lower(),
                  f"wallet_sendCalls x{wallet_state.get('send_count')}, {len(fix_req['calls'])} call(s)")
            after_fix = abi_decode(['uint256'], eth_call(ASM, calldata('nextSessionId()', [], [])))[0]
            check('remedy opens no new session', after_fix == sessions_before_fix, f'nextSessionId {sessions_before_fix} → {after_fix}')
            page.screenshot(path=str(OUT / '2b_remedy_done.png'), full_page=True)

        # The card reads the account again after a confirmed batch (SpendPermissionManager is an owner now).
        after = ''
        for _ in range(40):
            after = status.inner_text().strip()
            if after == 'Coinbase Smart Wallet detected.':
                break
            page.wait_for_timeout(500)
        check('card re-reads the account after the batch', after == 'Coinbase Smart Wallet detected.', after[:120])
        check('status never flashed "Checking…" after the first read', not page.evaluate('window.__checkingSeen'))
        if SCENARIO == 'undeployed':
            check('remedy button gone once SpendPermissionManager is an owner',
                  card.get_by_role('button', name='Add SpendPermissionManager as owner').count() == 0)
        permission = json.loads(card.locator('pre').inner_text())
        card.scroll_into_view_if_needed()
        card.screenshot(path=str(OUT / 'card_done.png'))
        (OUT / 'permission.json').write_text(json.dumps(permission, indent=2))
        req = wallet_state['send_requests'][0]
        check('wallet_sendCalls used EIP-5792 2.0.0 with atomicRequired', req.get('version') == '2.0.0' and req.get('atomicRequired') is True, f"{len(req['calls'])} calls")
        check('batch length matches scenario', len(req['calls']) == (4 if SCENARIO == 'fresh' else 3), str([c['to'] for c in req['calls']]))

        # ── on-fork state after the batch ──
        after_next = abi_decode(['uint256'], eth_call(ASM, calldata('nextSessionId()', [], [])))[0]
        sid = after_next - 1
        check('exactly one session opened', after_next == before_next + 1, f'nextSessionId {before_next} → {after_next}')
        s = abi_decode(['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
                       eth_call(ASM, calldata('sessions(uint256)', ['uint256'], [sid])))
        check('session.user == the Base Account', to_checksum_address(s[0]) == account, f'#{sid} user {s[0]}')
        check('session.agent == the agent', to_checksum_address(s[1]) == AGENT, s[1])
        top_agent = abi_decode(['address'], eth_call(FUNDER, calldata('topUpAgent(address)', ['address'], [account])))[0]
        check('funder.topUpAgent(account) == agent', to_checksum_address(top_agent) == AGENT, top_agent)
        perm_tuple = perm_tuple_of(permission)
        approved = abi_decode(['bool'], eth_call(SPM, calldata(f'isApproved({PERMISSION_T})', [PERMISSION_T], [perm_tuple])))[0]
        check('SPM.isApproved(the JSON the page shows) == true', approved, f"allowance {int(permission['allowance']) / 1e18} mUSDC / {permission['period']}s")
        check('SpendPermissionManager is an owner after the batch' + (' and the remedy' if SCENARIO == 'undeployed' else ''), is_owner(account, SPM))

        # ── the agent tops up margin with that permission (what top_up_margin does) ──
        amount = 5 * 10**18
        fund(account, amount)
        margin0 = abi_decode(['uint256'], eth_call(EXCHANGE, calldata('freeMargin(address)', ['address'], [account])))[0]
        r = top_up(perm_tuple, amount)
        margin1 = abi_decode(['uint256'], eth_call(EXCHANGE, calldata('freeMargin(address)', ['address'], [account])))[0]
        check('agent topUp with that permission moves 5 mUSDC into margin', margin1 - margin0 == amount, f'freeMargin +{(margin1 - margin0) / 1e18} (tx {r["transactionHash"][:10]}…)')

        # ── sign the credential for the new session in the list ──
        row = page.locator('tbody tr').filter(has=page.locator('td:first-child', has_text=re.compile(rf'^\s*{sid}\s*$')))
        row.wait_for(timeout=30_000)
        check('new session appears in the list', row.count() == 1, ' '.join(row.inner_text().split())[:160])
        row.get_by_role('button', name='Issue VC').click()
        try:
            page.wait_for_function(f"() => {{ const m = JSON.parse(localStorage.getItem('pepelab_vc_{CHAIN_ID}_{account.lower()}') || '{{}}'); return !!m['{sid}'] }}", timeout=60_000)
        except Exception:
            page.screenshot(path=str(OUT / '3_vc_fail.png'), full_page=True)
            print('rpc methods:', sorted(set(rpc_log)), 'console errors:', console_errors[:5], 'storage:', page.evaluate("JSON.stringify(localStorage)")[:400])
            raise
        vcs = json.loads(page.evaluate(f"localStorage.getItem('pepelab_vc_{CHAIN_ID}_{account.lower()}')"))
        vc = vcs[str(sid)]
        (OUT / 'vc.json').write_text(json.dumps(vc, indent=2))
        page.screenshot(path=str(OUT / '3_credential.png'), full_page=True)
        browser.close()
    # GitHub Pages serves a deep link (/sessions) through 404.html (SPA fallback): that 404 is expected.
    doc_url = f'{SITE}/sessions'
    unexpected_404 = [u for u in not_found if u.rstrip('/') != doc_url]
    console_errors = [e for e in console_errors if not (e.startswith('Failed to load resource') and not unexpected_404)]
    check('no failed requests besides the SPA deep-link fallback', not unexpected_404, '; '.join(unexpected_404[:3]))

    digest = bytes.fromhex(wallet_state['last_digest'][2:])
    sig = bytes.fromhex(vc['proof']['proofValue'][2:])
    magic = eth_call(account, calldata('isValidSignature(bytes32,bytes)', ['bytes32', 'bytes'], [digest, sig]))[:4].hex()
    check('ERC-1271 isValidSignature(digest, credential signature) == 0x1626ba7e', magic == '1626ba7e', '0x' + magic)
    check('no console errors on the page', not console_errors, '; '.join(console_errors[:3]))
    agent = subprocess.run(['node', str(AGENT_DIR / 'node_modules' / 'tsx' / 'dist' / 'cli.mjs'), 'examples/verify-vc-file.ts', str(OUT / 'vc.json'), RPC],
                           cwd=AGENT_DIR, capture_output=True, text=True, timeout=120)
    check("agent's verifyAuthorizationVCWithProvider accepts the credential", agent.returncode == 0, (agent.stdout or agent.stderr).strip()[:200])
    (OUT / 'rpc_methods.json').write_text(json.dumps(sorted(set(rpc_log))))
    return write_result(account=account, session=sid, build=build)


if __name__ == '__main__':
    sys.exit(main())

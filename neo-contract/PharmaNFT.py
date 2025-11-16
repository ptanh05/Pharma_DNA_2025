from typing import Any
from boa3.builtin.compile_time import public
from boa3.builtin.type import UInt160
from boa3.builtin.interop.storage import put, get, delete, find, get_context
from boa3.builtin.interop.runtime import calling_script_hash, time

# ---------- START: Boa-compatible helpers ----------

# fixed lengths
ID_BYTES_LEN = 4   # token_id length in bytes
CNT_BYTES_LEN = 4  # counters length (4 bytes)
ROLE_BYTES_LEN = 1 # role stored in 1 byte
ZERO_ADDRESS = UInt160([0] * 20)

def bytes_to_int(b: list) -> int:
    res: int = 0
    i: int = 0

    if b is None or len(b) == 0:
        return 0

    while i < len(b):
        byte_val: int = b[i]
        res = res + (byte_val * (256 ** i))
        i = i + 1

    return res

def int_to_bytes(n: int, length: int) -> list:
    out: list = []
    i: int = 0
    while i < length:
        out.append(n & 0xFF)
        n = n >> 8
        i = i + 1
    return out

# Storage helpers
def read_bytes(ctx: Any, key: list) -> list:
    b: list = get(key, ctx)
    return b

def write_bytes(ctx: Any, key: list, value: list):
    put(key, value, ctx)

def read_int(ctx: Any, key: list, length: int = CNT_BYTES_LEN) -> int:
    b: list = get(key, ctx)
    return bytes_to_int(b)

def write_int(ctx: Any, key: list, value: int, length: int = CNT_BYTES_LEN):
    put(key, int_to_bytes(value, length), ctx)

def read_bool(ctx: Any, key: list) -> bool:
    b: list = get(key, ctx)
    if b is None or len(b) == 0:
        return False
    return b[0] == 1

def write_bool(ctx: Any, key: list, val: bool):
    put(key, [1] if val else [0], ctx)

def tokenid_to_key(token_id: int) -> list:
    return int_to_bytes(token_id, ID_BYTES_LEN)

# ---------- END: helpers ----------

# ===== Constants =====
NONE = 0
MANUFACTURER = 1
DISTRIBUTOR = 2
PHARMACY = 3
ADMIN = 4

# Storage keys (all list[int])
OWNER_KEY = [ord(c) for c in 'owner']
ROLES_PREFIX = [ord(c) for c in 'roles_']
TOKEN_OWNER_PREFIX = [ord(c) for c in 'owner_']
TOKEN_URI_PREFIX = [ord(c) for c in 'uri_']
TOKEN_EXPIRY_PREFIX = [ord(c) for c in 'expiry_']
TOKEN_EXPIRED_PREFIX = [ord(c) for c in 'expired_']
TOKEN_BATCH_PREFIX = [ord(c) for c in 'batch_']
TOKEN_HISTORY_PREFIX = [ord(c) for c in 'history_']
TOKEN_BALANCE_PREFIX = [ord(c) for c in 'balance_']
TOKEN_INDEX_PREFIX = [ord(c) for c in 'tokenIndex_']
NEXT_TOKEN_ID_KEY = [ord(c) for c in 'nextTokenId']
TOTAL_MINTED_KEY = [ord(c) for c in 'totalMinted']
TOTAL_TRANSFERRED_KEY = [ord(c) for c in 'totalTransferred']
ROLE_COUNT_PREFIX = [ord(c) for c in 'roleCount_']
TRANSFER_RESTRICTIONS_KEY = [ord(c) for c in 'transferRestrictions']
ALLOWED_TRANSFER_PREFIX = [ord(c) for c in 'allowed_']
PAUSED_KEY = [ord(c) for c in 'paused']


# ===== Helper Functions =====
def get_owner() -> UInt160:
    ctx = get_context()
    b: list = read_bytes(ctx, OWNER_KEY)
    if b is None or len(b) != 20:
        return ZERO_ADDRESS
    return UInt160(b)

def set_owner(owner: UInt160):
    ctx = get_context()
    write_bytes(ctx, OWNER_KEY, owner)

def only_owner():
    caller = calling_script_hash
    owner = get_owner()
    assert caller == owner, "Only owner"

def get_role(user: UInt160) -> int:
    ctx = get_context()
    key = ROLES_PREFIX + user
    return read_int(ctx, key, ROLE_BYTES_LEN)

def set_role(user: UInt160, role: int):
    ctx = get_context()
    key = ROLES_PREFIX + user

    old_role = read_int(ctx, key, ROLE_BYTES_LEN)
    if old_role != NONE:
        old_count_key = ROLE_COUNT_PREFIX + int_to_bytes(old_role, 1)
        old_count = read_int(ctx, old_count_key, 1)
        if old_count > 0:
            write_int(ctx, old_count_key, old_count - 1, 1)

    write_int(ctx, key, role, ROLE_BYTES_LEN)

    if role != NONE:
        count_key = ROLE_COUNT_PREFIX + int_to_bytes(role, 1)
        count = read_int(ctx, count_key, 1)
        write_int(ctx, count_key, count + 1, 1)

def get_token_owner(token_id: int) -> UInt160:
    ctx = get_context()
    key = TOKEN_OWNER_PREFIX + tokenid_to_key(token_id)
    b: bytes = read_bytes(ctx, key)
    if b is None or len(b) != 20:
        return ZERO_ADDRESS
    return UInt160(b)

def set_token_owner(token_id: int, owner: UInt160):
    ctx = get_context()
    tid = tokenid_to_key(token_id)

    old_owner = get_token_owner(token_id)
    if old_owner != ZERO_ADDRESS:
        old_bal_key = TOKEN_BALANCE_PREFIX + old_owner
        old_bal = read_int(ctx, old_bal_key)
        if old_bal > 0:
            write_int(ctx, old_bal_key, old_bal - 1)
        delete(TOKEN_INDEX_PREFIX + old_owner + tid, ctx)

    write_bytes(ctx, TOKEN_OWNER_PREFIX + tid, owner)

    if owner != ZERO_ADDRESS:
        new_bal_key = TOKEN_BALANCE_PREFIX + owner
        new_bal = read_int(ctx, new_bal_key)
        write_int(ctx, new_bal_key, new_bal + 1)
        put(TOKEN_INDEX_PREFIX + owner + tid, b'\x01', ctx)

def get_token_uri(token_id: int) -> str:
    ctx = get_context()
    b: bytes = read_bytes(ctx, TOKEN_URI_PREFIX + tokenid_to_key(token_id))
    if b is None:
        return ""
    return b.decode('utf-8')

def set_token_uri(token_id: int, uri: str):
    ctx = get_context()
    put(TOKEN_URI_PREFIX + tokenid_to_key(token_id), uri.encode('utf-8'), ctx)

def get_token_expiry(token_id: int) -> int:
    ctx = get_context()
    return read_int(ctx, TOKEN_EXPIRY_PREFIX + tokenid_to_key(token_id), 8)

def set_token_expiry(token_id: int, expiry: int):
    ctx = get_context()
    write_int(ctx, TOKEN_EXPIRY_PREFIX + tokenid_to_key(token_id), expiry, 8)

def is_token_expired(token_id: int) -> bool:
    ctx = get_context()
    expired_key = TOKEN_EXPIRED_PREFIX + tokenid_to_key(token_id)
    if read_bool(ctx, expired_key):
        return True

    expiry = get_token_expiry(token_id)
    if expiry > 0:
        current_time = time
        if current_time >= expiry:
            write_bool(ctx, expired_key, True)
            return True
    return False

def get_token_batch_number(token_id: int) -> str:
    ctx = get_context()
    b: bytes = read_bytes(ctx, TOKEN_BATCH_PREFIX + tokenid_to_key(token_id))
    if b is None:
        return ""
    return b.decode('utf-8')

def set_token_batch_number(token_id: int, batch_number: str):
    ctx = get_context()
    put(TOKEN_BATCH_PREFIX + tokenid_to_key(token_id), batch_number.encode('utf-8'), ctx)

def add_to_history(token_id: int, address: UInt160):
    ctx = get_context()
    key = TOKEN_HISTORY_PREFIX + tokenid_to_key(token_id)
    b: bytes = read_bytes(ctx, key)
    history: str = b.decode('utf-8') if b is not None else ""
    if len(history) > 0:
        history = history + "," + str(address)
    else:
        history = str(address)
    put(key, history.encode('utf-8'), ctx)

def get_next_token_id() -> int:
    ctx = get_context()
    nid = read_int(ctx, NEXT_TOKEN_ID_KEY)
    write_int(ctx, NEXT_TOKEN_ID_KEY, nid + 1)
    return nid

def is_paused() -> bool:
    ctx = get_context()
    return read_bool(ctx, PAUSED_KEY)

def set_paused(paused: bool):
    ctx = get_context()
    write_bool(ctx, PAUSED_KEY, paused)

def is_allowed_transfer(from_role: int, to_role: int) -> bool:
    ctx = get_context()
    key = ALLOWED_TRANSFER_PREFIX + int_to_bytes(from_role, 1) + int_to_bytes(to_role, 1)
    return read_bool(ctx, key)

def set_allowed_transfer(from_role: int, to_role: int, allowed: bool):
    ctx = get_context()
    key = ALLOWED_TRANSFER_PREFIX + int_to_bytes(from_role, 1) + int_to_bytes(to_role, 1)
    write_bool(ctx, key, allowed)

# ===== NEP-11 Methods =====

@public
def symbol() -> str:
    return "PHARMA"

@public
def decimals() -> int:
    return 0

@public
def totalSupply() -> int:
    ctx = get_context()
    return read_int(ctx, TOTAL_MINTED_KEY)

@public
def balanceOf(owner: UInt160) -> int:
    if owner == ZERO_ADDRESS:
        return 0
    ctx = get_context()
    return read_int(ctx, TOKEN_BALANCE_PREFIX + owner)

@public
def ownerOf(tokenId: bytes) -> UInt160:
    token_id = bytes_to_int(tokenId)
    return get_token_owner(token_id)

@public
def tokensOf(owner: UInt160) -> list:
    if owner == ZERO_ADDRESS:
        return []
    ctx = get_context()
    tokens: list = []
    prefix = TOKEN_INDEX_PREFIX + owner
    iterator = find(prefix, ctx)
    while iterator.next():
        entry = iterator.value
        k: bytes = entry[0]
        token_bytes: bytes = k[len(prefix):]
        if len(token_bytes) >= ID_BYTES_LEN:
            token_id = bytes_to_int(token_bytes[:ID_BYTES_LEN])
            tokens.append(int_to_bytes(token_id, ID_BYTES_LEN))
    return tokens

@public
def transfer(to: UInt160, tokenId: bytes, data: bytes) -> bool:
    token_id = bytes_to_int(tokenId)
    return transfer_product_nft(token_id, to)

@public
def properties(tokenId: bytes) -> list:
    token_id = bytes_to_int(tokenId)
    owner = get_token_owner(token_id)
    uri = get_token_uri(token_id)
    batch = get_token_batch_number(token_id)
    expiry = get_token_expiry(token_id)
    expired = is_token_expired(token_id)
    # Return as list of tuples (key, value) pairs for neo3-boa compatibility
    # Format: [('owner', owner), ('uri', uri), ...]
    return [
        ('owner', owner),
        ('uri', uri),
        ('batch_number', batch),
        ('expiry_date', expiry),
        ('expired', expired)
    ]

# ===== Main Contract Functions =====

@public
def _deploy(data: Any, update: bool) -> None:
    if not update:
        owner = calling_script_hash
        set_owner(owner)
        set_allowed_transfer(MANUFACTURER, DISTRIBUTOR, True)
        set_allowed_transfer(DISTRIBUTOR, PHARMACY, True)
        set_allowed_transfer(ADMIN, DISTRIBUTOR, True)
        set_allowed_transfer(ADMIN, PHARMACY, True)
        set_allowed_transfer(ADMIN, MANUFACTURER, True)
        ctx = get_context()
        write_bool(ctx, TRANSFER_RESTRICTIONS_KEY, True)

# ===== Role Management =====

@public
def assign_role(user: UInt160, role: int) -> bool:
    only_owner()
    assert user != ZERO_ADDRESS, "Zero address"
    assert role >= NONE and role <= ADMIN, "Invalid role"
    set_role(user, role)
    return True

@public
def revoke_role(user: UInt160) -> bool:
    only_owner()
    assert user != ZERO_ADDRESS, "Zero address"
    set_role(user, NONE)
    return True

@public
def get_user_role(user: UInt160) -> int:
    return get_role(user)

@public
def has_role(user: UInt160, role: int) -> bool:
    return get_role(user) == role

# ===== Minting =====

@public
def mint_product_nft(uri: str, batch_number: str, expiry_date: int) -> int:
    assert not is_paused(), "Contract paused"
    caller = calling_script_hash
    role = get_role(caller)
    assert role == MANUFACTURER, "Only manufacturer"
    token_id = get_next_token_id()
    set_token_owner(token_id, caller)
    set_token_uri(token_id, uri)
    set_token_batch_number(token_id, batch_number)
    set_token_expiry(token_id, expiry_date)
    add_to_history(token_id, caller)
    ctx = get_context()
    total_minted = read_int(ctx, TOTAL_MINTED_KEY)
    write_int(ctx, TOTAL_MINTED_KEY, total_minted + 1)
    return token_id

@public
def batch_mint_product_nft(uris: list, batch_numbers: list, expiry_dates: list) -> list:
    assert not is_paused(), "Contract paused"
    caller = calling_script_hash
    role = get_role(caller)
    assert role == MANUFACTURER, "Only manufacturer"
    assert len(uris) == len(batch_numbers) == len(expiry_dates), "Array length mismatch"
    token_ids = []
    for i in range(len(uris)):
        token_id = get_next_token_id()
        set_token_owner(token_id, caller)
        set_token_uri(token_id, uris[i])
        set_token_batch_number(token_id, batch_numbers[i])
        set_token_expiry(token_id, expiry_dates[i])
        add_to_history(token_id, caller)
        token_ids.append(token_id)
    ctx = get_context()
    total_minted = read_int(ctx, TOTAL_MINTED_KEY)
    write_int(ctx, TOTAL_MINTED_KEY, total_minted + len(token_ids))
    return token_ids

# ===== Transfer =====

@public
def transfer_product_nft(token_id: int, to: UInt160) -> bool:
    assert not is_paused(), "Contract paused"
    assert not is_token_expired(token_id), "Product expired"
    caller = calling_script_hash
    owner = get_token_owner(token_id)
    assert owner != ZERO_ADDRESS, "Token does not exist"
    assert owner == caller, "Not token owner"
    assert to != ZERO_ADDRESS, "Zero address"
    assert to != owner, "Cannot transfer to self"
    ctx = get_context()
    if read_bool(ctx, TRANSFER_RESTRICTIONS_KEY):
        from_role = get_role(caller)
        to_role = get_role(to)
        assert is_allowed_transfer(from_role, to_role), "Transfer not allowed"
    set_token_owner(token_id, to)
    add_to_history(token_id, to)
    total_transferred = read_int(ctx, TOTAL_TRANSFERRED_KEY)
    write_int(ctx, TOTAL_TRANSFERRED_KEY, total_transferred + 1)
    return True

@public
def admin_transfer(token_id: int, to: UInt160) -> bool:
    caller = calling_script_hash
    role = get_role(caller)
    assert role == ADMIN, "Only admin"
    set_token_owner(token_id, to)
    add_to_history(token_id, to)
    return True

# ===== Query Functions =====

@public
def get_product_current_owner(token_id: int) -> UInt160:
    return get_token_owner(token_id)

@public
def next_token_id() -> int:
    ctx = get_context()
    return read_int(ctx, NEXT_TOKEN_ID_KEY)

@public
def total_minted() -> int:
    ctx = get_context()
    return read_int(ctx, TOTAL_MINTED_KEY)

@public
def is_product_expired(token_id: int) -> bool:
    return is_token_expired(token_id)

# ===== Admin Functions =====

@public
def pause() -> bool:
    only_owner()
    set_paused(True)
    return True

@public
def unpause() -> bool:
    only_owner()
    set_paused(False)
    return True

@public
def update_product_expiry(token_id: int, expiry_timestamp: int) -> bool:
    caller = calling_script_hash
    owner = get_token_owner(token_id)
    assert owner == caller, "Not token owner"
    set_token_expiry(token_id, expiry_timestamp)
    return True

@public
def mark_product_expired(token_id: int) -> bool:
    caller = calling_script_hash
    role = get_role(caller)
    assert role == ADMIN, "Only admin"
    ctx = get_context()
    write_bool(ctx, TOKEN_EXPIRED_PREFIX + tokenid_to_key(token_id), True)
    return True

@public
def set_transfer_restrictions(enabled: bool) -> bool:
    only_owner()
    ctx = get_context()
    write_bool(ctx, TRANSFER_RESTRICTIONS_KEY, enabled)
    return True

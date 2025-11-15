"""
PharmaNFT Smart Contract for Neo N3
Written in Python using Boa framework (neo3-boa v1.1.0)
Implements NEP-11 (NFT standard) for pharmaceutical supply chain tracking
"""

from boa3.builtin.compile_time import public
from boa3.builtin.type import UInt160
from boa3.builtin.interop.storage import put, get, delete, find
from boa3.builtin.interop.runtime import calling_script_hash, check_witness, time
from boa3.builtin.interop.contract import call_contract
from boa3.builtin.interop.blockchain import Transaction
from typing import Any

# ===== Constants =====
NONE = 0
MANUFACTURER = 1
DISTRIBUTOR = 2
PHARMACY = 3
ADMIN = 4

# Storage keys
OWNER_KEY = b'owner'
ROLES_PREFIX = b'roles_'
TOKEN_OWNER_PREFIX = b'owner_'
TOKEN_URI_PREFIX = b'uri_'
TOKEN_EXPIRY_PREFIX = b'expiry_'
TOKEN_EXPIRED_PREFIX = b'expired_'
TOKEN_BATCH_PREFIX = b'batch_'
TOKEN_HISTORY_PREFIX = b'history_'
TOKEN_BALANCE_PREFIX = b'balance_'
TOKEN_INDEX_PREFIX = b'tokenIndex_'
NEXT_TOKEN_ID_KEY = b'nextTokenId'
TOTAL_MINTED_KEY = b'totalMinted'
TOTAL_TRANSFERRED_KEY = b'totalTransferred'
ROLE_COUNT_PREFIX = b'roleCount_'
TRANSFER_RESTRICTIONS_KEY = b'transferRestrictions'
ALLOWED_TRANSFER_PREFIX = b'allowed_'
PAUSED_KEY = b'paused'

# ===== Helper Functions =====
def get_owner() -> UInt160:
    """Get contract owner"""
    return get(OWNER_KEY)

def set_owner(owner: UInt160):
    """Set contract owner"""
    put(OWNER_KEY, owner)

def only_owner():
    """Modifier: Only owner can call"""
    caller = calling_script_hash
    owner = get_owner()
    assert caller == owner, "Only owner"

def get_role(user: UInt160) -> int:
    """Get user role"""
    key = ROLES_PREFIX + user
    return get(key, NONE)

def set_role(user: UInt160, role: int):
    """Set user role"""
    key = ROLES_PREFIX + user
    
    # Update role counts
    old_role = get(key, NONE)
    if old_role != NONE:
        old_count_key = ROLE_COUNT_PREFIX + old_role.to_bytes()
        old_count = get(old_count_key, 0)
        if old_count > 0:
            put(old_count_key, old_count - 1)
    
    put(key, role)
    
    if role != NONE:
        count_key = ROLE_COUNT_PREFIX + role.to_bytes()
        count = get(count_key, 0)
        put(count_key, count + 1)

def get_token_owner(token_id: int) -> UInt160:
    """Get token owner"""
    key = TOKEN_OWNER_PREFIX + token_id.to_bytes()
    return get(key)

def set_token_owner(token_id: int, owner: UInt160):
    """Set token owner"""
    # Remove from old owner's balance
    old_owner = get_token_owner(token_id)
    if old_owner is not None:
        old_balance_key = TOKEN_BALANCE_PREFIX + old_owner
        old_balance = get(old_balance_key, 0)
        if old_balance > 0:
            put(old_balance_key, old_balance - 1)
        
        # Remove token from old owner's list
        old_index_key = TOKEN_INDEX_PREFIX + old_owner + token_id.to_bytes()
        delete(old_index_key)
    
    # Add to new owner's balance
    key = TOKEN_OWNER_PREFIX + token_id.to_bytes()
    put(key, owner)
    
    if owner is not None:
        new_balance_key = TOKEN_BALANCE_PREFIX + owner
        new_balance = get(new_balance_key, 0)
        put(new_balance_key, new_balance + 1)
        
        # Add token to new owner's list
        new_index_key = TOKEN_INDEX_PREFIX + owner + token_id.to_bytes()
        put(new_index_key, True)

def get_token_uri(token_id: int) -> str:
    """Get token URI"""
    key = TOKEN_URI_PREFIX + token_id.to_bytes()
    return get(key, "")

def set_token_uri(token_id: int, uri: str):
    """Set token URI"""
    key = TOKEN_URI_PREFIX + token_id.to_bytes()
    put(key, uri)

def get_token_expiry(token_id: int) -> int:
    """Get token expiry date"""
    key = TOKEN_EXPIRY_PREFIX + token_id.to_bytes()
    return get(key, 0)

def set_token_expiry(token_id: int, expiry: int):
    """Set token expiry date"""
    key = TOKEN_EXPIRY_PREFIX + token_id.to_bytes()
    put(key, expiry)

def is_token_expired(token_id: int) -> bool:
    """Check if token is expired"""
    expired_key = TOKEN_EXPIRED_PREFIX + token_id.to_bytes()
    if get(expired_key, False):
        return True
    
    expiry = get_token_expiry(token_id)
    if expiry > 0:
        current_time = time
        if current_time >= expiry:
            put(expired_key, True)
            return True
    
    return False

def get_token_batch_number(token_id: int) -> str:
    """Get token batch number"""
    key = TOKEN_BATCH_PREFIX + token_id.to_bytes()
    return get(key, "")

def set_token_batch_number(token_id: int, batch_number: str):
    """Set token batch number"""
    key = TOKEN_BATCH_PREFIX + token_id.to_bytes()
    put(key, batch_number)

def add_to_history(token_id: int, address: UInt160):
    """Add address to token history"""
    key = TOKEN_HISTORY_PREFIX + token_id.to_bytes()
    history = get(key, "")
    if len(history) > 0:
        history = history + "," + str(address)
    else:
        history = str(address)
    put(key, history)

def get_next_token_id() -> int:
    """Get and increment next token ID"""
    next_id = get(NEXT_TOKEN_ID_KEY, 0)
    put(NEXT_TOKEN_ID_KEY, next_id + 1)
    return next_id

def is_paused() -> bool:
    """Check if contract is paused"""
    return get(PAUSED_KEY, False)

def set_paused(paused: bool):
    """Set paused state"""
    put(PAUSED_KEY, paused)

def is_allowed_transfer(from_role: int, to_role: int) -> bool:
    """Check if transfer is allowed between roles"""
    key = ALLOWED_TRANSFER_PREFIX + from_role.to_bytes() + to_role.to_bytes()
    return get(key, False)

def set_allowed_transfer(from_role: int, to_role: int, allowed: bool):
    """Set allowed transfer between roles"""
    key = ALLOWED_TRANSFER_PREFIX + from_role.to_bytes() + to_role.to_bytes()
    put(key, allowed)

# ===== NEP-11 Standard Methods =====

@public
def symbol() -> str:
    """NEP-11: Get token symbol"""
    return "PHARMA"

@public
def decimals() -> int:
    """NEP-11: Get token decimals (0 for NFT)"""
    return 0

@public
def totalSupply() -> int:
    """NEP-11: Get total supply"""
    return get(TOTAL_MINTED_KEY, 0)

@public
def balanceOf(owner: UInt160) -> int:
    """NEP-11: Get balance of owner"""
    if owner is None:
        return 0
    key = TOKEN_BALANCE_PREFIX + owner
    return get(key, 0)

@public
def ownerOf(tokenId: bytes) -> UInt160:
    """NEP-11: Get owner of token"""
    token_id = int.from_bytes(tokenId, 'little')
    return get_token_owner(token_id)

@public
def tokensOf(owner: UInt160) -> list:
    """NEP-11: Get all tokens owned by owner"""
    if owner is None:
        return []
    
    tokens = []
    prefix = TOKEN_INDEX_PREFIX + owner
    iterator = find(prefix)
    
    while iterator.next():
        key = iterator.value[0]
        # Extract token ID from key
        token_bytes = key[len(prefix):]
        if len(token_bytes) > 0:
            token_id = int.from_bytes(token_bytes, 'little')
            tokens.append(token_id.to_bytes(4, 'little'))
    
    return tokens

@public
def transfer(to: UInt160, tokenId: bytes, data: Any) -> bool:
    """NEP-11: Transfer token"""
    token_id = int.from_bytes(tokenId, 'little')
    return transfer_product_nft(token_id, to)

@public
def properties(tokenId: bytes) -> dict:
    """NEP-11: Get token properties"""
    token_id = int.from_bytes(tokenId, 'little')
    
    owner = get_token_owner(token_id)
    uri = get_token_uri(token_id)
    batch = get_token_batch_number(token_id)
    expiry = get_token_expiry(token_id)
    expired = is_token_expired(token_id)
    
    return {
        'owner': owner,
        'uri': uri,
        'batch_number': batch,
        'expiry_date': expiry,
        'expired': expired
    }

# ===== Main Contract =====
@public
def _deploy(data: Any, update: bool):
    """Contract deployment"""
    if not update:
        # Set owner on first deployment
        owner = calling_script_hash
        set_owner(owner)
        
        # Initialize default transfer rules
        set_allowed_transfer(MANUFACTURER, DISTRIBUTOR, True)
        set_allowed_transfer(DISTRIBUTOR, PHARMACY, True)
        set_allowed_transfer(ADMIN, DISTRIBUTOR, True)
        set_allowed_transfer(ADMIN, PHARMACY, True)
        set_allowed_transfer(ADMIN, MANUFACTURER, True)
        
        # Enable transfer restrictions by default
        put(TRANSFER_RESTRICTIONS_KEY, True)

# ===== Role Management =====

@public
def assign_role(user: UInt160, role: int) -> bool:
    """
    Assign role to user (owner only)
    :param user: User address
    :param role: Role (0=None, 1=Manufacturer, 2=Distributor, 3=Pharmacy, 4=Admin)
    :return: True if successful
    """
    only_owner()
    assert user is not None, "Zero address"
    assert role >= NONE and role <= ADMIN, "Invalid role"
    
    set_role(user, role)
    return True

@public
def revoke_role(user: UInt160) -> bool:
    """
    Revoke role from user (owner only)
    :param user: User address
    :return: True if successful
    """
    only_owner()
    assert user is not None, "Zero address"
    
    set_role(user, NONE)
    return True

@public
def get_user_role(user: UInt160) -> int:
    """
    Get user role
    :param user: User address
    :return: Role (0-4)
    """
    return get_role(user)

@public
def has_role(user: UInt160, role: int) -> bool:
    """
    Check if user has specific role
    :param user: User address
    :param role: Role to check
    :return: True if user has role
    """
    return get_role(user) == role

@public
def batch_mint_product_nft(uris: list, batch_numbers: list, expiry_dates: list) -> list:
    """
    Batch mint multiple product NFTs (manufacturer only)
    :param uris: List of IPFS URIs
    :param batch_numbers: List of batch numbers
    :param expiry_dates: List of expiry timestamps
    :return: List of token IDs
    """
    assert not is_paused(), "Contract paused"
    
    caller = calling_script_hash
    role = get_role(caller)
    assert role == MANUFACTURER, "Only manufacturer"
    
    assert len(uris) == len(batch_numbers), "Array length mismatch"
    assert len(uris) == len(expiry_dates), "Array length mismatch"
    
    token_ids = []
    for i in range(len(uris)):
        token_id = get_next_token_id()
        set_token_owner(token_id, caller)
        set_token_uri(token_id, uris[i])
        set_token_batch_number(token_id, batch_numbers[i])
        set_token_expiry(token_id, expiry_dates[i])
        add_to_history(token_id, caller)
        token_ids.append(token_id)
    
    # Update statistics
    total_minted = get(TOTAL_MINTED_KEY, 0)
    put(TOTAL_MINTED_KEY, total_minted + len(token_ids))
    
    return token_ids

# ===== NFT Lifecycle =====

@public
def mint_product_nft(uri: str, batch_number: str, expiry_date: int) -> int:
    """
    Mint new product NFT (manufacturer only)
    :param uri: IPFS URI of metadata
    :param batch_number: Batch number
    :param expiry_date: Expiry timestamp
    :return: Token ID
    """
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
    
    # Update statistics
    total_minted = get(TOTAL_MINTED_KEY, 0)
    put(TOTAL_MINTED_KEY, total_minted + 1)
    
    return token_id

@public
def transfer_product_nft(token_id: int, to: UInt160) -> bool:
    """
    Transfer NFT to another address
    :param token_id: Token ID
    :param to: Recipient address
    :return: True if successful
    """
    assert not is_paused(), "Contract paused"
    assert not is_token_expired(token_id), "Product expired"
    
    caller = calling_script_hash
    owner = get_token_owner(token_id)
    assert owner is not None, "Token does not exist"
    assert owner == caller, "Not token owner"
    assert to is not None, "Zero address"
    assert to != owner, "Cannot transfer to self"
    
    # Check transfer restrictions
    if get(TRANSFER_RESTRICTIONS_KEY, True):
        from_role = get_role(caller)
        to_role = get_role(to)
        assert is_allowed_transfer(from_role, to_role), "Transfer not allowed"
    
    # Transfer (set_token_owner handles balance updates)
    set_token_owner(token_id, to)
    add_to_history(token_id, to)
    
    # Update statistics
    total_transferred = get(TOTAL_TRANSFERRED_KEY, 0)
    put(TOTAL_TRANSFERRED_KEY, total_transferred + 1)
    
    return True

@public
def admin_transfer(token_id: int, to: UInt160) -> bool:
    """
    Admin transfer (admin only)
    :param token_id: Token ID
    :param to: Recipient address
    :return: True if successful
    """
    caller = calling_script_hash
    role = get_role(caller)
    assert role == ADMIN, "Only admin"
    
    owner = get_token_owner(token_id)
    set_token_owner(token_id, to)
    add_to_history(token_id, to)
    
    return True

# ===== View Functions =====

@public
def get_product_current_owner(token_id: int) -> UInt160:
    """
    Get current owner of token
    :param token_id: Token ID
    :return: Owner address
    """
    return get_token_owner(token_id)

@public
def next_token_id() -> int:
    """Get next token ID"""
    return get(NEXT_TOKEN_ID_KEY, 0)

@public
def total_minted() -> int:
    """Get total minted tokens"""
    return get(TOTAL_MINTED_KEY, 0)

@public
def is_product_expired(token_id: int) -> bool:
    """Check if product is expired"""
    return is_token_expired(token_id)

# ===== Admin Functions =====

@public
def pause() -> bool:
    """Pause contract (owner only)"""
    only_owner()
    set_paused(True)
    return True

@public
def unpause() -> bool:
    """Unpause contract (owner only)"""
    only_owner()
    set_paused(False)
    return True

@public
def update_product_expiry(token_id: int, expiry_timestamp: int) -> bool:
    """Update product expiry (owner only)"""
    caller = calling_script_hash
    owner = get_token_owner(token_id)
    assert owner == caller, "Not token owner"
    
    set_token_expiry(token_id, expiry_timestamp)
    return True

@public
def mark_product_expired(token_id: int) -> bool:
    """Mark product as expired (admin only)"""
    caller = calling_script_hash
    role = get_role(caller)
    assert role == ADMIN, "Only admin"
    
    key = TOKEN_EXPIRED_PREFIX + token_id.to_bytes()
    put(key, True)
    return True

@public
def set_transfer_restrictions(enabled: bool) -> bool:
    """Enable/disable transfer restrictions (owner only)"""
    only_owner()
    put(TRANSFER_RESTRICTIONS_KEY, enabled)
    return True

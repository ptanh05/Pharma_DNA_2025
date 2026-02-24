module pharma_nft::access_control {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};

    const ROLE_ADMIN: u8 = 0;
    const ROLE_MANUFACTURER: u8 = 1;
    const ROLE_DISTRIBUTOR: u8 = 2;
    const ROLE_PHARMACY: u8 = 3;

    const E_INVALID_ROLE: u64 = 1;

    struct AdminCap has key, store {
        id: UID,
    }

    struct RoleRecord has key, store {
        id: UID,
        user: address,
        role: u8,
        role_name: String,
    }

    struct RoleGranted has copy, drop {
        user: address,
        role: u8,
        role_name: String,
        granted_by: address,
    }

    struct RoleRevoked has copy, drop {
        user: address,
        role: u8,
        granted_by: address,
    }

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    entry fun grant_role(
        _cap: &AdminCap,
        user: address,
        role: u8,
        ctx: &mut TxContext
    ) {
        assert!(role <= ROLE_PHARMACY, E_INVALID_ROLE);
        let role_name = role_to_string(role);
        let record = RoleRecord { id: object::new(ctx), user, role, role_name };
        event::emit(RoleGranted {
            user,
            role,
            role_name: record.role_name,
            granted_by: tx_context::sender(ctx),
        });
        transfer::transfer(record, user);
    }

    entry fun revoke_role(
        _cap: &AdminCap,
        record: RoleRecord,
        ctx: &mut TxContext
    ) {
        let RoleRecord { id, user, role, role_name: _ }= record;
        object::delete(id);
        event::emit(RoleRevoked { user, role, granted_by: tx_context::sender(ctx) });
    }

    fun role_to_string(role: u8): String {
        if (role == ROLE_ADMIN) { string::utf8(b"ADMIN") }
        else if (role == ROLE_MANUFACTURER) { string::utf8(b"MANUFACTURER") }
        else if (role == ROLE_DISTRIBUTOR) { string::utf8(b"DISTRIBUTOR") }
        else { string::utf8(b"PHARMACY") }
    }

    public fun get_user(record: &RoleRecord): address { record.user }
    public fun get_role(record: &RoleRecord): u8 { record.role }
    public fun get_role_name(record: &RoleRecord): String { record.role_name }
}

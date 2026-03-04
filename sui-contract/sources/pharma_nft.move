/// PharmaNFT Smart Contract for Sui
/// Implements pharmaceutical supply chain tracking using Sui Objects
module pharma_nft::pharma_nft {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use sui::table::{Self, Table};
    use std::vector;

    /// Role enum
    const NONE: u8 = 0;
    const MANUFACTURER: u8 = 1;
    const DISTRIBUTOR: u8 = 2;
    const PHARMACY: u8 = 3;
    const ADMIN: u8 = 4;

    /// Contract Admin Capability
    struct AdminCap has key, store {
        id: UID,
    }

    /// Contract State
    struct PharmaNFTContract has key {
        id: UID,
        roles: Table<address, u8>, // address -> role
        transfer_restrictions: bool,
        allowed_transfers: Table<u8, Table<u8, bool>>, // from_role -> to_role -> allowed
    }

    /// PharmaNFT Object
    struct PharmaNFT has key {
        id: UID,
        uri: String,
        batch_number: String,
        expiry_date: u64,
        expired: bool,
        history: vector<address>, // Transfer history
    }

    /// Events
    struct NFTMinted has copy, drop {
        object_id: ID,
        uri: String,
        batch_number: String,
        expiry_date: u64,
    }

    struct NFTTransferred has copy, drop {
        object_id: ID,
        from: address,
        to: address,
    }

    struct RoleAssigned has copy, drop {
        user: address,
        role: u8,
    }

    /// Role removed event
    struct RoleRemoved has copy, drop {
        user: address,
        role: u8,
    }

    /// Transfer restrictions updated event
    struct TransferRestrictionsUpdated has copy, drop {
        enabled: bool,
    }

    /// Transfer rule added event
    struct TransferRuleAdded has copy, drop {
        from_role: u8,
        to_role: u8,
    }

    /// Transfer rule removed event
    struct TransferRuleRemoved has copy, drop {
        from_role: u8,
        to_role: u8,
    }

    /// Initialize contract
    fun init(ctx: &mut TxContext) {
        let deployer = tx_context::sender(ctx);
        
        let admin = AdminCap {
            id: object::new(ctx),
        };
        
        // Transfer admin cap to deployer
        transfer::transfer(admin, deployer);

        let contract = PharmaNFTContract {
            id: object::new(ctx),
            roles: table::new(ctx),
            transfer_restrictions: true,
            allowed_transfers: table::new(ctx),
        };

        // Automatically assign ADMIN role to deployer
        table::add(&mut contract.roles, deployer, ADMIN);

        // Set up allowed transfers
        let manufacturer_to_distributor = table::new(ctx);
        table::add(&mut manufacturer_to_distributor, DISTRIBUTOR, true);
        table::add(&mut contract.allowed_transfers, MANUFACTURER, manufacturer_to_distributor);

        let distributor_to_pharmacy = table::new(ctx);
        table::add(&mut distributor_to_pharmacy, PHARMACY, true);
        table::add(&mut contract.allowed_transfers, DISTRIBUTOR, distributor_to_pharmacy);

        // Admin can transfer to anyone
        let admin_transfers = table::new(ctx);
        table::add(&mut admin_transfers, MANUFACTURER, true);
        table::add(&mut admin_transfers, DISTRIBUTOR, true);
        table::add(&mut admin_transfers, PHARMACY, true);
        table::add(&mut contract.allowed_transfers, ADMIN, admin_transfers);

        transfer::share_object(contract);
    }

    /// Assign role to user (admin only)
    /// Can be called by admin role or admin_cap owner
    entry fun assign_role(
        contract: &mut PharmaNFTContract,
        admin_cap: &AdminCap,
        user: address,
        role: u8,
        ctx: &TxContext,
    ) {
        assert!(role <= ADMIN, 0); // Invalid role
        
        let sender = tx_context::sender(ctx);
        // Check if sender is admin (either has admin role or owns admin_cap)
        // In Sui, ownership of admin_cap is checked automatically
        // But we also allow users with ADMIN role to assign roles
        let sender_role = get_user_role(contract, sender);
        assert!(sender_role == ADMIN, 1); // Only admin can assign roles

        // Update role if exists, otherwise add new
        if (table::contains(&contract.roles, user)) {
            let existing_role = table::borrow_mut(&mut contract.roles, user);
            *existing_role = role;
        } else {
            table::add(&mut contract.roles, user, role);
        };

        sui::event::emit(RoleAssigned {
            user,
            role,
        });
    }
    
    /// Assign role to user (requires AdminCap)
    /// This function allows assigning roles if caller provides valid AdminCap
    entry fun assign_role_by_admin(
        contract: &mut PharmaNFTContract,
        admin_cap: &AdminCap, // Require AdminCap proof - Sui verifies ownership automatically
        user: address,
        role: u8,
        ctx: &TxContext,
    ) {
        assert!(role <= ADMIN, 0); // Invalid role

        // AdminCap is automatically verified by Sui when passed as argument
        // The caller must own the AdminCap to execute this function
        // We still keep track of sender for event logging
        let sender = tx_context::sender(ctx);
        let sender_role = get_user_role(contract, sender);

        // Emit event for role assignment
        sui::event::emit(RoleAssigned {
            user,
            role,
        });

        // Update role if exists, otherwise add new
        if (table::contains(&contract.roles, user)) {
            let existing_role = table::borrow_mut(&mut contract.roles, user);
            *existing_role = role;
        } else {
            table::add(&mut contract.roles, user, role);
        };
    }

    /// Get user role
    public fun get_user_role(contract: &PharmaNFTContract, user: address): u8 {
        if (table::contains(&contract.roles, user)) {
            *table::borrow(&contract.roles, user)
        } else {
            NONE
        }
    }

    /// Remove role by admin (using admin role check only, no AdminCap needed)
    /// Allows ADMIN users to revoke roles from other users
    entry fun remove_role_by_admin(
        contract: &mut PharmaNFTContract,
        user: address,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let sender_role = get_user_role(contract, sender);
        // Only ADMIN can remove roles
        assert!(sender_role == ADMIN, 1);

        // User must already have a role
        assert!(table::contains(&contract.roles, user), 7);

        // Prevent admin from removing their own ADMIN role to avoid locking the contract
        let existing_role = *table::borrow(&contract.roles, user);
        assert!(!(existing_role == ADMIN && sender == user), 8);

        // Remove role from table
        let removed_role = *table::borrow(&contract.roles, user);
        table::remove(&mut contract.roles, user);

        sui::event::emit(RoleRemoved {
            user,
            role: removed_role,
        });
    }

    /// Enable/disable transfer restrictions (ADMIN only)
    entry fun set_transfer_restrictions(
        contract: &mut PharmaNFTContract,
        enabled: bool,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let sender_role = get_user_role(contract, sender);
        assert!(sender_role == ADMIN, 1);

        contract.transfer_restrictions = enabled;

        sui::event::emit(TransferRestrictionsUpdated { enabled });
    }

    /// Add allowed transfer rule: from_role -> to_role (ADMIN only)
    entry fun add_transfer_rule(
        contract: &mut PharmaNFTContract,
        from_role: u8,
        to_role: u8,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let sender_role = get_user_role(contract, sender);
        assert!(sender_role == ADMIN, 1);

        assert!(from_role <= ADMIN, 0);
        assert!(to_role <= ADMIN, 0);

        if (!table::contains(&contract.allowed_transfers, from_role)) {
            let new_table = table::new(ctx);
            table::add(&mut contract.allowed_transfers, from_role, new_table);
        };

        let allowed_to = table::borrow_mut(&mut contract.allowed_transfers, from_role);
        if (!table::contains(allowed_to, to_role)) {
            table::add(allowed_to, to_role, true);
        };

        sui::event::emit(TransferRuleAdded {
            from_role,
            to_role,
        });
    }

    /// Remove allowed transfer rule: from_role -> to_role (ADMIN only)
    entry fun remove_transfer_rule(
        contract: &mut PharmaNFTContract,
        from_role: u8,
        to_role: u8,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let sender_role = get_user_role(contract, sender);
        assert!(sender_role == ADMIN, 1);

        if (!table::contains(&contract.allowed_transfers, from_role)) {
            // Nothing to remove
            return
        };

        let allowed_to = table::borrow_mut(&mut contract.allowed_transfers, from_role);
        if (table::contains(allowed_to, to_role)) {
            table::remove(allowed_to, to_role);

            sui::event::emit(TransferRuleRemoved {
                from_role,
                to_role,
            });
        };
    }

    /// Mint product NFT (manufacturer only)
    entry fun mint_product_nft(
        contract: &mut PharmaNFTContract,
        uri: vector<u8>,
        batch_number: vector<u8>,
        expiry_date: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let role = get_user_role(contract, sender);
        assert!(role == MANUFACTURER, 2); // Only manufacturer

        // Validate expiry_date: must be in the future and not too far (max 10 years)
        let current_time = clock::timestamp_ms(clock);
        assert!(expiry_date > current_time, 9); // Expiry must be in the future
        assert!(expiry_date <= current_time + (10 * 365 * 24 * 60 * 60 * 1000), 10); // Max 10 years from now

        let history = vector::empty<address>();
        vector::push_back(&mut history, sender);
        
        let nft = PharmaNFT {
            id: object::new(ctx),
            uri: string::utf8(uri),
            batch_number: string::utf8(batch_number),
            expiry_date,
            expired: false,
            history,
        };

        let nft_id = object::id(&nft);
        transfer::transfer(nft, sender);

        sui::event::emit(NFTMinted {
            object_id: nft_id,
            uri: string::utf8(uri),
            batch_number: string::utf8(batch_number),
            expiry_date,
        });
    }

    /// Transfer product NFT
    entry fun transfer_product_nft(
        nft: PharmaNFT,
        contract: &PharmaNFTContract,
        to: address,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        
        // In Sui, ownership is checked automatically by the runtime
        // The sender must own the object to call this function

        // Get NFT ID before transfer
        let nft_id = object::id(&nft);

        // Check if expired
        let current_time = clock::timestamp_ms(clock);
        let is_expired = if (nft.expiry_date > 0 && current_time >= nft.expiry_date) {
            true
        } else {
            nft.expired
        };
        assert!(!is_expired, 4); // Product expired

        // Check transfer restrictions
        if (contract.transfer_restrictions) {
            let from_role = get_user_role(contract, sender);
            let to_role = get_user_role(contract, to);
            
            if (from_role != ADMIN) {
                assert!(table::contains(&contract.allowed_transfers, from_role), 5);
                let allowed_to = table::borrow(&contract.allowed_transfers, from_role);
                assert!(table::contains(allowed_to, to_role), 6); // Transfer not allowed
            };
        };

        // In Sui, we cannot recreate an object with the same UID after destructuring
        // So we transfer the object directly and track history via events
        // History can be reconstructed from NFTTransferred events
        transfer::transfer(nft, to);

        sui::event::emit(NFTTransferred {
            object_id: nft_id,
            from: sender,
            to,
        });
    }

    /// Admin transfer (bypass restrictions)
    entry fun admin_transfer(
        nft: PharmaNFT,
        _contract: &PharmaNFTContract,
        _admin_cap: &AdminCap,
        to: address,
        ctx: &TxContext,
    ) {
        // Check admin owns AdminCap
        let sender = tx_context::sender(ctx);
        // In Sui, ownership is checked automatically - admin_cap must be owned by sender

        // Get object ID before transfer
        let nft_id = object::id(&nft);
        
        // Transfer directly (bypass restrictions)
        transfer::transfer(nft, to);

        sui::event::emit(NFTTransferred {
            object_id: nft_id,
            from: sender,
            to,
        });
    }

    /// Check if product is expired
    public fun is_product_expired(nft: &PharmaNFT, clock: &Clock): bool {
        if (nft.expired) {
            return true
        };
        let current_time = clock::timestamp_ms(clock);
        current_time >= nft.expiry_date && nft.expiry_date > 0
    }

    /// Get NFT properties (view function)
    public fun get_nft_properties(nft: &PharmaNFT): (String, String, u64, bool, vector<address>) {
        (
            nft.uri,
            nft.batch_number,
            nft.expiry_date,
            nft.expired,
            nft.history,
        )
    }

    /// Get NFT history only (view function)
    public fun get_nft_history(nft: &PharmaNFT): vector<address> {
        nft.history
    }
}


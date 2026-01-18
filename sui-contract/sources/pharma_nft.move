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
    struct PharmaNFT has key, store {
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

    /// Initialize contract
    fun init(ctx: &mut TxContext) {
        let admin = AdminCap {
            id: object::new(ctx),
        };
        
        // Transfer admin cap to deployer
        transfer::transfer(admin, tx_context::sender(ctx));

        let contract = PharmaNFTContract {
            id: object::new(ctx),
            roles: table::new(ctx),
            transfer_restrictions: true,
            allowed_transfers: table::new(ctx),
        };

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
    public fun assign_role(
        contract: &mut PharmaNFTContract,
        admin_cap: &AdminCap,
        user: address,
        role: u8,
        ctx: &TxContext,
    ) {
        assert!(role <= ADMIN, 0); // Invalid role
        // In Sui, ownership is checked automatically - admin_cap must be owned by sender

        table::add(&mut contract.roles, user, role);
    }

    /// Get user role
    public fun get_user_role(contract: &PharmaNFTContract, user: address): u8 {
        if (table::contains(&contract.roles, user)) {
            *table::borrow(&contract.roles, user)
        } else {
            NONE
        }
    }

    /// Mint product NFT (manufacturer only)
    public entry fun mint_product_nft(
        contract: &mut PharmaNFTContract,
        uri: vector<u8>,
        batch_number: vector<u8>,
        expiry_date: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let role = get_user_role(contract, sender);
        assert!(role == MANUFACTURER, 2); // Only manufacturer

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
    public entry fun transfer_product_nft(
        nft: PharmaNFT,
        contract: &PharmaNFTContract,
        to: address,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        
        // In Sui, ownership is checked automatically by the runtime
        // The sender must own the object to call this function

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

        // Add to history and update expired status
        let PharmaNFT {
            id,
            uri,
            batch_number,
            expiry_date,
            expired: _,
            history,
        } = nft;
        
        vector::push_back(&mut history, to);
        
        let updated_nft = PharmaNFT {
            id,
            uri,
            batch_number,
            expiry_date,
            expired: is_expired,
            history,
        };

        // Transfer
        transfer::transfer(updated_nft, to);

        sui::event::emit(NFTTransferred {
            object_id: nft_id,
            from: sender,
            to,
        });
    }

    /// Admin transfer (bypass restrictions)
    public entry fun admin_transfer(
        nft: PharmaNFT,
        contract: &PharmaNFTContract,
        admin_cap: &AdminCap,
        to: address,
        ctx: &TxContext,
    ) {
        // Check admin owns AdminCap
        let sender = tx_context::sender(ctx);
        // In Sui, ownership is checked automatically - admin_cap must be owned by sender

        // Get object ID before destructuring
        let nft_id = object::id(&nft);

        // Add to history
        let PharmaNFT {
            id,
            uri,
            batch_number,
            expiry_date,
            expired,
            history,
        } = nft;
        
        vector::push_back(&mut history, to);
        
        let updated_nft = PharmaNFT {
            id,
            uri,
            batch_number,
            expiry_date,
            expired,
            history,
        };
        
        // Transfer
        transfer::transfer(updated_nft, to);

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
}


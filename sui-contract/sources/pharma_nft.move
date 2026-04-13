/// PharmaNFT Smart Contract v3.0 for Sui
/// Pharmaceutical supply chain tracking with metadata, milestones, and sensor data
/// Compatible with Sui Move 1.x framework
module pharma_nft::pharma_nft {

    // ============ Sui Framework Imports ============
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use std::string::{String, utf8};
    use std::vector;

    // ============ Constants ============

    const NONE: u8 = 0;
    const MANUFACTURER: u8 = 1;
    const DISTRIBUTOR: u8 = 2;
    const PHARMACY: u8 = 3;
    const ADMIN: u8 = 4;

    const STATUS_MINTED: u8 = 0;
    const STATUS_IN_TRANSIT: u8 = 1;
    const STATUS_AT_PHARMACY: u8 = 2;
    const STATUS_DISPENSED: u8 = 3;

    const ERR_INVALID_ROLE: u64 = 0;
    const ERR_NOT_AUTHORIZED: u64 = 1;
    const ERR_NOT_MANUFACTURER: u64 = 2;
    const ERR_PRODUCT_EXPIRED: u64 = 3;
    const ERR_TRANSFER_NOT_ALLOWED: u64 = 4;
    const ERR_INVALID_TRANSFER_ROUTE: u64 = 5;
    const ERR_USER_NOT_FOUND: u64 = 7;
    const ERR_CANNOT_REMOVE_SELF: u64 = 8;
    const ERR_INVALID_EXPIRY_DATE: u64 = 9;
    const ERR_EXPIRY_TOO_FAR: u64 = 10;
    const ERR_INVALID_STATUS: u64 = 11;
    const ERR_NOT_OWNER: u64 = 12;
    const ERR_NO_SENSOR_DATA: u64 = 13;

    // ============ Capability Objects ============

    struct AdminCap has key, store {
        id: UID,
    }

    // ============ Contract State ============

    struct PharmaNFTContract has key {
        id: UID,
        roles: Table<address, u8>,
        transfer_restrictions: bool,
        allowed_transfers: Table<u8, Table<u8, bool>>,
        total_nfts_minted: u64,
        version: u64,
    }

    // ============ NFT Object ============

    struct PharmaNFT has key {
        id: UID,
        uri: String,
        batch_number: String,
        drug_name: String,
        description: String,
        expiry_date: u64,
        expired: bool,
        quantity: u64,
        manufacturer_address: address,
        current_holder: address,
        status: u8,
        transfer_history: vector<TransferRecord>,
        milestones: vector<Milestone>,
    }

    struct TransferRecord has store, copy, drop {
        from: address,
        to: address,
        timestamp: u64,
        from_role: u8,
        to_role: u8,
        status_before: u8,
        status_after: u8,
    }

    /// Milestone - supply chain event with optional sensor data
    /// has_sensor_data=false means no sensor data recorded at this milestone
    struct Milestone has store, copy, drop {
        milestone_type: String,
        description: String,
        location: String,
        actor_address: address,
        timestamp: u64,
        has_sensor_data: bool,
        temperature: u64,
        humidity: u64,
        latitude: u64,
        longitude: u64,
    }

    // ============ Events ============

    struct NFTMinted has copy, drop {
        object_id: ID,
        batch_number: String,
        drug_name: String,
        manufacturer: address,
        expiry_date: u64,
        quantity: u64,
        timestamp: u64,
    }

    struct NFTTransferred has copy, drop {
        object_id: ID,
        batch_number: String,
        from: address,
        to: address,
        from_role: u8,
        to_role: u8,
        timestamp: u64,
    }

    struct RoleAssigned has copy, drop {
        user: address,
        role: u8,
        assigned_by: address,
        timestamp: u64,
    }

    struct RoleRemoved has copy, drop {
        user: address,
        role: u8,
        removed_by: address,
        timestamp: u64,
    }

    struct MilestoneAdded has copy, drop {
        object_id: ID,
        batch_number: String,
        milestone_type: String,
        actor: address,
        timestamp: u64,
    }

    struct SensorDataRecorded has copy, drop {
        object_id: ID,
        batch_number: String,
        temperature: u64,
        humidity: u64,
        latitude: u64,
        longitude: u64,
        recorded_by: address,
        timestamp: u64,
    }

    struct StatusChanged has copy, drop {
        object_id: ID,
        batch_number: String,
        old_status: u8,
        new_status: u8,
        changed_by: address,
        timestamp: u64,
    }

    struct TransferRestrictionsUpdated has copy, drop {
        enabled: bool,
        updated_by: address,
        timestamp: u64,
    }

    struct TransferRuleChanged has copy, drop {
        from_role: u8,
        to_role: u8,
        allowed: bool,
        updated_by: address,
        timestamp: u64,
    }

    // ============ One-Time Witness ============
    struct PHARMA_NFT has drop {}

    // ============ Initialize Contract ============

    fun init(_otw: PHARMA_NFT, ctx: &mut TxContext) {
        let deployer = tx_context::sender(ctx);

        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin_cap, deployer);

        let contract = PharmaNFTContract {
            id: object::new(ctx),
            roles: table::new(ctx),
            transfer_restrictions: true,
            allowed_transfers: table::new(ctx),
            total_nfts_minted: 0,
            version: 3,
        };

        table::add(&mut contract.roles, deployer, ADMIN);
        setup_default_transfer_rules(&mut contract, ctx);
        transfer::share_object(contract);
    }

    fun setup_default_transfer_rules(contract: &mut PharmaNFTContract, ctx: &mut TxContext) {
        let m_to_d: Table<u8, bool> = table::new(ctx);
        table::add(&mut m_to_d, DISTRIBUTOR, true);
        table::add(&mut contract.allowed_transfers, MANUFACTURER, m_to_d);

        let d_to_p: Table<u8, bool> = table::new(ctx);
        table::add(&mut d_to_p, PHARMACY, true);
        table::add(&mut contract.allowed_transfers, DISTRIBUTOR, d_to_p);

        let admin_transfers: Table<u8, bool> = table::new(ctx);
        table::add(&mut admin_transfers, MANUFACTURER, true);
        table::add(&mut admin_transfers, DISTRIBUTOR, true);
        table::add(&mut admin_transfers, PHARMACY, true);
        table::add(&mut contract.allowed_transfers, ADMIN, admin_transfers);
    }

    // ============ Contract Migration ============
    // Gọi hàm này nếu contract deploy không có transfer rules
    // Dùng AdminCap để đảm bảo chỉ admin mới gọi được

    entry fun migrate_contract(
        contract: &mut PharmaNFTContract,
        _admin_cap: &AdminCap,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        // Chỉ deployer (ADMIN) mới có thể migrate
        assert!(table::contains(&contract.roles, sender), ERR_USER_NOT_FOUND);

        // Nếu allowed_transfers chưa có MANUFACTURER → gọi setup
        if (!table::contains(&contract.allowed_transfers, MANUFACTURER)) {
            setup_default_transfer_rules(contract, ctx);
            sui::event::emit(TransferRuleChanged {
                from_role: 0,
                to_role: 0,
                action: utf8(b"migrated_default_rules"),
                timestamp: tx_context::epoch_timestamp_ms(ctx),
            });
        };
    }

    // ============ Admin Functions ============

    entry fun assign_role(
        contract: &mut PharmaNFTContract,
        _admin_cap: &AdminCap,
        user: address,
        role: u8,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(role <= ADMIN, ERR_INVALID_ROLE);

        if (table::contains(&contract.roles, user)) {
            let existing_role = table::borrow_mut(&mut contract.roles, user);
            *existing_role = role;
        } else {
            table::add(&mut contract.roles, user, role);
        };

        sui::event::emit(RoleAssigned {
            user,
            role,
            assigned_by: sender,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    entry fun remove_role(
        contract: &mut PharmaNFTContract,
        _admin_cap: &AdminCap,
        user: address,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&contract.roles, user), ERR_USER_NOT_FOUND);

        let existing_role = *table::borrow(&contract.roles, user);
        assert!(!(existing_role == ADMIN && sender == user), ERR_CANNOT_REMOVE_SELF);

        table::remove(&mut contract.roles, user);

        sui::event::emit(RoleRemoved {
            user,
            role: existing_role,
            removed_by: sender,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    entry fun set_transfer_restrictions(
        contract: &mut PharmaNFTContract,
        _admin_cap: &AdminCap,
        enabled: bool,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        contract.transfer_restrictions = enabled;

        sui::event::emit(TransferRestrictionsUpdated {
            enabled,
            updated_by: sender,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    entry fun add_transfer_rule(
        contract: &mut PharmaNFTContract,
        _admin_cap: &AdminCap,
        from_role: u8,
        to_role: u8,
        ctx: &mut TxContext,
    ) {
        assert!(from_role <= ADMIN && to_role <= ADMIN, ERR_INVALID_ROLE);

        if (!table::contains(&contract.allowed_transfers, from_role)) {
            let new_table: Table<u8, bool> = table::new(ctx);
            table::add(&mut contract.allowed_transfers, from_role, new_table);
        };

        let allowed_to = table::borrow_mut(&mut contract.allowed_transfers, from_role);
        if (!table::contains(allowed_to, to_role)) {
            table::add(allowed_to, to_role, true);
        };

        sui::event::emit(TransferRuleChanged {
            from_role,
            to_role,
            allowed: true,
            updated_by: tx_context::sender(ctx),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    entry fun remove_transfer_rule(
        contract: &mut PharmaNFTContract,
        _admin_cap: &AdminCap,
        from_role: u8,
        to_role: u8,
        ctx: &TxContext,
    ) {
        if (table::contains(&contract.allowed_transfers, from_role)) {
            let allowed_to = table::borrow_mut(&mut contract.allowed_transfers, from_role);
            if (table::contains(allowed_to, to_role)) {
                table::remove(allowed_to, to_role);

                sui::event::emit(TransferRuleChanged {
                    from_role,
                    to_role,
                    allowed: false,
                    updated_by: tx_context::sender(ctx),
                    timestamp: tx_context::epoch_timestamp_ms(ctx),
                });
            };
        };
    }

    // ============ NFT Functions ============

    entry fun mint_product_nft(
        contract: &mut PharmaNFTContract,
        uri: String,
        batch_number: String,
        drug_name: String,
        description: String,
        expiry_date: u64,
        quantity: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);

        let role = get_user_role_internal(contract, sender);
        assert!(role == MANUFACTURER, ERR_NOT_MANUFACTURER);

        let current_time = clock::timestamp_ms(clock);
        assert!(expiry_date > current_time, ERR_INVALID_EXPIRY_DATE);
        assert!(expiry_date <= current_time + 315360000000, ERR_EXPIRY_TOO_FAR);
        assert!(quantity > 0, ERR_INVALID_ROLE);

        let history = vector::empty<TransferRecord>();
        vector::push_back(
            &mut history,
            TransferRecord {
                from: sender,
                to: sender,
                timestamp: current_time,
                from_role: role,
                to_role: role,
                status_before: STATUS_MINTED,
                status_after: STATUS_MINTED,
            }
        );

        let milestones = vector::empty<Milestone>();
        vector::push_back(
            &mut milestones,
            Milestone {
                milestone_type: utf8(b"manufactured"),
                description: utf8(b"Product manufactured and NFT minted"),
                location: utf8(b"manufacturer_facility"),
                actor_address: sender,
                timestamp: current_time,
                has_sensor_data: false,
                temperature: 0,
                humidity: 0,
                latitude: 0,
                longitude: 0,
            }
        );

        let nft = PharmaNFT {
            id: object::new(ctx),
            uri,
            batch_number,
            drug_name,
            description,
            expiry_date,
            expired: false,
            quantity,
            manufacturer_address: sender,
            current_holder: sender,
            status: STATUS_MINTED,
            transfer_history: history,
            milestones,
        };

        let nft_id_ref = object::id(&nft);

        contract.total_nfts_minted = contract.total_nfts_minted + 1;

        transfer::transfer(nft, sender);

        sui::event::emit(NFTMinted {
            object_id: nft_id_ref,
            batch_number,
            drug_name,
            manufacturer: sender,
            expiry_date,
            quantity,
            timestamp: current_time,
        });
    }

    entry fun transfer_product_nft(
        nft: PharmaNFT,
        contract: &PharmaNFTContract,
        to: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);

        // ✅ FIX: Check sender is the current NFT holder
        assert!(nft.current_holder == sender, ERR_NOT_OWNER);

        // ✅ FIX: Validate sender and recipient have registered roles
        let from_role = get_user_role_internal(contract, sender);
        let to_role = get_user_role_internal(contract, to);
        assert!(from_role != NONE, ERR_USER_NOT_FOUND);
        assert!(to_role != NONE, ERR_USER_NOT_FOUND);

        let current_time = clock::timestamp_ms(clock);
        let is_expired = nft.expired || (current_time >= nft.expiry_date && nft.expiry_date > 0);
        assert!(!is_expired, ERR_PRODUCT_EXPIRED);

        if (contract.transfer_restrictions && from_role != ADMIN) {
            // ✅ FIX: Reject NONE role — table lookup would be meaningless for unregistered users
            assert!(from_role != NONE, ERR_USER_NOT_FOUND);
            assert!(table::contains(&contract.allowed_transfers, from_role), ERR_TRANSFER_NOT_ALLOWED);
            let allowed_to = table::borrow(&contract.allowed_transfers, from_role);
            assert!(table::contains(allowed_to, to_role), ERR_INVALID_TRANSFER_ROUTE);
        };

        // Capture all needed fields from NFT using destructuring
        let nft_id = object::id(&nft);
        let PharmaNFT {
            id: old_uid,
            uri,
            batch_number,
            drug_name,
            description,
            expiry_date,
            expired,
            quantity,
            manufacturer_address,
            current_holder: _,
            status: old_status,
            transfer_history: old_history,
            milestones,
        } = nft;
        object::delete(old_uid);

        let new_status = old_status;
        if (to_role == PHARMACY) {
            new_status = STATUS_AT_PHARMACY;
        } else if (from_role == MANUFACTURER && to_role == DISTRIBUTOR) {
            new_status = STATUS_IN_TRANSIT;
        };

        // Build new transfer history by appending record to existing history
        let new_transfer_record = TransferRecord {
            from: sender,
            to,
            timestamp: current_time,
            from_role,
            to_role,
            status_before: old_status,
            status_after: new_status,
        };
        vector::push_back(&mut old_history, new_transfer_record);

        let new_nft = PharmaNFT {
            id: object::new(ctx),
            uri,
            batch_number,
            drug_name,
            description,
            expiry_date,
            expired,
            quantity,
            manufacturer_address,
            current_holder: to,
            status: new_status,
            transfer_history: old_history,
            milestones,
        };

        transfer::transfer(new_nft, to);

        // Emit events after transfer
        sui::event::emit(NFTTransferred {
            object_id: nft_id,
            batch_number,
            from: sender,
            to,
            from_role,
            to_role,
            timestamp: current_time,
        });

        if (old_status != new_status) {
            sui::event::emit(StatusChanged {
                object_id: nft_id,
                batch_number,
                old_status,
                new_status,
                changed_by: sender,
                timestamp: current_time,
            });
        };
    }

    entry fun record_sensor_data(
        nft: &mut PharmaNFT,
        temperature: u64,
        humidity: u64,
        latitude: u64,
        longitude: u64,
        location: String,
        description: String,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(nft.current_holder == sender, ERR_NOT_OWNER);

        let current_time = clock::timestamp_ms(clock);

        vector::push_back(
            &mut nft.milestones,
            Milestone {
                milestone_type: utf8(b"sensor_data"),
                description,
                location,
                actor_address: sender,
                timestamp: current_time,
                has_sensor_data: true,
                temperature,
                humidity,
                latitude,
                longitude,
            }
        );

        sui::event::emit(SensorDataRecorded {
            object_id: object::id(nft),
            batch_number: nft.batch_number,
            temperature,
            humidity,
            latitude,
            longitude,
            recorded_by: sender,
            timestamp: current_time,
        });
    }

    entry fun add_milestone(
        nft: &mut PharmaNFT,
        milestone_type: String,
        description: String,
        location: String,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(nft.current_holder == sender, ERR_NOT_OWNER);

        let current_time = clock::timestamp_ms(clock);

        vector::push_back(
            &mut nft.milestones,
            Milestone {
                milestone_type,
                description,
                location,
                actor_address: sender,
                timestamp: current_time,
                has_sensor_data: false,
                temperature: 0,
                humidity: 0,
                latitude: 0,
                longitude: 0,
            }
        );

        sui::event::emit(MilestoneAdded {
            object_id: object::id(nft),
            batch_number: nft.batch_number,
            milestone_type,
            actor: sender,
            timestamp: current_time,
        });
    }

    entry fun mark_shipped(
        nft: PharmaNFT,
        contract: &PharmaNFTContract,
        destination: address,
        location: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(nft.current_holder == sender, ERR_NOT_OWNER);

        let current_time = clock::timestamp_ms(clock);
        let from_role = get_user_role_internal(contract, sender);
        let to_role = get_user_role_internal(contract, destination);

        // ✅ FIX: Validate roles are registered
        assert!(from_role != NONE, ERR_USER_NOT_FOUND);
        assert!(to_role != NONE, ERR_USER_NOT_FOUND);

        // ✅ FIX: Validate transfer route is allowed
        if (contract.transfer_restrictions && from_role != ADMIN) {
            assert!(table::contains(&contract.allowed_transfers, from_role), ERR_TRANSFER_NOT_ALLOWED);
            let allowed_to = table::borrow(&contract.allowed_transfers, from_role);
            assert!(table::contains(allowed_to, to_role), ERR_INVALID_TRANSFER_ROUTE);
        };

        let nft_id = object::id(&nft);
        let PharmaNFT {
            id: old_uid,
            uri: nft_uri,
            batch_number,
            drug_name,
            description,
            expiry_date,
            expired,
            quantity,
            manufacturer_address,
            current_holder: _,
            status: old_status,
            transfer_history: history,
            milestones,
        } = nft;
        object::delete(old_uid);

        vector::push_back(
            &mut milestones,
            Milestone {
                milestone_type: utf8(b"shipped"),
                description: utf8(b"Product shipped to next supply chain participant"),
                location,
                actor_address: sender,
                timestamp: current_time,
                has_sensor_data: false,
                temperature: 0,
                humidity: 0,
                latitude: 0,
                longitude: 0,
            }
        );

        vector::push_back(
            &mut history,
            TransferRecord {
                from: sender,
                to: destination,
                timestamp: current_time,
                from_role,
                to_role,
                status_before: old_status,
                status_after: STATUS_IN_TRANSIT,
            }
        );

        let new_nft = PharmaNFT {
            id: object::new(ctx),
            uri: nft_uri,
            batch_number,
            drug_name,
            description,
            expiry_date,
            expired,
            quantity,
            manufacturer_address,
            current_holder: destination,
            status: STATUS_IN_TRANSIT,
            transfer_history: history,
            milestones,
        };

        transfer::transfer(new_nft, destination);

        sui::event::emit(NFTTransferred {
            object_id: nft_id,
            batch_number,
            from: sender,
            to: destination,
            from_role,
            to_role,
            timestamp: current_time,
        });

        sui::event::emit(StatusChanged {
            object_id: nft_id,
            batch_number,
            old_status,
            new_status: STATUS_IN_TRANSIT,
            changed_by: sender,
            timestamp: current_time,
        });
    }

    entry fun confirm_receipt(
        nft: &mut PharmaNFT,
        contract: &PharmaNFTContract,
        location: String,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(nft.current_holder == sender, ERR_NOT_OWNER);

        let role = get_user_role_internal(contract, sender);
        assert!(role == PHARMACY, ERR_NOT_AUTHORIZED);

        let current_time = clock::timestamp_ms(clock);

        vector::push_back(
            &mut nft.milestones,
            Milestone {
                milestone_type: utf8(b"received_pharmacy"),
                description: utf8(b"Product received at pharmacy and confirmed"),
                location,
                actor_address: sender,
                timestamp: current_time,
                has_sensor_data: false,
                temperature: 0,
                humidity: 0,
                latitude: 0,
                longitude: 0,
            }
        );

        let old_status = nft.status;
        nft.status = STATUS_AT_PHARMACY;

        sui::event::emit(MilestoneAdded {
            object_id: object::id(nft),
            batch_number: nft.batch_number,
            milestone_type: utf8(b"received_pharmacy"),
            actor: sender,
            timestamp: current_time,
        });

        sui::event::emit(StatusChanged {
            object_id: object::id(nft),
            batch_number: nft.batch_number,
            old_status,
            new_status: STATUS_AT_PHARMACY,
            changed_by: sender,
            timestamp: current_time,
        });
    }

    entry fun dispense(
        nft: &mut PharmaNFT,
        contract: &PharmaNFTContract,
        customer_id: String,
        location: String,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(nft.current_holder == sender, ERR_NOT_OWNER);

        let role = get_user_role_internal(contract, sender);
        assert!(role == PHARMACY, ERR_NOT_AUTHORIZED);
        assert!(nft.status == STATUS_AT_PHARMACY, ERR_INVALID_STATUS);

        let current_time = clock::timestamp_ms(clock);

        vector::push_back(
            &mut nft.milestones,
            Milestone {
                milestone_type: utf8(b"dispensed"),
                description: customer_id,
                location,
                actor_address: sender,
                timestamp: current_time,
                has_sensor_data: false,
                temperature: 0,
                humidity: 0,
                latitude: 0,
                longitude: 0,
            }
        );

        let old_status = nft.status;
        nft.status = STATUS_DISPENSED;

        sui::event::emit(MilestoneAdded {
            object_id: object::id(nft),
            batch_number: nft.batch_number,
            milestone_type: utf8(b"dispensed"),
            actor: sender,
            timestamp: current_time,
        });

        sui::event::emit(StatusChanged {
            object_id: object::id(nft),
            batch_number: nft.batch_number,
            old_status,
            new_status: STATUS_DISPENSED,
            changed_by: sender,
            timestamp: current_time,
        });
    }

    entry fun update_uri(
        nft: &mut PharmaNFT,
        new_uri: String,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(nft.manufacturer_address == sender, ERR_NOT_AUTHORIZED);
        nft.uri = new_uri;
    }

    entry fun mark_expired(
        nft: &mut PharmaNFT,
        _contract: &PharmaNFTContract,
        ctx: &TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let role = get_user_role_internal(_contract, sender);
        assert!(role == ADMIN || sender == nft.manufacturer_address, ERR_NOT_AUTHORIZED);
        nft.expired = true;
    }

    // ============ View Functions ============

    public fun get_user_role(contract: &PharmaNFTContract, user: address): u8 {
        get_user_role_internal(contract, user)
    }

    fun get_user_role_internal(contract: &PharmaNFTContract, user: address): u8 {
        if (table::contains(&contract.roles, user)) {
            *table::borrow(&contract.roles, user)
        } else {
            NONE
        }
    }

    public fun get_status_string(status: u8): String {
        if (status == STATUS_MINTED) {
            utf8(b"minted")
        } else if (status == STATUS_IN_TRANSIT) {
            utf8(b"in_transit")
        } else if (status == STATUS_AT_PHARMACY) {
            utf8(b"at_pharmacy")
        } else if (status == STATUS_DISPENSED) {
            utf8(b"dispensed")
        } else {
            utf8(b"unknown")
        }
    }

    public fun get_role_string(role: u8): String {
        if (role == MANUFACTURER) {
            utf8(b"MANUFACTURER")
        } else if (role == DISTRIBUTOR) {
            utf8(b"DISTRIBUTOR")
        } else if (role == PHARMACY) {
            utf8(b"PHARMACY")
        } else if (role == ADMIN) {
            utf8(b"ADMIN")
        } else {
            utf8(b"NONE")
        }
    }

    public fun is_product_expired(nft: &PharmaNFT, clock: &Clock): bool {
        if (nft.expired) {
            return true
        };
        let current_time = clock::timestamp_ms(clock);
        current_time >= nft.expiry_date && nft.expiry_date > 0
    }

    public fun get_nft_properties(nft: &PharmaNFT): (
        String,
        String,
        String,
        String,
        u64,
        bool,
        u64,
        address,
        address,
        u8,
        u64,
        u64,
    ) {
        (
            nft.uri,
            nft.batch_number,
            nft.drug_name,
            nft.description,
            nft.expiry_date,
            nft.expired,
            nft.quantity,
            nft.manufacturer_address,
            nft.current_holder,
            nft.status,
            vector::length(&nft.milestones),
            vector::length(&nft.transfer_history),
        )
    }

    public fun get_milestone_count(nft: &PharmaNFT): u64 {
        vector::length(&nft.milestones)
    }

    public fun get_milestone_at(nft: &PharmaNFT, index: u64): &Milestone {
        vector::borrow(&nft.milestones, index)
    }

    public fun get_last_milestone(nft: &PharmaNFT): &Milestone {
        let len = vector::length(&nft.milestones);
        assert!(len > 0, ERR_INVALID_STATUS);
        vector::borrow(&nft.milestones, len - 1)
    }

    public fun get_last_sensor_data(nft: &PharmaNFT): (bool, u64, u64, u64, u64) {
        let len = vector::length(&nft.milestones);
        if (len == 0) {
            return (false, 0, 0, 0, 0)
        };
        // Return the last milestone's sensor data if it has any
        let last = vector::borrow(&nft.milestones, len - 1);
        if (last.has_sensor_data) {
            (true, last.temperature, last.humidity, last.latitude, last.longitude)
        } else {
            (false, 0, 0, 0, 0)
        }
    }

    public fun get_contract_info(contract: &PharmaNFTContract): (u64, bool, u64) {
        (contract.total_nfts_minted, contract.transfer_restrictions, contract.version)
    }

    public fun can_transfer(contract: &PharmaNFTContract, from: address, to: address): bool {
        let from_role = get_user_role_internal(contract, from);
        let to_role = get_user_role_internal(contract, to);

        if (!contract.transfer_restrictions) {
            return true
        };
        if (from_role == ADMIN) {
            return true
        };
        if (!table::contains(&contract.allowed_transfers, from_role)) {
            return false
        };
        let allowed_to = table::borrow(&contract.allowed_transfers, from_role);
        if (!table::contains(allowed_to, to_role)) {
            return false
        };
        true
    }

    public fun assert_owner(nft: &PharmaNFT, owner: address) {
        assert!(nft.current_holder == owner, ERR_NOT_OWNER);
    }

    public fun get_nft_id(nft: &PharmaNFT): ID {
        object::id(nft)
    }

    public fun get_batch_number(nft: &PharmaNFT): &String {
        &nft.batch_number
    }

    public fun get_manufacturer(nft: &PharmaNFT): address {
        nft.manufacturer_address
    }

    public fun get_current_holder(nft: &PharmaNFT): address {
        nft.current_holder
    }

    public fun get_status(nft: &PharmaNFT): u8 {
        nft.status
    }

    public fun get_expiry_date(nft: &PharmaNFT): u64 {
        nft.expiry_date
    }

    public fun get_quantity(nft: &PharmaNFT): u64 {
        nft.quantity
    }

    public fun has_milestone_sensor_data(milestone: &Milestone): bool {
        milestone.has_sensor_data
    }

    public fun get_milestone_sensor_data(milestone: &Milestone): (u64, u64, u64, u64) {
        assert!(milestone.has_sensor_data, ERR_NO_SENSOR_DATA);
        (milestone.temperature, milestone.humidity, milestone.latitude, milestone.longitude)
    }
}

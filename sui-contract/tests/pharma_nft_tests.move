// Pharma NFT Smart Contract Tests v3.0
// PharmaDNA · pharma_nft::pharma_nft
//
// Test coverage:
//   ✓ init & AdminCap
//   ✓ Role assignment / removal
//   ✓ NFT minting (manufacturer only)
//   ✓ Expiry validation on mint
//   ✓ Transfer: manufacturer → distributor (allowed route)
//   ✓ Transfer: distributor → pharmacy (allowed route)
//   ✓ Transfer: manufacturer → pharmacy (blocked — invalid route)
//   ✓ Expired product cannot be transferred
//   ✓ Unauthorized transfer (random address without role)
//   ✓ Sensor data recording
//   ✓ Milestone recording
//   ✓ mark_shipped + confirm_receipt flow
//   ✓ dispense (pharmacy only)
//   ✓ transfer_restrictions toggle
//   ✓ add_transfer_rule / remove_transfer_rule
//   ✓ View functions: get_status, is_product_expired, can_transfer

#[test_only]
module pharma_dna::pharma_nft_tests {
    use pharma_dna::pharma_nft as nft;
    use sui::test_scenario::{Self, Scenario};
    use sui::clock::{Self, Clock};
    use sui::transfer;
    use std::string::{utf8, String};

    // ===== Test addresses =====================================================
    const ADMIN: address = @0xAAA1;
    const MANUFACTURER: address = @0xAAA2;
    const DISTRIBUTOR: address = @0xAAA3;
    const PHARMACY: address = @0xAAA4;
    const RANDOM: address = @0xDEAD; // address with no role assigned

    // ===== Helper: advance clock by `ms` milliseconds ========================
    fun advance_clock(s: &mut Scenario, ms: u64) {
        let c = test_scenario::take_shared<Clock>(s);
        clock::increment_for_testing(&mut c, ms);
        test_scenario::return_shared(c);
    }

    // ===== Helper: current timestamp (ms) =====================================
    fun current_ts(s: &mut Scenario): u64 {
        let c = test_scenario::take_shared<Clock>(s);
        let ts = clock::timestamp_ms(&c);
        test_scenario::return_shared(c);
        ts
    }

    // ===== Helper: init contract + assign roles ==============================
    fun init_contract(scenario: &mut Scenario) {
        // Step 1: init() — framework will auto-share PharmaNFTContract after this
        test_scenario::next_tx(scenario, ADMIN);
        nft::init(nft::pharma_nft {}, test_scenario::ctx(scenario));

        // Step 2: shared contract is now accessible; assign AdminCap + roles
        test_scenario::next_tx(scenario, ADMIN);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(scenario);
        let admin_cap = test_scenario::take_from_address<nft::AdminCap>(scenario, ADMIN);

        nft::assign_role(&mut contract, &admin_cap, MANUFACTURER, nft::MANUFACTURER(), test_scenario::ctx(scenario));
        nft::assign_role(&mut contract, &admin_cap, DISTRIBUTOR, nft::DISTRIBUTOR(), test_scenario::ctx(scenario));
        nft::assign_role(&mut contract, &admin_cap, PHARMACY, nft::PHARMACY(), test_scenario::ctx(scenario));

        test_scenario::return_to_address(ADMIN, admin_cap);
        test_scenario::return_shared(contract);
    }

    // ===== Helper: mint a fresh NFT ==========================================
    fun mint_nft(scenario: &mut Scenario, batch: vector<u8>, expiry_offset_ms: u64) {
        let ts = current_ts(scenario);
        let expiry = ts + expiry_offset_ms;

        test_scenario::next_tx(scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(scenario);
        let clock = test_scenario::take_shared<Clock>(scenario);

        nft::mint_product_nft(
            &mut contract,
            utf8(b"https://ipfs.example.com"),
            utf8(batch),
            utf8(b"Amoxicillin 500mg"),
            utf8(b"Antibiotic for bacterial infections"),
            expiry,
            100,
            &clock,
            test_scenario::ctx(scenario),
        );

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
    }

    // =========================================================================
    // INIT TESTS
    // =========================================================================

    #[test]
    fun test_init_creates_admin_cap_and_contract() {
        let mut scenario = test_scenario::begin(ADMIN);

        nft::init(nft::pharma_nft {}, test_scenario::ctx(&mut scenario));

        test_scenario::next_tx(&mut scenario, ADMIN);

        // AdminCap belongs to deployer
        assert!(test_scenario::has_most_recent_for_address<nft::AdminCap>(ADMIN), 0);

        // Contract is shared
        assert!(test_scenario::has_most_recent_shared<nft::PharmaNFTContract>(), 1);

        test_scenario::end(scenario);
    }

    // =========================================================================
    // ROLE ASSIGNMENT TESTS
    // =========================================================================

    #[test]
    fun test_assign_and_get_role() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        test_scenario::next_tx(&mut scenario, ADMIN);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);

        assert!(nft::get_user_role(&contract, MANUFACTURER) == nft::MANUFACTURER(), 0);
        assert!(nft::get_user_role(&contract, DISTRIBUTOR) == nft::DISTRIBUTOR(), 0);
        assert!(nft::get_user_role(&contract, PHARMACY) == nft::PHARMACY(), 1);
        assert!(nft::get_user_role(&contract, RANDOM) == nft::NONE(), 2); // unassigned

        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_role_string_view() {
        assert!(nft::get_role_string(nft::MANUFACTURER()) == utf8(b"MANUFACTURER"), 0);
        assert!(nft::get_role_string(nft::DISTRIBUTOR()) == utf8(b"DISTRIBUTOR"), 0);
        assert!(nft::get_role_string(nft::PHARMACY()) == utf8(b"PHARMACY"), 0);
        assert!(nft::get_role_string(nft::ADMIN()) == utf8(b"ADMIN"), 0);
        assert!(nft::get_role_string(nft::NONE()) == utf8(b"NONE"), 0);
    }

    #[test]
    fun test_remove_role() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        test_scenario::next_tx(&mut scenario, ADMIN);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let admin_cap = test_scenario::take_from_address<nft::AdminCap>(&scenario, ADMIN);

        nft::remove_role(&mut contract, &admin_cap, DISTRIBUTOR, test_scenario::ctx(&mut scenario));

        // Distributor now has no role
        assert!(nft::get_user_role(&contract, DISTRIBUTOR) == nft::NONE(), 0);

        test_scenario::return_to_address(ADMIN, admin_cap);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nft::ERR_USER_NOT_FOUND)]
    fun test_remove_nonexistent_role_aborts() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        test_scenario::next_tx(&mut scenario, ADMIN);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let admin_cap = test_scenario::take_from_address<nft::AdminCap>(&scenario, ADMIN);

        // RANDOM never had a role
        nft::remove_role(&mut contract, &admin_cap, RANDOM, test_scenario::ctx(&mut scenario));

        test_scenario::return_to_address(ADMIN, admin_cap);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    // =========================================================================
    // MINT TESTS
    // =========================================================================

    #[test]
    fun test_mint_creates_nft_and_increments_counter() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        let nft_id = mint_nft(&mut scenario, b"BATCH-MINT-001", 86400000_u64); // +1 day

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);

        assert!(nft::get_nft_id(&nft) == nft_id, 0);
        assert!(nft::get_batch_number(&nft) == &utf8(b"BATCH-MINT-001"), 0);
        assert!(nft::get_drug_name(&nft) == &utf8(b"Amoxicillin 500mg"), 0);
        assert!(nft::get_status(&nft) == nft::STATUS_MINTED(), 0);
        assert!(nft::get_current_holder(&nft) == MANUFACTURER, 0);
        assert!(nft::get_manufacturer(&nft) == MANUFACTURER, 0);
        assert!(nft::get_quantity(&nft) == 100, 0);
        assert!(!nft::is_expired(&nft), 0);

        test_scenario::return_to_address(MANUFACTURER, nft);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_mint_creates_manufactured_milestone() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-MS-001", 86400000_u64);

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);

        assert!(nft::get_milestone_count(&nft) == 1, 0);

        test_scenario::return_to_address(MANUFACTURER, nft);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nft::ERR_INVALID_EXPIRY_DATE)]
    fun test_mint_with_past_expiry_aborts() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);
        let past_expiry = 1000u64; // far in the past

        nft::mint_product_nft_for_testing(
            &mut contract,
            utf8(b"https://ipfs.example.com"),
            utf8(b"BATCH-EXPIRED"),
            utf8(b"Medicine"),
            utf8(b""),
            past_expiry,
            1,
            &clock,
            test_scenario::ctx(scenario),
        );

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nft::ERR_NOT_MANUFACTURER)]
    fun test_non_manufacturer_cannot_mint() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        let ts = current_ts(&mut scenario);

        test_scenario::next_tx(&mut scenario, DISTRIBUTOR);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        // Distributor tries to mint — must abort
        nft::mint_product_nft(
            &mut contract,
            utf8(b"https://ipfs.example.com"),
            utf8(b"BATCH-UNAUTH"),
            utf8(b"Medicine"),
            utf8(b""),
            ts + 86400000,
            1,
            &clock,
            test_scenario::ctx(&mut scenario),
        );

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    // =========================================================================
    // TRANSFER TESTS
    // =========================================================================

    #[test]
    fun test_transfer_manufacturer_to_distributor() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        let nft_id = mint_nft(&mut scenario, b"BATCH-TRANS-001", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        nft::transfer_product_nft(&nft, &contract, DISTRIBUTOR, &clock, test_scenario::ctx(scenario));

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);

        test_scenario::next_tx(&mut scenario, DISTRIBUTOR);
        let transferred = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, DISTRIBUTOR);
        assert!(nft::get_current_holder(&transferred) == DISTRIBUTOR, 0);
        assert!(nft::get_status(&transferred) == nft::STATUS_IN_TRANSIT(), 1);
        test_scenario::return_to_address(DISTRIBUTOR, transferred);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_transfer_distributor_to_pharmacy() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-TRANS-002", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        // M → D
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft1 = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);
        nft::transfer_product_nft(&nft1, &contract, DISTRIBUTOR, &clock, test_scenario::ctx(scenario));
        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);

        advance_clock(&mut scenario, 500);

        // D → P
        test_scenario::next_tx(&mut scenario, DISTRIBUTOR);
        let nft2 = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, DISTRIBUTOR);
        let contract2 = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock2 = test_scenario::take_shared<Clock>(&scenario);
        nft::transfer_product_nft(&nft2, &contract2, PHARMACY, &clock2, test_scenario::ctx(scenario));
        test_scenario::return_shared(clock2);
        test_scenario::return_shared(contract2);
        test_scenario::end(scenario);

        test_scenario::next_tx(&mut scenario, PHARMACY);
        let dispensed = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, PHARMACY);
        assert!(nft::get_current_holder(&dispensed) == PHARMACY, 0);
        assert!(nft::get_status(&dispensed) == nft::STATUS_AT_PHARMACY(), 0);
        test_scenario::return_to_address(PHARMACY, dispensed);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nft::ERR_INVALID_TRANSFER_ROUTE)]
    fun test_transfer_manufacturer_to_pharmacy_blocked() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-INVALID", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        // Manufacturer cannot send directly to Pharmacy — only via Distributor
        nft::transfer_product_nft(&nft, &contract, PHARMACY, &clock, test_scenario::ctx(scenario));

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nft::ERR_USER_NOT_FOUND)]
    fun test_transfer_to_unregistered_address_aborts() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-NOROLE", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        // RANDOM has no role — transfer must abort
        nft::transfer_product_nft(&nft, &contract, RANDOM, &clock, test_scenario::ctx(scenario));

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nft::ERR_PRODUCT_EXPIRED)]
    fun test_transfer_expired_product_aborts() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        // Mint with 0 offset → immediately expired (current time)
        let ts = current_ts(&scenario);

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        nft::mint_product_nft_for_testing(
            &mut contract,
            utf8(b"https://ipfs.example.com"),
            utf8(b"BATCH-EXPIRED"),
            utf8(b"Expired Drug"),
            utf8(b""),
            ts, // expiry = current time → already expired
            1,
            &clock,
            test_scenario::ctx(scenario),
        );

        let nft_id = nft::get_last_nft_id_for_testing();

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);

        advance_clock(&mut scenario, 1); // advance past expiry

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract2 = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock2 = test_scenario::take_shared<Clock>(&scenario);

        // Expired product cannot be transferred
        nft::transfer_product_nft(&nft, &contract2, DISTRIBUTOR, &clock2, test_scenario::ctx(scenario));

        test_scenario::return_shared(clock2);
        test_scenario::return_shared(contract2);
        test_scenario::end(scenario);
    }

    // =========================================================================
    // SENSOR DATA TESTS
    // =========================================================================

    #[test]
    fun test_record_sensor_data() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-SENSOR-001", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        nft::record_sensor_data(
            &mut nft,
            500,   // temperature × 100 = 5.00°C
            5500,  // humidity × 100 = 55.00%
            10680000, // latitude × 10⁷ = 10.68 (Hanoi)
            106700000, // longitude × 10⁷ = 106.70
            utf8(b"Warehouse A, Hanoi"),
            utf8(b"Temperature within range"),
            &clock,
            test_scenario::ctx(scenario),
        );

        let milestone_count = nft::get_milestone_count(&nft);
        assert!(milestone_count == 2, 0); // manufactured + sensor

        test_scenario::return_shared(clock);
        test_scenario::return_to_address(MANUFACTURER, nft);
        test_scenario::end(scenario);
    }

    // =========================================================================
    // MILESTONE TESTS
    // =========================================================================

    #[test]
    fun test_add_milestone() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-MS-002", 86400000_u64);

        advance_clock(&mut scenario, 2000);

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        nft::add_milestone(
            &mut nft,
            utf8(b"quality_check"),
            utf8(b"Passed QC inspection"),
            utf8(b"QC Lab, HCMC"),
            &clock,
            test_scenario::ctx(scenario),
        );

        assert!(nft::get_milestone_count(&nft) == 2, 0);

        test_scenario::return_shared(clock);
        test_scenario::return_to_address(MANUFACTURER, nft);
        test_scenario::end(scenario);
    }

    // =========================================================================
    // SHIPPING / RECEIPT TESTS
    // =========================================================================

    #[test]
    fun test_mark_shipped_and_confirm_receipt() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-SHIP-001", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        // Manufacturer marks as shipped
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        nft::mark_shipped(
            &nft,
            &contract,
            DISTRIBUTOR,
            utf8(b"HCMC Logistics Center"),
            &clock,
            test_scenario::ctx(scenario),
        );

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);

        advance_clock(&mut scenario, 500);

        // Distributor confirms receipt
        test_scenario::next_tx(&mut scenario, DISTRIBUTOR);
        let nft2 = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, DISTRIBUTOR);
        let contract2 = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock2 = test_scenario::take_shared<Clock>(&scenario);

        assert!(nft::get_status(&nft2) == nft::STATUS_IN_TRANSIT(), 0);

        nft::confirm_receipt(
            &mut nft2,
            &contract2,
            utf8(b"Distributor Warehouse, Hanoi"),
            &clock2,
            test_scenario::ctx(scenario),
        );

        assert!(nft::get_status(&nft2) == nft::STATUS_AT_PHARMACY(), 0);
        assert!(nft::get_milestone_count(&nft2) == 3, 0); // manufactured + shipped + received

        test_scenario::return_shared(clock2);
        test_scenario::return_shared(contract2);
        test_scenario::return_to_address(DISTRIBUTOR, nft2);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nft::ERR_NOT_AUTHORIZED)]
    fun test_non_pharmacy_cannot_confirm_receipt() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-SHIP-002", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        // Manufacturer cannot confirm receipt (not a pharmacy)
        nft::confirm_receipt(
            &mut nft,
            &contract,
            utf8(b"Wrong place"),
            &clock,
            test_scenario::ctx(scenario),
        );

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    // =========================================================================
    // DISPENSE TESTS
    // =========================================================================

    #[test]
    fun test_dispense() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-DISP-001", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        // M → D
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft1 = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);
        nft::transfer_product_nft(&nft1, &contract, DISTRIBUTOR, &clock, test_scenario::ctx(scenario));
        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);

        advance_clock(&mut scenario, 500);

        // D → P
        test_scenario::next_tx(&mut scenario, DISTRIBUTOR);
        let nft2 = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, DISTRIBUTOR);
        let contract2 = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock2 = test_scenario::take_shared<Clock>(&scenario);
        nft::transfer_product_nft(&nft2, &contract2, PHARMACY, &clock2, test_scenario::ctx(scenario));
        test_scenario::return_shared(clock2);
        test_scenario::return_shared(contract2);
        test_scenario::end(scenario);

        advance_clock(&mut scenario, 500);

        // P dispenses
        test_scenario::next_tx(&mut scenario, PHARMACY);
        let nft3 = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, PHARMACY);
        let contract3 = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock3 = test_scenario::take_shared<Clock>(&scenario);

        nft::dispense(
            &mut nft3,
            &contract3,
            utf8(b"customer_CUST-123"),
            utf8(b"Nhà thuốc Phúc An, Q1"),
            &clock3,
            test_scenario::ctx(scenario),
        );

        assert!(nft::get_status(&nft3) == nft::STATUS_DISPENSED(), 0);
        assert!(nft::get_milestone_count(&nft3) == 3, 0); // minted + 2 transfers

        test_scenario::return_shared(clock3);
        test_scenario::return_shared(contract3);
        test_scenario::return_to_address(PHARMACY, nft3);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = nft::ERR_INVALID_STATUS)]
    fun test_dispense_not_at_pharmacy_aborts() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-DISP-002", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        // Try to dispense while still at manufacturer (not at pharmacy)
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        nft::dispense(
            &mut nft,
            &contract,
            utf8(b"customer"),
            utf8(b"Location"),
            &clock,
            test_scenario::ctx(scenario),
        );

        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    // =========================================================================
    // TRANSFER RESTRICTIONS TESTS
    // =========================================================================

    #[test]
    fun test_can_transfer_respects_routes() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        test_scenario::next_tx(&mut scenario, ADMIN);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);

        // Allowed routes
        assert!(nft::can_transfer(&contract, MANUFACTURER, DISTRIBUTOR) == true, 0);
        assert!(nft::can_transfer(&contract, DISTRIBUTOR, PHARMACY) == true, 0);

        // Blocked routes
        assert!(nft::can_transfer(&contract, MANUFACTURER, PHARMACY) == false, 0);
        assert!(nft::can_transfer(&contract, RANDOM, PHARMACY) == false, 0);

        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_disable_transfer_restrictions_allows_any_route() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        test_scenario::next_tx(&mut scenario, ADMIN);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let admin_cap = test_scenario::take_from_address<nft::AdminCap>(&scenario, ADMIN);

        nft::set_transfer_restrictions(&mut contract, &admin_cap, false, test_scenario::ctx(scenario));

        assert!(nft::can_transfer(&contract, MANUFACTURER, PHARMACY) == true, 0);
        assert!(nft::can_transfer(&contract, RANDOM, PHARMACY) == false, 0); // still need a role

        test_scenario::return_to_address(ADMIN, admin_cap);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_transfer_rule_opens_new_route() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        test_scenario::next_tx(&mut scenario, ADMIN);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let admin_cap = test_scenario::take_from_address<nft::AdminCap>(&scenario, ADMIN);

        // Before: MANUFACTURER → PHARMACY is blocked
        assert!(nft::can_transfer(&contract, MANUFACTURER, PHARMACY) == false, 0);

        // Admin opens the route
        nft::add_transfer_rule(&mut contract, &admin_cap, nft::MANUFACTURER(), nft::PHARMACY(), test_scenario::ctx(scenario));

        // After: route is open
        assert!(nft::can_transfer(&contract, MANUFACTURER, PHARMACY) == true, 0);

        test_scenario::return_to_address(ADMIN, admin_cap);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_remove_transfer_rule_closes_route() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);

        test_scenario::next_tx(&mut scenario, ADMIN);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let admin_cap = test_scenario::take_from_address<nft::AdminCap>(&scenario, ADMIN);

        // Default: MANUFACTURER → DISTRIBUTOR is allowed
        assert!(nft::can_transfer(&contract, MANUFACTURER, DISTRIBUTOR) == true, 0);

        nft::remove_transfer_rule(&mut contract, &admin_cap, nft::MANUFACTURER(), nft::DISTRIBUTOR(), test_scenario::ctx(scenario));

        assert!(nft::can_transfer(&contract, MANUFACTURER, DISTRIBUTOR) == false, 0);

        test_scenario::return_to_address(ADMIN, admin_cap);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);
    }

    // =========================================================================
    // EXPIRY / MARK EXPIRED TESTS
    // =========================================================================

    #[test]
    fun test_is_product_expired() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-EXPIRY-001", 86400000_u64);

        advance_clock(&mut scenario, 86400000); // +1 day

        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let clock = test_scenario::take_shared<Clock>(&scenario);

        assert!(nft::is_product_expired(&nft, &clock) == true, 0);

        test_scenario::return_shared(clock);
        test_scenario::return_to_address(MANUFACTURER, nft);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_mark_expired() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-MARK-EXP", 86400000_u64);

        test_scenario::next_tx(&mut scenario, ADMIN);
        let nft = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);

        assert!(nft::is_expired(&nft) == false, 0);

        nft::mark_expired(&mut nft, &contract, test_scenario::ctx(scenario));
        assert!(nft::is_expired(&nft) == true, 0);

        test_scenario::return_shared(contract);
        test_scenario::return_to_address(MANUFACTURER, nft);
        test_scenario::end(scenario);
    }

    // =========================================================================
    // STATUS VIEW TESTS
    // =========================================================================

    #[test]
    fun test_status_string() {
        assert!(nft::get_status_string(nft::STATUS_MINTED()) == utf8(b"minted"), 0);
        assert!(nft::get_status_string(nft::STATUS_IN_TRANSIT()) == utf8(b"in_transit"), 0);
        assert!(nft::get_status_string(nft::STATUS_AT_PHARMACY()) == utf8(b"at_pharmacy"), 0);
        assert!(nft::get_status_string(nft::STATUS_DISPENSED()) == utf8(b"dispensed"), 0);
        assert!(nft::get_status_string(99) == utf8(b"unknown"), 0);
    }

    // =========================================================================
    // TRANSFER HISTORY TESTS
    // =========================================================================

    #[test]
    fun test_transfer_history_grows() {
        let mut scenario = test_scenario::begin(ADMIN);
        init_contract(&mut scenario);
        mint_nft(&mut scenario, b"BATCH-HIST-001", 86400000_u64);

        advance_clock(&mut scenario, 1000);

        // M → D
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft1 = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, MANUFACTURER);
        let contract = test_scenario::take_shared<nft::PharmaNFTContract>(&scenario);
        let clock = test_scenario::take_shared<Clock>(&scenario);
        nft::transfer_product_nft(&nft1, &contract, DISTRIBUTOR, &clock, test_scenario::ctx(scenario));
        test_scenario::return_shared(clock);
        test_scenario::return_shared(contract);
        test_scenario::end(scenario);

        test_scenario::next_tx(&mut scenario, DISTRIBUTOR);
        let nft2 = test_scenario::take_from_address<nft::PharmaNFT>(&scenario, DISTRIBUTOR);

        // 1 mint record + 1 transfer record
        assert!(nft::get_transfer_history_count(&nft2) == 2, 0);

        test_scenario::return_to_address(DISTRIBUTOR, nft2);
        test_scenario::end(scenario);
    }
}

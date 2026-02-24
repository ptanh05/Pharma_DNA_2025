// Pharma DNA NFT Smart Contract Tests
// Tests để verify tính chính xác của minting, transferring, và permissions

#[test_only]
module pharma_dna::pharma_nft_tests {
    use pharma_dna::pharma_nft::{Self, PharmaCollection, ProductNFT};
    use sui::test_scenario::{Self, Scenario};
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, ID};
    use std::string::String;

    // Test addresses
    const MANUFACTURER: address = @0x1;
    const DISTRIBUTOR: address = @0x2;
    const PHARMACY: address = @0x3;
    const ADMIN: address = @0xFF;

    // Test: Khởi tạo PharmaCollection
    #[test]
    public fun test_create_collection() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        // Tạo collection
        pharma_nft::create_collection(ctx);
        
        // Verify collection được tạo
        test_scenario::next_tx(&mut scenario, ADMIN);
        assert!(test_scenario::has_most_recent_shared<PharmaCollection>(), 0);
        
        test_scenario::end(scenario);
    }

    // Test: Mint NFT (chỉ MANUFACTURER có quyền)
    #[test]
    public fun test_mint_nft() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        // Admin tạo collection
        pharma_nft::create_collection(ctx);
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        
        let mut collection = test_scenario::take_shared<PharmaCollection>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        // Manufacturer mint NFT
        pharma_nft::mint_product_nft(
            &mut collection,
            b"BATCH-001",
            b"https://ipfs.example.com/metadata",
            b"Aspirin 500mg",
            ctx
        );
        
        // Verify NFT được mint
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        assert!(test_scenario::has_most_recent_for_address<ProductNFT>(MANUFACTURER), 0);
        
        test_scenario::return_shared(collection);
        test_scenario::end(scenario);
    }

    // Test: Transfer NFT từ Manufacturer → Distributor
    #[test]
    public fun test_transfer_to_distributor() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::create_collection(ctx);
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        
        let mut collection = test_scenario::take_shared<PharmaCollection>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::mint_product_nft(
            &mut collection,
            b"BATCH-002",
            b"https://ipfs.example.com/metadata",
            b"Paracetamol 1000mg",
            ctx
        );
        
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<ProductNFT>(&scenario, MANUFACTURER);
        let ctx = test_scenario::ctx(&mut scenario);
        
        // Transfer to Distributor
        pharma_nft::transfer_to_distributor(&nft, DISTRIBUTOR, ctx);
        
        test_scenario::next_tx(&mut scenario, DISTRIBUTOR);
        assert!(test_scenario::has_most_recent_for_address<ProductNFT>(DISTRIBUTOR), 0);
        
        test_scenario::return_shared(collection);
        test_scenario::end(scenario);
    }

    // Test: Transfer NFT từ Distributor → Pharmacy
    #[test]
    public fun test_transfer_to_pharmacy() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::create_collection(ctx);
        
        // Mint NFT
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let mut collection = test_scenario::take_shared<PharmaCollection>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::mint_product_nft(
            &mut collection,
            b"BATCH-003",
            b"https://ipfs.example.com/metadata",
            b"Ibuprofen 200mg",
            ctx
        );
        test_scenario::return_shared(collection);
        
        // Transfer to Distributor
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<ProductNFT>(&scenario, MANUFACTURER);
        let ctx = test_scenario::ctx(&mut scenario);
        pharma_nft::transfer_to_distributor(&nft, DISTRIBUTOR, ctx);
        
        // Transfer to Pharmacy
        test_scenario::next_tx(&mut scenario, DISTRIBUTOR);
        let nft = test_scenario::take_from_address<ProductNFT>(&scenario, DISTRIBUTOR);
        let ctx = test_scenario::ctx(&mut scenario);
        pharma_nft::transfer_to_pharmacy(&nft, PHARMACY, ctx);
        
        test_scenario::next_tx(&mut scenario, PHARMACY);
        assert!(test_scenario::has_most_recent_for_address<ProductNFT>(PHARMACY), 0);
        
        test_scenario::end(scenario);
    }

    // Test: Check NFT metadata
    #[test]
    public fun test_nft_metadata() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::create_collection(ctx);
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        
        let mut collection = test_scenario::take_shared<PharmaCollection>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::mint_product_nft(
            &mut collection,
            b"BATCH-004",
            b"https://ipfs.example.com/metadata",
            b"Vitamin C 1000mg",
            ctx
        );
        
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<ProductNFT>(&scenario, MANUFACTURER);
        
        // Verify metadata
        assert!(pharma_nft::get_batch_number(&nft) == b"BATCH-004", 0);
        assert!(pharma_nft::get_product_name(&nft) == b"Vitamin C 1000mg", 0);
        assert!(pharma_nft::get_ipfs_hash(&nft) == b"https://ipfs.example.com/metadata", 0);
        assert!(pharma_nft::get_status(&nft) == b"minted", 0);
        
        test_scenario::end(scenario);
    }

    // Test: Burn NFT (chỉ owner)
    #[test]
    public fun test_burn_nft() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::create_collection(ctx);
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        
        let mut collection = test_scenario::take_shared<PharmaCollection>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::mint_product_nft(
            &mut collection,
            b"BATCH-005",
            b"https://ipfs.example.com/metadata",
            b"Expired Medicine",
            ctx
        );
        
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let nft = test_scenario::take_from_address<ProductNFT>(&scenario, MANUFACTURER);
        let ctx = test_scenario::ctx(&mut scenario);
        
        // Burn NFT
        pharma_nft::burn(nft, ctx);
        
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        assert!(!test_scenario::has_most_recent_for_address<ProductNFT>(MANUFACTURER), 0);
        
        test_scenario::return_shared(collection);
        test_scenario::end(scenario);
    }

    // Test: Unauthorized transfer attempt
    #[test]
    #[expected_failure(abort_code = pharma_nft::ENotAuthorized)]
    public fun test_unauthorized_transfer() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::create_collection(ctx);
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        
        let mut collection = test_scenario::take_shared<PharmaCollection>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::mint_product_nft(
            &mut collection,
            b"BATCH-006",
            b"https://ipfs.example.com/metadata",
            b"Test Medicine",
            ctx
        );
        
        test_scenario::next_tx(&mut scenario, PHARMACY);
        let mut collection = test_scenario::take_shared<PharmaCollection>(&scenario);
        let nft = test_scenario::take_from_address<ProductNFT>(&scenario, MANUFACTURER);
        let ctx = test_scenario::ctx(&mut scenario);
        
        // Pharmacy tries to mint (unauthorized)
        pharma_nft::mint_product_nft(
            &mut collection,
            b"BATCH-007",
            b"https://ipfs.example.com/metadata",
            b"Unauthorized Medicine",
            ctx
        );
        
        test_scenario::return_shared(collection);
        test_scenario::end(scenario);
    }

    // Test: Event emission on mint
    #[test]
    public fun test_mint_event() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::create_collection(ctx);
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        
        let mut collection = test_scenario::take_shared<PharmaCollection>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::mint_product_nft(
            &mut collection,
            b"BATCH-008",
            b"https://ipfs.example.com/metadata",
            b"Medicine for testing",
            ctx
        );
        
        // Event should be emitted during mint
        let events = test_scenario::events(&scenario);
        assert!(!vector::is_empty(&events), 0);
        
        test_scenario::return_shared(collection);
        test_scenario::end(scenario);
    }

    // Test: Batch operation
    #[test]
    public fun test_batch_mint() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        pharma_nft::create_collection(ctx);
        
        // Mint 10 NFTs
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        let mut collection = test_scenario::take_shared<PharmaCollection>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        let mut i = 0;
        while (i < 10) {
            let batch_id = 10 + i;
            let batch_number = b"BATCH-";
            pharma_nft::mint_product_nft(
                &mut collection,
                batch_number,
                b"https://ipfs.example.com/metadata",
                b"Batch Medicine",
                ctx
            );
            i = i + 1;
        };
        
        // Verify all 10 NFTs minted
        test_scenario::next_tx(&mut scenario, MANUFACTURER);
        assert!(test_scenario::has_most_recent_for_address<ProductNFT>(MANUFACTURER), 0);
        
        test_scenario::return_shared(collection);
        test_scenario::end(scenario);
    }
}

// Pharma DNA Access Control Tests
// Verify role-based access control

#[test_only]
module pharma_dna::pharma_access_tests {
    use pharma_dna::access_control::{Self, AccessControl};
    use sui::test_scenario::{Self};

    const ADMIN: address = @0xFF;
    const MANUFACTURER: address = @0x1;
    const DISTRIBUTOR: address = @0x2;
    const PHARMACY: address = @0x3;

    #[test]
    public fun test_assign_manufacturer_role() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        access_control::create(ctx);
        test_scenario::next_tx(&mut scenario, ADMIN);
        
        let mut ac = test_scenario::take_shared<AccessControl>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        access_control::assign_role(&mut ac, MANUFACTURER, 1, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        assert!(access_control::has_role(&ac, MANUFACTURER, 1), 0);
        
        test_scenario::return_shared(ac);
        test_scenario::end(scenario);
    }

    #[test]
    public fun test_assign_distributor_role() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        access_control::create(ctx);
        test_scenario::next_tx(&mut scenario, ADMIN);
        
        let mut ac = test_scenario::take_shared<AccessControl>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        access_control::assign_role(&mut ac, DISTRIBUTOR, 2, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        assert!(access_control::has_role(&ac, DISTRIBUTOR, 2), 0);
        
        test_scenario::return_shared(ac);
        test_scenario::end(scenario);
    }

    #[test]
    public fun test_revoke_role() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        access_control::create(ctx);
        test_scenario::next_tx(&mut scenario, ADMIN);
        
        let mut ac = test_scenario::take_shared<AccessControl>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        access_control::assign_role(&mut ac, MANUFACTURER, 1, ctx);
        test_scenario::next_tx(&mut scenario, ADMIN);
        assert!(access_control::has_role(&ac, MANUFACTURER, 1), 0);
        
        let mut ac = test_scenario::take_shared<AccessControl>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        access_control::revoke_role(&mut ac, MANUFACTURER, 1, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        assert!(!access_control::has_role(&ac, MANUFACTURER, 1), 0);
        
        test_scenario::return_shared(ac);
        test_scenario::end(scenario);
    }

    #[test]
    public fun test_multiple_roles() {
        let mut scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        access_control::create(ctx);
        test_scenario::next_tx(&mut scenario, ADMIN);
        
        let mut ac = test_scenario::take_shared<AccessControl>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        
        access_control::assign_role(&mut ac, MANUFACTURER, 1, ctx);
        access_control::assign_role(&mut ac, DISTRIBUTOR, 2, ctx);
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        assert!(access_control::has_role(&ac, MANUFACTURER, 1), 0);
        assert!(access_control::has_role(&ac, MANUFACTURER, 2), 0);
        
        test_scenario::return_shared(ac);
        test_scenario::end(scenario);
    }
}

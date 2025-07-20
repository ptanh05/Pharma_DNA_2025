// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PharmaDNA {
    enum Role { None, Manufacturer, Distributor, Pharmacy, Admin }
    struct Product {
        uint256 id;
        string name;
        address currentOwner;
        address[] history;
    }
    mapping(address => Role) public roles;
    mapping(uint256 => Product) public products;
    uint256 public nextProductId;
    address public owner;

    event RoleAssigned(address indexed user, Role role);
    event ProductRegistered(uint256 indexed productId, string name, address indexed manufacturer);
    event ProductTransferred(uint256 indexed productId, address indexed from, address indexed to);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }
    modifier onlyRole(Role r) {
        require(roles[msg.sender] == r, "Invalid role");
        _;
    }
    modifier onlyProductOwner(uint256 productId) {
        require(products[productId].currentOwner == msg.sender, "Not product owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        roles[msg.sender] = Role.Admin;
    }

    function assignRole(address user, Role role) external onlyOwner {
        roles[user] = role;
        emit RoleAssigned(user, role);
    }

    function registerProduct(string calldata name) external onlyRole(Role.Manufacturer) returns (uint256) {
        uint256 productId = nextProductId++;
        address[] memory history = new address[](1);
        history[0] = msg.sender;
        products[productId] = Product(productId, name, msg.sender, history);
        emit ProductRegistered(productId, name, msg.sender);
        return productId;
    }

    function transferProduct(uint256 productId, address to) external onlyProductOwner(productId) {
        require(roles[to] != Role.None, "Recipient must have a role");
        products[productId].currentOwner = to;
        products[productId].history.push(to);
        emit ProductTransferred(productId, msg.sender, to);
    }

    function getProductHistory(uint256 productId) external view returns (address[] memory) {
        return products[productId].history;
    }
} 
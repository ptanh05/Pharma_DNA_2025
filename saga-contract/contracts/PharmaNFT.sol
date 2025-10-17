// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * PharmaNFT
 * - Minimal breaking changes for existing frontend/API:
 *   - Keeps functions: roles(address), assignRole(address, Role), mintProductNFT(string),
 *     transferProductNFT(uint256,address), getProductHistory(uint256)
 * - Adds: revokeRole, batchAssignRoles, hasRole, getRole, getProductCurrentOwner,
 *   pause/unpause, role guards for admin operations
 */
contract PharmaNFT is ERC721URIStorage, Ownable, Pausable {
    using EnumerableSet for EnumerableSet.AddressSet;

    enum Role { None, Manufacturer, Distributor, Pharmacy, Admin }

    // Role management
    mapping(address => Role) public roles; // preserved public getter for FE/API compatibility
    EnumerableSet.AddressSet private allUsers;

    // Product lifecycle
    mapping(uint256 => address[]) public productHistory; // preserved getter
    uint256 public nextTokenId;

    // Events
    event RoleAssigned(address indexed user, Role role);
    event RoleRevoked(address indexed user);
    event RolesBatchAssigned(uint256 count);
    event ProductMinted(uint256 indexed tokenId, address indexed manufacturer, string uri);
    event ProductTransferred(uint256 indexed tokenId, address indexed from, address indexed to);

    // Modifiers
    modifier onlyRole(Role r) {
        require(roles[msg.sender] == r, "Invalid role");
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
    }

    constructor(address initialOwner) ERC721("PharmaNFT", "PHARMA") Ownable(initialOwner) {}

    // ===== Role management =====
    function assignRole(address user, Role role) external onlyOwner {
        roles[user] = role;
        allUsers.add(user);
        emit RoleAssigned(user, role);
    }

    function revokeRole(address user) external onlyOwner {
        roles[user] = Role.None;
        emit RoleRevoked(user);
    }

    function batchAssignRoles(address[] calldata users, Role[] calldata roleValues) external onlyOwner {
        require(users.length == roleValues.length, "Length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            roles[users[i]] = roleValues[i];
            allUsers.add(users[i]);
            emit RoleAssigned(users[i], roleValues[i]);
        }
        emit RolesBatchAssigned(users.length);
    }

    function hasRole(address user, Role roleValue) external view returns (bool) {
        return roles[user] == roleValue;
    }

    function getRole(address user) external view returns (Role) {
        return roles[user];
    }

    // ===== Minting =====
    function mintProductNFT(string calldata uri) external whenNotPaused onlyRole(Role.Manufacturer) returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        productHistory[tokenId].push(msg.sender);
        emit ProductMinted(tokenId, msg.sender, uri);
        return tokenId;
    }

    // ===== Transfer with business rules =====
    function transferProductNFT(uint256 tokenId, address to) external whenNotPaused onlyTokenOwner(tokenId) {
        require(roles[to] != Role.None, "Recipient must have a role");
        _transfer(msg.sender, to, tokenId);
        productHistory[tokenId].push(to);
        emit ProductTransferred(tokenId, msg.sender, to);
    }

    // ===== Views & helpers =====
    function getProductHistory(uint256 tokenId) external view returns (address[] memory) {
        return productHistory[tokenId];
    }

    function getProductCurrentOwner(uint256 tokenId) external view returns (address) {
        return ownerOf(tokenId);
    }

    function getAllUsers(uint256 offset, uint256 limit) external view returns (address[] memory users, Role[] memory userRoles) {
        uint256 total = allUsers.length();
        if (offset >= total) {
            return (new address[](0), new Role[](0));
        }
        uint256 to = offset + limit;
        if (to > total) to = total;
        uint256 size = to - offset;
        users = new address[](size);
        userRoles = new Role[](size);
        for (uint256 i = 0; i < size; i++) {
            address u = allUsers.at(offset + i);
            users[i] = u;
            userRoles[i] = roles[u];
        }
    }

    // ===== Admin controls =====
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
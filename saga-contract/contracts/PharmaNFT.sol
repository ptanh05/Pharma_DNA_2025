// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PharmaNFT is ERC721URIStorage, Ownable {
    enum Role { None, Manufacturer, Distributor, Pharmacy, Admin }
    mapping(address => Role) public roles;
    mapping(uint256 => address[]) public productHistory;
    uint256 public nextTokenId;

    event RoleAssigned(address indexed user, Role role);
    event ProductMinted(uint256 indexed tokenId, address indexed manufacturer, string uri);
    event ProductTransferred(uint256 indexed tokenId, address indexed from, address indexed to);

    modifier onlyRole(Role r) {
        require(roles[msg.sender] == r, "Invalid role");
        _;
    }
    modifier onlyTokenOwner(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
    }

    constructor(address initialOwner) ERC721("PharmaNFT", "PHARMA") Ownable(initialOwner) {}

    function assignRole(address user, Role role) external onlyOwner {
        roles[user] = role;
        emit RoleAssigned(user, role);
    }

    function mintProductNFT(string calldata uri) external onlyRole(Role.Manufacturer) returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        productHistory[tokenId].push(msg.sender);
        emit ProductMinted(tokenId, msg.sender, uri);
        return tokenId;
    }

    function transferProductNFT(uint256 tokenId, address to) external onlyTokenOwner(tokenId) {
        require(roles[to] != Role.None, "Recipient must have a role");
        _transfer(msg.sender, to, tokenId);
        productHistory[tokenId].push(to);
        emit ProductTransferred(tokenId, msg.sender, to);
    }

    function getProductHistory(uint256 tokenId) external view returns (address[] memory) {
        return productHistory[tokenId];
    }
} 
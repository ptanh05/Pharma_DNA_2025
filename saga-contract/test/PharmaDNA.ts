import { expect } from "chai";
import { ethers } from "hardhat";

describe("PharmaNFT", function () {
  let pharmaNFT: any;
  let admin: any, manufacturer: any, distributor: any, pharmacy: any;

  beforeEach(async function () {
    [admin, manufacturer, distributor, pharmacy] = await ethers.getSigners();
    const PharmaNFT = await ethers.getContractFactory("PharmaNFT");
    pharmaNFT = await PharmaNFT.deploy(admin.address);
    await pharmaNFT.waitForDeployment();
    await pharmaNFT.assignRole(manufacturer.address, 1); // Manufacturer
    await pharmaNFT.assignRole(distributor.address, 2); // Distributor
    await pharmaNFT.assignRole(pharmacy.address, 3); // Pharmacy
  });

  it("should allow manufacturer to mint product NFT", async function () {
    await pharmaNFT.connect(manufacturer).mintProductNFT("ipfs://hash-1");
    const owner = await pharmaNFT.ownerOf(0);
    expect(owner).to.equal(manufacturer.address);
  });

  it("should allow transfer and track product history", async function () {
    await pharmaNFT.connect(manufacturer).mintProductNFT("ipfs://hash-1");
    await pharmaNFT.connect(manufacturer).transferProductNFT(0, distributor.address);
    await pharmaNFT.connect(distributor).transferProductNFT(0, pharmacy.address);
    const owner = await pharmaNFT.ownerOf(0);
    expect(owner).to.equal(pharmacy.address);
    const history = await pharmaNFT.getProductHistory(0);
    expect(history.length).to.equal(3);
    expect(history[0]).to.equal(manufacturer.address);
    expect(history[1]).to.equal(distributor.address);
    expect(history[2]).to.equal(pharmacy.address);
  });
});
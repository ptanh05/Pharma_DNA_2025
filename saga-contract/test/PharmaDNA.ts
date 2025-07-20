import { expect } from "chai";
import { ethers } from "hardhat";

describe("PharmaDNA", function () {
  let pharmaDNA: any;
  let manufacturer: any, distributor: any, pharmacy: any;

  beforeEach(async function () {
    const [admin, m, d, p] = await ethers.getSigners();
    manufacturer = m;
    distributor = d;
    pharmacy = p;
    const PharmaDNA = await ethers.getContractFactory("PharmaDNA");
    pharmaDNA = await PharmaDNA.deploy();
    await pharmaDNA.deployed();
    await pharmaDNA.assignRole(manufacturer.address, 1); // Manufacturer
    await pharmaDNA.assignRole(distributor.address, 2); // Distributor
    await pharmaDNA.assignRole(pharmacy.address, 3); // Pharmacy
  });

  it("should allow manufacturer to register product", async function () {
    await pharmaDNA.connect(manufacturer).registerProduct("DrugA");
    const product = await pharmaDNA.products(0);
    expect(product.name).to.equal("DrugA");
    expect(product.currentOwner).to.equal(manufacturer.address);
  });

  it("should allow transfer and track product history", async function () {
    await pharmaDNA.connect(manufacturer).registerProduct("DrugA");
    await pharmaDNA.connect(manufacturer).transferProduct(0, distributor.address);
    await pharmaDNA.connect(distributor).transferProduct(0, pharmacy.address);
    const product = await pharmaDNA.products(0);
    expect(product.currentOwner).to.equal(pharmacy.address);
    const history = await pharmaDNA.getProductHistory(0);
    expect(history.length).to.equal(3);
    expect(history[0]).to.equal(manufacturer.address);
    expect(history[1]).to.equal(distributor.address);
    expect(history[2]).to.equal(pharmacy.address);
  });
}); 
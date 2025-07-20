import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PharmaDNAModule = buildModule("PharmaDNAModule", (m) => {
  const pharmaDNA = m.contract("PharmaDNA", []);
  return { pharmaDNA };
});

export default PharmaDNAModule; 
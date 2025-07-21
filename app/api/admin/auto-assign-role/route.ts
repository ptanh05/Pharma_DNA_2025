import { NextRequest, NextResponse } from 'next/server';
import { ethers } from "ethers";
import pharmaNFTAbi from "@/lib/pharmaNFT-abi.json";

const PHARMA_NFT_ADDRESS = process.env.PHARMA_NFT_ADDRESS || "0xaa3f88a6b613985f3D97295D6BAAb6246c2699c6";
const SAGA_RPC = "https://sagent-2751288990640000-1.jsonrpc.sagarpc.io";
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) return NextResponse.json({ error: "Thiếu địa chỉ" }, { status: 400 });
  try {
    if (!OWNER_PRIVATE_KEY) throw new Error("OWNER_PRIVATE_KEY not set");
    const provider = new ethers.JsonRpcProvider(SAGA_RPC);
    const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(PHARMA_NFT_ADDRESS, pharmaNFTAbi.abi || pharmaNFTAbi, ownerWallet);
    // Gán role Manufacturer (1)
    const tx = await contract.assignRole(address, 1);
    await tx.wait();
    return NextResponse.json({ success: true, txHash: tx.hash });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from "next/server";
import formidable from "formidable";
import { pinFileToIPFS } from "@/lib/pinata";
import { Readable } from "stream";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  // Chuyển request thành stream cho formidable
  const form = new formidable.IncomingForm();
  return new Promise((resolve) => {
    form.parse(req as any, async (err, fields, files) => {
      if (err) {
        resolve(NextResponse.json({ error: "Lỗi parse form" }, { status: 400 }));
        return;
      }
      try {
        const result = await pinFileToIPFS(fields, files);
        resolve(NextResponse.json(result));
      } catch (e: any) {
        resolve(NextResponse.json({ error: e.message || "Upload IPFS thất bại" }, { status: 500 }));
      }
    });
  });
} 
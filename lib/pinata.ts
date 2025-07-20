import FormData from "form-data";
import fs from "fs";

/**
 * Upload file và metadata lên Pinata IPFS (dùng cho Next.js API Route + formidable)
 * @param fields - metadata (tên thuốc, số lô, ...)
 * @param files - file upload (drugImage, certificate) từ formidable
 * @returns object chứa IpfsHash hoặc lỗi
 */
export async function pinFileToIPFS(fields: Record<string, any>, files: Record<string, any>) {
  const form = new FormData();
  // Thêm metadata dưới dạng JSON
  form.append("pinataMetadata", JSON.stringify({
    name: fields.drugName || "drug-batch",
    keyvalues: fields,
  }));
  // Thêm file ảnh thuốc
  if (files.drugImage && files.drugImage.filepath && fs.existsSync(files.drugImage.filepath)) {
    form.append(
      "file",
      fs.createReadStream(files.drugImage.filepath),
      files.drugImage.originalFilename
    );
  }
  // Thêm file certificate nếu có
  if (files.certificate && files.certificate.filepath && fs.existsSync(files.certificate.filepath)) {
    form.append(
      "file",
      fs.createReadStream(files.certificate.filepath),
      files.certificate.originalFilename
    );
  }
  // Gọi API Pinata
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
      ...form.getHeaders(),
    },
    body: form as any,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Pinata upload failed");
  return data;
} 
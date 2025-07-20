/**
 * Utility functions for Pinata IPFS integration
 */

export interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export interface DrugMetadata {
  drugName: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  description?: string;
  timestamp: string;
}

/**
 * Upload metadata và files lên Pinata IPFS
 */
export async function uploadToPinata(
  metadata: DrugMetadata,
  files: { drugImage?: File; certificate?: File }
): Promise<PinataResponse> {
  const formData = new FormData();

  // Thêm metadata
  formData.append(
    "pinataMetadata",
    JSON.stringify({
      name: `${metadata.drugName}-${metadata.batchNumber}`,
      keyvalues: metadata,
    })
  );

  // Thêm options
  formData.append(
    "pinataOptions",
    JSON.stringify({
      cidVersion: 1,
    })
  );

  // Thêm files
  if (files.drugImage && files.drugImage.size > 0) {
    formData.append("file", files.drugImage, files.drugImage.name);
  }

  if (files.certificate && files.certificate.size > 0) {
    formData.append("file", files.certificate, files.certificate.name);
  }

  // Nếu không có file nào, tạo metadata file
  if (
    (!files.drugImage || files.drugImage.size === 0) &&
    (!files.certificate || files.certificate.size === 0)
  ) {
    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: "application/json",
    });
    formData.append(
      "file",
      metadataBlob,
      `${metadata.drugName}-${metadata.batchNumber}-metadata.json`
    );
  }

  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed: ${errorText}`);
  }

  return await response.json();
}

/**
 * Lấy file từ IPFS thông qua Pinata gateway
 */
export function getIPFSUrl(hash: string): string {
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}

/**
 * Verify IPFS hash exists
 */
export async function verifyIPFSHash(hash: string): Promise<boolean> {
  try {
    const response = await fetch(getIPFSUrl(hash), { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

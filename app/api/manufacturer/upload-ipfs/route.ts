import { type NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    // 1. Lấy dữ liệu từ form-data của request.
    const formData = await request.formData();

    // Trích xuất các trường dữ liệu từ formData.
    const drugName = formData.get("drugName") as string;
    const batchNumber = formData.get("batchNumber") as string;
    const manufacturingDate = formData.get("manufacturingDate") as string;
    const expiryDate = formData.get("expiryDate") as string;
    const description = formData.get("description") as string;
    const drugImage = formData.get("drugImage") as File | null;
    const certificate = formData.get("certificate") as File | null;
    const manufacturerAddress = formData.get("manufacturerAddress") as string;

    // 2. Kiểm tra dữ liệu đầu vào.
    // Kiểm tra các trường thông tin cơ bản, bắt buộc phải có.
    if (!drugName || !batchNumber || !manufacturingDate || !expiryDate) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc" },
        { status: 400 }
      );
    }

    // Kiểm tra xem địa chỉ ví của nhà sản xuất có được cung cấp không.
    if (!manufacturerAddress) {
      return NextResponse.json(
        { error: "Thiếu địa chỉ ví manufacturer" },
        { status: 400 }
      );
    }

    // Kiểm tra xem khóa API của Pinata đã được cấu hình trong biến môi trường chưa.
    if (!process.env.PINATA_JWT) {
      return NextResponse.json(
        { error: "PINATA_JWT chưa được cấu hình" },
        { status: 500 } // Lỗi 500 vì đây là lỗi cấu hình phía server.
      );
    }

    // Mảng để lưu trữ các URI của file đã được upload lên IPFS (ví dụ: 'ipfs/Qm...').
    const uploadedFiles: string[] = [];

    // 3. Upload file lên IPFS (nếu có).
    // Xử lý upload ảnh thuốc nếu người dùng có cung cấp.
    if (drugImage && drugImage.size > 0) {
      try {
        const imageFormData = new FormData();
        imageFormData.append("file", drugImage);

        // Gửi request tới Pinata API để "ghim" (pin) file lên IPFS.
        const imageResponse = await fetch(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.PINATA_JWT}`,
            },
            body: imageFormData,
          }
        );

        // Nếu upload thành công, lấy IPFS hash và thêm vào mảng `uploadedFiles`.
        if (imageResponse.ok) {
          const imageResult = await imageResponse.json();
          uploadedFiles.push(`ipfs/${imageResult.IpfsHash}`);
        }
      } catch (error) {
        console.error("Lỗi khi upload ảnh thuốc:", error);
        // Có thể chọn dừng lại ở đây hoặc tiếp tục mà không có ảnh.
      }
    }

    // Xử lý upload file chứng nhận nếu người dùng có cung cấp.
    if (certificate && certificate.size > 0) {
      try {
        const certFormData = new FormData();
        certFormData.append("file", certificate);

        // Gửi request tới Pinata API.
        const certResponse = await fetch(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.PINATA_JWT}`,
            },
            body: certFormData,
          }
        );

        // Nếu upload thành công, lấy IPFS hash và thêm vào mảng.
        if (certResponse.ok) {
          const certResult = await certResponse.json();
          uploadedFiles.push(`ipfs/${certResult.IpfsHash}`);
        }
      } catch (error) {
        console.error("Lỗi khi upload chứng nhận:", error);
      }
    }

    // 4. Tạo và upload file metadata JSON lên IPFS.
    // Tạo đối tượng metadata chứa tất cả thông tin về thuốc và các file đã upload.
    const metadata = {
      drugName,
      batchNumber,
      manufacturingDate,
      expiryDate,
      description,
      manufacturerAddress,
      timestamp: new Date().toISOString(),
      files: uploadedFiles, // Danh sách các file trên IPFS.
      version: "1.0",
    };

    // Gửi request tới Pinata API để ghim file JSON metadata.
    const metadataResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: {
            name: `${drugName}-${batchNumber}-metadata`, // Tên file metadata trên Pinata.
            keyvalues: {
              // Các key-value để dễ dàng truy vấn trên Pinata.
              drugName: drugName,
              batchNumber: batchNumber,
              type: "drug-metadata",
            },
          },
        }),
      }
    );

    // Kiểm tra nếu việc ghim metadata không thành công.
    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error("Lỗi Pinata metadata:", errorText);
      return NextResponse.json(
        { error: "Lỗi khi upload metadata lên IPFS" },
        { status: 500 }
      );
    }

    // Lấy IPFS hash của file metadata từ kết quả trả về.
    const metadataResult = await metadataResponse.json();
    const ipfsHash = metadataResult.IpfsHash;

    // 5. Lưu thông tin vào database.
    try {
      // Thực hiện câu lệnh SQL INSERT để lưu thông tin vào bảng 'nfts'.
      const dbResult = await pool.query(
        `INSERT INTO nfts (name, status, created_at, manufacturer_address, ipfs_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          `${drugName} - ${batchNumber}`,
          "CREATED",
          new Date().toISOString(),
          manufacturerAddress,
          ipfsHash, // Lưu hash của metadata.
        ]
      );

      console.log("Kết quả ghi vào database:", dbResult);

      // 6. Trả về response thành công.
      return NextResponse.json({
        success: true,
        IpfsHash: ipfsHash,
        metadata: metadata,
        filesUploaded: uploadedFiles.length,
        databaseId: dbResult.rows[0].id, // ID của bản ghi vừa được tạo trong DB.
        message: "Upload thành công và đã lưu vào database",
      });
    } catch (dbError) {
      // Xử lý trường hợp đặc biệt: upload lên IPFS thành công nhưng ghi vào DB thất bại.
      console.error("Lỗi database:", dbError);
      return NextResponse.json({
        success: true, // Vẫn coi là thành công ở phía IPFS.
        IpfsHash: ipfsHash,
        metadata: metadata,
        filesUploaded: uploadedFiles.length,
        databaseError: "Lưu database thất bại nhưng IPFS upload thành công",
        message: "Upload IPFS thành công, nhưng có lỗi khi lưu vào database",
      });
    }
  } catch (error) {
    // Xử lý các lỗi chung khác trong quá trình thực thi.
    console.error("Lỗi upload chung:", error);
    return NextResponse.json(
      { error: "Lỗi server khi xử lý upload" },
      { status: 500 }
    );
  }
}

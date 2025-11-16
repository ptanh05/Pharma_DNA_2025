/**
 * IPFS Service
 * Handle IPFS operations (upload, download metadata)
 */

import axios from 'axios';
import FormData from 'form-data';

export interface IPFSUploadResult {
  success: boolean;
  ipfsHash?: string;
  error?: string;
}

export interface IPFSMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
  [key: string]: any;
}

export class IPFSService {
  private pinataJWT: string;
  private pinataGateway: string;

  constructor() {
    this.pinataJWT = process.env.PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT || '';
    this.pinataGateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
  }

  /**
   * Upload JSON metadata to IPFS
   */
  async uploadMetadata(metadata: IPFSMetadata): Promise<IPFSUploadResult> {
    try {
      if (!this.pinataJWT) {
        return {
          success: false,
          error: 'PINATA_JWT không được cấu hình',
        };
      }

      // Convert metadata to JSON string
      const jsonString = JSON.stringify(metadata);
      const jsonBuffer = Buffer.from(jsonString, 'utf-8');

      // Create form data
      const formData = new FormData();
      formData.append('file', jsonBuffer, {
        filename: 'metadata.json',
        contentType: 'application/json',
      });

      // Pinata metadata
      const pinataMetadata = {
        name: metadata.name || `NFT-${Date.now()}`,
      };

      formData.append('pinataMetadata', JSON.stringify(pinataMetadata));

      // Upload to Pinata
      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.pinataJWT}`,
            ...formData.getHeaders(),
          },
          maxBodyLength: Infinity,
        }
      );

      if (response.data && response.data.IpfsHash) {
        return {
          success: true,
          ipfsHash: response.data.IpfsHash,
        };
      }

      return {
        success: false,
        error: 'Không nhận được IPFS hash từ Pinata',
      };
    } catch (error: any) {
      console.error('IPFS upload error:', error);
      return {
        success: false,
        error: error.response?.data?.error?.details || error.message || 'Lỗi khi upload lên IPFS',
      };
    }
  }

  /**
   * Get metadata from IPFS
   */
  async getMetadata(ipfsHash: string): Promise<IPFSMetadata | null> {
    try {
      const url = `${this.pinataGateway}${ipfsHash}`;
      const response = await axios.get(url, {
        timeout: 10000, // 10 seconds timeout
      });

      return response.data as IPFSMetadata;
    } catch (error: any) {
      console.error('IPFS get metadata error:', error);
      return null;
    }
  }

  /**
   * Upload file to IPFS
   */
  async uploadFile(file: File | Buffer, filename?: string): Promise<IPFSUploadResult> {
    try {
      if (!this.pinataJWT) {
        return {
          success: false,
          error: 'PINATA_JWT không được cấu hình',
        };
      }

      const formData = new FormData();
      
      if (file instanceof File) {
        formData.append('file', file, filename || file.name);
      } else {
        formData.append('file', file, {
          filename: filename || `file-${Date.now()}`,
        });
      }

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.pinataJWT}`,
            ...formData.getHeaders(),
          },
          maxBodyLength: Infinity,
        }
      );

      if (response.data && response.data.IpfsHash) {
        return {
          success: true,
          ipfsHash: response.data.IpfsHash,
        };
      }

      return {
        success: false,
        error: 'Không nhận được IPFS hash từ Pinata',
      };
    } catch (error: any) {
      console.error('IPFS file upload error:', error);
      return {
        success: false,
        error: error.response?.data?.error?.details || error.message || 'Lỗi khi upload file lên IPFS',
      };
    }
  }
}


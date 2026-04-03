"use client";

import { useState } from "react";
import { useWalletSui as useWallet } from "@/hooks/useWalletSui";
import { useSubmitRegistration } from "@/hooks/useRegistration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Factory,
  Truck,
  Store,
  CheckCircle,
  Upload,
  Loader2,
  AlertCircle,
  FileText,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

// ============ Types ============

type Role = "MANUFACTURER" | "DISTRIBUTOR" | "PHARMACY";

interface FormData {
  walletAddress: string;
  requestedRole: Role;
  // Manufacturer
  companyName: string;
  licenseNumber: string;
  taxId: string;
  // Distributor
  distributorName: string;
  distributorAddress: string;
  // Pharmacy
  pharmacyName: string;
  pharmacyAddress: string;
  // Common
  contactEmail: string;
  contactPhone: string;
  notes: string;
}

// ============ Address Validation ============

const SUI_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$|^0x[a-fA-F0-9]{64}$/;

function isValidAddress(addr: string): boolean {
  return SUI_ADDRESS_REGEX.test(addr);
}

// ============ Main Component ============

export default function RegisterPage() {
  const { account, isConnected } = useWallet();
  const submitMutation = useSubmitRegistration();

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licenseIpfsHash, setLicenseIpfsHash] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    walletAddress: "",
    requestedRole: "MANUFACTURER",
    companyName: "",
    licenseNumber: "",
    taxId: "",
    distributorName: "",
    distributorAddress: "",
    pharmacyName: "",
    pharmacyAddress: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
  });

  // Auto-fill wallet address from connected wallet
  const handleConnectWallet = () => {
    if (account) {
      setFormData((prev) => ({ ...prev, walletAddress: account }));
    }
  };

  const handleRoleChange = (role: Role) => {
    setSelectedRole(role);
    setFormData((prev) => ({ ...prev, requestedRole: role }));
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File không được vượt quá 10MB");
        return;
      }
      setLicenseFile(file);
    }
  };

  const uploadLicenseToIPFS = async (): Promise<string> => {
    if (!licenseFile) throw new Error("Vui lòng upload giấy phép");

    setIsUploading(true);
    setUploadStatus("uploading");

    try {
      // Get JWT from server
      const jwtRes = await fetch("/api/pinata/jwt");
      const jwtData = await jwtRes.json();
      if (!jwtData.jwt) throw new Error("Không thể lấy token upload");

      // Upload to Pinata
      const formDataUpload = new FormData();
      formDataUpload.append("file", licenseFile);

      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwtData.jwt}` },
        body: formDataUpload,
      });

      if (!res.ok) throw new Error("Upload lên IPFS thất bại");

      const result = await res.json();
      const hash = result.IpfsHash;
      setLicenseIpfsHash(hash);
      setUploadStatus("success");
      return hash;
    } finally {
      setIsUploading(false);
    }
  };

  const validateForm = (): string | null => {
    if (!formData.walletAddress) return "Vui lòng nhập địa chỉ ví";
    if (!isValidAddress(formData.walletAddress)) return "Địa chỉ ví không hợp lệ";

    if (!selectedRole) return "Vui lòng chọn vai trò";

    if (selectedRole === "MANUFACTURER") {
      if (!formData.companyName.trim()) return "Vui lòng nhập tên công ty";
      if (!formData.licenseNumber.trim()) return "Vui lòng nhập số giấy phép";
    } else if (selectedRole === "DISTRIBUTOR") {
      if (!formData.distributorName.trim()) return "Vui lòng nhập tên công ty phân phối";
      if (!formData.licenseNumber.trim()) return "Vui lòng nhập số giấy phép";
      if (!formData.distributorAddress.trim()) return "Vui lòng nhập địa chỉ kho hàng";
    } else if (selectedRole === "PHARMACY") {
      if (!formData.pharmacyName.trim()) return "Vui lòng nhập tên nhà thuốc";
      if (!formData.licenseNumber.trim()) return "Vui lòng nhập số giấy phép";
      if (!formData.pharmacyAddress.trim()) return "Vui lòng nhập địa chỉ nhà thuốc";
    }

    if (!licenseFile && uploadStatus !== "success") return "Vui lòng upload giấy phép";

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    // Upload license if not already uploaded
    let finalLicenseHash = licenseIpfsHash;
    if (uploadStatus !== "success") {
      try {
        finalLicenseHash = await uploadLicenseToIPFS();
      } catch (error: any) {
        toast.error(error.message || "Upload giấy phép thất bại");
        return;
      }
    }

    // Submit registration
    const payload: any = {
      walletAddress: formData.walletAddress,
      requestedRole: selectedRole,
      licenseNumber: formData.licenseNumber,
      licenseIpfsHash: finalLicenseHash,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      notes: formData.notes,
    };

    if (selectedRole === "MANUFACTURER") {
      payload.companyName = formData.companyName;
      payload.taxId = formData.taxId;
    } else if (selectedRole === "DISTRIBUTOR") {
      payload.distributorName = formData.distributorName;
      payload.distributorAddress = formData.distributorAddress;
    } else if (selectedRole === "PHARMACY") {
      payload.pharmacyName = formData.pharmacyName;
      payload.pharmacyAddress = formData.pharmacyAddress;
    }

    try {
      await submitMutation.mutateAsync(payload);
      setSubmitted(true);
      toast.success("Đơn đăng ký đã được gửi thành công!");
    } catch (error: any) {
      toast.error(error.message || "Gửi đơn thất bại");
    }
  };

  // ============ Render ============

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Đăng ký thành công!</CardTitle>
            <CardDescription>
              Đơn đăng ký vai trò <strong>{selectedRole}</strong> đã được gửi đến admin.
              Bạn sẽ nhận được thông báo khi đơn được duyệt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/">Về trang chủ</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Đăng ký vai trò
          </h1>
          <p className="text-gray-600">
            Điền thông tin và gửi giấy phép để đăng ký vai trò trong hệ thống
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Role Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Chọn vai trò
              </CardTitle>
              <CardDescription>
                Chọn vai trò bạn muốn đăng ký trong hệ thống
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={selectedRole || ""}
                onValueChange={(v) => handleRoleChange(v as Role)}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <div>
                  <RadioGroupItem value="MANUFACTURER" id="role-manufacturer" className="peer sr-only" />
                  <Label
                    htmlFor="role-manufacturer"
                    className="flex flex-col items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-50 hover:bg-gray-50"
                  >
                    <Factory className="w-10 h-10 text-blue-600" />
                    <span className="font-semibold">Nhà sản xuất</span>
                    <span className="text-xs text-gray-500 text-center">Tạo NFT cho lô thuốc</span>
                  </Label>
                </div>

                <div>
                  <RadioGroupItem value="DISTRIBUTOR" id="role-distributor" className="peer sr-only" />
                  <Label
                    htmlFor="role-distributor"
                    className="flex flex-col items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-green-600 peer-data-[state=checked]:bg-green-50 hover:bg-gray-50"
                  >
                    <Truck className="w-10 h-10 text-green-600" />
                    <span className="font-semibold">Nhà phân phối</span>
                    <span className="text-xs text-gray-500 text-center">Quản lý vận chuyển</span>
                  </Label>
                </div>

                <div>
                  <RadioGroupItem value="PHARMACY" id="role-pharmacy" className="peer sr-only" />
                  <Label
                    htmlFor="role-pharmacy"
                    className="flex flex-col items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50 hover:bg-gray-50"
                  >
                    <Store className="w-10 h-10 text-purple-600" />
                    <span className="font-semibold">Nhà thuốc</span>
                    <span className="text-xs text-gray-500 text-center">Xác minh và nhập kho</span>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Step 2: Wallet Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Địa chỉ ví
              </CardTitle>
              <CardDescription>
                Nhập địa chỉ ví Sui của bạn (0x...)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="0x..."
                  value={formData.walletAddress}
                  onChange={(e) => handleInputChange("walletAddress", e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                {isConnected && account && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleConnectWallet}
                  >
                    Dùng ví đã kết nối
                  </Button>
                )}
              </div>
              {formData.walletAddress && !isValidAddress(formData.walletAddress) && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Địa chỉ ví không hợp lệ</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Role-specific fields */}
          {selectedRole && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Thông tin {selectedRole === "MANUFACTURER" ? "nhà sản xuất" : selectedRole === "DISTRIBUTOR" ? "nhà phân phối" : "nhà thuốc"}
                </CardTitle>
                <CardDescription>Điền đầy đủ thông tin theo yêu cầu</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Manufacturer fields */}
                {selectedRole === "MANUFACTURER" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Tên công ty *</Label>
                        <Input
                          id="companyName"
                          placeholder="Công ty TNHH Dược phẩm ABC"
                          value={formData.companyName}
                          onChange={(e) => handleInputChange("companyName", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="taxId">Mã số thuế</Label>
                        <Input
                          id="taxId"
                          placeholder="0123456789"
                          value={formData.taxId}
                          onChange={(e) => handleInputChange("taxId", e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Distributor fields */}
                {selectedRole === "DISTRIBUTOR" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="distributorName">Tên công ty phân phối *</Label>
                      <Input
                        id="distributorName"
                        placeholder="Công ty Phân phối Dược ABC"
                        value={formData.distributorName}
                        onChange={(e) => handleInputChange("distributorName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="distributorAddress">Địa chỉ kho hàng *</Label>
                      <Textarea
                        id="distributorAddress"
                        placeholder="Số 123, Đường ABC, Quận XYZ, TP.HCM"
                        value={formData.distributorAddress}
                        onChange={(e) => handleInputChange("distributorAddress", e.target.value)}
                        rows={2}
                      />
                    </div>
                  </>
                )}

                {/* Pharmacy fields */}
                {selectedRole === "PHARMACY" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="pharmacyName">Tên nhà thuốc *</Label>
                      <Input
                        id="pharmacyName"
                        placeholder="Nhà thuốc ABC"
                        value={formData.pharmacyName}
                        onChange={(e) => handleInputChange("pharmacyName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pharmacyAddress">Địa chỉ nhà thuốc *</Label>
                      <Textarea
                        id="pharmacyAddress"
                        placeholder="Số 456, Đường DEF, Quận GHI, Hà Nội"
                        value={formData.pharmacyAddress}
                        onChange={(e) => handleInputChange("pharmacyAddress", e.target.value)}
                        rows={2}
                      />
                    </div>
                  </>
                )}

                {/* Common fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">Số giấy phép *</Label>
                    <Input
                      id="licenseNumber"
                      placeholder={
                        selectedRole === "MANUFACTURER"
                          ? "GP kinh doanh số: ..."
                          : selectedRole === "DISTRIBUTOR"
                          ? "GP phân phối số: ..."
                          : "GP hoạt động số: ..."
                      }
                      value={formData.licenseNumber}
                      onChange={(e) => handleInputChange("licenseNumber", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Số điện thoại</Label>
                    <Input
                      id="contactPhone"
                      placeholder="0xxx xxx xxx"
                      value={formData.contactPhone}
                      onChange={(e) => handleInputChange("contactPhone", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email liên hệ</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="contact@company.com"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Ghi chú thêm</Label>
                  <Textarea
                    id="notes"
                    placeholder="Thông tin bổ sung (tùy chọn)"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: License Upload */}
          {selectedRole && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload giấy phép
                </CardTitle>
                <CardDescription>
                  Upload ảnh hoặc bản scan giấy phép lên IPFS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    id="licenseFile"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    disabled={uploadStatus === "success"}
                  />
                  <p className="text-xs text-gray-500">
                    Hỗ trợ: JPG, PNG, PDF. Tối đa 10MB.
                  </p>
                </div>

                {licenseFile && uploadStatus !== "success" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={uploadLicenseToIPFS}
                    disabled={isUploading}
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang upload lên IPFS...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload lên IPFS
                      </>
                    )}
                  </Button>
                )}

                {uploadStatus === "success" && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Đã upload thành công lên IPFS!
                      <br />
                      <span className="text-xs font-mono break-all">
                        Hash: {licenseIpfsHash}
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                {uploadStatus === "error" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Upload thất bại. Vui lòng thử lại.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitMutation.isPending || isUploading || !selectedRole || uploadStatus === "uploading"}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Đang gửi đơn...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Gửi đơn đăng ký
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

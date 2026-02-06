"use client";

import { useState } from "react";

export default function ConsumerSearch() {
  const [searchType, setSearchType] = useState<"batch" | "qr">("batch");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/public/lookup?${searchType}=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setResult(data);
    } catch (error) {
      alert("Không thể tìm kiếm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">Tra Cứu Thuốc</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex mb-4 gap-2">
          <button
            onClick={() => setSearchType("batch")}
            className={`px-4 py-2 rounded ${searchType === "batch" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Batch Number
          </button>
          <button
            onClick={() => setSearchType("qr")}
            className={`px-4 py-2 rounded ${searchType === "qr" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            QR Code
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchType === "batch" ? "Nhập batch number..." : "Nhập QR code..."}
          className="w-full p-3 border rounded-lg mb-4"
        />

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
        >
          {loading ? "Đang tìm..." : "Tra Cứu"}
        </button>
      </div>

      {result && result.data && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          {result.data.found ? (
            <div className="text-green-600 font-semibold">✓ Tìm thấy!</div>
          ) : (
            <div className="text-red-600">Không tìm thấy</div>
          )}
        </div>
      )}
    </div>
  );
}
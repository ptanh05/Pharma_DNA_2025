export default function PublicLookupPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-6">Tra Cứu Thuốc</h1>
        <div className="max-w-xl mx-auto bg-white rounded-lg shadow p-6">
          <input
            type="text"
            placeholder="Nhập batch number..."
            className="w-full p-3 border rounded"
          />
          <button className="w-full bg-blue-600 text-white py-3 mt-4 rounded">
            Tra Cứu
          </button>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <h1 style={{ fontSize: "4rem", marginBottom: "1rem", color: "#1a1a1a" }}>404</h1>
      <h2 style={{ marginBottom: "1rem", color: "#333" }}>Trang không tìm thấy</h2>
      <p style={{ marginBottom: "2rem", color: "#666", maxWidth: "400px" }}>
        Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
      </p>
      <Link
        href="/"
        style={{
          padding: "0.75rem 1.5rem",
          background: "#0070f3",
          color: "#fff",
          borderRadius: "8px",
          textDecoration: "none",
          fontSize: "1rem",
        }}
      >
        Quay về trang chủ
      </Link>
    </div>
  );
}

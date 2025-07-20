import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Truck, Search, Factory, Store, UserCheck } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            PharmaDNA: Truy xuất nguồn gốc thuốc bằng Blockchain & AIoT
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Mỗi lô thuốc là một NFT duy nhất, đảm bảo minh bạch và xác minh nguồn gốc chỉ với 1 lần quét QR.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-blue-600 bg-transparent"
            >
              <Link href="/manufacturer">
                <Factory className="w-5 h-5 mr-2" />
                Tạo lô thuốc
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-blue-600 bg-transparent"
            >
              <Link href="/lookup">
                <Search className="w-5 h-5 mr-2" />
                Tra cứu thuốc
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-blue-600 bg-transparent"
            >
              <Link href="/distributor">
                <Truck className="w-5 h-5 mr-2" />
                Quản lý vận chuyển
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Hệ thống theo vai trò</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Mỗi vai trò trong chuỗi cung ứng có giao diện và chức năng riêng biệt
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Factory className="w-12 h-12 text-blue-600 mb-4" />
                <CardTitle>Nhà sản xuất</CardTitle>
                <CardDescription>Tạo NFT cho từng lô thuốc, upload metadata lên IPFS</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/manufacturer">Truy cập</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Truck className="w-12 h-12 text-green-600 mb-4" />
                <CardTitle>Nhà phân phối</CardTitle>
                <CardDescription>Quản lý vận chuyển, upload dữ liệu cảm biến AIoT</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/distributor">Truy cập</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Store className="w-12 h-12 text-purple-600 mb-4" />
                <CardTitle>Nhà thuốc</CardTitle>
                <CardDescription>Quét QR, xác minh và xác nhận nhập kho</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/pharmacy">Truy cập</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Search className="w-12 h-12 text-orange-600 mb-4" />
                <CardTitle>Người tiêu dùng</CardTitle>
                <CardDescription>Tra cứu nguồn gốc thuốc không cần kết nối ví</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/lookup">Tra cứu</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <UserCheck className="w-12 h-12 text-red-600 mb-4" />
                <CardTitle>Quản trị viên</CardTitle>
                <CardDescription>Quản lý hệ thống, cấp quyền vai trò</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/admin">Quản lý</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Shield className="w-12 h-12 text-indigo-600 mb-4" />
                <CardTitle>Bảo mật</CardTitle>
                <CardDescription>Blockchain đảm bảo tính minh bạch và không thể thay đổi</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-transparent">
                  Tìm hiểu thêm
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Cách thức hoạt động</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Sản xuất</h3>
              <p className="text-gray-600">Nhà sản xuất tạo NFT cho lô thuốc</p>
            </div>

            <div className="text-center">
              <div className="bg-green-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Vận chuyển</h3>
              <p className="text-gray-600">Nhà phân phối theo dõi và cập nhật dữ liệu</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Nhập kho</h3>
              <p className="text-gray-600">Nhà thuốc xác minh và nhập kho</p>
            </div>

            <div className="text-center">
              <div className="bg-orange-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                4
              </div>
              <h3 className="text-xl font-semibold mb-2">Tra cứu</h3>
              <p className="text-gray-600">Người dùng quét QR để xác minh</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

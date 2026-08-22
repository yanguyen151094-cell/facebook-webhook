import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/feature/Sidebar";
import Topbar from "@/components/feature/Topbar";

const TITLES: Record<string, string> = {
  "/": "Tổng quan",
  "/inbox": "Hộp thư chung",
  "/team": "Phòng trò chuyện",
  "/customers": "Khách hàng",
  "/staff": "Quản lý nhân viên",
  "/channels": "Kết nối kênh",
  "/reports": "Báo cáo",
  "/logs": "Nhật ký hoạt động",
  "/settings": "Cài đặt",
  "/customer-notes": "Ghi chú khách hàng",
  "/accounts": "Kho tài khoản",
  "/evaluations": "Đánh giá",
};

export default function AppLayout() {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background-50">
        <div className="flex flex-col items-center gap-3 text-foreground-500">
          <i className="ri-loader-4-line text-3xl animate-spin" />
          <p className="text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const title = TITLES[location.pathname] ?? "TỔ 1D";

  return (
    <div className="h-full flex bg-background-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-background-50 border-r border-background-200">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-background-50 animate-fade-in">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
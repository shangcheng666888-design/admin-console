import type React from 'react'
import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ToastProvider'
import AdminLoadingState from './components/admin/AdminLoadingState'

const AdminLayout = lazy(() => import('./components/AdminLayout'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminShops = lazy(() => import('./pages/AdminShops'))
const AdminWarehouse = lazy(() => import('./pages/AdminWarehouse'))
const AdminWarehouseProductDetail = lazy(() => import('./pages/AdminWarehouseProductDetail'))
const AdminSystem = lazy(() => import('./pages/AdminSystem'))
const AdminOrders = lazy(() => import('./pages/AdminOrders'))
const AdminAuditShops = lazy(() => import('./pages/AdminAuditShops'))
const AdminAuditFunds = lazy(() => import('./pages/AdminAuditFunds'))
const AdminAuditShopFunds = lazy(() => import('./pages/AdminAuditShopFunds'))
const AdminAuditMallFunds = lazy(() => import('./pages/AdminAuditMallFunds'))

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation()
  useEffect(() => {
    document.getElementById('root')?.scrollTo(0, 0)
  }, [pathname])
  return null
}

const PageLoadFallback: React.FC = () => (
  <div className="admin-backend admin-backend--loading">
    <AdminLoadingState variant="page" label="加载管理页面" />
  </div>
)

const App: React.FC = () => (
  <ToastProvider>
    <ScrollToTop />
    <Suspense fallback={<PageLoadFallback />}>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="shops" element={<AdminShops />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="warehouse" element={<AdminWarehouse />} />
          <Route path="warehouse/product/:productId" element={<AdminWarehouseProductDetail />} />
          <Route path="audit/shops" element={<AdminAuditShops />} />
          <Route path="audit/funds" element={<AdminAuditFunds />} />
          <Route path="audit/shop-funds" element={<AdminAuditShopFunds />} />
          <Route path="audit/mall-funds" element={<AdminAuditMallFunds />} />
          <Route path="system" element={<AdminSystem />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  </ToastProvider>
)

export default App

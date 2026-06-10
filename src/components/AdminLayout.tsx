import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { api } from '../api/client'
import { ADMIN_AUTH_KEY } from '../constants/adminAuth'
import { AdminEditConfirmProvider } from '../context/AdminEditConfirmContext'
import AdminLoadingState from './admin/AdminLoadingState'
import adminLogo from '../assets/admin-logo.png'

const NAV_GROUPS: { path: string; label: string }[][] = [
  [{ path: '/dashboard', label: '仪表盘' }],
  [
    { path: '/users', label: '商城用户' },
    { path: '/shops', label: '店铺管理' },
    { path: '/orders', label: '订单管理' },
    { path: '/warehouse', label: '商品仓' },
  ],
  [
    { path: '/audit/shops', label: '店铺审核' },
    { path: '/audit/funds', label: '资金审核' },
  ],
  [{ path: '/system', label: '系统管理' }],
]

function isNavItemActive(pathname: string, path: string): boolean {
  if (path === '/audit/funds') {
    return (
      pathname === '/audit/funds' ||
      pathname === '/audit/shop-funds' ||
      pathname === '/audit/mall-funds'
    )
  }
  return pathname === path
}

const AdminLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [authChecked, setAuthChecked] = useState(false)
  const [username, setUsername] = useState<string>('')

  useEffect(() => {
    const raw = window.localStorage.getItem(ADMIN_AUTH_KEY)
    if (!raw) {
      navigate('/login', { state: { from: { pathname: location.pathname } }, replace: true })
      return
    }
    let cancelled = false
    api
      .get<{ success?: boolean; ok?: boolean }>('/api/admin/auth/verify')
      .then((res) => {
        if (cancelled) return
        if (res.success && res.ok) {
          try {
            const data = JSON.parse(raw) as { username?: string }
            setUsername(data.username ?? '')
          } catch {
            setUsername('')
          }
          setAuthChecked(true)
        } else {
          window.localStorage.removeItem(ADMIN_AUTH_KEY)
          navigate('/login', { state: { from: { pathname: location.pathname } }, replace: true })
        }
      })
      .catch(() => {
        if (cancelled) return
        try {
          window.localStorage.removeItem(ADMIN_AUTH_KEY)
        } catch {}
        navigate('/login', { state: { from: { pathname: location.pathname } }, replace: true })
      })
    return () => { cancelled = true }
  }, [navigate, location.pathname])

  const handleLogout = () => {
    try {
      window.localStorage.removeItem(ADMIN_AUTH_KEY)
    } catch {}
    navigate('/login')
  }

  if (!authChecked) {
    return (
      <div className="admin-backend admin-backend--loading">
        <AdminLoadingState variant="page" label="验证登录状态" />
      </div>
    )
  }

  return (
    <div className="admin-backend">
      <div className="admin-main">
        <header className="admin-header admin-header--fixed">
          <div className="admin-header-inner">
            <Link to="/dashboard" className="admin-header-brand">
              <span className="admin-header-brand-mark" aria-hidden>
                <img src={adminLogo} alt="" className="admin-header-brand-logo" />
              </span>
              <span className="admin-header-brand-text">
                <span className="admin-header-title">商城管理后台</span>
                <span className="admin-header-subtitle">Mall Admin Console</span>
              </span>
            </Link>

            <nav className="admin-header-nav" aria-label="管理后台导航">
              <div className="admin-header-nav-track">
                {NAV_GROUPS.map((group, groupIndex) => (
                  <div key={groupIndex} className="admin-header-nav-group">
                    {group.map((item) => {
                      const isActive = isNavItemActive(location.pathname, item.path)
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`admin-header-nav-item${isActive ? ' admin-header-nav-item--active' : ''}`}
                        >
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                ))}
              </div>
            </nav>

            <div className="admin-header-right">
              {username ? (
                <div className="admin-header-user">
                  <span className="admin-header-avatar" aria-hidden>
                    {username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="admin-header-username">{username}</span>
                </div>
              ) : null}
              <button
                type="button"
                className="admin-header-logout"
                aria-label="退出登录"
                onClick={handleLogout}
              >
                退出
              </button>
            </div>
          </div>
        </header>
        <div className="admin-content">
          <AdminEditConfirmProvider>
            <Outlet />
          </AdminEditConfirmProvider>
        </div>
      </div>
    </div>
  )
}

export default AdminLayout

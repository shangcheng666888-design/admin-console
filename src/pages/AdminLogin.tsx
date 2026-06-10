import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import adminLogo from '../assets/admin-logo.png'
import { ADMIN_AUTH_KEY } from '../constants/adminAuth'

const AdminLogin: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { validateError, notify } = useAdminToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpToken, setTotpToken] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      validateError('请输入用户名')
      return
    }
    if (!password) {
      validateError('请输入密码')
      return
    }
    const code = totpToken.replace(/\s/g, '')
    if (!code || code.length !== 6) {
      validateError('请输入 6 位谷歌验证码')
      return
    }
    setLoading(true)
    try {
      const res = await api.post<{ success: boolean; admin?: { username: string }; token?: string; message?: string }>(
        '/api/admin/auth/login',
        { username: username.trim(), password, totpToken: code }
      )
      if (res.success && res.admin && res.token) {
        window.localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({ username: res.admin.username, at: Date.now(), token: res.token }))
        notify({ title: '登录成功', message: '欢迎进入商城管理后台', type: 'success' })
        setTimeout(() => {
          navigate(from, { replace: true })
        }, 1500)
      } else {
        notify({
          title: '登录失败',
          message: (res as { message?: string }).message ?? '请检查账号、密码与验证码后重试',
          type: 'error',
        })
      }
    } catch (err) {
      notify({ title: '登录失败', message: err instanceof Error ? err.message : '网络错误，请稍后重试', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-shell">
        <aside className="admin-login-showcase" aria-hidden>
          <div className="admin-login-showcase-bg">
            <div className="admin-login-grid" />
            <div className="admin-login-glow admin-login-glow--a" />
            <div className="admin-login-glow admin-login-glow--b" />
            <div className="admin-login-scanline" />
          </div>
          <div className="admin-login-showcase-inner">
            <div className="admin-login-brand">
              <span className="admin-login-brand-mark">
                <img src={adminLogo} alt="" className="admin-login-brand-logo" />
              </span>
              <div className="admin-login-brand-text">
                <span className="admin-login-brand-title">商城管理后台</span>
                <span className="admin-login-brand-sub">Mall Admin Console</span>
              </div>
            </div>
            <p className="admin-login-tagline">
              企业级电商运营中枢
              <br />
              安全可控的全链路管理平台
            </p>
            <ul className="admin-login-features">
              <li className="admin-login-feature">
                <span className="admin-login-feature-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <span>
                  <strong>双因素认证</strong>
                  <small>Google Authenticator 动态口令</small>
                </span>
              </li>
              <li className="admin-login-feature">
                <span className="admin-login-feature-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </span>
                <span>
                  <strong>实时数据监控</strong>
                  <small>订单、用户、资金全链路可视</small>
                </span>
              </li>
              <li className="admin-login-feature">
                <span className="admin-login-feature-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <span>
                  <strong>权限隔离管控</strong>
                  <small>管理员专属入口与操作审计</small>
                </span>
              </li>
            </ul>
          </div>
          <div className="admin-login-showcase-foot">
            <span className="admin-login-status-dot" />
            Secure Admin · v2.0
          </div>
        </aside>

        <main className="admin-login-panel">
          <div className="admin-login-card">
            <header className="admin-login-card-head">
              <span className="admin-login-card-eyebrow">Admin Access</span>
              <h1 className="admin-login-card-title">管理员登录</h1>
              <p className="admin-login-card-desc">使用授权账号与动态验证码进入控制台</p>
            </header>

            <form className="admin-login-form" onSubmit={handleSubmit}>
              <div className="admin-login-field">
                <label htmlFor="admin-login-username" className="admin-login-label">用户名</label>
                <div className="admin-login-input-wrap">
                  <span className="admin-login-input-icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="admin-login-username"
                    type="text"
                    className="admin-login-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入管理员用户名"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="admin-login-field">
                <label htmlFor="admin-login-password" className="admin-login-label">密码</label>
                <div className="admin-login-input-wrap">
                  <span className="admin-login-input-icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="admin-login-password"
                    type="password"
                    className="admin-login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入登录密码"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className="admin-login-field">
                <label htmlFor="admin-login-totp" className="admin-login-label">
                  谷歌验证器
                  <span className="admin-login-label-badge">2FA</span>
                </label>
                <div className="admin-login-input-wrap admin-login-input-wrap--totp">
                  <span className="admin-login-input-icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><path d="M12 18h.01" />
                    </svg>
                  </span>
                  <input
                    id="admin-login-totp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="admin-login-input admin-login-input--totp"
                    value={totpToken}
                    onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoComplete="one-time-code"
                  />
                </div>
              </div>

              <button type="submit" className="admin-login-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="admin-login-submit-spinner" aria-hidden />
                    验证中…
                  </>
                ) : (
                  <>
                    进入管理后台
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <footer className="admin-login-secure">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              TLS 加密传输 · 双因素安全验证 · 仅限授权人员
            </footer>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminLogin
export { ADMIN_AUTH_KEY } from '../constants/adminAuth'

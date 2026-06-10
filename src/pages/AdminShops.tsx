import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, apiBase } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import { useAdminEditConfirm } from '../context/AdminEditConfirmContext'
import AdminLoadingState from '../components/admin/AdminLoadingState'

type ShopStatus = 'normal' | 'banned'

function resolveShopLogoUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return ''
  const s = url.trim()
  if (!s || s.startsWith('http://') || s.startsWith('https://')) return s
  return apiBase ? `${apiBase.replace(/\/$/, '')}${s.startsWith('/') ? '' : '/'}${s}` : s
}

interface Shop {
  id: string
  name: string
  /** 店铺 Logo（列表接口一并返回，仅多一个 URL 字段） */
  logo?: string | null
  /** 店主用户 ID（商城用户） */
  ownerId: string
  /** 店主登录账号，便于展示 */
  ownerAccount: string
  /** 店铺等级 */
  level: string
  /** 上架商品数量 */
  listedCount: number
  /** 关注数 */
  followCount: number
  /** 销量 */
  sales: number
  /** 好评率 0–100 */
  goodRate: number
  /** 信誉分（如 0–100） */
  creditScore: number
  /** 店铺钱包余额（元），与商城客户余额为两套体系 */
  walletBalance: number
  /** 店铺访问量 */
  visits: number
  /** 最近一次登录所在国家（根据 IP 粗略解析，仅供参考） */
  lastLoginCountry?: string | null
  /** 最近一次登录 IP（仅后台展示，不在 UI 中暴露给前台用户） */
  lastLoginIp?: string | null
  status: ShopStatus
  /** 开通时间 */
  createdAt: string
}

function formatDateTimeLocal(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d)
  } catch {
    return value
  }
}

const PAGE_SIZE = 30

const STATUS_LABEL: Record<ShopStatus, string> = {
  normal: '正常',
  banned: '封禁',
}

const LEVEL_OPTIONS = ['普通', '银牌', '金牌', '钻石']

const AdminShops: React.FC = () => {
  const [searchParams] = useSearchParams()
  const highlightShopId = searchParams.get('shop') ?? null

  const [shops, setShops] = useState<Shop[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ShopStatus>('all')
  const [page, setPage] = useState(1)
  const [detailShop, setDetailShop] = useState<Shop | null>(null)
  const [editForm, setEditForm] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(false)
  const { saveSuccess, saveError, loadError, actionSuccess, actionError } = useAdminToast()
  const { requestEditConfirm } = useAdminEditConfirm()

  const fetchShops = useCallback(
    async (mode: 'normal' | 'silent' = 'normal') => {
      if (mode === 'normal') setLoading(true)
      try {
        const res = await api.get<{ list: Array<Shop & { visits?: number }> }>('/api/shops')
        const list = Array.isArray(res.list)
          ? res.list.map((s) => ({
              ...s,
              visits: typeof s.visits === 'number' ? s.visits : 0,
            }))
          : []
        setShops(list)
      } catch (e) {
        if (mode === 'normal') {
          loadError(e, '加载店铺列表失败')
          setShops([])
        }
        // 静默轮询失败时不打断当前界面，也不提示错误
      } finally {
        if (mode === 'normal') setLoading(false)
      }
    },
    [loadError],
  )

  useEffect(() => {
    fetchShops('normal')
  }, [fetchShops])

  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        // 页面重新可见时做一次静默刷新
        fetchShops('silent')
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
    }
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchShops])

  const filtered = useMemo(() => {
    let list = shops
    if (statusFilter !== 'all') {
      list = list.filter((s) => s.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.ownerAccount.toLowerCase().includes(q) ||
          s.ownerId.toLowerCase().includes(q)
      )
    }
    return list
  }, [shops, search, statusFilter])

  const openDetail = (s: Shop) => {
    const current = shops.find((x) => x.id === s.id) ?? s
    setDetailShop(current)
    setEditForm(null)
  }

  const startEdit = () => {
    if (!detailShop) return
    setEditForm({ ...detailShop })
  }

  const cancelEdit = () => {
    setEditForm(null)
  }

  const performSaveEdit = () => {
    if (!editForm) return
    const payload = {
      level: editForm.level,
      followCount: editForm.followCount,
      sales: editForm.sales,
      goodRate: editForm.goodRate,
      creditScore: editForm.creditScore,
      walletBalance: editForm.walletBalance,
      visits: editForm.visits,
    }
    api.patch(`/api/shops/${encodeURIComponent(editForm.id)}`, payload)
      .then(() => {
        const updated = { ...editForm }
        setShops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        setDetailShop(updated)
        setEditForm(null)
      saveSuccess()
      })
      .catch((err: unknown) => {
      saveError(err)
      })
  }

  const saveEdit = () => {
    if (!editForm) return
    requestEditConfirm({
      title: '确认保存修改',
      message: `即将保存对店铺「${editForm.name}」的修改，提交后立即生效，请确认。`,
      confirmLabel: '确认保存',
      onConfirm: performSaveEdit,
    })
  }

  const updateEditForm = (patch: Partial<Shop>) => {
    setEditForm((prev) => (prev ? { ...prev, ...patch } : null))
  }

  const toggleBan = () => {
    if (!detailShop) return
    const nextStatus: ShopStatus = detailShop.status === 'normal' ? 'banned' : 'normal'
    api.patch(`/api/shops/${encodeURIComponent(detailShop.id)}`, { status: nextStatus })
      .then(() => {
        const updated = { ...detailShop, status: nextStatus }
        setShops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        setDetailShop(updated)
        setEditForm(null)
        actionSuccess(nextStatus === 'banned' ? '已封禁店铺' : '已解除封禁')
      })
      .catch((err: unknown) => {
      actionError(err)
      })
  }

  const confirmToggleBan = () => {
    if (!detailShop) return
    const isBan = detailShop.status === 'normal'
    requestEditConfirm({
      title: isBan ? '确认封禁店铺' : '确认解除封禁',
      message: isBan
        ? `确认封禁店铺「${detailShop.name}」？封禁后该店铺将无法接单，前台用户也不可浏览其商品。`
        : `确认解除店铺「${detailShop.name}」的封禁？解除后将恢复正常展示与接单。`,
      confirmLabel: isBan ? '确认封禁' : '确认解除',
      onConfirm: toggleBan,
    })
  }

  const displayShop = editForm ?? detailShop

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  return (
    <div className="admin-shops">
      <header className="admin-shops-header admin-list-hero admin-list-hero--with-actions">
        <div className="admin-list-hero-row">
          <div className="admin-list-hero-head">
            <span className="admin-list-hero-eyebrow">商家管理</span>
            <h2 className="admin-shops-title">店铺管理</h2>
          </div>
          <div className="admin-shops-toolbar admin-list-hero-actions">
        <div className="admin-shops-search-wrap">
          <span className="admin-shops-search-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            type="text"
            className="admin-shops-search"
            placeholder="店铺 ID / 名称 / 店主账号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-shops-filters">
          <button
            type="button"
            className={`admin-shops-filter-btn${statusFilter === 'all' ? ' admin-shops-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            全部
          </button>
          <button
            type="button"
            className={`admin-shops-filter-btn${statusFilter === 'normal' ? ' admin-shops-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('normal')}
          >
            正常
          </button>
          <button
            type="button"
            className={`admin-shops-filter-btn${statusFilter === 'banned' ? ' admin-shops-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('banned')}
          >
            封禁
          </button>
        </div>
          </div>
        </div>
        <p className="admin-shops-desc">
          管理已开通店铺的入驻商家。可查看店铺信息、关注、销量与状态，支持按状态筛选与搜索。
        </p>
      </header>

      <section className="admin-shops-table-wrap">
        <div className="admin-table-scroll">
        <table className="admin-shops-table">
          <thead>
            <tr>
              <th className="admin-shops-col admin-shops-col--id">店铺 ID</th>
              <th className="admin-shops-col admin-shops-col--name">店铺名称</th>
              <th className="admin-shops-col admin-shops-col--owner">店主账户</th>
              <th className="admin-shops-col admin-shops-col--level">店铺等级</th>
              <th className="admin-shops-col admin-shops-col--stat">关注</th>
              <th className="admin-shops-col admin-shops-col--stat">销量</th>
              <th className="admin-shops-col admin-shops-col--stat">好评率</th>
              <th className="admin-shops-col admin-shops-col--time">开通时间</th>
              <th className="admin-shops-col admin-shops-sticky admin-shops-sticky--credit">信誉分</th>
              <th className="admin-shops-col admin-shops-sticky admin-shops-sticky--balance admin-shops-th-balance">钱包余额</th>
              <th className="admin-shops-col admin-shops-sticky admin-shops-sticky--status">状态</th>
              <th className="admin-shops-col admin-shops-sticky admin-shops-sticky--actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="admin-loading-cell">
                  <AdminLoadingState variant="panel" label="加载店铺列表" />
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={12} className="admin-shops-empty">
                  暂无符合条件的店铺
                </td>
              </tr>
            ) : (
              paginated.map((s) => {
                const logoSrc = resolveShopLogoUrl(s.logo)
                return (
                <tr key={s.id} className={highlightShopId === s.id ? 'admin-shops-row--highlight' : ''}>
                  <td className="admin-shops-col admin-shops-col--id">
                    <div className="admin-shops-id-cell">
                      <div className="admin-shops-id-logo" aria-hidden>
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt=""
                            className="admin-shops-id-logo-img"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="admin-shops-id-logo-fallback">{s.name?.slice(0, 1) || '店'}</span>
                        )}
                      </div>
                      <code className="admin-shops-id admin-cell-ellipsis admin-cell-ellipsis--mono" title={s.id}>{s.id}</code>
                    </div>
                  </td>
                  <td className="admin-shops-col admin-shops-col--name"><span className="admin-shops-name admin-cell-ellipsis" title={s.name}>{s.name}</span></td>
                  <td className="admin-shops-col admin-shops-col--owner">
                    <span className="admin-shops-owner-account">{s.ownerAccount}</span>
                    <Link to={`/users?user=${encodeURIComponent(s.ownerId)}`} className="admin-shops-owner-link">查看用户</Link>
                  </td>
                  <td className="admin-shops-col admin-shops-col--level">{s.level}</td>
                  <td className="admin-shops-col admin-shops-col--stat">{s.followCount.toLocaleString()}</td>
                  <td className="admin-shops-col admin-shops-col--stat">{s.sales.toLocaleString()}</td>
                  <td className="admin-shops-col admin-shops-col--stat">{s.goodRate}%</td>
                  <td className="admin-shops-col admin-shops-col--time">{formatDateTimeLocal(s.createdAt)}</td>
                  <td className="admin-shops-col admin-shops-sticky admin-shops-sticky--credit"><span className="admin-shops-credit">{s.creditScore}</span></td>
                  <td className="admin-shops-col admin-shops-sticky admin-shops-sticky--balance admin-shops-cell-balance"><span className="admin-shops-balance">{s.walletBalance.toFixed(2)}</span></td>
                  <td className="admin-shops-col admin-shops-sticky admin-shops-sticky--status">
                    <span className={`admin-shops-status admin-shops-status--${s.status}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="admin-shops-col admin-shops-sticky admin-shops-sticky--actions">
                    <button type="button" className="admin-shops-action" onClick={() => openDetail(s)}>查看详情</button>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
        </div>
        {totalPages > 1 && (
          <footer className="admin-table-footer admin-shops-pagination">
            <button
              type="button"
              className="admin-shops-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="admin-shops-page-info">
              第 {page} / {totalPages} 页，共 {filtered.length} 条
            </span>
            <button
              type="button"
              className="admin-shops-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </button>
          </footer>
        )}
      </section>

      {detailShop && (
        <>
          <div
            className="admin-shops-drawer-overlay"
            onClick={() => { setDetailShop(null); setEditForm(null) }}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="admin-shops-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-shops-drawer-title"
          >
            <div className="admin-shops-drawer-head">
              <h2 id="admin-shops-drawer-title" className="admin-shops-drawer-title">
                {editForm ? '编辑店铺' : '店铺详情'}
              </h2>
              <button
                type="button"
                className="admin-shops-drawer-close"
                onClick={() => { setDetailShop(null); setEditForm(null) }}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="admin-shops-drawer-body">
              {editForm ? (
                <>
                <div className="admin-drawer-summary">
                  <div className="admin-drawer-summary-logo" aria-hidden>
                    {resolveShopLogoUrl(editForm.logo) ? (
                      <img src={resolveShopLogoUrl(editForm.logo)} alt="" loading="lazy" decoding="async" />
                    ) : (
                      editForm.name?.slice(0, 1) || '店'
                    )}
                  </div>
                  <div className="admin-drawer-summary-main">
                    <span className="admin-drawer-summary-title">{editForm.name}</span>
                    <code className="admin-drawer-summary-sub">{editForm.id}</code>
                  </div>
                  <div className="admin-drawer-summary-aside">
                    <span className={`admin-shops-status admin-shops-status--${editForm.status}`}>
                      {STATUS_LABEL[editForm.status]}
                    </span>
                    <span className="admin-drawer-summary-money">{editForm.walletBalance.toFixed(2)}</span>
                  </div>
                </div>
                <section className="admin-drawer-section">
                  <h3 className="admin-drawer-section-title">基本信息</h3>
                  <div className="admin-shops-edit-form admin-shops-edit-form--in-section">
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label">店主账户</label>
                      <span className="admin-shops-edit-readonly">{editForm.ownerAccount}</span>
                    </div>
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label" htmlFor="admin-shop-edit-level">店铺等级</label>
                      <select
                        id="admin-shop-edit-level"
                        className="admin-shops-edit-input"
                        value={editForm.level}
                        onChange={(e) => updateEditForm({ level: e.target.value })}
                      >
                        {LEVEL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label">开通时间</label>
                      <span className="admin-shops-edit-readonly">{formatDateTimeLocal(editForm.createdAt)}</span>
                    </div>
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label">最近登录</label>
                      <span className="admin-shops-edit-readonly">
                        {editForm.lastLoginIp
                          ? `${editForm.lastLoginIp}（国家：${editForm.lastLoginCountry || '未知'}）`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </section>
                <section className="admin-drawer-section">
                  <h3 className="admin-drawer-section-title">经营数据</h3>
                  <div className="admin-shops-edit-form admin-shops-edit-form--in-section admin-shops-edit-form--grid">
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label" htmlFor="admin-shop-edit-follow">关注</label>
                      <input
                        id="admin-shop-edit-follow"
                        type="number"
                        min={0}
                        className="admin-shops-edit-input"
                        value={editForm.followCount}
                        onChange={(e) => updateEditForm({ followCount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      />
                    </div>
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label" htmlFor="admin-shop-edit-sales">销量</label>
                      <input
                        id="admin-shop-edit-sales"
                        type="number"
                        min={0}
                        className="admin-shops-edit-input"
                        value={editForm.sales}
                        onChange={(e) => updateEditForm({ sales: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      />
                    </div>
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label" htmlFor="admin-shop-edit-good-rate">好评率（0–100）</label>
                      <input
                        id="admin-shop-edit-good-rate"
                        type="number"
                        min={0}
                        max={100}
                        className="admin-shops-edit-input"
                        value={editForm.goodRate}
                        onChange={(e) => updateEditForm({ goodRate: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                      />
                    </div>
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label" htmlFor="admin-shop-edit-credit">信誉分（0–100）</label>
                      <input
                        id="admin-shop-edit-credit"
                        type="number"
                        min={0}
                        max={100}
                        className="admin-shops-edit-input"
                        value={editForm.creditScore}
                        onChange={(e) => updateEditForm({ creditScore: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                      />
                    </div>
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label" htmlFor="admin-shop-edit-wallet">店铺钱包余额</label>
                      <input
                        id="admin-shop-edit-wallet"
                        type="number"
                        step="0.01"
                        min="0"
                        className="admin-shops-edit-input"
                        value={editForm.walletBalance}
                        onChange={(e) => updateEditForm({ walletBalance: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="admin-shops-edit-row">
                      <label className="admin-shops-edit-label" htmlFor="admin-shop-edit-visits">访问量</label>
                      <input
                        id="admin-shop-edit-visits"
                        type="number"
                        min={0}
                        className="admin-shops-edit-input"
                        value={editForm.visits}
                        onChange={(e) => updateEditForm({ visits: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      />
                    </div>
                  </div>
                </section>
                </>
              ) : (
                <>
                <div className="admin-drawer-summary">
                  <div className="admin-drawer-summary-logo" aria-hidden>
                    {resolveShopLogoUrl(displayShop!.logo) ? (
                      <img src={resolveShopLogoUrl(displayShop!.logo)} alt="" loading="lazy" decoding="async" />
                    ) : (
                      displayShop!.name?.slice(0, 1) || '店'
                    )}
                  </div>
                  <div className="admin-drawer-summary-main">
                    <span className="admin-drawer-summary-title">{displayShop!.name}</span>
                    <code className="admin-drawer-summary-sub">{displayShop!.id}</code>
                  </div>
                  <div className="admin-drawer-summary-aside">
                    <span className={`admin-shops-status admin-shops-status--${displayShop!.status}`}>
                      {STATUS_LABEL[displayShop!.status]}
                    </span>
                    <span className="admin-drawer-summary-money">{displayShop!.walletBalance.toFixed(2)}</span>
                  </div>
                </div>
                <section className="admin-drawer-section">
                  <h3 className="admin-drawer-section-title">基本信息</h3>
                <dl className="admin-shops-detail-list">
                  <div className="admin-shops-detail-row">
                    <dt>店主账户</dt>
                    <dd>
                      <span className="admin-shops-owner-account">{displayShop!.ownerAccount}</span>
                      <Link to={`/users?user=${encodeURIComponent(displayShop!.ownerId)}`} className="admin-shops-owner-link" onClick={() => { setDetailShop(null); setEditForm(null) }}>查看用户</Link>
                    </dd>
                  </div>
                  <div className="admin-shops-detail-row">
                    <dt>店铺等级</dt>
                    <dd>{displayShop!.level}</dd>
                  </div>
                  <div className="admin-shops-detail-row">
                    <dt>开通时间</dt>
                    <dd>{formatDateTimeLocal(displayShop!.createdAt)}</dd>
                  </div>
                  <div className="admin-shops-detail-row">
                    <dt>最近登录</dt>
                    <dd>
                      {displayShop!.lastLoginIp
                        ? `${displayShop!.lastLoginIp}（国家：${displayShop!.lastLoginCountry || '未知'}）`
                        : '—'}
                    </dd>
                  </div>
                </dl>
                </section>
                <section className="admin-drawer-section">
                  <h3 className="admin-drawer-section-title">经营数据</h3>
                <dl className="admin-shops-detail-list admin-shops-detail-list--grid">
                  <div className="admin-shops-detail-row">
                    <dt>上架商品数量</dt>
                    <dd className="admin-shops-detail-dd-row">
                      <span>{displayShop!.listedCount}</span>
                      <button type="button" className="admin-shops-detail-view-btn">查看</button>
                    </dd>
                  </div>
                  <div className="admin-shops-detail-row">
                    <dt>关注</dt>
                    <dd>{displayShop!.followCount.toLocaleString()}</dd>
                  </div>
                  <div className="admin-shops-detail-row">
                    <dt>销量</dt>
                    <dd>{displayShop!.sales.toLocaleString()}</dd>
                  </div>
                  <div className="admin-shops-detail-row">
                    <dt>好评率</dt>
                    <dd>{displayShop!.goodRate}%</dd>
                  </div>
                  <div className="admin-shops-detail-row">
                    <dt>信誉分</dt>
                    <dd><span className="admin-shops-credit">{displayShop!.creditScore}</span></dd>
                  </div>
                  <div className="admin-shops-detail-row">
                    <dt>访问量</dt>
                    <dd>{(displayShop!.visits ?? 0).toLocaleString()}</dd>
                  </div>
                </dl>
                </section>
                </>
              )}
            </div>
            <div className="admin-shops-drawer-actions">
              {editForm ? (
                <>
                  <button type="button" className="admin-shops-drawer-btn" onClick={saveEdit}>保存</button>
                  <button type="button" className="admin-shops-drawer-btn admin-shops-drawer-btn--secondary" onClick={cancelEdit}>取消</button>
                </>
              ) : (
                <>
                  {displayShop!.status === 'normal' ? (
                    <button
                      type="button"
                      className="admin-shops-drawer-btn admin-shops-drawer-btn--warn"
                      onClick={confirmToggleBan}
                    >
                      封禁店铺
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-shops-drawer-btn"
                      onClick={confirmToggleBan}
                    >
                      解除封禁
                    </button>
                  )}
                  <button type="button" className="admin-shops-drawer-btn admin-shops-drawer-btn--secondary" onClick={startEdit}>编辑</button>
                  <Link to={`/shops/${displayShop!.id}`} className="admin-shops-drawer-btn admin-shops-drawer-btn--secondary" target="_blank" rel="noopener noreferrer">推广店铺</Link>
                  <Link to={`/orders?shop=${displayShop!.id}`} className="admin-shops-drawer-btn admin-shops-drawer-btn--secondary" onClick={() => { setDetailShop(null); setEditForm(null) }}>订单</Link>
                </>
              )}
            </div>
          </div>
        </>
      )}


    </div>
  )
}

export default AdminShops

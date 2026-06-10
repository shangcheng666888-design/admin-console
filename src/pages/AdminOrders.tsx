import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import { useAdminEditConfirm } from '../context/AdminEditConfirmContext'
import { formatDateTime } from '../utils/datetime'

type OrderStatus =
  | 'pending_pay'
  | 'paid'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'return_pending'
  | 'returned'
  | 'refund_pending'
  | 'refunded'
  | 'cancelled'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_pay: '待付款',
  paid: '待发货',
  shipped: '正在出库',
  in_transit: '正在配送',
  delivered: '已签收',
  completed: '订单完成',
  return_pending: '申请退货',
  returned: '已退货',
  refund_pending: '正在退款',
  refunded: '已退款',
  cancelled: '已取消',
}

const STATUS_OPTIONS: OrderStatus[] = [
  'pending_pay',
  'paid',
  'shipped',
  'in_transit',
  'delivered',
  'completed',
  'return_pending',
  'returned',
  'refund_pending',
  'refunded',
  'cancelled',
]

interface AdminOrderItem {
  id: string
  /** 该商品在店铺商品库中的唯一编号（listingId），从订单项 id 提取 */
  productCode: string
  /** 商品在该店铺的上架号（listingId），用于详情展示 */
  listingId?: string
  title: string
  price: number
  quantity: number
}

interface AdminOrder {
  id: string
  shopId: string
  orderNo: string
  orderTime: string
  /** 买家账号展示文案（初始为 “用户 {id}”，后续用 buyerAccounts 覆盖） */
  buyer: string
  /** 买家用户 ID，供查询账号使用 */
  buyerId?: string
  /** 店铺名称（通过 shopId 查询所得） */
  shopName?: string
  /** 店主账号（通过店铺 ownerId 查询用户账号、掩码后展示） */
  ownerAccount?: string
  /** 该订单涉及的商品编号列表（店铺内唯一编号，可能为多个） */
  productCodes: string
  amount: number
  status: OrderStatus
  trackingNo?: string
  /** 订单内的商品明细列表，用于详情展示 */
  items?: AdminOrderItem[]
}

type ApiOrderStatus = 'pending' | 'paid' | 'shipped' | 'in_transit' | 'delivered' | 'completed' | 'return_pending' | 'returned' | 'refund_pending' | 'refunded' | 'cancelled'

interface ApiOrder {
  id: string
  orderNumber: string
  shopId: string
  userId: string
  amount: number
  status: ApiOrderStatus
  trackingNo?: string
  createdAt: string
  items?: Array<{ id: string; listingId?: string; productId?: string; title: string; price: number; quantity: number }>
}

/** 管理员视角：买家/店主账号显示为明文（仅做去空格与兜底） */
function maskAccount(account: string): string {
  const trimmed = account.trim()
  if (!trimmed) return '—'
  return trimmed
}

/** 仅取纯上架号（UUID 部分）：订单项 id 可能为 \"uuid-sku_id\"，上架号为前 36 位 UUID */
function getPureListingId(id: string | null | undefined): string {
  if (id == null || id === '') return ''
  const s = String(id).trim()
  // 若长度 >= 36，则认为前 36 位为上架号（UUID），后面是 SKU 等附加信息
  if (s.length >= 36) return s.slice(0, 36)
  return s
}

function mapApiStatusToAdmin(status: ApiOrderStatus): OrderStatus {
  switch (status) {
    case 'pending':
      return 'pending_pay'
    case 'paid':
      return 'paid'
    case 'shipped':
      return 'shipped'
    case 'in_transit':
      return 'in_transit'
    case 'delivered':
      return 'delivered'
    case 'completed':
      return 'completed'
    case 'return_pending':
      return 'return_pending'
    case 'returned':
      return 'returned'
    case 'refund_pending':
      return 'refund_pending'
    case 'refunded':
      return 'refunded'
    case 'cancelled':
    default:
      return 'cancelled'
  }
}

function apiOrderToAdmin(o: ApiOrder): AdminOrder {
  const itemCodes = Array.from(
    new Set(
      (o.items ?? [])
        // 商品仓 ID：优先使用 productId（供货商品 ID），若缺失则退回上架号 / 订单项 id
        .map((i) => {
          if (i.productId != null && String(i.productId).trim()) {
            return String(i.productId).trim()
          }
          return getPureListingId(i.listingId ?? i.id)
        })
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    ),
  )
  const buyerId = o.userId || ''
  return {
    id: o.id,
    shopId: o.shopId,
    orderNo: o.orderNumber || o.id,
    orderTime: formatDateTime(o.createdAt),
    buyer: buyerId ? `用户 ${buyerId}` : '—',
    buyerId,
    productCodes: itemCodes.length > 0 ? itemCodes.join('、') : '—',
    amount: o.amount,
    status: mapApiStatusToAdmin(o.status),
    trackingNo: o.trackingNo,
    items: (o.items ?? []).map((it) => ({
      id: it.id,
      productCode:
        (it.productId && String(it.productId).trim()) ||
        getPureListingId(it.listingId ?? it.id),
      listingId: it.listingId,
      title: it.title,
      price: it.price,
      quantity: it.quantity,
    })),
  }
}

const PAGE_SIZE = 10

const AdminOrders: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const shopId = searchParams.get('shop')
  const [shopIdInput, setShopIdInput] = useState(shopId ?? '')
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [orderNoSearch, setOrderNoSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detailOrder, setDetailOrder] = useState<AdminOrder | null>(null)
  const [editForm, setEditForm] = useState<AdminOrder | null>(null)

  const { saveSuccess, saveError, loadError } = useAdminToast()
  const { requestEditConfirm } = useAdminEditConfirm()

  /** 买家账号（掩码后），key 为 buyerId */
  const [buyerAccounts, setBuyerAccounts] = useState<Record<string, string>>({})
  /** 店铺名称，key 为 shopId */
  const [shopNames, setShopNames] = useState<Record<string, string>>({})
  /** 店主账号（掩码后），key 为 shopId */
  const [ownerAccounts, setOwnerAccounts] = useState<Record<string, string>>({})

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (shopId) params.set('shop', shopId)
      const res = await api.get<{ list: ApiOrder[] }>(`/api/orders${params.toString() ? `?${params.toString()}` : ''}`)
      const list = Array.isArray(res.list) ? res.list.map(apiOrderToAdmin) : []
      setOrders(list)
    } catch (e) {
      loadError(e, '加载订单失败')
      setOrders([])
    }
  }, [shopId, loadError])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchOrders()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
    }
    const timer = window.setInterval(fetchOrders, 5000)
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [fetchOrders])

  // 店铺 ID 输入框与 URL 同步
  useEffect(() => {
    setShopIdInput(shopId ?? '')
  }, [shopId])

  const searchByShopId = () => {
    const v = shopIdInput.trim()
    if (v) {
      setSearchParams({ shop: v })
      setPage(1)
    } else {
      setSearchParams({})
      setPage(1)
    }
  }

  // 根据订单列表补充：买家账号、店铺名称、店主账号
  useEffect(() => {
    if (!orders.length) return
    let cancelled = false

    const fetchExtraInfo = async () => {
      try {
        // 买家账号
        const buyerIds = Array.from(
          new Set(orders.map((o) => o.buyerId).filter((id): id is string => !!id)),
        )
        if (buyerIds.length) {
          const results = await Promise.all(
            buyerIds.map(async (id) => {
              try {
                const u = await api.get<{ account?: string }>(`/api/users/${encodeURIComponent(id)}`)
                const label = u.account ? maskAccount(u.account) : `用户 ${id}`
                return { id, label }
              } catch {
                return { id, label: `用户 ${id}` }
              }
            }),
          )
          if (!cancelled) {
            setBuyerAccounts((prev) => {
              const next = { ...prev }
              for (const { id, label } of results) {
                if (!next[id]) next[id] = label
              }
              return next
            })
          }
        }

        // 店铺名称与店主账号
        const shopIds = Array.from(new Set(orders.map((o) => o.shopId).filter((id) => !!id)))
        if (!shopIds.length) return
        const shopResults = await Promise.all(
          shopIds.map(async (id) => {
            try {
              const s = await api.get<{ name?: string; ownerId?: string }>(`/api/shops/${encodeURIComponent(id)}`)
              return { id, name: s.name ?? id, ownerId: s.ownerId ?? '' }
            } catch {
              return { id, name: id, ownerId: '' }
            }
          }),
        )
        if (!cancelled) {
          const ownerIds = Array.from(
            new Set(shopResults.map((s) => s.ownerId).filter((id): id is string => !!id)),
          )
          setShopNames((prev) => {
            const next = { ...prev }
            for (const s of shopResults) {
              if (!next[s.id]) next[s.id] = s.name
            }
            return next
          })
          if (ownerIds.length) {
            const ownerResults = await Promise.all(
              ownerIds.map(async (id) => {
                try {
                  const u = await api.get<{ account?: string }>(`/api/users/${encodeURIComponent(id)}`)
                  const label = u.account ? maskAccount(u.account) : `用户 ${id}`
                  return { id, label }
                } catch {
                  return { id, label: `用户 ${id}` }
                }
              }),
            )
            if (!cancelled) {
              setOwnerAccounts((prev) => {
                const next = { ...prev }
                // 按 shopId 存储店主账号，方便通过 shopId 直接取
                for (const s of shopResults) {
                  const owner = ownerResults.find((o) => o.id === s.ownerId)
                  if (s.id && owner && !next[s.id]) {
                    next[s.id] = owner.label
                  }
                }
                return next
              })
            }
          }
        }
      } catch {
        // 忽略附加信息加载错误，避免影响订单主流程
      }
    }

    fetchExtraInfo()

    return () => {
      cancelled = true
    }
  }, [orders])

  const filtered = useMemo(() => {
    let list = shopId ? orders.filter((o) => o.shopId === shopId) : orders
    if (statusFilter !== 'all') {
      list = list.filter((o) => o.status === statusFilter)
    }
    if (orderNoSearch.trim()) {
      const q = orderNoSearch.trim().toLowerCase()
      list = list.filter((o) => o.orderNo.toLowerCase().includes(q))
    }
    return list
  }, [orders, shopId, statusFilter, orderNoSearch])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  const openDetail = (o: AdminOrder) => {
    const current = orders.find((x) => x.id === o.id) ?? o
    setDetailOrder(current)
    setEditForm(null)
  }

  const startEdit = () => {
    if (!detailOrder) return
    setEditForm({ ...detailOrder })
  }

  const cancelEdit = () => {
    setEditForm(null)
  }

  const performSaveEdit = async () => {
    if (!editForm) return
    try {
      // 仅将状态与物流单号同步给后端，其他字段暂时本地编辑
      const payload: { status?: string; trackingNo?: string | null } = {}
      let dbStatus: string | undefined
      switch (editForm.status) {
        case 'pending_pay':
          dbStatus = 'pending'
          break
        case 'paid':
          dbStatus = 'paid'
          break
        case 'shipped':
          dbStatus = 'shipped'
          break
        case 'in_transit':
          dbStatus = 'in_transit'
          break
        case 'delivered':
          dbStatus = 'delivered'
          break
        case 'completed':
          dbStatus = 'completed'
          break
        case 'return_pending':
          dbStatus = 'return_pending'
          break
        case 'returned':
          dbStatus = 'returned'
          break
        case 'refund_pending':
          dbStatus = 'refund_pending'
          break
        case 'refunded':
          dbStatus = 'refunded'
          break
        case 'cancelled':
          dbStatus = 'cancelled'
          break
        default:
          break
      }
      if (dbStatus) payload.status = dbStatus
      payload.trackingNo = editForm.trackingNo ?? undefined
      await api.patch(`/api/orders/${encodeURIComponent(editForm.id)}`, payload)

      const updated = { ...editForm }
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      setDetailOrder(updated)
      setEditForm(null)
      saveSuccess()
    } catch (e) {
      saveError(e)
    }
  }

  const saveEdit = () => {
    if (!editForm) return
    requestEditConfirm({
      title: '确认保存修改',
      message: `即将保存对订单「${editForm.orderNo}」的修改，提交后立即生效，请确认。`,
      confirmLabel: '确认保存',
      onConfirm: () => {
        void performSaveEdit()
      },
    })
  }

  const updateEditForm = (patch: Partial<AdminOrder>) => {
    setEditForm((prev) => (prev ? { ...prev, ...patch } : null))
  }

  const displayOrder = editForm ?? detailOrder
  const displayBuyerLabel =
    displayOrder?.buyerId && buyerAccounts[displayOrder.buyerId]
      ? buyerAccounts[displayOrder.buyerId]
      : displayOrder?.buyer ?? '—'
  const displayShopName =
    (displayOrder && shopNames[displayOrder.shopId]) || displayOrder?.shopId || '—'
  const displayOwnerAccount =
    (displayOrder && ownerAccounts[displayOrder.shopId]) || '—'

  return (
    <div className="admin-orders">
      <header className="admin-orders-header admin-list-hero admin-list-hero--with-actions">
        <div className="admin-list-hero-row">
          <div className="admin-list-hero-head">
            <span className="admin-list-hero-eyebrow">交易管理</span>
            <h2 className="admin-orders-title">订单管理</h2>
          </div>
          <div className="admin-orders-toolbar admin-list-hero-actions">
            <div className="admin-orders-search-wrap">
              <input
                type="text"
                className="admin-orders-search admin-orders-search-shop"
                placeholder="店铺 ID 或名称"
                value={shopIdInput}
                onChange={(e) => setShopIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchByShopId()}
              />
              <button type="button" className="admin-orders-shop-search-btn" onClick={searchByShopId}>
                按店铺搜索
              </button>
              <input
                type="text"
                className="admin-orders-search"
                placeholder="搜索订单号"
                value={orderNoSearch}
                onChange={(e) => setOrderNoSearch(e.target.value)}
              />
            </div>
            <label className="admin-orders-status-field">
              <span className="admin-orders-status-icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </span>
              <select
                className="admin-orders-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
                aria-label="按订单状态筛选"
              >
                <option value="all">全部状态</option>
                {STATUS_OPTIONS.map((key) => (
                  <option key={key} value={key}>
                    {STATUS_LABEL[key]}
                  </option>
                ))}
              </select>
              <span className="admin-orders-status-chevron" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </label>
          </div>
        </div>
        <p className="admin-orders-desc">
          {shopId ? `店铺 ${shopId} 的订单记录` : '全站订单，支持查看与全链路修改。可从店铺管理进入某店铺订单。'}
          {shopId ? (
            <>
              {' '}
              <Link to="/shops" className="admin-orders-back-link">返回店铺管理</Link>
            </>
          ) : null}
        </p>
      </header>

      <section className="admin-orders-table-wrap">
        <div className="admin-table-scroll">
        <table className="admin-orders-table">
          <thead>
            <tr>
              <th className="admin-orders-col admin-orders-col--orderNo">订单号</th>
              <th className="admin-orders-col admin-orders-col--time">下单时间</th>
              <th className="admin-orders-col admin-orders-col--buyer">买家</th>
              <th className="admin-orders-col admin-orders-col--shop">店铺名</th>
              <th className="admin-orders-col admin-orders-col--codes">商品编号</th>
              <th className="admin-orders-col admin-orders-col--amount">订单金额</th>
              <th className="admin-orders-col admin-orders-sticky admin-orders-sticky--status">状态</th>
              <th className="admin-orders-col admin-orders-sticky admin-orders-sticky--actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-orders-empty">
                  {shopId ? '该店铺暂无符合条件的订单' : '暂无符合条件的订单'}
                </td>
              </tr>
            ) : (
              paginated.map((o) => (
                <tr key={o.id}>
                  <td className="admin-orders-col admin-orders-col--orderNo"><code className="admin-orders-orderNo">{o.orderNo}</code></td>
                  <td className="admin-orders-col admin-orders-col--time">{o.orderTime}</td>
                  <td className="admin-orders-col admin-orders-col--buyer">
                    <span className="admin-orders-cell-text">{o.buyerId && buyerAccounts[o.buyerId] ? buyerAccounts[o.buyerId] : o.buyer}</span>
                  </td>
                  <td className="admin-orders-col admin-orders-col--shop">
                    <span className="admin-orders-cell-text">{shopNames[o.shopId] || o.shopId || '—'}</span>
                  </td>
                  <td className="admin-orders-col admin-orders-col--codes">
                    <span className="admin-orders-cell-text admin-orders-cell-text--codes">{o.productCodes}</span>
                  </td>
                  <td className="admin-orders-col admin-orders-col--amount admin-orders-cell-amount">{o.amount.toFixed(2)}</td>
                  <td className="admin-orders-col admin-orders-sticky admin-orders-sticky--status">
                    <span className={`admin-orders-status admin-orders-status--${o.status}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="admin-orders-col admin-orders-sticky admin-orders-sticky--actions">
                    <button type="button" className="admin-orders-action-btn" onClick={() => openDetail(o)}>查看</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        {totalPages > 1 && (
          <footer className="admin-table-footer admin-orders-pagination">
            <button
              type="button"
              className="admin-orders-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="admin-orders-page-info">
              第 {page} / {totalPages} 页，共 {filtered.length} 条
            </span>
            <button
              type="button"
              className="admin-orders-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </button>
          </footer>
        )}
      </section>

      {detailOrder && (
        <>
          <div
            className="admin-orders-drawer-overlay"
            onClick={() => { setDetailOrder(null); setEditForm(null) }}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="admin-orders-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-orders-drawer-title"
          >
            <div className="admin-orders-drawer-head">
              <h2 id="admin-orders-drawer-title" className="admin-orders-drawer-title">
                {editForm ? '编辑订单' : '订单详情'}
              </h2>
              <button
                type="button"
                className="admin-orders-drawer-close"
                onClick={() => { setDetailOrder(null); setEditForm(null) }}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="admin-orders-drawer-body">
              {editForm ? (
                <div className="admin-orders-edit-form">
                  <div className="admin-orders-edit-row">
                    <label className="admin-orders-edit-label">订单号</label>
                    <span className="admin-orders-edit-readonly">{editForm.orderNo}</span>
                  </div>
                  <div className="admin-orders-edit-row">
                    <label className="admin-orders-edit-label">店铺 ID</label>
                    <span className="admin-orders-edit-readonly">{editForm.shopId}</span>
                  </div>
                  <div className="admin-orders-edit-row">
                    <label className="admin-orders-edit-label">下单时间</label>
                    <input
                      type="text"
                      className="admin-orders-edit-input"
                      value={editForm.orderTime}
                      onChange={(e) => updateEditForm({ orderTime: e.target.value })}
                      placeholder="如 2025-02-27 10:30"
                    />
                  </div>
                  <div className="admin-orders-edit-row">
                    <label className="admin-orders-edit-label">买家</label>
                    <input
                      type="text"
                      className="admin-orders-edit-input"
                      value={editForm.buyer}
                      onChange={(e) => updateEditForm({ buyer: e.target.value })}
                    />
                  </div>
                  <div className="admin-orders-edit-row">
                    <label className="admin-orders-edit-label">商品编号</label>
                    <input
                      type="text"
                      className="admin-orders-edit-input"
                      value={editForm.productCodes}
                      onChange={(e) => updateEditForm({ productCodes: e.target.value })}
                    />
                  </div>
                  <div className="admin-orders-edit-row">
                    <label className="admin-orders-edit-label">订单金额</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="admin-orders-edit-input"
                      value={editForm.amount}
                      onChange={(e) => updateEditForm({ amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="admin-orders-edit-row">
                    <label className="admin-orders-edit-label">状态</label>
                    <select
                      className="admin-orders-edit-input"
                      value={editForm.status}
                      onChange={(e) => updateEditForm({ status: e.target.value as OrderStatus })}
                    >
                      {STATUS_OPTIONS.map((key) => (
                        <option key={key} value={key}>{STATUS_LABEL[key]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-orders-edit-row">
                    <label className="admin-orders-edit-label">物流单号（选填）</label>
                    <input
                      type="text"
                      className="admin-orders-edit-input"
                      value={editForm.trackingNo ?? ''}
                      onChange={(e) => updateEditForm({ trackingNo: e.target.value || undefined })}
                      placeholder="已发货/已完成时可填"
                    />
                  </div>
                </div>
              ) : (
                <>
                <div className="admin-drawer-summary">
                  <div className="admin-drawer-summary-main">
                    <span className="admin-drawer-summary-title">{displayOrder!.orderNo}</span>
                    <code className="admin-drawer-summary-sub">{displayOrder!.orderTime}</code>
                  </div>
                  <div className="admin-drawer-summary-aside">
                    <span className={`admin-orders-status admin-orders-status--${displayOrder!.status}`}>
                      {STATUS_LABEL[displayOrder!.status]}
                    </span>
                    <span className="admin-drawer-summary-money">{displayOrder!.amount.toFixed(2)}</span>
                  </div>
                </div>
                <section className="admin-drawer-section">
                  <h3 className="admin-drawer-section-title">店铺与买家</h3>
                <dl className="admin-orders-detail-list">
                  <div className="admin-orders-detail-row">
                    <dt>店铺名称</dt>
                    <dd>{displayShopName}</dd>
                  </div>
                  <div className="admin-orders-detail-row">
                    <dt>店铺 ID</dt>
                    <dd><code className="admin-orders-orderNo">{displayOrder!.shopId}</code></dd>
                  </div>
                  <div className="admin-orders-detail-row">
                    <dt>店主账号</dt>
                    <dd>{displayOwnerAccount}</dd>
                  </div>
                  <div className="admin-orders-detail-row">
                    <dt>买家</dt>
                    <dd>{displayBuyerLabel}</dd>
                  </div>
                  {(displayOrder!.trackingNo != null && displayOrder!.trackingNo !== '') && (
                    <div className="admin-orders-detail-row">
                      <dt>物流单号</dt>
                      <dd>{displayOrder!.trackingNo}</dd>
                    </div>
                  )}
                </dl>
                </section>
                <section className="admin-drawer-section">
                  <h3 className="admin-drawer-section-title">商品信息</h3>
                  <dl className="admin-orders-detail-list">
                    <div className="admin-orders-detail-row">
                      <dt>商品编号</dt>
                      <dd><code className="admin-orders-orderNo">{displayOrder!.productCodes}</code></dd>
                    </div>
                  </dl>
                  {displayOrder?.items && displayOrder.items.length > 0 && (
                    <ul className="admin-orders-detail-items">
                      {displayOrder.items.map((it) => (
                        <li key={it.id} className="admin-orders-detail-item">
                          <div className="admin-orders-detail-item-main">
                            <span className="admin-orders-detail-item-title">{it.title}</span>
                            <span className="admin-orders-detail-item-meta">
                              {it.price.toFixed(2)} · x{it.quantity}
                            </span>
                          </div>
                          <div className="admin-orders-detail-item-listing">
                            <span className="admin-orders-detail-item-listing-label">上架号：</span>
                            <code className="admin-orders-listing-id">
                              {getPureListingId(it.listingId ?? it.id) || '—'}
                            </code>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                </>
              )}
            </div>
            <div className="admin-orders-drawer-actions">
              {editForm ? (
                <>
                  <button type="button" className="admin-orders-drawer-btn" onClick={saveEdit}>保存</button>
                  <button type="button" className="admin-orders-drawer-btn admin-orders-drawer-btn--secondary" onClick={cancelEdit}>取消</button>
                </>
              ) : (
                <>
                  <button type="button" className="admin-orders-drawer-btn admin-orders-drawer-btn--secondary" onClick={startEdit}>编辑</button>
                  <button type="button" className="admin-orders-drawer-btn admin-orders-drawer-btn--secondary" onClick={() => { setDetailOrder(null); setEditForm(null) }}>关闭</button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AdminOrders

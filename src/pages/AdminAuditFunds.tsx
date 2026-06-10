import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import { formatDateTime } from '../utils/datetime'
import AdminLoadingState from '../components/admin/AdminLoadingState'

type FundScope = 'mall' | 'shop'
type FundType = 'recharge' | 'withdraw'
type FundStatus = 'pending' | 'approved' | 'rejected'

interface FundRow {
  id: string
  orderNo: string
  amount: number
  applyTime: string
  status: FundStatus
  loginAccount?: string
  shopId?: string
  shopName?: string
  ownerAccount?: string
  rechargeScreenshotUrl?: string | null
  withdrawAddress?: string | null
  withdrawNetwork?: string | null
}

const PAGE_SIZE = 30

const STATUS_LABEL: Record<FundStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
}

function parseScope(value: string | null): FundScope {
  return value === 'shop' ? 'shop' : 'mall'
}

function parseFundType(value: string | null): FundType {
  return value === 'withdraw' ? 'withdraw' : 'recharge'
}

const AdminAuditFunds: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const scope = parseScope(searchParams.get('scope'))
  const fundType = parseFundType(searchParams.get('type'))
  const { loadError, actionSuccess, actionError } = useAdminToast()

  const [list, setList] = useState<FundRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [platformDepositAddress, setPlatformDepositAddress] = useState('')
  const [pendingByScope, setPendingByScope] = useState<Record<FundScope, Record<FundType, number>>>({
    mall: { recharge: 0, withdraw: 0 },
    shop: { recharge: 0, withdraw: 0 },
  })

  const setScope = (next: FundScope) => {
    setSearchParams({ scope: next, type: fundType })
    setPage(1)
    setSearchInput('')
    setKeyword('')
  }

  const setFundType = (next: FundType) => {
    setSearchParams({ scope, type: next })
    setPage(1)
    setSearchInput('')
    setKeyword('')
  }

  useEffect(() => {
    api
      .get<{ receiveAddress: string }>('/api/admin/platform-payment-config')
      .then((data) => setPlatformDepositAddress(data.receiveAddress ?? ''))
      .catch(() => {})
  }, [])

  const fetchList = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('type', fundType)
        params.set('page', String(page))
        params.set('pageSize', String(PAGE_SIZE))
        if (keyword.trim()) params.set('q', keyword.trim())

        if (scope === 'mall') {
          const res = await api.get<{
            list: Array<{
              id: number
              userId: string
              type: string
              amount: number
              status: string
              createdAt: string
              orderNo?: string
              userAccount?: string | null
              rechargeScreenshotUrl?: string | null
              withdrawAddress?: string | null
            }>
            total: number
          }>(`/api/audit/fund-applications?${params.toString()}`)
          const items: FundRow[] = (res.list ?? []).map((row) => ({
            id: String(row.id),
            orderNo: row.orderNo ?? (fundType === 'withdraw' ? `WD${row.id}` : `RCH${row.id}`),
            loginAccount: row.userAccount ?? row.userId,
            amount: Number(row.amount ?? 0),
            status: (row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending') as FundStatus,
            applyTime: formatDateTime(row.createdAt),
            rechargeScreenshotUrl: row.rechargeScreenshotUrl ?? null,
            withdrawAddress: row.withdrawAddress ?? null,
          }))
          setList(items)
          setTotal(res.total ?? items.length)
          setPendingByScope((prev) => ({
            ...prev,
            mall: {
              ...prev.mall,
              [fundType]: items.filter((x) => x.status === 'pending').length,
            },
          }))
        } else {
          const res = await api.get<{
            list: Array<{
              id: number
              shopId: string
              shopName?: string | null
              ownerAccount?: string | null
              amount: number
              status: string
              createdAt: string
              orderNo?: string
              rechargeScreenshotUrl?: string | null
              withdrawAddress?: string | null
              withdrawNetwork?: string | null
            }>
            total: number
          }>(`/api/audit/shop-fund-applications?${params.toString()}`)
          const items: FundRow[] = (res.list ?? []).map((row) => ({
            id: String(row.id),
            orderNo:
              row.orderNo ??
              (fundType === 'withdraw'
                ? `SWD${String(row.id).padStart(8, '0')}`
                : `SRCH${String(row.id).padStart(8, '0')}`),
            shopId: row.shopId,
            shopName: row.shopName ?? row.shopId,
            ownerAccount: row.ownerAccount ?? '—',
            amount: Number(row.amount ?? 0),
            status: (row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending') as FundStatus,
            applyTime: formatDateTime(row.createdAt),
            rechargeScreenshotUrl: row.rechargeScreenshotUrl ?? null,
            withdrawAddress: row.withdrawAddress ?? null,
            withdrawNetwork: row.withdrawNetwork ?? 'TRC20',
          }))
          setList(items)
          setTotal(res.total ?? items.length)
          setPendingByScope((prev) => ({
            ...prev,
            shop: {
              ...prev.shop,
              [fundType]: items.filter((x) => x.status === 'pending').length,
            },
          }))
        }
      } catch (e) {
        loadError(
          e,
          scope === 'mall' ? '加载商城资金记录失败' : '加载店铺资金记录失败',
        )
        setList([])
        setTotal(0)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [scope, fundType, page, keyword, loadError],
  )

  useEffect(() => {
    let cancelled = false
    const run = async (silent = false) => {
      if (cancelled) return
      await fetchList(silent)
    }
    run(false)
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') run(true)
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => run(true), 5000)
    return () => {
      cancelled = true
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [fetchList])

  const handleApprove = async (id: string) => {
    const base =
      scope === 'mall'
        ? `/api/audit/fund-applications/${encodeURIComponent(id)}`
        : `/api/audit/shop-fund-applications/${encodeURIComponent(id)}`
    try {
      await api.post(`${base}/approve`, {})
      setList((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'approved' } : x)))
      actionSuccess('已通过该资金申请')
    } catch (e) {
      actionError(e)
    }
  }

  const handleReject = async (id: string) => {
    const remark = window.prompt('拒绝原因（可选）') ?? undefined
    const base =
      scope === 'mall'
        ? `/api/audit/fund-applications/${encodeURIComponent(id)}`
        : `/api/audit/shop-fund-applications/${encodeURIComponent(id)}`
    try {
      await api.post(`${base}/reject`, scope === 'mall' ? (remark ? { remark } : {}) : { remark })
      setList((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)))
      actionSuccess('已拒绝该资金申请')
    } catch (e) {
      actionError(e)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pendingCount = list.filter((x) => x.status === 'pending').length
  const tableVariant = `admin-audit-table--funds-${scope}-${fundType}`
  const searchPlaceholder =
    fundType === 'recharge'
      ? scope === 'mall'
        ? '按交易 ID / 用户账号 / 交易号 搜索'
        : '按交易 ID / 店铺 / 店主账号 搜索'
      : scope === 'mall'
        ? '按交易 ID / 用户账号 / 提现地址 搜索'
        : '按交易 ID / 店铺 / 提现地址 搜索'

  const renderStatusCell = (row: FundRow) => (
    <td className="admin-audit-col admin-audit-sticky admin-audit-sticky--status">
      <span className={`admin-audit-status admin-audit-status--${row.status}`}>{STATUS_LABEL[row.status]}</span>
    </td>
  )

  const renderActionsCell = (row: FundRow) => (
    <td className="admin-audit-col admin-audit-sticky admin-audit-sticky--actions">
      {row.status === 'pending' ? (
        <div className="admin-audit-fund-action-stack">
          <button type="button" className="admin-audit-btn admin-audit-btn--pass" onClick={() => handleApprove(row.id)}>
            通过
          </button>
          <button type="button" className="admin-audit-btn admin-audit-btn--reject" onClick={() => handleReject(row.id)}>
            拒绝
          </button>
        </div>
      ) : (
        <span className="admin-audit-actions-placeholder">—</span>
      )}
    </td>
  )

  const renderScreenshotCell = (row: FundRow) => (
    <td className="admin-audit-col admin-audit-col--screenshot admin-audit-screenshot-cell">
      {row.rechargeScreenshotUrl ? (
        <a
          href={row.rechargeScreenshotUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="admin-audit-screenshot-link"
          title="查看大图"
        >
          <img
            src={row.rechargeScreenshotUrl}
            alt=""
            className="admin-audit-screenshot-thumb"
            loading="lazy"
            decoding="async"
          />
        </a>
      ) : (
        '—'
      )}
    </td>
  )

  const colSpan =
    scope === 'shop'
      ? fundType === 'recharge'
        ? 9
        : 9
      : fundType === 'recharge'
        ? 8
        : 7

  return (
    <div className="admin-audit-page admin-audit-funds-page">
      <header className="admin-audit-header admin-list-hero">
        <span className="admin-list-hero-eyebrow">资金风控</span>
        <h2 className="admin-audit-title">资金审核</h2>
        <p className="admin-audit-desc">统一审核商城用户与店铺的资金充值、提现申请，支持搜索、分页与实时刷新。</p>
      </header>

      <div className="admin-list-controls">
      <div className="admin-audit-fund-scope-tabs" role="tablist" aria-label="资金范围切换">
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'mall'}
          className={`admin-audit-fund-scope-tab admin-audit-fund-scope-tab--mall${scope === 'mall' ? ' admin-audit-fund-scope-tab--active' : ''}`}
          onClick={() => setScope('mall')}
        >
          <span className="admin-audit-fund-scope-tab-label">商城资金</span>
          <span className="admin-audit-fund-scope-tab-desc">用户钱包充值 / 提现</span>
          <span className="admin-audit-fund-scope-tab-count">
            {pendingByScope.mall.recharge + pendingByScope.mall.withdraw}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'shop'}
          className={`admin-audit-fund-scope-tab admin-audit-fund-scope-tab--shop${scope === 'shop' ? ' admin-audit-fund-scope-tab--active' : ''}`}
          onClick={() => setScope('shop')}
        >
          <span className="admin-audit-fund-scope-tab-label">店铺资金</span>
          <span className="admin-audit-fund-scope-tab-desc">店铺钱包充值 / 提现</span>
          <span className="admin-audit-fund-scope-tab-count">
            {pendingByScope.shop.recharge + pendingByScope.shop.withdraw}
          </span>
        </button>
      </div>

      <div className="admin-audit-fund-context">
        <span className={`admin-audit-fund-scope-badge admin-audit-fund-scope-badge--${scope}`}>
          {scope === 'mall' ? '商城资金' : '店铺资金'}
        </span>
        <span className="admin-audit-fund-context-sep">·</span>
        <span className="admin-audit-fund-context-type">{fundType === 'recharge' ? '充值审核' : '提现审核'}</span>
      </div>

      <div className="admin-audit-tabs admin-audit-fund-type-tabs" role="tablist" aria-label="审核类型切换">
        <button
          type="button"
          role="tab"
          aria-selected={fundType === 'recharge'}
          className={`admin-audit-tab${fundType === 'recharge' ? ' admin-audit-tab--active' : ''}`}
          onClick={() => setFundType('recharge')}
        >
          充值审核
          <span className="admin-audit-tab-count">{pendingByScope[scope].recharge}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={fundType === 'withdraw'}
          className={`admin-audit-tab${fundType === 'withdraw' ? ' admin-audit-tab--active' : ''}`}
          onClick={() => setFundType('withdraw')}
        >
          提现审核
          <span className="admin-audit-tab-count">{pendingByScope[scope].withdraw}</span>
        </button>
      </div>
      </div>

      <section className="admin-audit-table-wrap">
        <div className="admin-table-toolbar">
          <div className="admin-audit-search">
            <input
              type="text"
              className="admin-audit-search-input"
              placeholder={searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setKeyword(searchInput.trim())
                  setPage(1)
                }
              }}
            />
            <button
              type="button"
              className="admin-audit-search-btn"
              onClick={() => {
                setKeyword(searchInput.trim())
                setPage(1)
              }}
            >
              搜索
            </button>
          </div>
        </div>

        <div className="admin-table-scroll admin-audit-fund-table-scroll">
          <table className={`admin-audit-table admin-audit-table--funds ${tableVariant}`}>
            <thead>
              {scope === 'mall' && fundType === 'recharge' && (
                <tr>
                  <th className="admin-audit-col admin-audit-col--orderNo">交易 ID</th>
                  <th className="admin-audit-col admin-audit-col--account">用户账号</th>
                  <th className="admin-audit-col admin-audit-col--amount">充值金额（USDT）</th>
                  <th className="admin-audit-col admin-audit-col--address">充值地址</th>
                  <th className="admin-audit-col admin-audit-col--screenshot">交易截图</th>
                  <th className="admin-audit-col admin-audit-col--time">提交时间</th>
                  <th className="admin-audit-col admin-audit-sticky admin-audit-sticky--status">状态</th>
                  <th className="admin-audit-col admin-audit-sticky admin-audit-sticky--actions">操作</th>
                </tr>
              )}
              {scope === 'mall' && fundType === 'withdraw' && (
                <tr>
                  <th className="admin-audit-col admin-audit-col--orderNo">交易 ID</th>
                  <th className="admin-audit-col admin-audit-col--account">用户账号</th>
                  <th className="admin-audit-col admin-audit-col--amount">提现金额（USDT）</th>
                  <th className="admin-audit-col admin-audit-col--address">提现地址</th>
                  <th className="admin-audit-col admin-audit-col--time">提交时间</th>
                  <th className="admin-audit-col admin-audit-sticky admin-audit-sticky--status">状态</th>
                  <th className="admin-audit-col admin-audit-sticky admin-audit-sticky--actions">操作</th>
                </tr>
              )}
              {scope === 'shop' && fundType === 'recharge' && (
                <tr>
                  <th className="admin-audit-col admin-audit-col--orderNo">交易 ID</th>
                  <th className="admin-audit-col admin-audit-col--shop">店铺</th>
                  <th className="admin-audit-col admin-audit-col--account">店主账号</th>
                  <th className="admin-audit-col admin-audit-col--amount">充值金额（USDT）</th>
                  <th className="admin-audit-col admin-audit-col--address">充值地址</th>
                  <th className="admin-audit-col admin-audit-col--screenshot">交易截图</th>
                  <th className="admin-audit-col admin-audit-col--time">提交时间</th>
                  <th className="admin-audit-col admin-audit-sticky admin-audit-sticky--status">状态</th>
                  <th className="admin-audit-col admin-audit-sticky admin-audit-sticky--actions">操作</th>
                </tr>
              )}
              {scope === 'shop' && fundType === 'withdraw' && (
                <tr>
                  <th className="admin-audit-col admin-audit-col--orderNo">交易 ID</th>
                  <th className="admin-audit-col admin-audit-col--shop">店铺</th>
                  <th className="admin-audit-col admin-audit-col--account">店主账号</th>
                  <th className="admin-audit-col admin-audit-col--amount">提现金额（USDT）</th>
                  <th className="admin-audit-col admin-audit-col--network">网络</th>
                  <th className="admin-audit-col admin-audit-col--address">提现地址</th>
                  <th className="admin-audit-col admin-audit-col--time">提交时间</th>
                  <th className="admin-audit-col admin-audit-sticky admin-audit-sticky--status">状态</th>
                  <th className="admin-audit-col admin-audit-sticky admin-audit-sticky--actions">操作</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="admin-loading-cell">
                    <AdminLoadingState variant="panel" label="加载审核列表" />
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="admin-audit-empty">
                    暂无数据
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={`${scope}-${fundType}-${row.id}`}>
                    <td className="admin-audit-col admin-audit-col--orderNo">
                      <code className="admin-audit-id">{row.orderNo}</code>
                    </td>
                    {scope === 'mall' ? (
                      <td className="admin-audit-col admin-audit-col--account">
                        <span className="admin-audit-cell-full">{row.loginAccount}</span>
                      </td>
                    ) : (
                      <>
                        <td className="admin-audit-col admin-audit-col--shop">
                          <span className="admin-audit-cell-full">
                            {row.shopName}（{row.shopId}）
                          </span>
                        </td>
                        <td className="admin-audit-col admin-audit-col--account">
                          <span className="admin-audit-cell-full">{row.ownerAccount || '—'}</span>
                        </td>
                      </>
                    )}
                    <td className="admin-audit-col admin-audit-col--amount admin-audit-amount">{row.amount.toFixed(2)}</td>
                    {fundType === 'withdraw' && scope === 'shop' && (
                      <td className="admin-audit-col admin-audit-col--network">{row.withdrawNetwork ?? 'TRC20'}</td>
                    )}
                    <td className="admin-audit-col admin-audit-col--address">
                      {fundType === 'recharge' ? (
                        <code className="admin-audit-id admin-audit-cell-full">{platformDepositAddress || '—'}</code>
                      ) : (
                        <span className="admin-audit-cell-full">
                          {row.withdrawAddress && row.withdrawAddress.trim() ? row.withdrawAddress : '—'}
                        </span>
                      )}
                    </td>
                    {fundType === 'recharge' && renderScreenshotCell(row)}
                    <td className="admin-audit-col admin-audit-col--time">{row.applyTime}</td>
                    {renderStatusCell(row)}
                    {renderActionsCell(row)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="admin-table-footer">
          <div className="admin-audit-pagination">
            <button
              type="button"
              className="admin-audit-page-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="admin-audit-page-info">
              第 {page} / {totalPages} 页，共 {total} 条
              {pendingCount > 0 ? ` · 本页待审核 ${pendingCount} 条` : ''}
            </span>
            <button
              type="button"
              className="admin-audit-page-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export default AdminAuditFunds

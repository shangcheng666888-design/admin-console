import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import { useAdminEditConfirm } from '../context/AdminEditConfirmContext'
import AdminLoadingState from '../components/admin/AdminLoadingState'

type PaidChannel = 'tiktok' | 'meta' | 'google' | 'other'
type PromoStatus = 'pending' | 'active' | 'paused' | 'ended'
type TargetType = 'shop' | 'product' | null

interface PromotionRow {
  id: number
  shopId: string
  shopName: string | null
  channel: PaidChannel
  status: PromoStatus
  targetType: TargetType
  targetListingId: string | null
  targetProductTitle: string | null
  adminNote: string | null
  activatedAt: string | null
  updatedAt: string
}

interface MetricPoint {
  date: string
  impressions: number
  clicks: number
  visits: number
  orders: number
  spend: number
  revenue: number
}

interface ShopOption {
  id: string
  name: string
}

const CHANNEL_OPTIONS: { value: PaidChannel; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'other', label: '其他' },
]

const STATUS_LABEL: Record<PromoStatus, string> = {
  pending: '待开启',
  active: '推广中',
  paused: '已暂停',
  ended: '已结束',
}

const METRIC_FIELDS: { key: keyof MetricPoint; label: string; step?: string }[] = [
  { key: 'impressions', label: '曝光' },
  { key: 'clicks', label: '点击' },
  { key: 'visits', label: '进店' },
  { key: 'orders', label: '成交' },
  { key: 'spend', label: '消耗 ($)', step: '0.01' },
  { key: 'revenue', label: '成交额 ($)', step: '0.01' },
]

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const AdminPaidPromotions: React.FC = () => {
  const { loadError, saveSuccess, saveError, actionSuccess, actionError } = useAdminToast()
  const { requestEditConfirm } = useAdminEditConfirm()

  const [loading, setLoading] = useState(true)
  const [savingMetrics, setSavingMetrics] = useState(false)
  const [creating, setCreating] = useState(false)
  const [list, setList] = useState<PromotionRow[]>([])
  const [shops, setShops] = useState<ShopOption[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | PromoStatus>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [metrics, setMetrics] = useState<MetricPoint[]>([])
  const [createForm, setCreateForm] = useState({
    shopId: '',
    channel: 'tiktok' as PaidChannel,
    adminNote: '',
  })

  const selected = useMemo(
    () => list.find((item) => item.id === selectedId) ?? null,
    [list, selectedId],
  )

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const query = statusFilter === 'all' ? '' : `?status=${encodeURIComponent(statusFilter)}`
      const res = await api.get<{ list: PromotionRow[] }>(`/api/admin/paid-promotions${query}`)
      setList(Array.isArray(res.list) ? res.list : [])
    } catch (e) {
      loadError(e, '加载付费推广列表失败')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [loadError, statusFilter])

  const fetchShops = useCallback(async () => {
    try {
      const res = await api.get<{ list: ShopOption[] }>('/api/admin/paid-promotions/shops-options')
      setShops(Array.isArray(res.list) ? res.list : [])
    } catch {
      setShops([])
    }
  }, [])

  const fetchMetrics = useCallback(async (id: number) => {
    try {
      const res = await api.get<{ series: MetricPoint[] }>(`/api/admin/paid-promotions/${id}/metrics`)
      setMetrics(Array.isArray(res.series) ? res.series : [])
    } catch (e) {
      loadError(e, '加载推广数据失败')
      setMetrics([])
    }
  }, [loadError])

  useEffect(() => {
    fetchList()
    fetchShops()
  }, [fetchList, fetchShops])

  useEffect(() => {
    if (selectedId) fetchMetrics(selectedId)
    else setMetrics([])
  }, [selectedId, fetchMetrics])

  const performCreate = () => {
    if (!createForm.shopId) return
    setCreating(true)
    api
      .post('/api/admin/paid-promotions', {
        shopId: createForm.shopId,
        channel: createForm.channel,
        status: 'active',
        adminNote: createForm.adminNote.trim() || undefined,
      })
      .then(() => {
        actionSuccess('付费推广已开启')
        setCreateForm({ shopId: '', channel: 'tiktok', adminNote: '' })
        fetchList()
      })
      .catch((e) => actionError(e, '开启失败'))
      .finally(() => setCreating(false))
  }

  const handleCreate = () => {
    if (!createForm.shopId) {
      actionError('请选择店铺')
      return
    }
    requestEditConfirm({
      title: '开启付费推广',
      message: '确认已为该店铺完成线下购买沟通，并为其开启付费推广？',
      confirmLabel: '确认开启',
      onConfirm: performCreate,
    })
  }

  const performUpdateStatus = (id: number, status: PromoStatus) => {
    api
      .patch(`/api/admin/paid-promotions/${id}`, { status })
      .then(() => {
        actionSuccess('状态已更新')
        fetchList()
        if (selectedId === id) fetchMetrics(id)
      })
      .catch((e) => actionError(e, '更新失败'))
  }

  const updateStatus = (id: number, status: PromoStatus) => {
    const label = STATUS_LABEL[status]
    requestEditConfirm({
      title: '更新推广状态',
      message: `确认将推广状态更新为「${label}」？`,
      confirmLabel: '确认更新',
      onConfirm: () => performUpdateStatus(id, status),
    })
  }

  const updateMetricCell = (date: string, key: keyof MetricPoint, value: string) => {
    setMetrics((prev) =>
      prev.map((row) => {
        if (row.date !== date) return row
        if (key === 'date') return row
        const num = Number(value)
        return {
          ...row,
          [key]: Number.isFinite(num) ? Math.max(0, num) : 0,
        }
      }),
    )
  }

  const performSaveMetrics = () => {
    if (!selectedId) return
    setSavingMetrics(true)
    api
      .put(`/api/admin/paid-promotions/${selectedId}/metrics`, { metrics })
      .then(() => {
        saveSuccess('推广数据已保存')
        fetchMetrics(selectedId)
      })
      .catch((e) => saveError(e, '保存失败'))
      .finally(() => setSavingMetrics(false))
  }

  const saveMetrics = () => {
    if (!selectedId) return
    requestEditConfirm({
      title: '保存推广数据',
      message: '确认保存近 7 日智能推广数据？商家看板将同步展示。',
      confirmLabel: '确认保存',
      onConfirm: performSaveMetrics,
    })
  }

  if (loading && list.length === 0) {
    return <AdminLoadingState variant="page" label="加载推广智能控" />
  }

  return (
    <div className="admin-page admin-paid-promotions-page">
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">推广智能控</h1>
          <p className="admin-page-desc">
            商家完成付费流量购买后，在此开启推广；商家选择推广目标后，可智能调控近 7 日投放数据。
          </p>
        </div>
      </header>

      <section className="admin-card admin-paid-promotions-create">
        <h2 className="admin-card-title">开启付费推广</h2>
        <div className="admin-paid-promotions-create-grid">
          <label className="admin-field">
            <span>店铺</span>
            <select
              value={createForm.shopId}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, shopId: e.target.value }))}
            >
              <option value="">请选择店铺</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name} ({shop.id})
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>推广渠道</span>
            <select
              value={createForm.channel}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, channel: e.target.value as PaidChannel }))
              }
            >
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field admin-field--wide">
            <span>备注（可选）</span>
            <input
              type="text"
              value={createForm.adminNote}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, adminNote: e.target.value }))}
              placeholder="例如：TikTok 套餐 A，预算 $500"
            />
          </label>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? '开启中…' : '开启推广'}
          </button>
        </div>
      </section>

      <div className="admin-paid-promotions-layout">
        <section className="admin-card admin-paid-promotions-list">
          <div className="admin-paid-promotions-list-head">
            <h2 className="admin-card-title">推广列表</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | PromoStatus)}
            >
              <option value="all">全部状态</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-paid-promotions-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>店铺</th>
                  <th>渠道</th>
                  <th>状态</th>
                  <th>推广目标</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="admin-table-empty">
                      暂无推广记录
                    </td>
                  </tr>
                ) : (
                  list.map((item) => (
                    <tr
                      key={item.id}
                      className={selectedId === item.id ? 'admin-table-row--active' : ''}
                    >
                      <td>
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => setSelectedId(item.id)}
                        >
                          {item.shopName ?? item.shopId}
                        </button>
                        <div className="admin-table-sub">{item.shopId}</div>
                      </td>
                      <td>{CHANNEL_OPTIONS.find((c) => c.value === item.channel)?.label ?? item.channel}</td>
                      <td>
                        <span className={`admin-badge admin-badge--${item.status}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                      </td>
                      <td>
                        {item.targetType === 'product'
                          ? item.targetProductTitle ?? `商品 ${item.targetListingId}`
                          : item.targetType === 'shop'
                            ? '整店推广'
                            : '待商家选择'}
                      </td>
                      <td>
                        <div className="admin-table-actions">
                          {item.status !== 'active' && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm"
                              onClick={() => updateStatus(item.id, 'active')}
                            >
                              开启
                            </button>
                          )}
                          {item.status === 'active' && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm"
                              onClick={() => updateStatus(item.id, 'paused')}
                            >
                              暂停
                            </button>
                          )}
                          {item.status !== 'ended' && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--ghost"
                              onClick={() => updateStatus(item.id, 'ended')}
                            >
                              结束
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card admin-paid-promotions-control">
          <h2 className="admin-card-title">智能数据调控</h2>
          {!selected ? (
            <p className="admin-paid-promotions-placeholder">请从左侧选择一条推广记录</p>
          ) : (
            <>
              <div className="admin-paid-promotions-selected-meta">
                <div>
                  <strong>{selected.shopName ?? selected.shopId}</strong>
                  <span>
                    {CHANNEL_OPTIONS.find((c) => c.value === selected.channel)?.label} ·{' '}
                    {STATUS_LABEL[selected.status]}
                  </span>
                </div>
                <div>
                  推广目标：
                  {selected.targetType === 'product'
                    ? selected.targetProductTitle ?? `商品 ${selected.targetListingId}`
                    : selected.targetType === 'shop'
                      ? '整店推广'
                      : '商家尚未选择'}
                </div>
                {selected.adminNote ? <div>备注：{selected.adminNote}</div> : null}
              </div>

              {selected.targetType ? (
                <>
                  <div className="admin-paid-promotions-metrics-table-wrap">
                    <table className="admin-table admin-paid-promotions-metrics-table">
                      <thead>
                        <tr>
                          <th>日期</th>
                          {METRIC_FIELDS.map((field) => (
                            <th key={field.key}>{field.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.map((row) => (
                          <tr key={row.date}>
                            <td>{formatDateLabel(row.date)}</td>
                            {METRIC_FIELDS.map((field) => (
                              <td key={field.key}>
                                <input
                                  type="number"
                                  min={0}
                                  step={field.step ?? '1'}
                                  className="admin-paid-promotions-metric-input"
                                  value={row[field.key]}
                                  onChange={(e) => updateMetricCell(row.date, field.key, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    onClick={saveMetrics}
                    disabled={savingMetrics}
                  >
                    {savingMetrics ? '保存中…' : '保存近 7 日数据'}
                  </button>
                </>
              ) : (
                <p className="admin-paid-promotions-placeholder">
                  商家尚未在仪表盘选择推广目标，选择后可在此调控投放数据。
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default AdminPaidPromotions

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import { useAdminEditConfirm } from '../context/AdminEditConfirmContext'
import AdminLoadingState from '../components/admin/AdminLoadingState'

type PaidChannel = 'tiktok' | 'meta' | 'google' | 'other'
type PromoStatus = 'pending' | 'awaiting_launch' | 'active' | 'paused' | 'ended' | 'completed'
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
  targetRegion: string | null
  targetAudience: string | null
  adminNote: string | null
  campaignDurationDays: number | null
  budgetTotal: number | null
  presetImpressions: number | null
  presetClicks: number | null
  presetVisits: number | null
  presetOrders: number | null
  presetRevenue: number | null
  campaignStartAt: string | null
  campaignEndAt: string | null
  merchantConfirmedAt: string | null
  activatedAt: string | null
  updatedAt: string
}

function needsCampaignConfig(promotion: PromotionRow): boolean {
  if (promotion.status === 'awaiting_launch') return true
  if (
    promotion.status === 'active' &&
    promotion.merchantConfirmedAt &&
    !promotion.campaignStartAt &&
    promotion.targetType
  ) {
    return true
  }
  return false
}

function hasLaunchedCampaign(promotion: PromotionRow): boolean {
  return Boolean(promotion.campaignStartAt) || promotion.status === 'completed'
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

interface ShopSearchResult {
  id: string
  name: string
  ownerAccount?: string
  status?: string
}

const CHANNEL_OPTIONS: { value: PaidChannel; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'other', label: '其他' },
]

const STATUS_LABEL: Record<PromoStatus, string> = {
  pending: '待商家配置',
  awaiting_launch: '待开启推广',
  active: '推广中',
  paused: '已暂停',
  ended: '已结束',
  completed: '已完成',
}

const REGION_LABEL: Record<string, string> = {
  north_america: '北美',
  europe: '欧洲',
  southeast_asia: '东南亚',
  middle_east: '中东',
  latin_america: '拉美',
  global: '全球',
}

const AUDIENCE_LABEL: Record<string, string> = {
  all: '全部受众',
  young_adults: '年轻群体 18-34',
  women: '女性用户',
  men: '男性用户',
  parents: '家长群体',
  high_intent: '高购买意向',
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const AdminPaidPromotions: React.FC = () => {
  const { loadError, actionSuccess, actionError } = useAdminToast()
  const { requestEditConfirm } = useAdminEditConfirm()

  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [list, setList] = useState<PromotionRow[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | PromoStatus>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [metrics, setMetrics] = useState<MetricPoint[]>([])
  const [metricsSummary, setMetricsSummary] = useState<{
    campaignProgress?: number
    budgetProgress?: number
    totals?: MetricPoint
    presets?: MetricPoint
  } | null>(null)
  const [campaignConfig, setCampaignConfig] = useState({
    durationDays: '7',
    budgetTotal: '',
    impressions: '',
    clickRate: '',
    visits: '',
    orders: '',
    revenue: '',
  })
  const [shopSearchInput, setShopSearchInput] = useState('')
  const [shopSearchLoading, setShopSearchLoading] = useState(false)
  const [shopSearchResults, setShopSearchResults] = useState<ShopSearchResult[]>([])
  const [selectedShop, setSelectedShop] = useState<ShopSearchResult | null>(null)
  const [createForm, setCreateForm] = useState({
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

  const syncCampaignConfigFromPromotion = useCallback((promotion: PromotionRow) => {
    const clicks = promotion.presetClicks ?? 0
    const impressions = promotion.presetImpressions ?? 0
    const clickRate = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : ''
    setCampaignConfig({
      durationDays: String(promotion.campaignDurationDays ?? 7),
      budgetTotal: promotion.budgetTotal != null ? String(promotion.budgetTotal) : '',
      impressions: promotion.presetImpressions != null ? String(promotion.presetImpressions) : '',
      clickRate,
      visits: promotion.presetVisits != null ? String(promotion.presetVisits) : '',
      orders: promotion.presetOrders != null ? String(promotion.presetOrders) : '',
      revenue: promotion.presetRevenue != null ? String(promotion.presetRevenue) : '',
    })
  }, [])

  const fetchMetrics = useCallback(async (id: number) => {
    try {
      const res = await api.get<{
        series: MetricPoint[]
        campaignProgress?: number
        budgetProgress?: number
        totals?: MetricPoint
        presets?: MetricPoint
        promotion: PromotionRow
      }>(`/api/admin/paid-promotions/${id}/metrics`)
      setMetrics(Array.isArray(res.series) ? res.series : [])
      setMetricsSummary({
        campaignProgress: res.campaignProgress,
        budgetProgress: res.budgetProgress,
        totals: res.totals,
        presets: res.presets,
      })
      if (res.promotion) syncCampaignConfigFromPromotion(res.promotion)
    } catch (e) {
      loadError(e, '加载推广数据失败')
      setMetrics([])
      setMetricsSummary(null)
    }
  }, [loadError, syncCampaignConfigFromPromotion])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const searchShops = useCallback(async () => {
    const keyword = shopSearchInput.trim()
    if (!keyword) {
      actionError('请输入店铺 ID 或店铺名称')
      return
    }
    setShopSearchLoading(true)
    setShopSearchResults([])
    try {
      const res = await api.get<{ list: ShopSearchResult[] }>(
        `/api/shops?search=${encodeURIComponent(keyword)}`,
      )
      let results = Array.isArray(res.list) ? res.list.filter((s) => s.status !== 'banned') : []
      if (results.length === 0) {
        const exactRes = await api.get<{ list: ShopSearchResult[] }>(
          `/api/shops?shop=${encodeURIComponent(keyword)}`,
        )
        results = Array.isArray(exactRes.list) ? exactRes.list : []
      }
      setShopSearchResults(results)
      if (results.length === 0) {
        actionError('未找到匹配的店铺，请检查 ID 或名称')
      }
    } catch (e) {
      actionError(e, '搜索店铺失败')
      setShopSearchResults([])
    } finally {
      setShopSearchLoading(false)
    }
  }, [shopSearchInput, actionError])

  const selectShop = (shop: ShopSearchResult) => {
    setSelectedShop(shop)
    setShopSearchResults([])
  }

  const clearSelectedShop = () => {
    setSelectedShop(null)
  }

  useEffect(() => {
    if (selectedId) {
      fetchMetrics(selectedId)
      const item = list.find((row) => row.id === selectedId)
      if (item) syncCampaignConfigFromPromotion(item)
    } else {
      setMetrics([])
      setMetricsSummary(null)
    }
  }, [selectedId, fetchMetrics, list, syncCampaignConfigFromPromotion])

  const performCreate = () => {
    if (!selectedShop?.id) return
    setCreating(true)
    api
      .post('/api/admin/paid-promotions', {
        shopId: selectedShop.id,
        channel: createForm.channel,
        adminNote: createForm.adminNote.trim() || undefined,
      })
      .then(() => {
        actionSuccess('已创建付费推广资格，等待商家配置')
        setCreateForm({ channel: 'tiktok', adminNote: '' })
        setSelectedShop(null)
        setShopSearchInput('')
        setShopSearchResults([])
        fetchList()
      })
      .catch((e) => actionError(e, '开启失败'))
      .finally(() => setCreating(false))
  }

  const handleCreate = () => {
    if (!selectedShop?.id) {
      actionError('请先搜索并选择店铺')
      return
    }
    requestEditConfirm({
      title: '创建付费推广',
      message: `确认为店铺「${selectedShop.name}（${selectedShop.id}）」创建付费推广资格？商家配置后可由您开启投放。`,
      confirmLabel: '确认创建',
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

  const buildCampaignPayload = () => ({
    durationDays: Number(campaignConfig.durationDays),
    budgetTotal: Number(campaignConfig.budgetTotal),
    impressions: Number(campaignConfig.impressions),
    clickRate: Number(campaignConfig.clickRate),
    visits: Number(campaignConfig.visits),
    orders: Number(campaignConfig.orders),
    revenue: Number(campaignConfig.revenue),
  })

  const performLaunch = () => {
    if (!selectedId) return
    setLaunching(true)
    api
      .post(`/api/admin/paid-promotions/${selectedId}/launch`, buildCampaignPayload())
      .then(() => {
        actionSuccess('推广已开启，系统将按设定智能消耗预算并释放数据')
        fetchList()
        fetchMetrics(selectedId)
      })
      .catch((e: unknown) => actionError(e, '开启失败'))
      .finally(() => setLaunching(false))
  }

  const handleLaunch = () => {
    if (!selectedId || !selected) return
    const payload = buildCampaignPayload()
    if (!payload.durationDays || !payload.budgetTotal || !payload.impressions) {
      actionError('请填写投放时长、总预算与总曝光')
      return
    }
    requestEditConfirm({
      title: '开启推广',
      message: `确认按当前配置为「${selected.shopName ?? selected.shopId}」开启推广？投放期间将不规则释放数据，结束时与预设完全一致。`,
      confirmLabel: '开启推广',
      onConfirm: performLaunch,
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
        <div className="admin-paid-promotions-shop-search">
          <label className="admin-field admin-field--search">
            <span>搜索店铺</span>
            <div className="admin-paid-promotions-search-row">
              <input
                type="text"
                value={shopSearchInput}
                onChange={(e) => setShopSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    searchShops()
                  }
                }}
                placeholder="输入店铺 ID 或店铺名称"
              />
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={searchShops}
                disabled={shopSearchLoading}
              >
                {shopSearchLoading ? '搜索中…' : '搜索'}
              </button>
            </div>
          </label>

          {shopSearchResults.length > 0 ? (
            <ul className="admin-paid-promotions-shop-results">
              {shopSearchResults.map((shop) => (
                <li key={shop.id}>
                  <button
                    type="button"
                    className="admin-paid-promotions-shop-result"
                    onClick={() => selectShop(shop)}
                  >
                    <span className="admin-paid-promotions-shop-result-name">{shop.name}</span>
                    <span className="admin-paid-promotions-shop-result-meta">
                      {shop.id}
                      {shop.ownerAccount ? ` · 店主 ${shop.ownerAccount}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {selectedShop ? (
            <div className="admin-paid-promotions-selected-shop">
              <div>
                <span className="admin-paid-promotions-selected-shop-label">已选店铺</span>
                <strong>{selectedShop.name}</strong>
                <span className="admin-paid-promotions-selected-shop-id">{selectedShop.id}</span>
              </div>
              <button type="button" className="admin-btn admin-btn--sm admin-btn--ghost" onClick={clearSelectedShop}>
                重新选择
              </button>
            </div>
          ) : (
            <p className="admin-paid-promotions-shop-hint">搜索并选择店铺后，再选择推广渠道并开启。</p>
          )}
        </div>

        <div className="admin-paid-promotions-create-grid">
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
            disabled={creating || !selectedShop}
          >
            {creating ? '创建中…' : '创建推广资格'}
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
                        {item.targetRegion ? (
                          <div className="admin-table-sub">
                            {REGION_LABEL[item.targetRegion] ?? item.targetRegion}
                            {item.targetAudience ? ` · ${AUDIENCE_LABEL[item.targetAudience] ?? item.targetAudience}` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="admin-table-actions">
                          {needsCampaignConfig(item) ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--primary"
                              onClick={() => setSelectedId(item.id)}
                            >
                              配置投放
                            </button>
                          ) : null}
                          {item.status === 'active' && hasLaunchedCampaign(item) && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm"
                              onClick={() => updateStatus(item.id, 'paused')}
                            >
                              暂停
                            </button>
                          )}
                          {item.status === 'active' && hasLaunchedCampaign(item) && (
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
          <h2 className="admin-card-title">投放配置与智能消耗</h2>
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
                {selected.targetRegion ? (
                  <div>
                    地区 / 受众：{REGION_LABEL[selected.targetRegion] ?? selected.targetRegion}
                    {selected.targetAudience ? ` · ${AUDIENCE_LABEL[selected.targetAudience] ?? selected.targetAudience}` : ''}
                  </div>
                ) : null}
                {selected.adminNote ? <div>备注：{selected.adminNote}</div> : null}
              </div>

              {needsCampaignConfig(selected) ? (
                <div className="admin-paid-promotions-config-panel">
                  <p className="admin-paid-promotions-config-hint">
                    商家已确认推广方案，请填写投放参数后点击「开启推广」。
                  </p>
                <div className="admin-paid-promotions-config-grid">
                  <label className="admin-field">
                    <span>投放时长（天）</span>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={campaignConfig.durationDays}
                      onChange={(e) => setCampaignConfig((prev) => ({ ...prev, durationDays: e.target.value }))}
                    />
                  </label>
                  <label className="admin-field">
                    <span>总预算 ($)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={campaignConfig.budgetTotal}
                      onChange={(e) => setCampaignConfig((prev) => ({ ...prev, budgetTotal: e.target.value }))}
                    />
                  </label>
                  <label className="admin-field">
                    <span>总曝光</span>
                    <input
                      type="number"
                      min={0}
                      value={campaignConfig.impressions}
                      onChange={(e) => setCampaignConfig((prev) => ({ ...prev, impressions: e.target.value }))}
                    />
                  </label>
                  <label className="admin-field">
                    <span>点击率 (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={campaignConfig.clickRate}
                      onChange={(e) => setCampaignConfig((prev) => ({ ...prev, clickRate: e.target.value }))}
                    />
                  </label>
                  <label className="admin-field">
                    <span>总进店</span>
                    <input
                      type="number"
                      min={0}
                      value={campaignConfig.visits}
                      onChange={(e) => setCampaignConfig((prev) => ({ ...prev, visits: e.target.value }))}
                    />
                  </label>
                  <label className="admin-field">
                    <span>总成交</span>
                    <input
                      type="number"
                      min={0}
                      value={campaignConfig.orders}
                      onChange={(e) => setCampaignConfig((prev) => ({ ...prev, orders: e.target.value }))}
                    />
                  </label>
                  <label className="admin-field admin-field--wide">
                    <span>总成交额 ($)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={campaignConfig.revenue}
                      onChange={(e) => setCampaignConfig((prev) => ({ ...prev, revenue: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary admin-paid-promotions-launch-btn"
                    onClick={handleLaunch}
                    disabled={launching}
                  >
                    {launching ? '开启中…' : '开启推广'}
                  </button>
                </div>
                </div>
              ) : selected.status === 'pending' ? (
                <p className="admin-paid-promotions-placeholder">
                  等待商家在仪表盘选择推广目标、地区与受众并确认。
                </p>
              ) : (selected.status === 'active' || selected.status === 'completed') && hasLaunchedCampaign(selected) ? (
                <>
                  {metricsSummary ? (
                    <div className="admin-paid-promotions-live-summary">
                      <span>预算消耗：{Math.round((metricsSummary.budgetProgress ?? 0) * 100)}%</span>
                      <span>投放进度：{Math.round((metricsSummary.campaignProgress ?? 0) * 100)}%</span>
                    </div>
                  ) : null}
                  <div className="admin-paid-promotions-metrics-table-wrap">
                    <table className="admin-table admin-paid-promotions-metrics-table">
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>曝光</th>
                          <th>点击</th>
                          <th>进店</th>
                          <th>成交</th>
                          <th>消耗</th>
                          <th>成交额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="admin-table-empty">暂无已释放数据</td>
                          </tr>
                        ) : (
                          metrics.map((row) => (
                            <tr key={row.date}>
                              <td>{formatDateLabel(row.date)}</td>
                              <td>{row.impressions}</td>
                              <td>{row.clicks}</td>
                              <td>{row.visits}</td>
                              <td>{row.orders}</td>
                              <td>${row.spend.toFixed(2)}</td>
                              <td>${row.revenue.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="admin-paid-promotions-placeholder">当前状态无需配置投放。</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default AdminPaidPromotions

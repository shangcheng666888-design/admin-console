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
  ownerAccount: string | null
  channel: PaidChannel
  status: PromoStatus
  targetType: TargetType
  targetListingId: string | null
  targetProductTitle: string | null
  targetRegion: string | null
  targetAudience: string | null
  adminNote: string | null
  campaignDurationDays: number | null
  campaignDurationValue: number | null
  campaignDurationUnit: 'minute' | 'hour' | 'day' | null
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
  createdAt: string
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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function formatTargetLabel(item: PromotionRow): string {
  if (item.targetType === 'product') return item.targetProductTitle ?? `商品 ${item.targetListingId ?? ''}`
  if (item.targetType === 'shop') return '整店推广'
  return '待商家选择'
}

function formatMerchantConfig(item: PromotionRow): string {
  const parts: string[] = [formatTargetLabel(item)]
  if (item.targetRegion) parts.push(REGION_LABEL[item.targetRegion] ?? item.targetRegion)
  if (item.targetAudience) parts.push(AUDIENCE_LABEL[item.targetAudience] ?? item.targetAudience)
  return parts.join(' · ')
}

function formatCampaignConfig(item: PromotionRow): string {
  if (!item.campaignStartAt && item.budgetTotal == null) return '—'
  const parts: string[] = []
  if (item.campaignDurationValue) {
    parts.push(formatDurationLabel(item.campaignDurationValue, item.campaignDurationUnit))
  }
  if (item.budgetTotal != null) parts.push(`$${item.budgetTotal.toFixed(2)}`)
  if (item.presetImpressions != null) parts.push(`${item.presetImpressions.toLocaleString()} 曝光`)
  if (item.presetClicks != null) parts.push(`${item.presetClicks.toLocaleString()} 点击`)
  if (item.presetVisits != null) parts.push(`${item.presetVisits.toLocaleString()} 进店`)
  return parts.join(' · ')
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDurationLabel(value: number | null, unit: PromotionRow['campaignDurationUnit']) {
  if (!value) return '—'
  if (unit === 'minute') return `${value} 分钟`
  if (unit === 'hour') return `${value} 小时`
  return `${value} 天`
}

function formatRemainingTime(remainingMs: number, isSettling: boolean) {
  if (isSettling) return '已到结算时间'
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `剩余 ${days} 天 ${hours} 小时`
  if (hours > 0) return `剩余 ${hours} 小时 ${minutes} 分钟`
  if (minutes > 0) return `剩余 ${minutes} 分钟`
  return '剩余不足 1 分钟'
}

function progressPct(current: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.round((current / total) * 100))
}

interface RunningCampaignItem {
  promotion: PromotionRow
  metrics: {
    totals?: MetricPoint
    presets?: MetricPoint
    campaignProgress?: number
    budgetProgress?: number
    isCompleted?: boolean
  }
  remainingMs: number
  remainingSeconds: number
  isSettling: boolean
}

interface PromotionRecordItem {
  promotion: PromotionRow
  metricsSummary: {
    totals?: MetricPoint
    presets?: MetricPoint
    campaignProgress?: number
    budgetProgress?: number
    isCompleted?: boolean
  } | null
}

const AdminPaidPromotions: React.FC = () => {
  const { loadError, actionSuccess, actionError } = useAdminToast()
  const { requestEditConfirm } = useAdminEditConfirm()

  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [records, setRecords] = useState<PromotionRecordItem[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | PromoStatus>('all')
  const [recordSearch, setRecordSearch] = useState('')
  const [recordSearchInput, setRecordSearchInput] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [metrics, setMetrics] = useState<MetricPoint[]>([])
  const [metricsSummary, setMetricsSummary] = useState<{
    campaignProgress?: number
    budgetProgress?: number
    totals?: MetricPoint
    presets?: MetricPoint
  } | null>(null)
  const [campaignConfig, setCampaignConfig] = useState({
    durationValue: '7',
    durationUnit: 'day' as 'minute' | 'hour' | 'day',
    budgetTotal: '',
    impressions: '',
    clicks: '',
    visits: '',
  })
  const [shopSearchInput, setShopSearchInput] = useState('')
  const [shopSearchLoading, setShopSearchLoading] = useState(false)
  const [shopSearchResults, setShopSearchResults] = useState<ShopSearchResult[]>([])
  const [selectedShop, setSelectedShop] = useState<ShopSearchResult | null>(null)
  const [createForm, setCreateForm] = useState({
    channel: 'tiktok' as PaidChannel,
    adminNote: '',
  })
  const [runningCampaigns, setRunningCampaigns] = useState<RunningCampaignItem[]>([])
  const [runningLoading, setRunningLoading] = useState(false)

  const selected = useMemo(
    () => records.find((item) => item.promotion.id === selectedId)?.promotion ?? null,
    [records, selectedId],
  )

  const selectedRecord = useMemo(
    () => records.find((item) => item.promotion.id === selectedId) ?? null,
    [records, selectedId],
  )

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (recordSearch.trim()) params.set('search', recordSearch.trim())
      const query = params.toString()
      try {
        const res = await api.get<{ list: PromotionRecordItem[] }>(
          `/api/admin/paid-promotions/records${query ? `?${query}` : ''}`,
        )
        setRecords(Array.isArray(res.list) ? res.list : [])
      } catch (recordsError) {
        const legacyRes = await api.get<{ list: PromotionRow[] }>(
          `/api/admin/paid-promotions${query ? `?${query}` : ''}`,
        )
        const legacyList = Array.isArray(legacyRes.list) ? legacyRes.list : []
        setRecords(legacyList.map((promotion) => ({ promotion, metricsSummary: null })))
        if (legacyList.length === 0 && recordsError) {
          throw recordsError
        }
      }
    } catch (e) {
      loadError(e, '加载推广记录失败')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [loadError, statusFilter, recordSearch])

  const syncCampaignConfigFromPromotion = useCallback((promotion: PromotionRow) => {
    setCampaignConfig({
      durationValue: String(promotion.campaignDurationValue ?? promotion.campaignDurationDays ?? 7),
      durationUnit: promotion.campaignDurationUnit ?? 'day',
      budgetTotal: promotion.budgetTotal != null ? String(promotion.budgetTotal) : '',
      impressions: promotion.presetImpressions != null ? String(promotion.presetImpressions) : '',
      clicks: promotion.presetClicks != null ? String(promotion.presetClicks) : '',
      visits: promotion.presetVisits != null ? String(promotion.presetVisits) : '',
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

  const fetchRunningCampaigns = useCallback(async () => {
    setRunningLoading(true)
    try {
      const res = await api.get<{ list: RunningCampaignItem[] }>('/api/admin/paid-promotions/running')
      setRunningCampaigns(Array.isArray(res.list) ? res.list : [])
    } catch (e) {
      loadError(e, '加载投放中列表失败')
      setRunningCampaigns([])
    } finally {
      setRunningLoading(false)
    }
  }, [loadError])

  useEffect(() => {
    fetchRecords()
    fetchRunningCampaigns()
    const timer = window.setInterval(fetchRunningCampaigns, 10000)
    return () => window.clearInterval(timer)
  }, [fetchRecords, fetchRunningCampaigns])

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
      const item = records.find((row) => row.promotion.id === selectedId)?.promotion
      if (item) syncCampaignConfigFromPromotion(item)
    } else {
      setMetrics([])
      setMetricsSummary(null)
    }
  }, [selectedId, fetchMetrics, records, syncCampaignConfigFromPromotion])

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
        fetchRecords()
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
        fetchRecords()
        fetchRunningCampaigns()
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
    durationValue: Number(campaignConfig.durationValue),
    durationUnit: campaignConfig.durationUnit,
    budgetTotal: Number(campaignConfig.budgetTotal),
    impressions: Number(campaignConfig.impressions),
    clicks: Number(campaignConfig.clicks),
    visits: Number(campaignConfig.visits),
  })

  const durationMax = campaignConfig.durationUnit === 'minute' ? 1440 : campaignConfig.durationUnit === 'hour' ? 2160 : 90

  const performLaunch = () => {
    if (!selectedId) return
    setLaunching(true)
    api
      .post(`/api/admin/paid-promotions/${selectedId}/launch`, buildCampaignPayload())
      .then(() => {
        actionSuccess('推广已开启，系统将按设定智能消耗预算并释放数据')
        fetchRecords()
        fetchRunningCampaigns()
        fetchMetrics(selectedId)
      })
      .catch((e: unknown) => actionError(e, '开启失败'))
      .finally(() => setLaunching(false))
  }

  const handleLaunch = () => {
    if (!selectedId || !selected) return
    const payload = buildCampaignPayload()
    if (!payload.durationValue || !payload.budgetTotal || !payload.impressions) {
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

  if (loading && records.length === 0) {
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

      <section className="admin-card admin-paid-promotions-running">
        <div className="admin-paid-promotions-running-head">
          <div>
            <h2 className="admin-card-title">投放中监控</h2>
            <p className="admin-paid-promotions-running-desc">
              查看已开启推广的实时进度、配置参数与距离结算的剩余时间。
            </p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--sm admin-btn--ghost"
            onClick={fetchRunningCampaigns}
            disabled={runningLoading}
          >
            {runningLoading ? '刷新中…' : '刷新'}
          </button>
        </div>

        {runningCampaigns.length === 0 ? (
          <p className="admin-paid-promotions-placeholder">当前没有投放中的推广</p>
        ) : (
          <div className="admin-paid-promotions-running-grid">
            {runningCampaigns.map((item) => {
              const promo = item.promotion
              const totals = item.metrics.totals
              const presets = item.metrics.presets
              const impressionsCurrent = totals?.impressions ?? 0
              const clicksCurrent = totals?.clicks ?? 0
              const visitsCurrent = totals?.visits ?? 0
              const spendCurrent = totals?.spend ?? 0
              const impressionsTarget = presets?.impressions ?? promo.presetImpressions ?? 0
              const clicksTarget = presets?.clicks ?? promo.presetClicks ?? 0
              const visitsTarget = presets?.visits ?? promo.presetVisits ?? 0
              const budgetTarget = presets?.spend ?? promo.budgetTotal ?? 0
              const campaignPct = Math.round((item.metrics.campaignProgress ?? 0) * 100)
              const budgetPct = Math.round((item.metrics.budgetProgress ?? 0) * 100)
              const clickRate =
                impressionsCurrent > 0 ? Math.round((clicksCurrent / impressionsCurrent) * 1000) / 10 : 0

              return (
                <article key={promo.id} className="admin-paid-promotions-running-card">
                  <header className="admin-paid-promotions-running-card-head">
                    <div>
                      <strong>{promo.shopName ?? promo.shopId}</strong>
                      <span className="admin-paid-promotions-running-card-sub">
                        {CHANNEL_OPTIONS.find((c) => c.value === promo.channel)?.label} · {promo.shopId}
                      </span>
                    </div>
                    <span
                      className={`admin-paid-promotions-running-timer${item.isSettling ? ' admin-paid-promotions-running-timer--due' : ''}`}
                    >
                      {formatRemainingTime(item.remainingMs, item.isSettling)}
                    </span>
                  </header>

                  <div className="admin-paid-promotions-running-config">
                    <div>
                      <span>投放时长</span>
                      <strong>{formatDurationLabel(promo.campaignDurationValue, promo.campaignDurationUnit)}</strong>
                    </div>
                    <div>
                      <span>总预算</span>
                      <strong>${budgetTarget.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span>总曝光</span>
                      <strong>{impressionsTarget.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>总点击</span>
                      <strong>{clicksTarget.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>总进店</span>
                      <strong>{visitsTarget.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>推广目标</span>
                      <strong>
                        {promo.targetType === 'product'
                          ? promo.targetProductTitle ?? '单品'
                          : promo.targetType === 'shop'
                            ? '整店'
                            : '—'}
                      </strong>
                    </div>
                    <div>
                      <span>投放地区</span>
                      <strong>{promo.targetRegion ?? '—'}</strong>
                    </div>
                    <div>
                      <span>目标受众</span>
                      <strong>{promo.targetAudience ?? '—'}</strong>
                    </div>
                  </div>

                  <div className="admin-paid-promotions-running-progress-block">
                    <div className="admin-paid-promotions-running-progress-row">
                      <span>投放进度</span>
                      <strong>{campaignPct}%</strong>
                    </div>
                    <div className="admin-paid-promotions-running-bar">
                      <span style={{ width: `${campaignPct}%` }} />
                    </div>
                  </div>

                  <div className="admin-paid-promotions-running-progress-block">
                    <div className="admin-paid-promotions-running-progress-row">
                      <span>预算消耗</span>
                      <strong>
                        {budgetPct}% · ${spendCurrent.toFixed(2)} / ${budgetTarget.toFixed(2)}
                      </strong>
                    </div>
                    <div className="admin-paid-promotions-running-bar admin-paid-promotions-running-bar--budget">
                      <span style={{ width: `${budgetPct}%` }} />
                    </div>
                  </div>

                  <div className="admin-paid-promotions-running-live">
                    <div>
                      <span>曝光</span>
                      <strong>
                        {impressionsCurrent.toLocaleString()} / {impressionsTarget.toLocaleString()}
                      </strong>
                      <em>{progressPct(impressionsCurrent, impressionsTarget)}%</em>
                    </div>
                    <div>
                      <span>点击</span>
                      <strong>
                        {clicksCurrent.toLocaleString()} / {clicksTarget.toLocaleString()}
                      </strong>
                      <em>{progressPct(clicksCurrent, clicksTarget)}%</em>
                    </div>
                    <div>
                      <span>进店</span>
                      <strong>
                        {visitsCurrent.toLocaleString()} / {visitsTarget.toLocaleString()}
                      </strong>
                      <em>{progressPct(visitsCurrent, visitsTarget)}%</em>
                    </div>
                    <div>
                      <span>点击率</span>
                      <strong>{clickRate}%</strong>
                      <em>自动计算</em>
                    </div>
                  </div>

                  <div className="admin-paid-promotions-running-foot">
                    <span>
                      开始：{promo.campaignStartAt ? new Date(promo.campaignStartAt).toLocaleString() : '—'}
                    </span>
                    <span>
                      结算：{promo.campaignEndAt ? new Date(promo.campaignEndAt).toLocaleString() : '—'}
                    </span>
                    <button
                      type="button"
                      className="admin-btn admin-btn--sm"
                      onClick={() => setSelectedId(promo.id)}
                    >
                      查看明细
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

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
            <div>
              <h2 className="admin-card-title">推广记录</h2>
              <p className="admin-paid-promotions-records-desc">
                查看各会员店铺的付费推广记录、商家配置与投放参数。
              </p>
            </div>
            <div className="admin-paid-promotions-records-filters">
              <input
                type="search"
                className="admin-paid-promotions-records-search"
                value={recordSearchInput}
                onChange={(e) => setRecordSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setRecordSearch(recordSearchInput.trim())
                  }
                }}
                placeholder="搜索店铺 / 会员账号"
              />
              <button
                type="button"
                className="admin-btn admin-btn--sm"
                onClick={() => setRecordSearch(recordSearchInput.trim())}
              >
                搜索
              </button>
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
          </div>
          <div className="admin-paid-promotions-table-wrap admin-paid-promotions-records-table-wrap">
            <table className="admin-table admin-paid-promotions-records-table">
              <thead>
                <tr>
                  <th>创建时间</th>
                  <th>店铺 / 会员</th>
                  <th>渠道</th>
                  <th>状态</th>
                  <th>商家配置</th>
                  <th>投放配置</th>
                  <th>实际效果</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-table-empty">
                      暂无推广记录
                    </td>
                  </tr>
                ) : (
                  records.map(({ promotion: item, metricsSummary }) => {
                    const totals = metricsSummary?.totals
                    const presets = metricsSummary?.presets
                    return (
                      <tr
                        key={item.id}
                        className={selectedId === item.id ? 'admin-table-row--active' : ''}
                      >
                        <td>
                          <div>{formatDateTime(item.createdAt)}</div>
                          {item.merchantConfirmedAt ? (
                            <div className="admin-table-sub">
                              确认：{formatDateTime(item.merchantConfirmedAt)}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-link-btn"
                            onClick={() => setSelectedId(item.id)}
                          >
                            {item.shopName ?? item.shopId}
                          </button>
                          <div className="admin-table-sub">{item.shopId}</div>
                          {item.ownerAccount ? (
                            <div className="admin-table-sub">会员 {item.ownerAccount}</div>
                          ) : null}
                        </td>
                        <td>{CHANNEL_OPTIONS.find((c) => c.value === item.channel)?.label ?? item.channel}</td>
                        <td>
                          <span className={`admin-badge admin-badge--${item.status}`}>
                            {STATUS_LABEL[item.status]}
                          </span>
                        </td>
                        <td>
                          <div>{formatMerchantConfig(item)}</div>
                          {item.merchantConfirmedAt ? (
                            <div className="admin-table-sub">
                              确认于 {formatDateTime(item.merchantConfirmedAt)}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div>{formatCampaignConfig(item)}</div>
                          {item.campaignStartAt ? (
                            <div className="admin-table-sub">
                              {formatDateTime(item.campaignStartAt)} — {formatDateTime(item.campaignEndAt)}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {metricsSummary && totals ? (
                            <>
                              <div>
                                曝光 {totals.impressions.toLocaleString()}
                                {presets?.impressions ? ` / ${presets.impressions.toLocaleString()}` : ''}
                              </div>
                              <div className="admin-table-sub">
                                点击 {totals.clicks.toLocaleString()} · 进店 {totals.visits.toLocaleString()} · $
                                {totals.spend.toFixed(2)}
                              </div>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <div className="admin-table-actions">
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--ghost"
                              onClick={() => setSelectedId(item.id)}
                            >
                              详情
                            </button>
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
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card admin-paid-promotions-control">
          <h2 className="admin-card-title">记录详情</h2>
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
                {selected.ownerAccount ? <div>会员账号：{selected.ownerAccount}</div> : null}
                <div>店铺 ID：{selected.shopId}</div>
                <div>创建时间：{formatDateTime(selected.createdAt)}</div>
                {selected.adminNote ? <div>管理员备注：{selected.adminNote}</div> : null}
              </div>

              <div className="admin-paid-promotions-config-detail">
                <h3 className="admin-paid-promotions-config-detail-title">商家配置</h3>
                <dl className="admin-paid-promotions-config-dl">
                  <div>
                    <dt>推广目标</dt>
                    <dd>{formatTargetLabel(selected)}</dd>
                  </div>
                  <div>
                    <dt>投放地区</dt>
                    <dd>
                      {selected.targetRegion
                        ? REGION_LABEL[selected.targetRegion] ?? selected.targetRegion
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>目标受众</dt>
                    <dd>
                      {selected.targetAudience
                        ? AUDIENCE_LABEL[selected.targetAudience] ?? selected.targetAudience
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>商家确认时间</dt>
                    <dd>{formatDateTime(selected.merchantConfirmedAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="admin-paid-promotions-config-detail">
                <h3 className="admin-paid-promotions-config-detail-title">投放配置</h3>
                <dl className="admin-paid-promotions-config-dl">
                  <div>
                    <dt>投放时长</dt>
                    <dd>{formatDurationLabel(selected.campaignDurationValue, selected.campaignDurationUnit)}</dd>
                  </div>
                  <div>
                    <dt>总预算</dt>
                    <dd>{selected.budgetTotal != null ? `$${selected.budgetTotal.toFixed(2)}` : '—'}</dd>
                  </div>
                  <div>
                    <dt>总曝光 / 点击 / 进店</dt>
                    <dd>
                      {selected.presetImpressions != null
                        ? `${selected.presetImpressions.toLocaleString()} / ${(selected.presetClicks ?? 0).toLocaleString()} / ${(selected.presetVisits ?? 0).toLocaleString()}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>投放时段</dt>
                    <dd>
                      {selected.campaignStartAt
                        ? `${formatDateTime(selected.campaignStartAt)} — ${formatDateTime(selected.campaignEndAt)}`
                        : '尚未开启'}
                    </dd>
                  </div>
                </dl>
              </div>

              {needsCampaignConfig(selected) ? (
                <div className="admin-paid-promotions-config-panel">
                  <p className="admin-paid-promotions-config-hint">
                    商家已确认推广方案，请填写投放参数后点击「开启推广」。
                  </p>
                <div className="admin-paid-promotions-config-grid">
                  <label className="admin-field admin-field--duration">
                    <span>投放时长</span>
                    <div className="admin-paid-promotions-duration-row">
                      <input
                        type="number"
                        min={1}
                        max={durationMax}
                        value={campaignConfig.durationValue}
                        onChange={(e) => setCampaignConfig((prev) => ({ ...prev, durationValue: e.target.value }))}
                      />
                      <select
                        value={campaignConfig.durationUnit}
                        onChange={(e) =>
                          setCampaignConfig((prev) => ({
                            ...prev,
                            durationUnit: e.target.value as 'minute' | 'hour' | 'day',
                          }))
                        }
                      >
                        <option value="minute">分钟</option>
                        <option value="hour">小时</option>
                        <option value="day">天</option>
                      </select>
                    </div>
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
                    <span>总点击</span>
                    <input
                      type="number"
                      min={0}
                      value={campaignConfig.clicks}
                      onChange={(e) => setCampaignConfig((prev) => ({ ...prev, clicks: e.target.value }))}
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
              ) : hasLaunchedCampaign(selected) ? (
                <>
                  {metricsSummary || selectedRecord?.metricsSummary ? (
                    <div className="admin-paid-promotions-live-summary">
                      <span>
                        预算消耗：
                        {Math.round(
                          ((metricsSummary ?? selectedRecord?.metricsSummary)?.budgetProgress ?? 0) * 100,
                        )}
                        %
                      </span>
                      <span>
                        投放进度：
                        {Math.round(
                          ((metricsSummary ?? selectedRecord?.metricsSummary)?.campaignProgress ?? 0) * 100,
                        )}
                        %
                      </span>
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

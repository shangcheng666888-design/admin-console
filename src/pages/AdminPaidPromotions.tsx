import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, apiBase } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import { useAdminEditConfirm } from '../context/AdminEditConfirmContext'
import AdminLoadingState from '../components/admin/AdminLoadingState'
import paidTiktok from '../assets/paid-tiktok.png'
import paidMeta from '../assets/paid-meta.png'
import paidGoogle from '../assets/paid-google.png'

type PaidChannel = 'tiktok' | 'meta' | 'google' | 'other'
type PromoStatus = 'pending' | 'awaiting_launch' | 'active' | 'paused' | 'ended' | 'completed'
type TargetType = 'shop' | 'product' | null

interface PromotionRow {
  id: number
  shopId: string
  shopName: string | null
  shopLogo: string | null
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
  logo?: string | null
  ownerAccount?: string
  status?: string
}

function resolveShopLogoUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return ''
  const value = url.trim()
  if (!value || value.startsWith('http://') || value.startsWith('https://')) return value
  return apiBase ? `${apiBase.replace(/\/$/, '')}${value.startsWith('/') ? '' : '/'}${value}` : value
}

function shopDisplayName(item: Pick<PromotionRow, 'shopName' | 'shopId'>): string {
  return item.shopName ?? item.shopId
}

const CHANNEL_OPTIONS: { value: PaidChannel; label: string; icon?: string }[] = [
  { value: 'tiktok', label: 'TikTok', icon: paidTiktok },
  { value: 'meta', label: 'Meta', icon: paidMeta },
  { value: 'google', label: 'Google', icon: paidGoogle },
  { value: 'other', label: '其他' },
]

const CHANNEL_META: Record<PaidChannel, { label: string; icon?: string }> = {
  tiktok: { label: 'TikTok', icon: paidTiktok },
  meta: { label: 'Meta', icon: paidMeta },
  google: { label: 'Google', icon: paidGoogle },
  other: { label: '其他' },
}

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

function ChannelBadge({ channel }: { channel: PaidChannel }) {
  const meta = CHANNEL_META[channel]
  return (
    <span className={`admin-pp-channel admin-pp-channel--${channel}`}>
      {meta.icon ? <img src={meta.icon} alt="" className="admin-pp-channel-icon" /> : null}
      <span>{meta.label}</span>
    </span>
  )
}

function StatusBadge({ status }: { status: PromoStatus }) {
  return <span className={`admin-badge admin-badge--${status}`}>{STATUS_LABEL[status]}</span>
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'indigo' | 'emerald' | 'amber' | 'sky'
}) {
  return (
    <div className={`admin-pp-stat admin-pp-stat--${tone}`}>
      <span className="admin-pp-stat-value">{value.toLocaleString()}</span>
      <span className="admin-pp-stat-label">{label}</span>
    </div>
  )
}

function ShopAvatar({
  name,
  logo,
  size = 'md',
}: {
  name: string
  logo?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const url = resolveShopLogoUrl(logo)
  const initial = (name || '?').slice(0, 1).toUpperCase()
  const showImage = Boolean(url) && !imgFailed

  return (
    <span className={`admin-pp-shop-avatar admin-pp-shop-avatar--${size}`} aria-hidden="true">
      {showImage ? (
        <img src={url} alt="" onError={() => setImgFailed(true)} />
      ) : (
        <span className="admin-pp-shop-avatar-fallback">{initial}</span>
      )}
    </span>
  )
}

async function enrichRecordsWithShopLogos(items: PromotionRecordItem[]): Promise<PromotionRecordItem[]> {
  const shopIds = [
    ...new Set(
      items
        .filter(({ promotion }) => !resolveShopLogoUrl(promotion.shopLogo))
        .map(({ promotion }) => promotion.shopId),
    ),
  ]
  if (shopIds.length === 0) return items

  const logoByShop = new Map<string, string>()
  await Promise.all(
    shopIds.map(async (shopId) => {
      try {
        const res = await api.get<{ list: Array<{ id: string; logo?: string | null }> }>(
          `/api/shops?shop=${encodeURIComponent(shopId)}`,
        )
        const logo = res.list?.[0]?.logo
        if (logo) logoByShop.set(shopId, logo)
      } catch {
        /* ignore single shop lookup failures */
      }
    }),
  )

  if (logoByShop.size === 0) return items
  return items.map((item) => {
    if (resolveShopLogoUrl(item.promotion.shopLogo)) return item
    const logo = logoByShop.get(item.promotion.shopId) ?? null
    if (!logo) return item
    return { ...item, promotion: { ...item.promotion, shopLogo: logo } }
  })
}

function PromotionListItem({
  item,
  metricsSummary,
  selected,
  onSelect,
  onConfigure,
  onPause,
  onEnd,
}: {
  item: PromotionRow
  metricsSummary: PromotionRecordItem['metricsSummary']
  selected: boolean
  onSelect: () => void
  onConfigure: () => void
  onPause: () => void
  onEnd: () => void
}) {
  const totals = metricsSummary?.totals
  const name = shopDisplayName(item)

  return (
    <article
      className={`admin-pp-list-item${selected ? ' admin-pp-list-item--active' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="admin-pp-list-col admin-pp-list-col--avatar">
        <ShopAvatar name={name} logo={item.shopLogo} size="lg" />
      </div>
      <div className="admin-pp-list-col admin-pp-list-col--shop">
        <div className="admin-pp-list-shop-copy">
          <strong className="admin-pp-list-shop-name">{name}</strong>
          <code className="admin-pp-list-shop-id">{item.shopId}</code>
          <span className="admin-pp-list-owner">
            店主 {item.ownerAccount?.trim() || '—'}
          </span>
        </div>
      </div>

      <div className="admin-pp-list-col admin-pp-list-col--status">
        <StatusBadge status={item.status} />
        <ChannelBadge channel={item.channel} />
        <time className="admin-pp-list-time">{formatDateTime(item.createdAt)}</time>
      </div>

      <div className="admin-pp-list-col admin-pp-list-col--config">
        <span className="admin-pp-list-tag">{formatTargetLabel(item)}</span>
        {item.targetRegion ? (
          <span className="admin-pp-list-tag admin-pp-list-tag--muted">
            {REGION_LABEL[item.targetRegion] ?? item.targetRegion}
          </span>
        ) : null}
        {item.budgetTotal != null ? (
          <span className="admin-pp-list-tag admin-pp-list-tag--budget">
            ${item.budgetTotal.toFixed(2)}
          </span>
        ) : null}
      </div>

      <div className="admin-pp-list-col admin-pp-list-col--metrics">
        {totals ? (
          <>
            <div className="admin-pp-list-metric">
              <em>进店</em>
              <strong>{totals.visits.toLocaleString()}</strong>
            </div>
            <div className="admin-pp-list-metric">
              <em>消耗</em>
              <strong>${totals.spend.toFixed(2)}</strong>
            </div>
          </>
        ) : (
          <span className="admin-pp-list-metrics-empty">暂无投放数据</span>
        )}
      </div>

      <div
        className="admin-pp-list-col admin-pp-list-col--actions"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="admin-pp-list-action" onClick={onSelect}>
          详情
        </button>
        {needsCampaignConfig(item) ? (
          <button type="button" className="admin-pp-list-action admin-pp-list-action--primary" onClick={onConfigure}>
            配置
          </button>
        ) : null}
        {item.status === 'active' && hasLaunchedCampaign(item) ? (
          <>
            <button type="button" className="admin-pp-list-action" onClick={onPause}>
              暂停
            </button>
            <button type="button" className="admin-pp-list-action admin-pp-list-action--ghost" onClick={onEnd}>
              结束
            </button>
          </>
        ) : null}
      </div>
    </article>
  )
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

  const pageStats = useMemo(
    () => ({
      total: records.length,
      running: runningCampaigns.length,
      active: records.filter((item) => item.promotion.status === 'active').length,
      awaiting: records.filter((item) => item.promotion.status === 'awaiting_launch').length,
      pending: records.filter((item) => item.promotion.status === 'pending').length,
    }),
    [records, runningCampaigns],
  )

  const statusFilterOptions: Array<{ value: 'all' | PromoStatus; label: string }> = [
    { value: 'all', label: '全部' },
    ...Object.entries(STATUS_LABEL).map(([value, label]) => ({
      value: value as PromoStatus,
      label,
    })),
  ]

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
        const rawList = Array.isArray(res.list) ? res.list : []
        setRecords(await enrichRecordsWithShopLogos(rawList))
      } catch (recordsError) {
        const legacyRes = await api.get<{ list: PromotionRow[] }>(
          `/api/admin/paid-promotions${query ? `?${query}` : ''}`,
        )
        const legacyList = Array.isArray(legacyRes.list) ? legacyRes.list : []
        const wrapped = legacyList.map((promotion) => ({ promotion, metricsSummary: null }))
        setRecords(await enrichRecordsWithShopLogos(wrapped))
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

  const closeDetail = useCallback(() => {
    setSelectedId(null)
  }, [])

  useEffect(() => {
    if (!selectedId) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetail()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, closeDetail])

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
      })
      .then(() => {
        actionSuccess('已创建付费推广资格，等待商家配置')
        setCreateForm({ channel: 'tiktok' })
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
      <header className="admin-pp-hero">
        <div className="admin-pp-hero-copy">
          <span className="admin-pp-hero-kicker">Paid Ads Console</span>
          <h1 className="admin-pp-hero-title">推广智能控</h1>
          <p className="admin-pp-hero-desc">
            统一管理付费推广资格、商家投放配置与实时消耗进度，支持按会员账号检索历史记录。
          </p>
        </div>
        <div className="admin-pp-stats">
          <StatCard label="投放中" value={pageStats.running} tone="emerald" />
          <StatCard label="待开启" value={pageStats.awaiting} tone="sky" />
          <StatCard label="待商家配置" value={pageStats.pending} tone="amber" />
          <StatCard label="全部列表" value={pageStats.total} tone="indigo" />
        </div>
      </header>

      <section className="admin-pp-panel admin-pp-panel--running">
        <div className="admin-pp-panel-head">
          <div>
            <h2 className="admin-pp-panel-title">投放中监控</h2>
            <p className="admin-pp-panel-desc">实时查看进度、预算消耗与结算倒计时，每 10 秒自动刷新。</p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--sm admin-btn--ghost admin-pp-refresh-btn"
            onClick={fetchRunningCampaigns}
            disabled={runningLoading}
          >
            {runningLoading ? '刷新中…' : '手动刷新'}
          </button>
        </div>

        {runningCampaigns.length === 0 ? (
          <div className="admin-pp-empty admin-pp-empty--inline">
            <span className="admin-pp-empty-icon" aria-hidden="true">◎</span>
            <p>当前没有投放中的推广</p>
          </div>
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
                    <div className="admin-pp-running-head-shop">
                      <ShopAvatar name={shopDisplayName(promo)} logo={promo.shopLogo} size="md" />
                      <div>
                        <div className="admin-pp-running-shop-row">
                          <strong>{shopDisplayName(promo)}</strong>
                          <ChannelBadge channel={promo.channel} />
                        </div>
                        <span className="admin-paid-promotions-running-card-sub">
                          {promo.shopId}
                          {promo.ownerAccount ? ` · 店主 ${promo.ownerAccount}` : ''}
                        </span>
                      </div>
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
                      <strong>{promo.targetRegion ? (REGION_LABEL[promo.targetRegion] ?? promo.targetRegion) : '—'}</strong>
                    </div>
                    <div>
                      <span>目标受众</span>
                      <strong>{promo.targetAudience ? (AUDIENCE_LABEL[promo.targetAudience] ?? promo.targetAudience) : '—'}</strong>
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

      <section className="admin-pp-panel admin-pp-panel--create">
        <div className="admin-pp-panel-head">
          <div>
            <h2 className="admin-pp-panel-title">开启付费推广</h2>
            <p className="admin-pp-panel-desc">先选定店铺，再选择渠道并创建推广资格，商家确认目标后由您开启投放。</p>
          </div>
        </div>

        <div className="admin-pp-create-layout">
          <div className="admin-pp-create-step">
            <span className="admin-pp-create-step-label">步骤 1 · 选择店铺</span>
            <div className="admin-pp-create-search">
              <input
                type="text"
                className="admin-pp-create-search-input"
                value={shopSearchInput}
                onChange={(e) => setShopSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    searchShops()
                  }
                }}
                placeholder="输入店铺名称或店铺 ID"
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

            {shopSearchResults.length > 0 ? (
              <ul className="admin-pp-create-results">
                {shopSearchResults.map((shop) => (
                  <li key={shop.id}>
                    <button
                      type="button"
                      className={`admin-pp-create-result${selectedShop?.id === shop.id ? ' admin-pp-create-result--active' : ''}`}
                      onClick={() => selectShop(shop)}
                    >
                      <ShopAvatar name={shop.name} logo={shop.logo} size="md" />
                      <span className="admin-pp-create-result-copy">
                        <strong>{shop.name}</strong>
                        <code>{shop.id}</code>
                        {shop.ownerAccount ? <em>店主 {shop.ownerAccount}</em> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-pp-create-hint">搜索后将展示匹配店铺，点击即可选中。</p>
            )}
          </div>

          <div className="admin-pp-create-step admin-pp-create-step--config">
            <span className="admin-pp-create-step-label">步骤 2 · 配置并创建</span>

            {selectedShop ? (
              <div className="admin-pp-create-selected">
                <ShopAvatar name={selectedShop.name} logo={selectedShop.logo} size="lg" />
                <div className="admin-pp-create-selected-copy">
                  <strong>{selectedShop.name}</strong>
                  <code>{selectedShop.id}</code>
                  {selectedShop.ownerAccount ? <span>店主 {selectedShop.ownerAccount}</span> : null}
                </div>
                <button type="button" className="admin-pp-create-clear" onClick={clearSelectedShop}>
                  更换
                </button>
              </div>
            ) : (
              <div className="admin-pp-create-selected admin-pp-create-selected--empty">
                <span>请先在左侧选择一家店铺</span>
              </div>
            )}

            <div className="admin-pp-create-fields">
              <div className="admin-pp-create-field">
                <span className="admin-pp-create-field-label">推广渠道</span>
                <div className="admin-pp-channel-picker">
                  {CHANNEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`admin-pp-channel-option admin-pp-channel-option--${opt.value}${createForm.channel === opt.value ? ' admin-pp-channel-option--active' : ''}`}
                      onClick={() => setCreateForm((prev) => ({ ...prev, channel: opt.value }))}
                    >
                      {opt.icon ? <img src={opt.icon} alt="" className="admin-pp-channel-option-icon" /> : null}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="admin-btn admin-btn--primary admin-pp-create-submit"
                onClick={handleCreate}
                disabled={creating || !selectedShop}
              >
                {creating ? '创建中…' : '创建推广资格'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-pp-panel admin-pp-panel--list">
        <div className="admin-pp-list-head">
          <div>
            <h2 className="admin-pp-panel-title">推广列表</h2>
            <p className="admin-pp-panel-desc">展示店铺头像、名称、ID 与店主账号，点击行或「详情」打开抽屉处理。</p>
          </div>
          <div className="admin-pp-list-toolbar">
            <input
              type="search"
              className="admin-pp-list-search"
              value={recordSearchInput}
              onChange={(e) => setRecordSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setRecordSearch(recordSearchInput.trim())
                }
              }}
              placeholder="搜索店铺 / 店主账号"
            />
            <button
              type="button"
              className="admin-btn admin-btn--sm admin-btn--primary"
              onClick={() => setRecordSearch(recordSearchInput.trim())}
            >
              搜索
            </button>
          </div>
        </div>

        <div className="admin-pp-status-tabs" role="tablist" aria-label="推广状态筛选">
          {statusFilterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={statusFilter === opt.value}
              className={`admin-pp-status-tab${statusFilter === opt.value ? ' admin-pp-status-tab--active' : ''}`}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="admin-pp-list-head-row" aria-hidden="true">
          <span className="admin-pp-list-col admin-pp-list-col--avatar">头像</span>
          <span className="admin-pp-list-col admin-pp-list-col--shop">店铺信息</span>
          <span className="admin-pp-list-col admin-pp-list-col--status">状态 / 渠道</span>
          <span className="admin-pp-list-col admin-pp-list-col--config">推广配置</span>
          <span className="admin-pp-list-col admin-pp-list-col--metrics">效果</span>
          <span className="admin-pp-list-col admin-pp-list-col--actions">操作</span>
        </div>

        <div className="admin-pp-list-body">
          {records.length === 0 ? (
            <div className="admin-pp-empty">
              <span className="admin-pp-empty-icon" aria-hidden="true">☰</span>
              <p>暂无推广列表</p>
              <span className="admin-pp-empty-hint">创建推广资格后，将在此展示全部店铺推广</span>
            </div>
          ) : (
            records.map(({ promotion: item, metricsSummary }) => (
              <PromotionListItem
                key={item.id}
                item={item}
                metricsSummary={metricsSummary}
                selected={selectedId === item.id}
                onSelect={() => setSelectedId(item.id)}
                onConfigure={() => setSelectedId(item.id)}
                onPause={() => updateStatus(item.id, 'paused')}
                onEnd={() => updateStatus(item.id, 'ended')}
              />
            ))
          )}
        </div>
      </section>

      {selected ? (
        <>
          <div
            className="admin-pp-drawer-overlay"
            onClick={closeDetail}
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="admin-pp-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-pp-drawer-title"
          >
            <div className="admin-pp-drawer-head">
              <div className="admin-pp-drawer-head-main">
                <h2 id="admin-pp-drawer-title" className="admin-pp-drawer-title">
                  推广记录详情
                </h2>
                <p className="admin-pp-drawer-subtitle">{selected.shopName ?? selected.shopId}</p>
              </div>
              <button
                type="button"
                className="admin-pp-drawer-close"
                onClick={closeDetail}
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <div className="admin-pp-drawer-body">
              <div className="admin-pp-detail-header">
                <ShopAvatar name={shopDisplayName(selected)} logo={selected.shopLogo} size="lg" />
                <div className="admin-pp-detail-header-main">
                  <strong>{shopDisplayName(selected)}</strong>
                  <div className="admin-pp-detail-header-tags">
                    <ChannelBadge channel={selected.channel} />
                    <StatusBadge status={selected.status} />
                  </div>
                  <div className="admin-pp-detail-header-meta">
                    <code>{selected.shopId}</code>
                    {selected.ownerAccount ? <span>店主 {selected.ownerAccount}</span> : null}
                  </div>
                </div>
              </div>

              <div className="admin-drawer-summary admin-pp-drawer-summary">
                <div className="admin-drawer-summary-main">
                  <span className="admin-drawer-summary-title">#{selected.id}</span>
                  <code className="admin-drawer-summary-sub">创建于 {formatDateTime(selected.createdAt)}</code>
                </div>
                <div className="admin-drawer-summary-aside">
                  {selected.budgetTotal != null ? (
                    <span className="admin-drawer-summary-money">${selected.budgetTotal.toFixed(2)}</span>
                  ) : (
                    <span className="admin-pp-drawer-summary-placeholder">待配置预算</span>
                  )}
                </div>
              </div>

              {selected.adminNote ? (
                <section className="admin-drawer-section">
                  <h3 className="admin-drawer-section-title">管理员备注</h3>
                  <p className="admin-pp-drawer-note">{selected.adminNote}</p>
                </section>
              ) : null}

              <section className="admin-drawer-section">
                <h3 className="admin-drawer-section-title">商家配置</h3>
                <dl className="admin-paid-promotions-config-dl admin-pp-drawer-dl">
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
              </section>

              <section className="admin-drawer-section">
                <h3 className="admin-drawer-section-title">投放配置</h3>
                <dl className="admin-paid-promotions-config-dl admin-pp-drawer-dl">
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
              </section>

              {needsCampaignConfig(selected) ? (
                <section className="admin-drawer-section admin-pp-drawer-config-section">
                  <h3 className="admin-drawer-section-title">开启投放</h3>
                  <p className="admin-paid-promotions-config-hint">
                    商家已确认推广方案，请填写投放参数后点击「开启推广」。
                  </p>
                  <div className="admin-paid-promotions-config-grid admin-pp-drawer-config-grid">
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
                  </div>
                </section>
              ) : selected.status === 'pending' ? (
                <section className="admin-drawer-section">
                  <p className="admin-paid-promotions-placeholder">
                    等待商家在仪表盘选择推广目标、地区与受众并确认。
                  </p>
                </section>
              ) : hasLaunchedCampaign(selected) ? (
                <section className="admin-drawer-section">
                  <h3 className="admin-drawer-section-title">每日释放数据</h3>
                  {metricsSummary || selectedRecord?.metricsSummary ? (
                    <div className="admin-paid-promotions-live-summary admin-pp-drawer-live-summary">
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
                </section>
              ) : (
                <section className="admin-drawer-section">
                  <p className="admin-paid-promotions-placeholder">当前状态无需配置投放。</p>
                </section>
              )}
            </div>

            <div className="admin-pp-drawer-actions">
              {needsCampaignConfig(selected) ? (
                <button
                  type="button"
                  className="admin-pp-drawer-btn"
                  onClick={handleLaunch}
                  disabled={launching}
                >
                  {launching ? '开启中…' : '开启推广'}
                </button>
              ) : null}
              {selected.status === 'active' && hasLaunchedCampaign(selected) ? (
                <>
                  <button
                    type="button"
                    className="admin-pp-drawer-btn admin-pp-drawer-btn--secondary"
                    onClick={() => updateStatus(selected.id, 'paused')}
                  >
                    暂停
                  </button>
                  <button
                    type="button"
                    className="admin-pp-drawer-btn admin-pp-drawer-btn--secondary"
                    onClick={() => updateStatus(selected.id, 'ended')}
                  >
                    结束
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="admin-pp-drawer-btn admin-pp-drawer-btn--secondary"
                onClick={closeDetail}
              >
                关闭
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default AdminPaidPromotions

import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'

interface DashboardStats {
  userCount: number
  shopCount: number
  productCount: number
  orderCount: number
  todayOrders: number
  robotCount: number
}

interface DashboardResponse {
  stats: DashboardStats
  orderTrend: Array<{ name: string; 订单: number; 销售额: number }>
  visitTrend: Array<{ name: string; 访客: number }>
  todayOverview: {
    newUsersToday: number
    newShopsToday: number
    pendingAuditShops: number
    pendingTickets: number
  }
  systemStatus: {
    api: string
    database: string
    robots: number
  }
}

type StatKey = keyof DashboardStats

const STAT_LABELS: StatKey[] = [
  'userCount',
  'shopCount',
  'productCount',
  'orderCount',
  'todayOrders',
  'robotCount',
]

const STAT_META: Record<
  StatKey,
  { label: string; unit: string; accent: string; desc: string }
> = {
  userCount: { label: '商城用户', unit: '', accent: '#4f46e5', desc: '注册用户总量' },
  shopCount: { label: '入驻店铺', unit: '', accent: '#7c3aed', desc: '已开通店铺数' },
  productCount: { label: '在售商品', unit: '', accent: '#2563eb', desc: '平台在售 SKU' },
  orderCount: { label: '订单总数', unit: '', accent: '#0ea5e9', desc: '累计成交订单' },
  todayOrders: { label: '今日订单', unit: '', accent: '#0891b2', desc: '当日新增订单' },
  robotCount: { label: '机器人节点', unit: ' 台', accent: '#6366f1', desc: '运行中节点' },
}

const defaultStats: DashboardStats = {
  userCount: 0,
  shopCount: 0,
  productCount: 0,
  orderCount: 0,
  todayOrders: 0,
  robotCount: 0,
}
const defaultOrderTrend = [
  { name: '周一', 订单: 0, 销售额: 0 },
  { name: '周二', 订单: 0, 销售额: 0 },
  { name: '周三', 订单: 0, 销售额: 0 },
  { name: '周四', 订单: 0, 销售额: 0 },
  { name: '周五', 订单: 0, 销售额: 0 },
  { name: '周六', 订单: 0, 销售额: 0 },
  { name: '周日', 订单: 0, 销售额: 0 },
]
const defaultVisitTrend = defaultOrderTrend.map(({ name }) => ({ name, 访客: 0 }))

function formatStatValue(key: StatKey, value: number): string {
  if (key === 'robotCount') return String(value)
  return value.toLocaleString()
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>(defaultStats)
  const [orderTrend, setOrderTrend] = useState(defaultOrderTrend)
  const [visitTrend, setVisitTrend] = useState(defaultVisitTrend)
  const [todayOverview, setTodayOverview] = useState({
    newUsersToday: 0,
    newShopsToday: 0,
    pendingAuditShops: 0,
    pendingTickets: 0,
  })
  const [systemStatus, setSystemStatus] = useState({ api: '正常', database: '正常', robots: 0 })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get<DashboardResponse>('/api/admin/dashboard')
      if (res.stats) {
        setStats(res.stats)
      }
      if (Array.isArray(res.orderTrend) && res.orderTrend.length > 0) {
        setOrderTrend(res.orderTrend)
      }
      if (Array.isArray(res.visitTrend) && res.visitTrend.length > 0) {
        setVisitTrend(res.visitTrend)
      }
      if (res.todayOverview) {
        setTodayOverview(res.todayOverview)
      }
      if (res.systemStatus) {
        setSystemStatus({
          api: res.systemStatus.api === 'ok' ? '正常' : String(res.systemStatus.api),
          database: res.systemStatus.database === 'ok' ? '正常' : String(res.systemStatus.database),
          robots: typeof res.systemStatus.robots === 'number' ? res.systemStatus.robots : 0,
        })
      }
      setLastUpdated(new Date())
    } catch {
      // keep previous state
    }
  }, [])

  useEffect(() => {
    fetchDashboard()

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchDashboard()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
    }
    const timer = window.setInterval(fetchDashboard, 5000)
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [fetchDashboard])

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div className="admin-page admin-dashboard-page">
      <header className="admin-dashboard-hero">
        <div className="admin-dashboard-hero-main">
          <span className="admin-dashboard-eyebrow">运营概览</span>
          <h2 className="admin-page-title">仪表盘</h2>
          <p className="admin-page-desc">商城核心指标、趋势图表与系统状态一览，数据每 5 秒自动刷新。</p>
        </div>
        <div className="admin-dashboard-hero-aside">
          <span className="admin-dashboard-live-badge">
            <span className="admin-dashboard-live-dot" aria-hidden />
            实时数据
          </span>
          <span className="admin-dashboard-updated">更新于 {updatedLabel}</span>
          {todayOverview.pendingAuditShops > 0 ? (
            <Link to="/audit/shops" className="admin-dashboard-quick-link">
              待审核店铺 {todayOverview.pendingAuditShops}
            </Link>
          ) : null}
        </div>
      </header>

      <section className="admin-dashboard-stats" aria-label="核心指标">
        {STAT_LABELS.map((key) => {
          const meta = STAT_META[key]
          return (
            <article
              key={key}
              className="admin-dashboard-stat-card"
              style={{ '--stat-accent': meta.accent } as React.CSSProperties}
            >
              <div className="admin-dashboard-stat-top">
                <span className="admin-dashboard-stat-label">{meta.label}</span>
                <span className="admin-dashboard-stat-chip">{meta.desc}</span>
              </div>
              <span className="admin-dashboard-stat-value">
                {formatStatValue(key, stats[key])}
                {meta.unit}
              </span>
            </article>
          )
        })}
      </section>

      <div className="admin-dashboard-body">
        <section className="admin-dashboard-main" aria-label="趋势图表">
          <article className="admin-dashboard-panel admin-dashboard-chart-card">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3 className="admin-dashboard-panel-title">近 7 日订单与销售额</h3>
                <p className="admin-dashboard-panel-desc">订单量与销售额双轴对比</p>
              </div>
              <span className="admin-dashboard-panel-tag">7 天</span>
            </div>
            <div className="admin-dashboard-chart-wrap">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={orderTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashOrderFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="dashSalesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    stroke="#cbd5e1"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
                    }}
                    labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                    formatter={(value, name) => [
                      name === '销售额' ? Number(value).toLocaleString() : value,
                      name === '销售额' ? '销售额' : '订单',
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="订单"
                    stroke="#4f46e5"
                    fill="url(#dashOrderFill)"
                    strokeWidth={2.5}
                    name="订单"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="销售额"
                    stroke="#7c3aed"
                    fill="url(#dashSalesFill)"
                    strokeWidth={2.5}
                    name="销售额"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-dashboard-panel admin-dashboard-chart-card">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3 className="admin-dashboard-panel-title">近 7 日访客数</h3>
                <p className="admin-dashboard-panel-desc">全站访问趋势</p>
              </div>
              <span className="admin-dashboard-panel-tag">7 天</span>
            </div>
            <div className="admin-dashboard-chart-wrap">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={visitTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashVisitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
                    }}
                    labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                    formatter={(value) => [Number(value).toLocaleString(), '访客']}
                  />
                  <Bar dataKey="访客" fill="url(#dashVisitFill)" radius={[8, 8, 0, 0]} name="访客" maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <aside className="admin-dashboard-side" aria-label="今日概况与系统状态">
          <article className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3 className="admin-dashboard-panel-title">今日概况</h3>
                <p className="admin-dashboard-panel-desc">当日新增与待办提醒</p>
              </div>
            </div>
            <div className="admin-dashboard-metric-grid">
              <div className="admin-dashboard-metric-item">
                <span className="admin-dashboard-metric-label">新增用户</span>
                <span className="admin-dashboard-metric-value">{todayOverview.newUsersToday}</span>
              </div>
              <div className="admin-dashboard-metric-item">
                <span className="admin-dashboard-metric-label">新增店铺</span>
                <span className="admin-dashboard-metric-value">{todayOverview.newShopsToday}</span>
              </div>
              <div className="admin-dashboard-metric-item admin-dashboard-metric-item--warn">
                <span className="admin-dashboard-metric-label">待审核店铺</span>
                <span className="admin-dashboard-metric-value">{todayOverview.pendingAuditShops}</span>
              </div>
              <div className="admin-dashboard-metric-item">
                <span className="admin-dashboard-metric-label">待处理工单</span>
                <span className="admin-dashboard-metric-value">{todayOverview.pendingTickets}</span>
              </div>
            </div>
          </article>

          <article className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3 className="admin-dashboard-panel-title">系统状态</h3>
                <p className="admin-dashboard-panel-desc">服务与集群运行情况</p>
              </div>
            </div>
            <ul className="admin-dashboard-status-list">
              <li className="admin-dashboard-status-item">
                <span className="admin-dashboard-status-label">API 服务</span>
                <span className="admin-dashboard-status-value admin-dashboard-status-value--ok">
                  <span className="admin-dashboard-status-dot" aria-hidden />
                  {systemStatus.api}
                </span>
              </li>
              <li className="admin-dashboard-status-item">
                <span className="admin-dashboard-status-label">数据库</span>
                <span className="admin-dashboard-status-value admin-dashboard-status-value--ok">
                  <span className="admin-dashboard-status-dot" aria-hidden />
                  {systemStatus.database}
                </span>
              </li>
              <li className="admin-dashboard-status-item">
                <span className="admin-dashboard-status-label">机器人集群</span>
                <span className="admin-dashboard-status-value admin-dashboard-status-value--ok">
                  <span className="admin-dashboard-status-dot" aria-hidden />
                  {systemStatus.robots} 台
                </span>
              </li>
            </ul>
          </article>
        </aside>
      </div>
    </div>
  )
}

export default AdminDashboard

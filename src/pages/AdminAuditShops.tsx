import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import { formatDateTime } from '../utils/datetime'
import AdminLoadingState from '../components/admin/AdminLoadingState'

const COUNTRY_LABEL: Record<string, string> = {
  CN: '中国',
  TW: '台湾',
  HK: '香港',
  US: '美国',
}

/** 与商家入驻申请表单字段对应（与后端 GET /api/audit/shops 返回一致） */
interface PendingShopApply {
  id: string
  storeName: string
  storeAddress: string
  country: string
  idNumber: string
  realName: string
  email: string
  invitationCode: string
  applyTime: string
  logo: string
  idFront: string
  idBack: string
  idHandheld: string
  signature: string
  status: 'pending' | 'approved' | 'rejected'
  applyAccount?: string
}

function formatApplyTime(iso: string): string {
  return formatDateTime(iso)
}

const AdminAuditShops: React.FC = () => {
  const [list, setList] = useState<PendingShopApply[]>([])
  const [detail, setDetail] = useState<PendingShopApply | null>(null)
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const { loadError, actionSuccess, actionError } = useAdminToast()

  useEffect(() => {
    if (!previewImage) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImage])

  const openPreview = (src: string, alt: string) => {
    setPreviewImage({ src, alt })
  }

  const renderAssetImage = (src: string, alt: string, className = 'admin-audit-shop-asset-img') => (
    <button
      type="button"
      className="admin-audit-shop-asset-btn"
      onClick={() => openPreview(src, alt)}
      aria-label={`查看${alt}大图`}
      title="点击查看大图"
    >
      <img src={src} alt={alt} className={className} />
    </button>
  )

  useEffect(() => {
    let cancelled = false

    const fetchPending = async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await api.get<{ list: PendingShopApply[] }>('/api/audit/shops')
        if (cancelled) return
        const items = Array.isArray(res.list) ? res.list : []
        setList(items.map((a) => ({
          ...a,
          applyTime: formatApplyTime(a.applyTime),
          status: a.status ?? 'pending',
        })))
      } catch {
        if (!cancelled) loadError('加载待审核列表失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // 首次进入页时加载一次
    fetchPending(false)
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchPending(true)
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    // 后台静默轮询，感知新申请
    const timer = window.setInterval(() => fetchPending(true), 5000)

    return () => {
      cancelled = true
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [loadError])

  const handleApprove = (id: string) => {
    api.post<{ success?: boolean; shopId?: string }>(`/api/audit/shops/${id}/approve`, {})
      .then(() => {
        setList((prev) =>
          prev.map((x) => (x.id === id ? { ...x, status: 'approved' } : x)),
        )
        setDetail((d) => (d && d.id === id ? { ...d, status: 'approved' } : d))
        actionSuccess('已通过，店铺已开通')
      })
      .catch((err: unknown) => {
        actionError(err)
      })
  }
  const handleReject = (id: string) => {
    api.post(`/api/audit/shops/${id}/reject`, {})
      .then(() => {
        setList((prev) =>
          prev.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)),
        )
        setDetail((d) => (d && d.id === id ? { ...d, status: 'rejected' } : d))
        actionSuccess('已拒绝该入驻申请')
      })
      .catch((err: unknown) => {
        actionError(err)
      })
  }

  return (
    <div className="admin-audit-page">
      <header className="admin-audit-header admin-list-hero">
        <span className="admin-list-hero-eyebrow">入驻审核</span>
        <h2 className="admin-audit-title">店铺审核</h2>
        <p className="admin-audit-desc">
          商家入驻申请待审核。列表做「简要卡片」，详情请点击右侧「查看」按钮。
        </p>
      </header>
      <section className="admin-audit-table-wrap">
        <div className="admin-table-scroll">
        <table className="admin-audit-table admin-audit-table--shops">
          <thead>
            <tr>
              <th className="admin-col-left">申请信息</th>
              <th className="admin-col-left">申请人</th>
              <th className="admin-col-center">状态</th>
              <th className="admin-col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="admin-loading-cell">
                  <AdminLoadingState variant="panel" label="加载入驻申请" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="admin-audit-empty">暂无待审核项</td>
              </tr>
            ) : (
              list.map((row) => (
                <tr key={row.id}>
                  <td className="admin-col-left">
                    <div className="admin-audit-shop-main">
                      <div className="admin-audit-shop-main-avatar">
                        {row.logo ? (
                          <img
                            src={row.logo}
                            alt="店铺头像"
                            className="admin-audit-shop-main-avatar-img"
                          />
                        ) : (
                          <span className="admin-audit-shop-main-avatar-placeholder">
                            {row.storeName ? row.storeName.slice(0, 1) : '店'}
                          </span>
                        )}
                      </div>
                      <div className="admin-audit-shop-main-text">
                        <div className="admin-audit-shop-main-title-row">
                          <span className="admin-audit-shop-main-name" title={row.storeName}>
                            {row.storeName}
                          </span>
                          <code className="admin-audit-id">{row.id}</code>
                        </div>
                        <div className="admin-audit-shop-main-meta">
                          <span className="admin-audit-shop-main-country">
                            {COUNTRY_LABEL[row.country] ?? row.country}
                          </span>
                          <span className="admin-audit-shop-main-dot">•</span>
                          <span className="admin-audit-shop-main-address" title={row.storeAddress}>
                            {row.storeAddress}
                          </span>
                        </div>
                        <div className="admin-audit-shop-main-time">申请时间：{row.applyTime}</div>
                      </div>
                    </div>
                  </td>
                  <td className="admin-col-left">
                    <div className="admin-audit-shop-apply">
                      <div className="admin-audit-shop-apply-name" title={row.realName}>
                        {row.realName}
                      </div>
                      <div className="admin-audit-shop-apply-account" title={row.applyAccount || row.email || '—'}>
                        {row.applyAccount || row.email || '—'}
                      </div>
                      <div className="admin-audit-shop-apply-id" title={row.idNumber}>
                        证件：{row.idNumber}
                      </div>
                    </div>
                  </td>
                  <td className="admin-col-center">
                    <span className={`admin-audit-status admin-audit-status--${row.status}`}>
                      {row.status === 'approved'
                        ? '已通过'
                        : row.status === 'rejected'
                          ? '已拒绝'
                          : '待审核'}
                    </span>
                  </td>
                  <td className="admin-col-actions">
                    <div className="admin-audit-shop-actions">
                      <button
                        type="button"
                        className="admin-audit-btn admin-audit-btn--view"
                        onClick={() => setDetail(row)}
                      >
                        查看详情
                      </button>
                      {row.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="admin-audit-btn admin-audit-btn--pass"
                            onClick={() => handleApprove(row.id)}
                          >
                            通过
                          </button>
                          <button
                            type="button"
                            className="admin-audit-btn admin-audit-btn--reject"
                            onClick={() => handleReject(row.id)}
                          >
                            拒绝
                          </button>
                        </>
                      )}
                    </div>
                    {row.status !== 'pending' && (
                      <div className="admin-audit-shop-actions-note">
                        {row.status === 'approved' ? '已通过，记录已归档' : '已拒绝，记录已归档'}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </section>

      {detail && (
        <>
          <div className="admin-audit-shop-overlay" onClick={() => setDetail(null)} role="presentation" aria-hidden="true" />
          <div className="admin-audit-shop-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-audit-shop-drawer-title">
            <div className="admin-audit-shop-drawer-head">
              <h2 id="admin-audit-shop-drawer-title" className="admin-audit-shop-drawer-title">入驻申请详情</h2>
              <button type="button" className="admin-audit-shop-drawer-close" onClick={() => setDetail(null)} aria-label="关闭">×</button>
            </div>
            <div className="admin-audit-shop-drawer-body">
              <section className="admin-audit-shop-section">
                <h3 className="admin-audit-shop-section-title">商业信息</h3>
                <dl className="admin-audit-shop-dl">
                  <div className="admin-audit-shop-row">
                    <dt>店铺名称</dt>
                    <dd>{detail.storeName}</dd>
                  </div>
                  <div className="admin-audit-shop-row">
                    <dt>店铺地址</dt>
                    <dd>{detail.storeAddress}</dd>
                  </div>
                  <div className="admin-audit-shop-row">
                    <dt>国家</dt>
                    <dd>{COUNTRY_LABEL[detail.country] ?? detail.country}</dd>
                  </div>
                </dl>
              </section>
              <section className="admin-audit-shop-section">
                <h3 className="admin-audit-shop-section-title">主体信息</h3>
                <dl className="admin-audit-shop-dl">
                  <div className="admin-audit-shop-row">
                    <dt>真实姓名</dt>
                    <dd>{detail.realName}</dd>
                  </div>
                  <div className="admin-audit-shop-row">
                    <dt>证件/护照号码</dt>
                    <dd>{detail.idNumber}</dd>
                  </div>
                  <div className="admin-audit-shop-row">
                    <dt>申请账户</dt>
                    <dd>{detail.applyAccount || detail.email || '—'}</dd>
                  </div>
                  <div className="admin-audit-shop-row">
                    <dt>邀请码</dt>
                    <dd>{detail.invitationCode}</dd>
                  </div>
                  <div className="admin-audit-shop-row">
                    <dt>申请时间</dt>
                    <dd>{detail.applyTime}</dd>
                  </div>
                </dl>
              </section>
              <section className="admin-audit-shop-section">
                <h3 className="admin-audit-shop-section-title">资质材料</h3>
                <div className="admin-audit-shop-assets">
                  <div className="admin-audit-shop-asset">
                    <span className="admin-audit-shop-asset-label">店铺标志</span>
                    <div className="admin-audit-shop-asset-box admin-audit-shop-asset-box--logo">
                      {detail.logo ? renderAssetImage(detail.logo, '店铺标志', 'admin-audit-shop-asset-img admin-audit-shop-asset-img--logo') : <span className="admin-audit-shop-asset-empty">未上传</span>}
                    </div>
                  </div>
                  <div className="admin-audit-shop-asset">
                    <span className="admin-audit-shop-asset-label">证件正面</span>
                    <div className="admin-audit-shop-asset-box">
                      {detail.idFront ? renderAssetImage(detail.idFront, '证件正面') : <span className="admin-audit-shop-asset-empty">未上传</span>}
                    </div>
                  </div>
                  <div className="admin-audit-shop-asset">
                    <span className="admin-audit-shop-asset-label">证件反面</span>
                    <div className="admin-audit-shop-asset-box">
                      {detail.idBack ? renderAssetImage(detail.idBack, '证件反面') : <span className="admin-audit-shop-asset-empty">未上传</span>}
                    </div>
                  </div>
                  <div className="admin-audit-shop-asset">
                    <span className="admin-audit-shop-asset-label">手持证件照</span>
                    <div className="admin-audit-shop-asset-box admin-audit-shop-asset-box--tall">
                      {detail.idHandheld ? renderAssetImage(detail.idHandheld, '手持证件照') : <span className="admin-audit-shop-asset-empty">未上传</span>}
                    </div>
                  </div>
                  <div className="admin-audit-shop-asset">
                    <span className="admin-audit-shop-asset-label">乙方签名</span>
                    <div className="admin-audit-shop-asset-box admin-audit-shop-asset-box--sign">
                      {detail.signature ? renderAssetImage(detail.signature, '乙方签名', 'admin-audit-shop-asset-img admin-audit-shop-asset-img--sign') : <span className="admin-audit-shop-asset-empty">未上传</span>}
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <div className="admin-audit-shop-drawer-actions">
              <button type="button" className="admin-audit-shop-drawer-btn admin-audit-shop-drawer-btn--pass" onClick={() => handleApprove(detail.id)}>通过</button>
              <button type="button" className="admin-audit-shop-drawer-btn admin-audit-shop-drawer-btn--reject" onClick={() => handleReject(detail.id)}>拒绝</button>
              <button type="button" className="admin-audit-shop-drawer-btn admin-audit-shop-drawer-btn--secondary" onClick={() => setDetail(null)}>关闭</button>
            </div>
          </div>
        </>
      )}

      {previewImage && (
        <div
          className="admin-audit-image-preview"
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.alt}
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            className="admin-audit-image-preview-close"
            onClick={(event) => {
              event.stopPropagation()
              setPreviewImage(null)
            }}
            aria-label="关闭大图预览"
          >
            ×
          </button>
          <img
            src={previewImage.src}
            alt={previewImage.alt}
            className="admin-audit-image-preview-img"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export default AdminAuditShops

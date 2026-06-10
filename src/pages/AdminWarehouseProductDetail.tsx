import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import { useAdminEditConfirm } from '../context/AdminEditConfirmContext'
import AdminLoadingState from '../components/admin/AdminLoadingState'
import { sanitizeHtml } from '../utils/sanitizeHtml'

export interface SupplySku {
  skuId?: number
  productId?: number
  attrs: unknown
  purchasePrice: number | null
  sellingPrice: number | null
  coverImg: string | null
  images: string[]
}

export interface SupplyDetail {
  id: string
  title: string
  images: string[]
  purchasePrice: number | null
  price: number
  descriptionHtml: string
  detailHtml: string
  skus: SupplySku[]
  categoryId?: string
  subCategoryId?: string
  status?: 'on' | 'off'
}

interface CategoryItem {
  id: string
  parent_id: string | null
  level: number
  name: string
}

const normalizeDetail = (d: Record<string, unknown>): SupplyDetail => ({
  id: String(d.id ?? ''),
  title: String(d.title ?? ''),
  images: Array.isArray(d.images) ? (d.images as string[]) : [],
  purchasePrice:
    d.purchasePrice != null
      ? Number(d.purchasePrice)
      : d.purchase_price != null
        ? Number(d.purchase_price)
        : null,
  price: Number(d.price ?? d.selling_price) || 0,
  descriptionHtml: String(d.descriptionHtml ?? d.description_html ?? ''),
  detailHtml: String(d.detailHtml ?? d.detail_html ?? ''),
  categoryId: d.categoryId != null ? String(d.categoryId) : undefined,
  subCategoryId: d.subCategoryId != null ? String(d.subCategoryId) : undefined,
  status: d.status === 'off' ? 'off' : 'on',
  skus: (Array.isArray(d.skus) ? d.skus : []).map((s: Record<string, unknown>) => ({
    skuId: (s.skuId ?? s.sku_id) as number | undefined,
    productId: (s.productId ?? s.product_id) as number | undefined,
    attrs: s.attrs,
    purchasePrice:
      s.purchasePrice != null
        ? Number(s.purchasePrice)
        : s.purchase_price != null
          ? Number(s.purchase_price)
          : null,
    sellingPrice:
      s.sellingPrice != null
        ? Number(s.sellingPrice)
        : s.selling_price != null
          ? Number(s.selling_price)
          : null,
    coverImg: (s.coverImg ?? s.cover_img ?? null) as string | null,
    images: Array.isArray(s.images) ? (s.images as string[]) : [],
  })),
})

const AdminWarehouseProductDetail: React.FC = () => {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { saveSuccess, saveError, loadError, actionSuccess, actionError } = useAdminToast()
  const { requestEditConfirm } = useAdminEditConfirm()
  const isNew = !productId || productId === 'new'
  const [detail, setDetail] = useState<SupplyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState<SupplyDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [mainImageUploading, setMainImageUploading] = useState(false)
  const [skuUploadingIdx, setSkuUploadingIdx] = useState<number | null>(null)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const mainImageInputRef = useRef<HTMLInputElement>(null)
  const mainImageUrlRef = useRef<HTMLInputElement>(null)
  const skuImageInputRef = useRef<HTMLInputElement>(null)
  const skuImageTargetRef = useRef<number | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!productId) {
      setErrorMessage('缺少商品 ID')
      setLoading(false)
      return
    }
    if (isNew) {
      const empty: SupplyDetail = {
        id: '',
        title: '',
        images: [],
        purchasePrice: null,
        price: 0,
        descriptionHtml: '',
        detailHtml: '',
        skus: [],
        categoryId: '',
        subCategoryId: '',
      }
      setDetail(empty)
      setForm(empty)
      setLoading(false)
      return
    }
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await api.get<SupplyDetail>(`/api/products/supply/${encodeURIComponent(productId)}`)
      const d = normalizeDetail(res as unknown as Record<string, unknown>)
      setDetail(d)
      setForm(d)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载商品详情失败'
      setErrorMessage(msg)
      loadError(msg, '加载商品详情失败')
      setDetail(null)
      setForm(null)
    } finally {
      setLoading(false)
    }
  }, [productId, isNew, loadError])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get<{ list: CategoryItem[] }>('/api/categories')
      setCategories(Array.isArray(res.list) ? res.list : [])
    } catch {
      setCategories([])
    }
  }, [])

  useEffect(() => {
    if (isNew) fetchCategories()
  }, [isNew, fetchCategories])

  const topCategories = categories.filter((c) => !c.parent_id || c.level === 1)
  const childrenByParentId = categories.reduce<Record<string, CategoryItem[]>>((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = []
      acc[c.parent_id].push(c)
    }
    return acc
  }, {})

  const updateForm = (patch: Partial<SupplyDetail>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : null))
  }

  const updateFormSkus = (skus: SupplySku[]) => {
    setForm((prev) => (prev ? { ...prev, skus } : null))
  }

  const toggleSupplyStatus = async (nextStatus: 'on' | 'off') => {
    if (!productId) return
    try {
      await api.patch(`/api/products/supply/${encodeURIComponent(productId)}/status`, {
        status: nextStatus,
      })
      setDetail((prev) => (prev ? { ...prev, status: nextStatus } : prev))
      setForm((prev) => (prev ? { ...prev, status: nextStatus } : prev))
      actionSuccess(nextStatus === 'off' ? '已下架供货' : '已恢复供货')
    } catch (e) {
      actionError(e, '更新状态失败')
    }
  }

  /** 主图：删除一张并立即写库（新建时仅改本地表单） */
  const removeMainImage = async (index: number) => {
    if (!form) return
    const next = (form.images ?? []).filter((_, i) => i !== index)
    updateForm({ images: next })
    if (isNew || !productId) {
      return
    }
    try {
      await api.patch(`/api/products/supply/${encodeURIComponent(productId)}`, { ...form, images: next })
      setDetail((d) => (d ? { ...d, images: next } : null))
      actionSuccess('已删除该商品')
    } catch (e) {
      actionError(e, '删除失败')
      updateForm({ images: form.images })
    }
  }

  /** 主图：添加一张（URL 或上传）并立即写库；新建时仅改本地表单 */
  const addMainImage = async (urlOrFile: string | File) => {
    if (!form) return
    let url: string
    if (typeof urlOrFile === 'string') {
      url = urlOrFile.trim()
      if (!url) return
    } else {
      setMainImageUploading(true)
      try {
        const res = await api.uploadImage(urlOrFile, { bucket: 'commodity' })
        url = res.url
      } catch (e) {
        saveError(e, '上传失败')
        return
      } finally {
        setMainImageUploading(false)
      }
    }
    const next = [...(form.images ?? []), url]
    updateForm({ images: next })
    if (isNew || !productId) {
      return
    }
    try {
      await api.patch(`/api/products/supply/${encodeURIComponent(productId)}`, { ...form, images: next })
      setDetail((d) => (d ? { ...d, images: next } : null))
      actionSuccess('已添加')
    } catch (e) {
      actionError(e, '添加失败')
      updateForm({ images: form.images })
    }
  }

  /** 款式图：删除一张并立即写库（cover 或 images[i]）；新建时仅改本地表单 */
  const removeSkuImage = async (skuIdx: number, isCover: boolean, imageIdx?: number) => {
    if (!form) return
    const next = form.skus.map((s, i) => {
      if (i !== skuIdx) return s
      if (isCover) return { ...s, coverImg: null }
      const imgs = [...(s.images ?? [])]
      if (imageIdx != null) imgs.splice(imageIdx, 1)
      return { ...s, images: imgs }
    })
    updateFormSkus(next)
    if (isNew || !productId) {
      return
    }
    try {
      await api.put(`/api/products/supply/${encodeURIComponent(productId)}/skus`, { skus: next })
      setDetail((d) => (d ? { ...d, skus: next } : null))
      actionSuccess('已删除该商品')
    } catch (e) {
      actionError(e, '删除失败')
      updateFormSkus(form.skus)
    }
  }

  /** 款式图：添加一张并立即写库；新建时仅改本地表单 */
  const addSkuImage = async (skuIdx: number, urlOrFile: string | File) => {
    if (!form) return
    let url: string
    if (typeof urlOrFile === 'string') {
      url = urlOrFile.trim()
      if (!url) return
    } else {
      setSkuUploadingIdx(skuIdx)
      try {
        const res = await api.uploadImage(urlOrFile, { bucket: 'commodity' })
        url = res.url
      } catch (e) {
        saveError(e, '上传失败')
        return
      } finally {
        setSkuUploadingIdx(null)
      }
    }
    const next = form.skus.map((s, i) => {
      if (i !== skuIdx) return s
      return { ...s, images: [...(s.images ?? []), url] }
    })
    updateFormSkus(next)
    if (isNew || !productId) {
      return
    }
    try {
      await api.put(`/api/products/supply/${encodeURIComponent(productId)}/skus`, { skus: next })
      setDetail((d) => (d ? { ...d, skus: next } : null))
      actionSuccess('已添加')
    } catch (e) {
      actionError(e, '添加失败')
      updateFormSkus(form.skus)
    }
  }

  const performSave = async () => {
    if (!productId || !form) return
    setSaving(true)
    try {
      if (isNew) {
        const res = await api.post<{ success?: boolean; id?: string }>('/api/products/supply', {
          categoryId: form.categoryId || undefined,
          subCategoryId: form.subCategoryId || undefined,
          title: form.title,
          descriptionHtml: form.descriptionHtml,
          detailHtml: form.detailHtml,
          images: form.images,
          purchasePrice: form.purchasePrice,
          price: form.price,
          skus: form.skus.map((s) => ({
            attrs: s.attrs,
            purchasePrice: s.purchasePrice,
            sellingPrice: s.sellingPrice,
            coverImg: s.coverImg,
            images: s.images,
          })),
        })
        const newId = res.id ?? ''
        saveSuccess('商品已创建')
        if (newId) {
          navigate(`/warehouse/product/${encodeURIComponent(newId)}`, { replace: true })
        } else {
          // 若后端未返回 id，仍留在当前页
          setEditing(false)
          setDetail(form)
        }
      } else {
        await api.patch(`/api/products/supply/${encodeURIComponent(productId)}`, {
          title: form.title,
          descriptionHtml: form.descriptionHtml,
          detailHtml: form.detailHtml,
          images: form.images,
          purchasePrice: form.purchasePrice,
          price: form.price,
        })
        await api.put(`/api/products/supply/${encodeURIComponent(productId)}/skus`, {
          skus: form.skus.map((s) => ({
            attrs: s.attrs,
            purchasePrice: s.purchasePrice,
            sellingPrice: s.sellingPrice,
            coverImg: s.coverImg,
            images: s.images,
          })),
        })
        saveSuccess()
        setEditing(false)
        setDetail(form)
        fetchDetail()
      }
    } catch (e) {
      saveError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    if (!form) return
    requestEditConfirm({
      title: isNew ? '确认创建商品' : '确认保存修改',
      message: isNew
        ? '即将创建新的供货商品，提交后立即入库，请确认。'
        : `即将保存对商品「${form.title || productId}」的修改，提交后立即生效，请确认。`,
      confirmLabel: isNew ? '确认创建' : '确认保存',
      onConfirm: () => {
        void performSave()
      },
    })
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setForm(detail)
  }

  /** 常见属性英文名 → 中文展示名 */
  const ATTR_NAME_ZH: Record<string, string> = {
    color: '颜色',
    size: '尺码',
    style: '款式',
    spec: '规格',
  }
  /** 取属性值的展示文案：优先用专门用于展示的字段，否则用 attrValueName/value（避免只显示代码或数字而丢失正确文案） */
  const getAttrDisplayValue = (item: Record<string, unknown>): string | null => {
    const raw =
      item.attrValueDisplay ??
      item.attrValueNameCn ??
      item.displayValue ??
      item.valueLabel ??
      item.attrValueName ??
      item.value
    if (raw == null) return null
    return String(raw)
  }
  /** 将规格/属性转为可读文案：支持 [{ attrName, attrValueName, attrValueDisplay? }] 或 { key: value } 或纯字符串 */
  const attrsText = (attrs: unknown): string => {
    if (attrs == null) return '—'
    if (typeof attrs === 'string') return attrs
    if (Array.isArray(attrs)) {
      const parts = attrs
        .filter((item) => item && typeof item === 'object')
        .map((item: Record<string, unknown>) => {
          const name = item.attrName ?? item.name
          const value = getAttrDisplayValue(item)
          if (name != null && value !== null && value !== '') {
            const label = ATTR_NAME_ZH[String(name)] ?? String(name)
            return `${label}: ${value}`
          }
          return null
        })
        .filter(Boolean) as string[]
      if (parts.length) return parts.join(' · ')
    }
    if (typeof attrs === 'object' && !Array.isArray(attrs)) {
      const entries = Object.entries(attrs as Record<string, unknown>)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${ATTR_NAME_ZH[k] ?? k}: ${String(v)}`)
      if (entries.length) return entries.join(' · ')
    }
    return JSON.stringify(attrs)
  }

  if (loading) {
    return (
      <div className="admin-product-detail">
        <AdminLoadingState variant="page" label="加载商品详情" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="admin-product-detail">
        <div className="admin-product-detail-empty">
          {errorMessage || '商品不存在或加载失败'}
        </div>
        {productId && (
          <p className="admin-product-detail-empty-hint">商品 ID：{productId}</p>
        )}
        <button type="button" className="admin-product-detail-back" onClick={() => navigate('/warehouse')}>
          返回商品仓库
        </button>
      </div>
    )
  }

  const data = editing ? form : detail
  const showData = data ?? detail

  return (
    <div className="admin-product-detail">
      <header className="admin-product-detail-header">
        <button type="button" className="admin-product-detail-back" onClick={() => navigate('/warehouse')}>
          ← 返回商品仓库
        </button>
        <h1 className="admin-product-detail-title">
          {isNew ? '上传商品' : editing ? '编辑商品' : '商品详情'}
        </h1>
        {!isNew && showData?.status && !editing && (
          <span
            className={`admin-product-detail-status-pill admin-product-detail-status-pill--${
              showData.status === 'off' ? 'off' : 'on'
            }`}
          >
            {showData.status === 'off' ? '已下架（供货不可见）' : '供货中'}
          </span>
        )}
        {isNew ? (
          <div className="admin-product-detail-actions">
            <button type="button" className="admin-product-detail-btn admin-product-detail-btn--secondary" onClick={() => navigate('/warehouse')}>
              取消
            </button>
            <button type="button" className="admin-product-detail-btn" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        ) : !editing ? (
          <div className="admin-product-detail-actions">
            <button
              type="button"
              className="admin-product-detail-btn admin-product-detail-btn--secondary"
              onClick={() => toggleSupplyStatus(showData?.status === 'off' ? 'on' : 'off')}
            >
              {showData?.status === 'off' ? '恢复供货' : '下架供货'}
            </button>
            <button
              type="button"
              className="admin-product-detail-btn-edit"
              onClick={() => setEditing(true)}
            >
              编辑本商品
            </button>
          </div>
        ) : (
          <div className="admin-product-detail-actions">
            <button type="button" className="admin-product-detail-btn admin-product-detail-btn--secondary" onClick={handleCancelEdit}>
              取消
            </button>
            <button type="button" className="admin-product-detail-btn" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        )}
      </header>

      <section className="admin-product-detail-body">
        {/* 上传商品时：选择大分类、细分类 */}
        {isNew && form && (
          <section className="admin-product-detail-section">
            <h2 className="admin-product-detail-section-title">分类</h2>
            <div className="admin-product-detail-category-row">
              <label className="admin-product-detail-label">
                大分类
                <select
                  className="admin-product-detail-select"
                  value={form.categoryId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value
                    updateForm({ categoryId: id, subCategoryId: '' })
                  }}
                >
                  <option value="">请选择大分类</option>
                  {topCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="admin-product-detail-label">
                细分类
                <select
                  className="admin-product-detail-select"
                  value={form.subCategoryId ?? ''}
                  onChange={(e) => updateForm({ subCategoryId: e.target.value })}
                  disabled={!form.categoryId}
                >
                  <option value="">请选择细分类</option>
                  {(childrenByParentId[form.categoryId ?? ''] ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}
        {/* 主图：编辑时每张图右侧圆形叉删除，最后为增加图片块（上传或 URL） */}
        <section className="admin-product-detail-section">
          <h2 className="admin-product-detail-section-title">主图</h2>
          {editing && form ? (
            <>
              <div className="admin-product-detail-main-images admin-product-detail-main-images--editing">
                {(form.images ?? []).map((url, i) => (
                  <div key={i} className="admin-product-detail-img-wrap">
                    <div className="admin-product-detail-img-item">
                      <img src={url} alt="" />
                    </div>
                    <button
                      type="button"
                      className="admin-product-detail-img-remove"
                      onClick={() => removeMainImage(i)}
                      aria-label="删除图片"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="admin-product-detail-img-add-wrap">
                  <input
                    ref={mainImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="admin-product-detail-img-input-hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) addMainImage(file)
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    className="admin-product-detail-img-add"
                    onClick={() => mainImageInputRef.current?.click()}
                    disabled={mainImageUploading}
                  >
                    {mainImageUploading ? '上传中…' : '+'}
                  </button>
                  <span className="admin-product-detail-img-add-label">上传图片</span>
                </div>
              </div>
              <div className="admin-product-detail-add-url-row">
                <input
                  ref={mainImageUrlRef}
                  type="text"
                  className="admin-product-detail-input admin-product-detail-input--sm"
                  placeholder="或输入图片 URL 添加"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = mainImageUrlRef.current?.value?.trim()
                      if (v) { addMainImage(v); mainImageUrlRef.current!.value = '' }
                    }
                  }}
                />
                <button
                  type="button"
                  className="admin-product-detail-btn admin-product-detail-btn--secondary"
                  onClick={() => {
                    const v = mainImageUrlRef.current?.value?.trim()
                    if (v) { addMainImage(v); mainImageUrlRef.current!.value = '' }
                  }}
                >
                  添加
                </button>
              </div>
            </>
          ) : (
            <div className="admin-product-detail-main-images">
              {(showData.images ?? []).length === 0 ? (
                <span className="admin-product-detail-no-data">暂无主图</span>
              ) : (
                (showData.images ?? []).map((url, i) => (
                  <div key={i} className="admin-product-detail-img-item">
                    <img src={url} alt="" />
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* 商品名称 */}
        <section className="admin-product-detail-section">
          <h2 className="admin-product-detail-section-title">商品名称</h2>
          {editing && form ? (
            <input
              type="text"
              className="admin-product-detail-input"
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              placeholder="商品名称"
            />
          ) : (
            <p className="admin-product-detail-text">{showData.title || '—'}</p>
          )}
        </section>

        {/* 描述/介绍 */}
        <section className="admin-product-detail-section">
          <h2 className="admin-product-detail-section-title">描述 / 介绍</h2>
          {editing && form ? (
            <textarea
              className="admin-product-detail-textarea"
              value={form.descriptionHtml ?? ''}
              onChange={(e) => updateForm({ descriptionHtml: e.target.value })}
              placeholder="商品描述（支持 HTML）"
              rows={6}
            />
          ) : (
            <div
              className="admin-product-detail-html"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(showData.descriptionHtml || '<p>暂无描述</p>') }}
            />
          )}
        </section>

        {/* 供货价、建议售价 */}
        <section className="admin-product-detail-section admin-product-detail-section--row">
          <div className="admin-product-detail-field">
            <span className="admin-product-detail-label">供货价（元）</span>
            {editing && form ? (
              <input
                type="number"
                step="0.01"
                className="admin-product-detail-input"
                value={form.purchasePrice ?? ''}
                onChange={(e) => updateForm({ purchasePrice: e.target.value === '' ? null : Number(e.target.value) })}
              />
            ) : (
              <span className="admin-product-detail-value">
                {showData.purchasePrice != null ? `¥${Number(showData.purchasePrice).toFixed(2)}` : '未设置'}
              </span>
            )}
          </div>
          <div className="admin-product-detail-field">
            <span className="admin-product-detail-label">建议售价（元）</span>
            {editing && form ? (
              <input
                type="number"
                step="0.01"
                className="admin-product-detail-input"
                value={form.price ?? ''}
                onChange={(e) => updateForm({ price: Number(e.target.value) || 0 })}
              />
            ) : (
              <span className="admin-product-detail-value">¥{(Number(showData.price) || 0).toFixed(2)}</span>
            )}
          </div>
        </section>

        {/* 款式（SKU）：字段 + 款式图。共用单个 file input，由 skuImageTargetRef 指定当前操作的 sku 下标 */}
        <input
          ref={skuImageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="admin-product-detail-img-input-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            const target = skuImageTargetRef.current
            if (file && target != null) addSkuImage(target, file)
            e.target.value = ''
          }}
        />
        <section className="admin-product-detail-section">
          <h2 className="admin-product-detail-section-title">款式（SKU）</h2>
          {(showData.skus ?? []).length === 0 ? (
            <p className="admin-product-detail-no-data">暂无款式</p>
          ) : (
            <ul className="admin-product-detail-sku-list">
              {(showData.skus ?? []).map((sku, idx) => (
                <li key={idx} className="admin-product-detail-sku-card">
                  <div className="admin-product-detail-sku-fields">
                    <div className="admin-product-detail-sku-field">
                      <span className="admin-product-detail-sku-label">规格/属性（字段）</span>
                      {editing && form ? (
                        <input
                          type="text"
                          className="admin-product-detail-input"
                          value={typeof sku.attrs === 'string' ? sku.attrs : JSON.stringify(sku.attrs ?? '')}
                          onChange={(e) => {
                            const next = [...form.skus]
                            try {
                              next[idx] = { ...next[idx], attrs: JSON.parse(e.target.value) || e.target.value }
                            } catch {
                              next[idx] = { ...next[idx], attrs: e.target.value }
                            }
                            updateFormSkus(next)
                          }}
                          placeholder='如 {"颜色":"红","尺码":"M"}'
                        />
                      ) : (
                        <span className="admin-product-detail-sku-value">{attrsText(sku.attrs)}</span>
                      )}
                    </div>
                    {editing && form && (
                      <>
                        <div className="admin-product-detail-sku-field">
                          <span className="admin-product-detail-sku-label">供货价</span>
                          <input
                            type="number"
                            step="0.01"
                            className="admin-product-detail-input"
                            value={sku.purchasePrice ?? ''}
                            onChange={(e) => {
                              const next = [...form.skus]
                              next[idx] = { ...next[idx], purchasePrice: e.target.value === '' ? null : Number(e.target.value) }
                              updateFormSkus(next)
                            }}
                          />
                        </div>
                        <div className="admin-product-detail-sku-field">
                          <span className="admin-product-detail-sku-label">售价</span>
                          <input
                            type="number"
                            step="0.01"
                            className="admin-product-detail-input"
                            value={sku.sellingPrice ?? ''}
                            onChange={(e) => {
                              const next = [...form.skus]
                              next[idx] = { ...next[idx], sellingPrice: e.target.value === '' ? null : Number(e.target.value) }
                              updateFormSkus(next)
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="admin-product-detail-sku-images">
                    <span className="admin-product-detail-sku-label">款式图</span>
                    {editing && form ? (
                      <div className="admin-product-detail-sku-edit-img">
                        <div className="admin-product-detail-img-row admin-product-detail-img-row--editing">
                          {sku.coverImg && (
                            <div className="admin-product-detail-img-wrap admin-product-detail-img-wrap--sm">
                              <div className="admin-product-detail-img-item admin-product-detail-img-item--sm">
                                <img src={sku.coverImg} alt="" />
                              </div>
                              <button type="button" className="admin-product-detail-img-remove admin-product-detail-img-remove--sm" onClick={() => removeSkuImage(idx, true)} aria-label="删除">×</button>
                            </div>
                          )}
                          {(sku.images ?? []).map((url, i) => (
                            <div key={i} className="admin-product-detail-img-wrap admin-product-detail-img-wrap--sm">
                              <div className="admin-product-detail-img-item admin-product-detail-img-item--sm">
                                <img src={url} alt="" />
                              </div>
                              <button type="button" className="admin-product-detail-img-remove admin-product-detail-img-remove--sm" onClick={() => removeSkuImage(idx, false, i)} aria-label="删除">×</button>
                            </div>
                          ))}
                          <div className="admin-product-detail-img-add-wrap admin-product-detail-img-add-wrap--sm">
                            <button
                              type="button"
                              className="admin-product-detail-img-add admin-product-detail-img-add--sm"
                              onClick={() => { skuImageTargetRef.current = idx; skuImageInputRef.current?.click() }}
                              disabled={skuUploadingIdx === idx}
                            >
                              {skuUploadingIdx === idx ? '…' : '+'}
                            </button>
                          </div>
                        </div>
                        <div className="admin-product-detail-add-url-row">
                          <input
                            type="text"
                            className="admin-product-detail-input admin-product-detail-input--sm"
                            placeholder="款式图 URL 添加"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = (e.currentTarget as HTMLInputElement).value?.trim()
                                if (v) { addSkuImage(idx, v); (e.currentTarget as HTMLInputElement).value = '' }
                              }
                            }}
                          />
                          <button type="button" className="admin-product-detail-btn admin-product-detail-btn--secondary" onClick={(e) => {
                            const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                            const v = input?.value?.trim()
                            if (v) { addSkuImage(idx, v); input.value = '' }
                          }}>
                            添加
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {sku.coverImg || (sku.images && sku.images.length > 0) ? (
                          <div className="admin-product-detail-img-row">
                            {sku.coverImg && (
                              <div className="admin-product-detail-img-item">
                                <img src={sku.coverImg} alt="" />
                              </div>
                            )}
                            {(sku.images ?? []).map((url, i) => (
                              <div key={i} className="admin-product-detail-img-item">
                                <img src={url} alt="" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="admin-product-detail-no-data">无款式图（仅显示字段）</span>
                        )}
                      </>
                    )}
                  </div>
                  {editing && form && (
                    <button
                      type="button"
                      className="admin-product-detail-sku-remove"
                      onClick={() => updateFormSkus(form.skus.filter((_, i) => i !== idx))}
                    >
                      删除此款式
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editing && form && (
            <button
              type="button"
              className="admin-product-detail-add-sku"
              onClick={() => updateFormSkus([...form.skus, { attrs: {}, purchasePrice: null, sellingPrice: null, coverImg: null, images: [] }])}
            >
              添加款式
            </button>
          )}
        </section>
      </section>
    </div>
  )
}

export default AdminWarehouseProductDetail

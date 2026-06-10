import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAdminToast } from '../hooks/useAdminToast'
import { getCategoryNameZh } from '../constants/categoryNameZh'
import categoryTitleIcon from '../assets/category-icon.png'
import { useLang } from '../context/LangContext'
import AdminLoadingState from '../components/admin/AdminLoadingState'

interface CategoryItem {
  id: string
  parent_id: string | null
  level: number
  name: string
}

interface SupplyProduct {
  id: string
  title: string
  image: string
  purchasePrice: number | null
  price: number
  category: string
  subCategory: string
  sales: number
  status?: 'on' | 'off'
}

const PAGE_SIZE_OPTIONS = [10, 20, 30]

const AdminWarehouse: React.FC = () => {
  const navigate = useNavigate()
  const { loadError, actionSuccess, actionError } = useAdminToast()
  const { lang } = useLang()
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [list, setList] = useState<SupplyProduct[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [categoryId, setCategoryId] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set())
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

  const topCategories = categories.filter((c) => !c.parent_id || c.level === 1)
  const childrenByParentId = categories.reduce<Record<string, CategoryItem[]>>((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = []
      acc[c.parent_id].push(c)
    }
    return acc
  }, {})

  const toggleParentExpand = (parentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedParentIds((prev) => {
      const next = new Set(prev)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }

  const selectCategory = (id: string) => {
    handleCategoryChange(id)
    setCategoryDropdownOpen(false)
  }

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get<{ list: CategoryItem[] }>('/api/categories')
      setCategories(Array.isArray(res.list) ? res.list : [])
    } catch {
      setCategories([])
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const params = new URLSearchParams()
      params.set('limit', String(pageSize))
      params.set('offset', String(offset))
      if (categoryId) params.set('categoryId', categoryId)
      if (searchKeyword) params.set('search', searchKeyword)
      const res = await api.get<{ list: Array<SupplyProduct & { status?: 'on' | 'off' }>; total: number }>(
        `/api/products/supply?${params.toString()}`
      )
      const rawList = Array.isArray(res.list) ? res.list : []
      setList(
        rawList.map((row) => ({
          ...row,
          status: row.status === 'off' ? 'off' : 'on',
        }))
      )
      setTotal(Number(res.total) ?? 0)
    } catch (e) {
      loadError(e, lang === 'zh' ? '加载商品列表失败' : 'Failed to load product list')
      setList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, categoryId, searchKeyword, loadError, lang])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchProducts()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
      return () => document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchProducts])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }
    if (categoryDropdownOpen) {
      document.addEventListener('click', onDocClick)
      return () => document.removeEventListener('click', onDocClick)
    }
  }, [categoryDropdownOpen])

  const selectedCategoryLabel = categoryId
    ? getCategoryNameZh(categories.find((c) => c.id === categoryId)?.name ?? categoryId)
    : lang === 'zh'
      ? '全部分类'
      : 'All categories'

  const handleSearch = () => {
    setSearchKeyword(searchInput.trim())
    setPage(1)
  }

  const handleCategoryChange = (value: string) => {
    setCategoryId(value)
    setPage(1)
  }

  const goToDetail = (id: string) => {
    navigate(`/warehouse/product/${encodeURIComponent(id)}`)
  }

  const goToCreate = () => {
    navigate('/warehouse/product/new')
  }

  const toggleSupplyStatus = async (item: SupplyProduct) => {
    const nextStatus: 'on' | 'off' = item.status === 'off' ? 'on' : 'off'
    try {
      await api.patch(`/api/products/supply/${encodeURIComponent(item.id)}/status`, {
        status: nextStatus,
      })
      setList((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, status: nextStatus } : row))
      )
      actionSuccess(
        nextStatus === 'off'
          ? lang === 'zh'
            ? '已下架供货'
            : 'Supply turned off'
          : lang === 'zh'
            ? '已恢复供货'
            : 'Supply resumed',
      )
    } catch (e) {
      actionError(e, lang === 'zh' ? '更新状态失败' : 'Failed to update status')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="admin-warehouse">
      <header className="admin-warehouse-header admin-list-hero admin-list-hero--with-actions">
        <div className="admin-list-hero-row">
          <div className="admin-list-hero-head">
            <span className="admin-list-hero-eyebrow">{lang === 'zh' ? '商品供给' : 'Supply'}</span>
            <h2 className="admin-warehouse-title">
              {lang === 'zh' ? '商品仓库' : 'Product warehouse'}
            </h2>
          </div>
          <div className="admin-warehouse-toolbar admin-list-hero-actions">
        <div className="admin-warehouse-toolbar-left">
          <div className="admin-warehouse-category-dropdown" ref={categoryDropdownRef}>
            <button
              type="button"
              className={`admin-warehouse-category-trigger${categoryDropdownOpen ? ' admin-warehouse-category-trigger--open' : ''}`}
              onClick={() => setCategoryDropdownOpen((v) => !v)}
              aria-expanded={categoryDropdownOpen}
              aria-haspopup="listbox"
              aria-label={lang === 'zh' ? '按分类筛选' : 'Filter by category'}
            >
              <span className="admin-warehouse-category-trigger-icon" aria-hidden>
                <img src={categoryTitleIcon} alt="" className="admin-warehouse-category-trigger-icon-img" />
              </span>
              <span className="admin-warehouse-category-trigger-text">{selectedCategoryLabel}</span>
              <span className={`admin-warehouse-category-trigger-chevron${categoryDropdownOpen ? ' admin-warehouse-category-trigger-chevron--open' : ''}`} aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            {categoryDropdownOpen && (
              <div
                className="admin-warehouse-category-menu"
                role="listbox"
                aria-label={lang === 'zh' ? '选择分类' : 'Choose category'}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={!categoryId}
                  className={`admin-warehouse-category-option admin-warehouse-category-option--all${!categoryId ? ' admin-warehouse-category-option--active' : ''}`}
                  onClick={() => selectCategory('')}
                >
                  {lang === 'zh' ? '全部分类' : 'All categories'}
                </button>
                <div className="admin-warehouse-category-divider" />
                {topCategories.map((parent) => {
                  const isExpanded = expandedParentIds.has(parent.id)
                  const children = childrenByParentId[parent.id] ?? []
                  const hasChildren = children.length > 0
                  return (
                    <div key={parent.id} className="admin-warehouse-category-group">
                      <div
                        className={`admin-warehouse-category-parent${categoryId === parent.id ? ' admin-warehouse-category-option--active' : ''}`}
                        role="option"
                        aria-selected={categoryId === parent.id}
                        aria-expanded={hasChildren ? isExpanded : undefined}
                        onClick={() => {
                          if (isExpanded && hasChildren) {
                            selectCategory(parent.id)
                          } else if (hasChildren) {
                            setExpandedParentIds((prev) => new Set(prev).add(parent.id))
                          } else {
                            selectCategory(parent.id)
                          }
                        }}
                      >
                        <span className="admin-warehouse-category-parent-label">
                          {getCategoryNameZh(parent.name) || parent.id}
                        </span>
                        {hasChildren ? (
                          <button
                            type="button"
                            className={`admin-warehouse-category-parent-chevron${isExpanded ? ' admin-warehouse-category-parent-chevron--open' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleParentExpand(parent.id, e)
                            }}
                            aria-label={
                              isExpanded
                                ? lang === 'zh'
                                  ? '收起'
                                  : 'Collapse'
                                : lang === 'zh'
                                  ? '展开'
                                  : 'Expand'
                            }
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      {hasChildren && isExpanded && (
                        <div className="admin-warehouse-category-children">
                          <button
                            type="button"
                            role="option"
                            aria-selected={categoryId === parent.id}
                            className={`admin-warehouse-category-option admin-warehouse-category-option--parent${categoryId === parent.id ? ' admin-warehouse-category-option--active' : ''}`}
                            onClick={() => selectCategory(parent.id)}
                          >
                            <span className="admin-warehouse-category-option-name">
                              {lang === 'zh' ? '（当前大分类全部）' : '(All in this main category)'}
                            </span>
                          </button>
                          {children.map((child) => (
                            <button
                              key={child.id}
                              type="button"
                              role="option"
                              aria-selected={categoryId === child.id}
                              className={`admin-warehouse-category-option admin-warehouse-category-option--child${categoryId === child.id ? ' admin-warehouse-category-option--active' : ''}`}
                              onClick={() => selectCategory(child.id)}
                            >
                              <span className="admin-warehouse-category-option-name">{getCategoryNameZh(child.name) || child.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="admin-warehouse-search-wrap">
            <input
              type="text"
              className="admin-warehouse-search-input"
              placeholder={lang === 'zh' ? '搜索商品名称或 ID' : 'Search by product name or ID'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              aria-label={lang === 'zh' ? '搜索' : 'Search'}
            />
            <button type="button" className="admin-warehouse-search-btn" onClick={handleSearch}>
              {lang === 'zh' ? '查询' : 'Search'}
            </button>
          </div>
        </div>
        <div className="admin-warehouse-toolbar-right">
          <button
            type="button"
            className="admin-warehouse-add-btn"
            onClick={goToCreate}
          >
            {lang === 'zh' ? '上传商品' : 'Upload product'}
          </button>
          <span className="admin-warehouse-page-size-label">
            {lang === 'zh' ? '每页' : 'Per page'}
          </span>
          <select
            className="admin-warehouse-select admin-warehouse-select--sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            aria-label={lang === 'zh' ? '每页条数' : 'Items per page'}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="admin-warehouse-page-size-label">
            {lang === 'zh' ? '条' : 'items'}
          </span>
        </div>
          </div>
        </div>
        <p className="admin-warehouse-desc">
          {lang === 'zh'
            ? '管理平台供货商品，数据来自数据库。支持按分类筛选、关键词搜索与分页查看。'
            : 'Manage platform supply products from the database, with category filter, keyword search and pagination.'}
        </p>
      </header>

      <section className="admin-warehouse-table-wrap">
        {loading ? (
          <AdminLoadingState variant="panel" label={lang === 'zh' ? '加载商品列表' : 'Loading products'} />
        ) : (
          <div className="admin-table-scroll">
          <table className="admin-warehouse-table" role="grid">
            <thead>
              <tr>
                <th className="admin-warehouse-col admin-warehouse-col--img">
                  {lang === 'zh' ? '图片' : 'Image'}
                </th>
                <th className="admin-warehouse-col admin-warehouse-col--id">
                  {lang === 'zh' ? '商品 ID' : 'Product ID'}
                </th>
                <th className="admin-warehouse-col admin-warehouse-col--name">
                  {lang === 'zh' ? '商品名称' : 'Product name'}
                </th>
                <th className="admin-warehouse-col admin-warehouse-col--category">
                  {lang === 'zh' ? '分类' : 'Category'}
                </th>
                <th className="admin-warehouse-col admin-warehouse-col--subcategory">
                  {lang === 'zh' ? '子分类' : 'Sub‑category'}
                </th>
                <th className="admin-warehouse-col admin-warehouse-col--purchase">
                  {lang === 'zh' ? '供货价（元）' : 'Supply price (CNY)'}
                </th>
                <th className="admin-warehouse-col admin-warehouse-col--price">
                  {lang === 'zh' ? '建议售价（元）' : 'Suggested price (CNY)'}
                </th>
                <th className="admin-warehouse-col admin-warehouse-sticky admin-warehouse-sticky--status">
                  {lang === 'zh' ? '供货状态' : 'Supply status'}
                </th>
                <th className="admin-warehouse-col admin-warehouse-sticky admin-warehouse-sticky--actions">
                  {lang === 'zh' ? '操作' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={9} className="admin-warehouse-empty">
                    {lang === 'zh' ? '暂无商品数据' : 'No products yet'}
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr
                    key={row.id}
                    className={`admin-warehouse-tr${
                      row.status === 'off' ? ' admin-warehouse-tr--disabled' : ''
                    }`}
                  >
                    <td className="admin-warehouse-col admin-warehouse-col--img">
                      <div className="admin-warehouse-cell-img-wrap">
                        {row.image ? (
                          <img src={row.image} alt="" className="admin-warehouse-cell-img" loading="lazy" decoding="async" />
                        ) : (
                          <span className="admin-warehouse-cell-img-placeholder">—</span>
                        )}
                      </div>
                    </td>
                    <td className="admin-warehouse-col admin-warehouse-col--id">
                      <code className="admin-warehouse-code">{row.id}</code>
                    </td>
                    <td className="admin-warehouse-col admin-warehouse-col--name">
                      <span className="admin-cell-ellipsis" title={row.title || undefined}>
                        {row.title || '—'}
                      </span>
                    </td>
                    <td className="admin-warehouse-col admin-warehouse-col--category">{row.category || '—'}</td>
                    <td className="admin-warehouse-col admin-warehouse-col--subcategory">{row.subCategory || '—'}</td>
                    <td className="admin-warehouse-col admin-warehouse-col--purchase">
                      {row.purchasePrice != null ? (
                        `¥${Number(row.purchasePrice).toFixed(2)}`
                      ) : (
                        <span
                          className="admin-warehouse-cell-empty"
                          title={
                            lang === 'zh'
                              ? '可在编辑中填写供货价'
                              : 'You can fill in the supply price in edit page'
                          }
                        >
                          {lang === 'zh' ? '未设置' : 'Not set'}
                        </span>
                      )}
                    </td>
                    <td className="admin-warehouse-col admin-warehouse-col--price">
                      ¥{(Number(row.price) || 0).toFixed(2)}
                    </td>
                    <td className="admin-warehouse-col admin-warehouse-sticky admin-warehouse-sticky--status">
                      <span
                        className={`admin-warehouse-status-pill admin-warehouse-status-pill--${
                          row.status === 'off' ? 'off' : 'on'
                        }`}
                      >
                        {row.status === 'off'
                          ? lang === 'zh'
                            ? '已停止供货'
                            : 'Supply stopped'
                          : lang === 'zh'
                            ? '供货中'
                            : 'Supplying'}
                      </span>
                    </td>
                    <td className="admin-warehouse-col admin-warehouse-sticky admin-warehouse-sticky--actions">
                      <div className="admin-warehouse-action-stack">
                        <button
                          type="button"
                          className="admin-warehouse-action-btn"
                          onClick={() => goToDetail(row.id)}
                        >
                          {lang === 'zh' ? '查看详情' : 'View details'}
                        </button>
                        <button
                          type="button"
                          className="admin-warehouse-action-btn admin-warehouse-action-btn--secondary"
                          onClick={() => toggleSupplyStatus(row)}
                        >
                          {row.status === 'off'
                            ? lang === 'zh'
                              ? '恢复供货'
                              : 'Resume supply'
                            : lang === 'zh'
                              ? '下架供货'
                              : 'Turn off supply'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        )}
        {!loading && total > 0 && (
        <footer className="admin-table-footer admin-warehouse-pagination">
          <span className="admin-warehouse-pagination-total">
            {lang === 'zh' ? '共 ' : 'Total '}
            {total}
            {lang === 'zh' ? ' 条' : ''}
          </span>
          <div className="admin-warehouse-pagination-btns">
            <button
              type="button"
              className="admin-warehouse-pagination-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label={lang === 'zh' ? '上一页' : 'Previous page'}
            >
              {lang === 'zh' ? '上一页' : 'Previous'}
            </button>
            <span className="admin-warehouse-pagination-info">
              {lang === 'zh' ? '第 ' : 'Page '}
              {page}
              {lang === 'zh' ? ' / ' : ' of '}
              {totalPages}
              {lang === 'zh' ? ' 页' : ''}
            </span>
            <button
              type="button"
              className="admin-warehouse-pagination-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label={lang === 'zh' ? '下一页' : 'Next page'}
            >
              {lang === 'zh' ? '下一页' : 'Next'}
            </button>
          </div>
        </footer>
        )}
      </section>
    </div>
  )
}

export default AdminWarehouse

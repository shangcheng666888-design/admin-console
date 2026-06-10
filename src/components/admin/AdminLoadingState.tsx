import React from 'react'

export type AdminLoadingVariant = 'page' | 'panel' | 'inline'

export interface AdminLoadingStateProps {
  /** 展示在动画下方的提示文案 */
  label?: string
  /** page：整页居中；panel：表格/面板区域；inline：紧凑行内 */
  variant?: AdminLoadingVariant
  className?: string
}

const AdminLoadingState: React.FC<AdminLoadingStateProps> = ({
  label = '数据加载中',
  variant = 'panel',
  className = '',
}) => {
  return (
    <div
      className={['admin-loading-state', `admin-loading-state--${variant}`, className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div id="loader" aria-hidden>
        <div id="sq1" className="square" />
        <div id="sq2" className="square" />
        <div id="sq3" className="square" />
        <div id="sq4" className="square" />
        <div id="sq5" className="square" />
        <div id="sq6" className="square" />
        <div id="sq7" className="square" />
        <div id="sq8" className="square" />
        <div id="sq9" className="square" />
      </div>
      {label ? <p className="admin-loading-state-label">{label}</p> : null}
    </div>
  )
}

export default AdminLoadingState

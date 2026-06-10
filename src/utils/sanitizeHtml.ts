/**
 * 对富文本 HTML 做净化，防止 XSS。
 * 用于商品描述、管理端描述预览等 dangerouslySetInnerHTML 场景。
 */
import DOMPurify from 'dompurify'

/** 商品描述等富文本允许的标签（白名单） */
const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span', 'a', 'strong', 'b', 'em', 'i', 'u',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'img', 'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'hr', 'pre', 'code',
]

/** 允许的属性 */
const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'title',  // a
  'src', 'alt', 'width', 'height',   // img
  'class', 'style', 'align',         // 通用
]

/**
 * 净化 HTML 字符串，仅保留白名单内标签与属性，去除 script、事件等。
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  })
}

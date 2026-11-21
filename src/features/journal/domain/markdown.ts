import DOMPurify from 'dompurify'
import { Marked } from 'marked'

const marked = new Marked({ gfm: true, breaks: true, async: false })

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td']

// Los enlaces se abren fuera de la app y sin referrer; nada más lleva atributos.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

/**
 * Markdown -> HTML seguro. Lista cerrada de etiquetas, sin imágenes, estilos ni manejadores de eventos,
 * y solo enlaces http(s) y mailto. El resultado es lo único que puede ir a dangerouslySetInnerHTML.
 */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source) as string
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    ALLOW_DATA_ATTR: false,
  })
}

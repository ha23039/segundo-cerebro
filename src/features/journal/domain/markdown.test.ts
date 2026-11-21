import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('renderiza Markdown básico', () => {
    const html = renderMarkdown('# Título\n\nUn **texto** con *énfasis* y `código`.\n\n- uno\n- dos')
    expect(html).toContain('<h1>Título</h1>')
    expect(html).toContain('<strong>texto</strong>')
    expect(html).toContain('<em>énfasis</em>')
    expect(html).toContain('<code>código</code>')
    expect(html).toContain('<li>uno</li>')
  })

  it('elimina scripts, manejadores de eventos y HTML crudo peligroso', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<div onclick="x()" style="color:red">hola</div>\n\n<iframe src="https://evil.test"></iframe>')
    expect(html).not.toMatch(/<script|<img|<iframe|onerror|onclick|style=/i)
    expect(html).toContain('hola')
  })

  it('bloquea enlaces javascript: y data:, y deja los https con rel seguro', () => {
    const bad = renderMarkdown('[x](javascript:alert(1)) [y](data:text/html,<script>alert(1)</script>)')
    expect(bad).not.toMatch(/javascript:|data:/i)
    const ok = renderMarkdown('[web](https://example.com)')
    expect(ok).toContain('href="https://example.com"')
    expect(ok).toContain('target="_blank"')
    expect(ok).toContain('rel="noopener noreferrer nofollow"')
  })

  it('no permite imágenes (ni siquiera con Markdown)', () => {
    expect(renderMarkdown('![x](https://example.com/a.png)')).not.toContain('<img')
  })

  it('un texto vacío da HTML vacío', () => {
    expect(renderMarkdown('')).toBe('')
  })
})

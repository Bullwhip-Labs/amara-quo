// /lib/services/email/rich_email_renderer.ts
// Cross-client Markdown → email HTML renderer (Outlook/Gmail/Apple-safe). Handles bold/italic, lists, and tables.

export interface EmailRenderOptions {
  fontFamily?: string
  fontSize?: string
  lineHeight?: string
  textColor?: string
  tableBorderColor?: string
  headerColor?: string
}

export class RichEmailRenderer {
  private options: Required<EmailRenderOptions>

  constructor(opts?: EmailRenderOptions) {
    this.options = {
      fontFamily: opts?.fontFamily ?? 'Inter, Arial, sans-serif',
      fontSize: opts?.fontSize ?? '16px',
      lineHeight: opts?.lineHeight ?? '24px',
      textColor: opts?.textColor ?? '#111827',
      tableBorderColor: opts?.tableBorderColor ?? '#e5e7eb',
      headerColor: opts?.headerColor ?? '#111827',
    }
  }

  // Public: main entry — returns inner HTML for wrapper <td>
  renderToEmailHtml(markdown: string): string {
    // Normalize line endings
    const src = markdown.replace(/\r\n/g, '\n')

    // Split into blocks (tables, lists, paragraphs, headings)
    const blocks = this.tokenizeBlocks(src)

    const parts: string[] = []
    for (const block of blocks) {
      switch (block.type) {
        case 'table':
          parts.push(this.createEmailTable(block.headers, block.rows))
          break
        case 'ul':
          parts.push(this.createBulletList(block.items))
          break
        case 'ol':
          parts.push(this.createNumberList(block.items))
          break
        case 'h2':
          parts.push(this.heading(block.text, 20, 28, true))
          break
        case 'h3':
          parts.push(this.heading(block.text, 18, 26, true))
          break
        case 'p':
          parts.push(this.paragraph(block.text))
          break
        case 'hr':
          parts.push(this.rule())
          break
        default:
          parts.push(this.paragraph(block.text))
      }
    }

    return parts.join('')
  }

  // ---- Block helpers

  private heading(text: string, size: number, lh: number, bold = false): string {
    const o = this.options
    const content = this.processInline(text)
    return `
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0;padding:0;">
  <tr>
    <td align="left" valign="top" style="padding:20px 0 8px 0;font-family:${o.fontFamily};font-size:${size}px;line-height:${lh}px;color:${o.headerColor};${bold ? 'font-weight:700;' : ''}mso-line-height-rule:exactly;">
      ${content}
    </td>
  </tr>
</table>`
  }

  private paragraph(text: string): string {
    const o = this.options
    // Allow empty lines to produce spacing, but ensure Outlook keeps height
    const safe = text.trim().length ? this.processInline(text) : '&nbsp;'
    return `
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0;padding:0;">
  <tr>
    <td align="left" valign="top" style="padding:0 0 12px 0;font-family:${o.fontFamily};font-size:${o.fontSize};line-height:${o.lineHeight};color:${o.textColor};mso-line-height-rule:exactly;">
      ${safe}
    </td>
  </tr>
</table>`
  }

  private rule(): string {
    const o = this.options
    return `
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0;padding:16px 0;">
  <tr>
    <td style="height:1px;line-height:1px;mso-line-height-rule:exactly;background:${o.tableBorderColor};">&nbsp;</td>
  </tr>
</table>`
  }

  private createBulletList(items: string[]): string {
    const o = this.options
    // Bulletproof UL for Outlook/Gmail: use UL/LI but enforce spacing and bullets
    const lis = items.map((raw) => {
      const content = this.processInline(raw)
      return `<li style="margin:0 0 8px 0;mso-line-height-rule:exactly;">${content}</li>`
    }).join('')

    return `
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td align="left" valign="top" style="padding:0 0 12px 0;font-family:${o.fontFamily};font-size:${o.fontSize};line-height:${o.lineHeight};color:${o.textColor};mso-line-height-rule:exactly;">
      <ul style="margin:0;padding:0 0 0 20px;list-style-type:disc;">
        ${lis}
      </ul>
    </td>
  </tr>
</table>`
  }

  private createNumberList(items: string[]): string {
    const o = this.options
    const lis = items.map((raw) => {
      const content = this.processInline(raw)
      return `<li style="margin:0 0 8px 0;mso-line-height-rule:exactly;">${content}</li>`
    }).join('')

    return `
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td align="left" valign="top" style="padding:0 0 12px 0;font-family:${o.fontFamily};font-size:${o.fontSize};line-height:${o.lineHeight};color:${o.textColor};mso-line-height-rule:exactly;">
      <ol style="margin:0;padding:0 0 0 20px;">
        ${lis}
      </ol>
    </td>
  </tr>
</table>`
  }

  private createEmailTable(headers: string[], rows: string[][]): string {
    const o = this.options

    const headerCells = headers.map((h) => {
      const content = this.processInline(h.trim() || '&nbsp;')
      return `<th align="left" valign="top" bgcolor="#f8f9fa" style="padding:10px;border:1px solid ${o.tableBorderColor};font-family:${o.fontFamily};font-size:14px;line-height:20px;color:${o.headerColor};font-weight:700;background-color:#f8f9fa;mso-line-height-rule:exactly;">${content}</th>`
    }).join('')

    const dataRows = rows.map((r, idx) => {
      const tds = r.map((cell) => {
        const content = this.processInline(cell.trim() || '&nbsp;')
        return `<td align="left" valign="top" style="padding:10px;border:1px solid ${o.tableBorderColor};font-family:${o.fontFamily};font-size:14px;line-height:20px;color:${o.textColor};mso-line-height-rule:exactly;">${content}</td>`
      }).join('')
      const bg = idx % 2 === 0 ? '' : ' bgcolor="#fcfcfd"'
      return `<tr${bg}>${tds}</tr>`
    }).join('')

    return `
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
  <tr>
    <td>
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
        <tr>${headerCells}</tr>
        ${dataRows}
      </table>
    </td>
  </tr>
</table>`
  }

  // ---- Tokenization (basic but predictable)

  private tokenizeBlocks(src: string): Array<any> {
    const lines = src.split('\n')
    const blocks: Array<any> = []
    let i = 0

    const collectList = (ordered: boolean) => {
      const items: string[] = []
      while (i < lines.length) {
        const line = lines[i]
        if (ordered ? /^\s*\d+\.\s+/.test(line) : /^\s*[-*]\s+/.test(line)) {
          items.push(line.replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, ''))
          i++
          continue
        }
        break
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items })
    }

    const collectTable = () => {
      // GitHub-like pipe tables
      const headerLine = lines[i++]
      const sepLine = lines[i] ?? ''
      if (!/^\s*\|?[-:\s|]+\|?\s*$/.test(sepLine)) {
        // not a real table, treat as paragraph
        blocks.push({ type: 'p', text: headerLine })
        return
      }
      i++ // consume separator
      const headers = headerLine.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim())
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const row = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim())
        rows.push(row)
        i++
      }
      blocks.push({ type: 'table', headers, rows })
    }

    while (i < lines.length) {
      const line = lines[i]

      if (/^\s*$/.test(line)) { // blank line
        blocks.push({ type: 'p', text: '' })
        i++
        continue
      }

      if (/^##\s+/.test(line)) {
        blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') })
        i++
        continue
      }

      if (/^###\s+/.test(line)) {
        blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '') })
        i++
        continue
      }

      if (/^\s*[-*]\s+/.test(line)) {
        collectList(false)
        continue
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        collectList(true)
        continue
      }

      if (/^\s*\|/.test(line)) {
        collectTable()
        continue
      }

      if (/^\s*---\s*$/.test(line)) {
        blocks.push({ type: 'hr' })
        i++
        continue
      }

      blocks.push({ type: 'p', text: line })
      i++
    }

    return blocks
  }

  // ---- Inline formatting and safe escaping

  private processInline(text: string): string {
    // Escape first (idempotent-ish): convert raw characters but keep existing entities
    let out = this.escapeHtml(text)

    // Bold **text**
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *text* (avoid inside **)
    out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Code `text`
    out = out.replace(/`([^`]+)`/g, (_m, g1) => `<code style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;font-size:0.95em;">${g1}</code>`)
    // Simple links [text](url)
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#2563eb;text-decoration:underline;">$1</a>')

    return out
  }

  private escapeHtml(text: string): string {
    // Avoid double-escape: only replace & not already starting an entity
    return text
      .replace(/&(?!(?:[a-zA-Z]+|#\d+);)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}

// Convenience function
export const renderEmailContent = (markdown: string, options?: EmailRenderOptions): string => {
  const renderer = new RichEmailRenderer(options)
  return renderer.renderToEmailHtml(markdown)
}

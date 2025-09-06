// /lib/services/emails/rich_email_renderer.ts
// Minimal cross-platform Markdown -> email HTML (Gmail/Outlook/Apple).
// Supports: bold, italics, bullet lists, tables, consistent line spacing.

export interface EmailRenderOptions {
  fontFamily?: string
  fontSize?: string
  lineHeight?: string
  textColor?: string
  tableBorderColor?: string
}

export class RichEmailRenderer {
  private options: Required<EmailRenderOptions>

  constructor(options: EmailRenderOptions = {}) {
    this.options = {
      fontFamily: options.fontFamily || 'Arial, sans-serif',
      fontSize: options.fontSize || '14px',
      lineHeight: options.lineHeight || '1.6',
      textColor: options.textColor || '#333333',
      tableBorderColor: options.tableBorderColor || '#e0e0e0',
    }
  }

  /**
   * Convert markdown to email-safe HTML (robust across Outlook/Gmail/Apple).
   * Order matters: escape once; never re-escape later.
   */
  renderToEmailHtml(markdown: string): string {
    if (!markdown?.trim()) return ''

    // 1) Escape HTML metacharacters so user content can't inject HTML
    let html = this.escapeHtml(markdown)

    // 2) Blocks first (so later paragraphing won't wrap them)
    html = this.processTables(html)
    html = this.processLists(html)

    // 3) Inline styles (bold/italic) across remaining text
    html = this.processTextFormatting(html)

    // 4) Paragraphize the rest with consistent spacing
    html = this.processParagraphs(html)

    return html.trim()
  }

  // ---------- Blocks ----------

  /**
   * Markdown tables -> true <table> for Outlook reliability.
   * Matches:
   * | h1 | h2 |
   * | --- | --- |
   * | a | b |
   */
  private processTables(input: string): string {
    const re = /\|(.+)\|\s*\n\|[-\s|:]+\|\s*\n((?:\|.*\|\s*\n?)*)/g
    return input.replace(re, (_m, headerRow: string, dataRows: string) => {
      const headers = this.parseTableRow(headerRow)
      const rows = dataRows
        .trim()
        .split('\n')
        .filter((r) => r.trim())
        .map((r) => this.parseTableRow(r))
      return this.createEmailTable(headers, rows)
    })
  }

  private createEmailTable(headers: string[], rows: string[][]): string {
    const o = this.options

    const thead =
      '<tr>' +
      headers
        .map(
          (h) =>
            `<th align="left" valign="top" style="padding:10px 8px;border-bottom:2px solid ${o.tableBorderColor};font-family:${o.fontFamily};font-size:${o.fontSize};line-height:${o.lineHeight};color:${o.textColor};font-weight:bold;background:#f8f9fa;mso-line-height-rule:exactly;">${this.processInlineFormatting(
              h.trim()
            )}</th>`
        )
        .join('') +
      '</tr>'

    const tbody = rows
      .map((row, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8f9fa'
        const tds = row
          .map(
            (cell) =>
              `<td align="left" valign="top" style="padding:8px;border-bottom:1px solid ${o.tableBorderColor};background:${bg};font-family:${o.fontFamily};font-size:${o.fontSize};line-height:${o.lineHeight};color:${o.textColor};mso-line-height-rule:exactly;">${this.processInlineFormatting(
                cell.trim()
              )}</td>`
          )
          .join('')
        return `<tr>${tds}</tr>`
      })
      .join('')

    return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${o.tableBorderColor};border-collapse:collapse;margin:16px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <thead>${thead}</thead>
  <tbody>${tbody}</tbody>
</table>`.trim()
  }

  /**
   * Bullet lists: lines starting with -, *, or •.
   * Renders as a table-based list (stable in Outlook).
   * Supports 2-space indent per level.
   */
  private processLists(input: string): string {
    const lines = input.split('\n')
    const out: string[] = []
    let inList = false
    let rows: string[] = []

    const flush = () => {
      if (!inList || rows.length === 0) return
      out.push(
        `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:separate;">${rows.join(
          ''
        )}</table>`
      )
      rows = []
      inList = false
    }

    for (const raw of lines) {
      const line = raw.replace(/\r$/, '')
      const m = line.match(/^(\s*)[•\*\-] (.+)$/)
      if (m) {
        const [, indent, text] = m
        const level = Math.floor((indent || '').length / 2)
        const leftPad = Math.max(0, level * 20)
        const bullet = '•'

        inList = true
        rows.push(
          `<tr>
             <td width="${12 + leftPad}" valign="top" style="padding:4px 0 4px ${leftPad}px;font-family:${this.options.fontFamily};mso-line-height-rule:exactly;">
               <span style="color:${this.options.textColor};font-weight:bold;">${bullet}</span>
             </td>
             <td valign="top" style="padding:4px 0;font-family:${this.options.fontFamily};font-size:${this.options.fontSize};line-height:${this.options.lineHeight};color:${this.options.textColor};mso-line-height-rule:exactly;">
               ${this.processInlineFormatting(text)}
             </td>
           </tr>`
        )
        continue
      }

      // Non-list line: end list if we were in one
      flush()
      out.push(line)
    }

    flush()
    return out.join('\n')
  }

  // ---------- Inline formatting ----------

  /**
   * Bold/italic across the whole (already-escaped) string.
   * Avoids lookbehind for broader runtime compatibility.
   */
  private processTextFormatting(input: string): string {
    let html = input

    // Bold: **text** or __text__
    html = html.replace(/\*\*([^*\n]+)\*\*/g, `<strong style="font-weight:bold;color:${this.options.textColor};">$1</strong>`)
    html = html.replace(/__([^_\n]+)__/g, `<strong style="font-weight:bold;color:${this.options.textColor};">$1</strong>`)

    // Italic: *text* or _text_
    html = html.replace(/\*([^*\n]+)\*/g, `<em style="font-style:italic;color:${this.options.textColor};">$1</em>`)
    html = html.replace(/_([^_\n]+)_/g, `<em style="font-style:italic;color:${this.options.textColor};">$1</em>`)

    return html
  }

  /**
   * Inline formatting for text inside table/list cells.
   * IMPORTANT: Do NOT escape here—the input is already escaped up front.
   */
  private processInlineFormatting(text: string): string {
    let t = text
    t = t.replace(/\*\*([^*\n]+)\*\*/g, `<strong style="font-weight:bold;">$1</strong>`)
    t = t.replace(/__([^_\n]+)__/g, `<strong style="font-weight:bold;">$1</strong>`)
    t = t.replace(/\*([^*\n]+)\*/g, `<em style="font-style:italic;">$1</em>`)
    t = t.replace(/_([^_\n]+)_/g, `<em style="font-style:italic;">$1</em>`)
    return t
  }

  // ---------- Paragraphs ----------

  /**
   * Wrap non-HTML blocks in <p> with normalized spacing.
   * Keeps tables/list tables as-is (block HTML starts with "<").
   * Converts single newlines within a paragraph to <br>.
   */
  private processParagraphs(input: string): string {
    const lines = input.split('\n')
    const out: string[] = []
    let para: string[] = []

    const pushPara = () => {
      if (!para.length) return
      const joined = para.join(' ')
      const inner = joined.replace(/\n/g, '<br>')
      out.push(
        `<p style="margin:12px 0;font-family:${this.options.fontFamily};font-size:${this.options.fontSize};line-height:${this.options.lineHeight};color:${this.options.textColor};mso-line-height-rule:exactly;">${inner}</p>`
      )
      para = []
    }

    for (const raw of lines) {
      const line = raw.trim()

      if (line === '') {
        pushPara()
        continue
      }

      if (line.startsWith('<')) {
        // Block HTML (table/list) – end current para, then insert block
        pushPara()
        out.push(line)
      } else {
        para.push(line)
      }
    }

    pushPara()
    return out.join('\n')
  }

  // ---------- Utils ----------

  private parseTableRow(row: string): string[] {
    return row
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c !== '')
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
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

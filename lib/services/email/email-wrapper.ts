// /lib/services/emails/email-wrapper.ts
// Wrapper HTML (doctype, meta, preheader, Outlook conditionals). Delegates inner content to RichEmailRenderer.

import { renderEmailContent } from '../email/rich_email_renderer'

export interface EmailWrapperOptions {
  template?: 'standard' | 'urgent' | 'quote'
  subject: string
  preheader?: string
}

export interface EmailResult {
  html: string
  text: string
}

export class EmailWrapper {
  wrapContent(markdownContent: string, options: EmailWrapperOptions): EmailResult {
    const htmlBody = renderEmailContent(markdownContent, {})
    const html = this.wrapHtml(htmlBody, options)
    const text = this.wrapPlainText(markdownContent, options)
    return { html, text }
  }

  private wrapHtml(innerHtml: string, options: EmailWrapperOptions): string {
    const brand = this.brandLine(options.template)
    const preheader = options.preheader ?? ''
    return `<!doctype html>
<html lang="en">
<head>
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escapeHtml(options.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <!-- Preheader (hidden) -->
  <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;color:transparent;">
    ${this.escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0;padding:0;">
    <tr>
      <td align="center" valign="top" style="padding:0;mso-line-height-rule:exactly;">
        <!--[if mso]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600"><tr><td>
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;">
          <tr>
            <td align="left" valign="top" style="padding:24px 20px 8px 20px;font-family:Inter, Arial, sans-serif;font-size:12px;line-height:18px;color:#6b7280;mso-line-height-rule:exactly;">
              ${this.escapeHtml(brand)}
            </td>
          </tr>
          <tr>
            <td align="left" valign="top" style="padding:8px 20px 28px 20px;font-family:Inter, Arial, sans-serif;font-size:16px;line-height:24px;color:#111827;mso-line-height-rule:exactly;">
              ${innerHtml}
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
  }

  private wrapPlainText(markdownContent: string, options: EmailWrapperOptions): string {
    // Very basic conversion to plain text — lists, tables, inline emphasis cues
    let t = markdownContent
      .replace(/\r\n/g, '\n')
      .replace(/^##\s+/gm, '')
      .replace(/^###\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1') // strip bold markers
      .replace(/\*([^*]+)\*/g, '$1')     // strip italic markers
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 <$2>')

    // Bullet/number lists: keep bullets for readability
    t = t.replace(/^\s*[-*]\s+/gm, '• ')
         .replace(/^\s*(\d+)\.\s+/gm, '$1) ')

    // Pipe tables → TSV-ish
    t = t.replace(/^\s*\|(.+)\|\s*$/gm, (_m, row: string) =>
      row.split('|').map(c => c.trim()).join('\t')
    )

    const header = this.brandLine(options.template)
    const separator = '—'.repeat(40)
    return `${header}
${separator}

${t}
`
  }

  private brandLine(template?: EmailWrapperOptions['template']): string {
    switch (template) {
      case 'urgent': return 'AMARA QUO – URGENT'
      case 'quote':  return 'AMARA QUO – FREIGHT QUOTE'
      default:       return 'AMARA QUO – FREIGHT INTELLIGENCE'
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&(?!(?:[a-zA-Z]+|#\d+);)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}

export const wrapEmailContent = (content: string, options: EmailWrapperOptions): EmailResult => {
  const wrapper = new EmailWrapper()
  return wrapper.wrapContent(content, options)
}

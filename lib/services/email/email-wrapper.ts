// /lib/services/emails/email-wrapper.ts
// Minimal email template wrapper - ONLY handles branding/layout
// Delegates all content formatting to rich-email-renderer

import { RichEmailRenderer } from './rich_email_renderer'

export interface EmailWrapperOptions {
  template?: 'standard' | 'urgent' | 'quote'
  subject: string
}

export interface EmailResult {
  html: string
  text: string
}

export class EmailWrapper {
  private renderer: RichEmailRenderer

  constructor() {
    this.renderer = new RichEmailRenderer()
  }

  /**
   * Wrap rendered content in email template
   */
  wrapContent(markdownContent: string, options: EmailWrapperOptions): EmailResult {
    // Use renderer for content formatting
    const renderedContent = this.renderer.renderToEmailHtml(markdownContent)
    
    // Wrap in template
    const html = this.wrapInTemplate(renderedContent, options)
    const text = this.wrapPlainText(markdownContent, options)
    
    return { html, text }
  }

  /**
   * Wrap formatted HTML content in email template with solid Outlook-safe styling
   */
  private wrapInTemplate(content: string, options: EmailWrapperOptions): string {
    const headerBg = this.getHeaderColor(options.template)
    const headerText = this.getHeaderText(options.template)

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(options.subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
      <td align="center" style="padding:20px 0;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          
          <!-- Header -->
          <tr>
            <td style="background-color:${headerBg};color:#ffffff;padding:24px;font-family:Arial,sans-serif;mso-line-height-rule:exactly;">
              <h1 style="margin:0;font-size:24px;font-weight:300;letter-spacing:2px;line-height:28px;mso-line-height-rule:exactly;">AMARA QUO</h1>
              <p style="margin:4px 0 0 0;font-size:12px;line-height:16px;mso-line-height-rule:exactly;">${headerText}</p>
            </td>
          </tr>
          
          <!-- Content (pre-formatted by renderer) -->
          <tr>
            <td style="padding:24px;font-family:Arial,sans-serif;mso-line-height-rule:exactly;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background-color:#f8f9fa;border-top:1px solid #e9ecef;font-family:Arial,sans-serif;text-align:center;mso-line-height-rule:exactly;">
              <p style="margin:0;font-size:12px;color:#6c757d;line-height:16px;mso-line-height-rule:exactly;">
                Automated response from Amara QUO Freight Intelligence
              </p>
              <p style="margin:4px 0 0 0;font-size:12px;color:#6c757d;line-height:16px;mso-line-height-rule:exactly;">
                ${new Date().toLocaleString()}
              </p>
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

  /**
   * Create plain text version with header/footer
   */
  private wrapPlainText(markdownContent: string, options: EmailWrapperOptions): string {
    // Convert markdown to plain text (simple approach - no tables/formatting)
    let text = markdownContent
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold
      .replace(/\*([^*\n]+)\*/g, '$1')    // Remove italic
      .replace(/^\s*[*\-+]\s+/gm, '• ')   // Convert bullets to •
      .replace(/\n{3,}/g, '\n\n')         // Clean extra newlines
      .trim()

    const header = this.getPlainTextHeader(options.template)
    const footer = '\n---\nAutomated response from Amara QUO Freight Intelligence\n' + new Date().toLocaleString()

    return `${header}\n\n${text}${footer}`
  }

  private getHeaderColor(template?: string): string {
    switch (template) {
      case 'urgent': return '#DC2626'  // Red
      case 'quote': return '#7C3AED'   // Purple  
      default: return '#1F2937'        // Dark gray
    }
  }

  private getHeaderText(template?: string): string {
    switch (template) {
      case 'urgent': return '⚡ URGENT FREIGHT INTELLIGENCE'
      case 'quote': return '📊 FREIGHT QUOTE SYSTEM'
      default: return 'FREIGHT INTELLIGENCE SYSTEM'
    }
  }

  private getPlainTextHeader(template?: string): string {
    const separator = '='.repeat(50)
    switch (template) {
      case 'urgent': return `AMARA QUO - URGENT FREIGHT INTELLIGENCE\n${separator}`
      case 'quote': return `AMARA QUO - FREIGHT QUOTE SYSTEM\n${separator}`
      default: return `AMARA QUO - FREIGHT INTELLIGENCE SYSTEM\n${separator}`
    }
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

// Export convenience function
export const wrapEmailContent = (content: string, options: EmailWrapperOptions): EmailResult => {
  const wrapper = new EmailWrapper()
  return wrapper.wrapContent(content, options)
}
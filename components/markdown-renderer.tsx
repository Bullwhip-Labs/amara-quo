// /components/markdown-renderer.tsx
// Refined markdown renderer with fixed text wrapping
// Ensures text properly wraps in container

'use client'

import { useMemo } from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Enhanced markdown to HTML converter with refined spacing
  const htmlContent = useMemo(() => {
    if (!content) return ''
    
    let html = content
    
    // Escape HTML first to prevent XSS
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    
    // Pre-process: Remove excessive newlines (more than 2 consecutive)
    html = html.replace(/\n{3,}/g, '\n\n')
    
    // Convert markdown patterns
    // Headers with tighter spacing
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-3 mb-1.5 text-gray-900 break-words">$1</h3>')
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-3 mb-1.5 text-gray-900 break-words">$1</h2>')
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-3 mb-2 text-gray-900 break-words">$1</h1>')
    
    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr class="my-3 border-gray-200" />')
    html = html.replace(/^\*\*\*$/gim, '<hr class="my-3 border-gray-200" />')
    
    // Code blocks with triple backticks - improved styling
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const trimmedCode = code.trim()
      return `<pre class="bg-gray-50 border border-gray-200 p-3 rounded-md overflow-x-auto my-2 text-sm max-w-full"><code class="text-gray-800 whitespace-pre-wrap break-words">${trimmedCode}</code></pre>`
    })
    
    // Bold - must come before italic to handle **text** correctly
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    html = html.replace(/__([^_]+)__/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    
    // Italic
    html = html.replace(/\*([^*\n]+)\*/g, '<em class="italic">$1</em>')
    html = html.replace(/_([^_\n]+)_/g, '<em class="italic">$1</em>')
    
    // Inline code with better styling
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-gray-800 font-mono break-words">$1</code>')
    
    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-gray-300 pl-4 my-2 text-gray-700 italic break-words">$1</blockquote>')
    
    // Tables - enhanced detection and styling with wrapper for overflow
    const lines = html.split('\n')
    let inTable = false
    let tableHtml = ''
    const processedLines: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Check if line looks like a table row
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true
          tableHtml = '<div class="overflow-x-auto my-3 max-w-full"><table class="min-w-full divide-y divide-gray-200 text-sm">'
          
          // Process header row
          const cells = line.split('|').filter(cell => cell.trim())
          tableHtml += '<thead class="bg-gray-50"><tr>'
          cells.forEach(cell => {
            const content = cell.trim()
            // Process markdown within cells
            const processedContent = content
              .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs">$1</code>')
            tableHtml += `<th class="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">${processedContent}</th>`
          })
          tableHtml += '</tr></thead><tbody class="bg-white divide-y divide-gray-200">'
          
          // Skip separator line if it exists
          if (i + 1 < lines.length && lines[i + 1].includes('---')) {
            i++
          }
        } else {
          // Process data row
          const cells = line.split('|').filter(cell => cell.trim())
          tableHtml += '<tr class="hover:bg-gray-50 transition-colors">'
          cells.forEach(cell => {
            const content = cell.trim()
            // Process markdown within cells
            const processedContent = content
              .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs">$1</code>')
            tableHtml += `<td class="px-3 py-2 text-sm text-gray-700 break-words">${processedContent}</td>`
          })
          tableHtml += '</tr>'
        }
      } else {
        // Not a table line
        if (inTable) {
          tableHtml += '</tbody></table></div>'
          processedLines.push(tableHtml)
          inTable = false
          tableHtml = ''
        }
        processedLines.push(line)
      }
    }
    
    // Close table if still open
    if (inTable) {
      tableHtml += '</tbody></table></div>'
      processedLines.push(tableHtml)
    }
    
    html = processedLines.join('\n')
    
    // Process lists with proper nesting support
    const listLines = html.split('\n')
    const finalLines: string[] = []
    let inUList = false
    let inOList = false
    let listItems: string[] = []
    
    for (const line of listLines) {
      // Unordered list items
      const uListMatch = line.match(/^[\*\-•] (.+)/)
      // Ordered list items
      const oListMatch = line.match(/^(\d+)\. (.+)/)
      
      if (uListMatch) {
        if (!inUList) {
          if (inOList) {
            // Close ordered list first
            finalLines.push(`<ol class="list-decimal list-inside space-y-1 my-2 ml-2 break-words">${listItems.join('')}</ol>`)
            listItems = []
            inOList = false
          }
          inUList = true
        }
        const content = uListMatch[1]
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs">$1</code>')
        listItems.push(`<li class="text-gray-700 break-words">${content}</li>`)
      } else if (oListMatch) {
        if (!inOList) {
          if (inUList) {
            // Close unordered list first
            finalLines.push(`<ul class="list-disc list-inside space-y-1 my-2 ml-2 break-words">${listItems.join('')}</ul>`)
            listItems = []
            inUList = false
          }
          inOList = true
        }
        const content = oListMatch[2]
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs">$1</code>')
        listItems.push(`<li class="text-gray-700 break-words">${content}</li>`)
      } else {
        // Not a list item - close any open lists
        if (inUList) {
          finalLines.push(`<ul class="list-disc list-inside space-y-1 my-2 ml-2 break-words">${listItems.join('')}</ul>`)
          listItems = []
          inUList = false
        } else if (inOList) {
          finalLines.push(`<ol class="list-decimal list-inside space-y-1 my-2 ml-2 break-words">${listItems.join('')}</ol>`)
          listItems = []
          inOList = false
        }
        finalLines.push(line)
      }
    }
    
    // Close any remaining lists
    if (inUList) {
      finalLines.push(`<ul class="list-disc list-inside space-y-1 my-2 ml-2 break-words">${listItems.join('')}</ul>`)
    } else if (inOList) {
      finalLines.push(`<ol class="list-decimal list-inside space-y-1 my-2 ml-2 break-words">${listItems.join('')}</ol>`)
    }
    
    html = finalLines.join('\n')
    
    // Links with better styling
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline decoration-1 underline-offset-2 transition-colors break-all" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Process paragraphs - smart paragraph detection
    const paragraphLines = html.split('\n')
    const paragraphs: string[] = []
    let currentParagraph: string[] = []
    
    for (const line of paragraphLines) {
      const trimmedLine = line.trim()
      
      // Check if line is already HTML (starts with <)
      if (trimmedLine.startsWith('<')) {
        // Save current paragraph if exists
        if (currentParagraph.length > 0) {
          paragraphs.push(`<p class="text-gray-700 leading-relaxed mb-2 break-words">${currentParagraph.join(' ')}</p>`)
          currentParagraph = []
        }
        // Add HTML element directly
        paragraphs.push(trimmedLine)
      } else if (trimmedLine === '') {
        // Empty line - end current paragraph
        if (currentParagraph.length > 0) {
          paragraphs.push(`<p class="text-gray-700 leading-relaxed mb-2 break-words">${currentParagraph.join(' ')}</p>`)
          currentParagraph = []
        }
      } else {
        // Regular text - add to current paragraph
        currentParagraph.push(trimmedLine)
      }
    }
    
    // Add any remaining paragraph
    if (currentParagraph.length > 0) {
      paragraphs.push(`<p class="text-gray-700 leading-relaxed mb-2 break-words">${currentParagraph.join(' ')}</p>`)
    }
    
    // Join everything and clean up
    html = paragraphs
      .filter(p => p.trim() !== '')
      .join('\n')
    
    // Clean up any remaining escaped HTML entities in non-code sections
    html = html.replace(/&lt;(?!\/?(code|pre))/g, '<')
    html = html.replace(/&gt;(?!\/?(code|pre))/g, '>')
    
    return html
  }, [content])

  return (
    <div 
      className={`markdown-content w-full max-w-full overflow-hidden ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
      style={{
        fontFamily: 'var(--font-sans)',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        hyphens: 'auto',
        WebkitHyphens: 'auto',
        MozHyphens: 'auto',
        msHyphens: 'auto',
      }}
    />
  )
}
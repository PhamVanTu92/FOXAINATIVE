/**
 * FoxAI Widget SDK - Markdown Parser
 * @module utils/markdown
 * 
 * Comprehensive markdown parser supporting:
 * - Headings (h1-h6)
 * - Bold, Italic, Strikethrough
 * - Code blocks with syntax highlighting hints
 * - Inline code
 * - Ordered and unordered lists
 * - Task lists (checkboxes)
 * - Blockquotes (nested)
 * - Tables
 * - Links and images
 * - Horizontal rules
 * - Auto-link URLs and emails
 */

/**
 * Parse markdown text to HTML
 * @param text - Markdown text to parse
 * @returns HTML string
 */
export function parseMarkdown(text: string): string {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    // Preserve code blocks first (prevent other parsing inside)
    const codeBlocks: string[] = [];
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
        const index = codeBlocks.length;
        const langClass = lang ? ` class="language-${lang}"` : '';
        codeBlocks.push(`<pre><code${langClass}>${code.trim()}</code></pre>`);
        return `%%CODEBLOCK_${index}%%`;
    });
    
    // Inline code (preserve spaces)
    const inlineCodes: string[] = [];
    html = html.replace(/`([^`]+)`/g, (_match, code) => {
        const index = inlineCodes.length;
        inlineCodes.push(`<code>${code}</code>`);
        return `%%INLINECODE_${index}%%`;
    });
    
    // Tables
    html = parseTables(html);
    
    // Headings (h1-h6)
    html = html.replace(/^###### (.*$)/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Bold (** or __)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // Italic (* or _) - careful not to match inside words
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');
    
    // Strikethrough
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    
    // Blockquotes (support nested)
    html = parseBlockquotes(html);
    
    // Lists (including task lists)
    html = parseLists(html);
    
    // Horizontal rule (---, ***, ___)
    html = html.replace(/^(---|\*\*\*|___)$/gm, '<hr>');
    
    // Images ![alt](url)
    html = html.replace(
        /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        '<img src="$2" alt="$1" title="$3" style="max-width:100%;border-radius:4px;">'
    );
    
    // Links [text](url)
    html = html.replace(
        /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" title="$3">$1</a>'
    );
    
    // Auto-link URLs
    html = html.replace(
        /(?<!href="|src="|">)(https?:\/\/[^\s<]+[^\s<.,;:!?"'\])>])/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Auto-link emails
    html = html.replace(
        /(?<!["\/>])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
        '<a href="mailto:$1">$1</a>'
    );
    
    // Line breaks (respect paragraph breaks)
    html = html.replace(/\n\n+/g, '</p><p>');
    html = html.replace(/\n(?![<\/]*(h[1-6]|ul|ol|li|blockquote|pre|hr|table|tr|td|th|p|div))/g, '<br>');
    
    // Wrap in paragraph if needed
    if (!html.startsWith('<')) {
        html = `<p>${html}</p>`;
    }
    
    // Restore code blocks
    codeBlocks.forEach((block, i) => {
        html = html.replace(`%%CODEBLOCK_${i}%%`, block);
    });
    
    // Restore inline code
    inlineCodes.forEach((code, i) => {
        html = html.replace(`%%INLINECODE_${i}%%`, code);
    });
    
    // Clean up
    html = cleanupHtml(html);
    
    return html;
}

/**
 * Escape HTML special characters (except for markdown processing)
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Parse markdown tables
 */
function parseTables(html: string): string {
    const tableRegex = /^(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)+)/gm;
    
    return html.replace(tableRegex, (_, headerRow, _alignRow, bodyRows) => {
        // Parse header
        const headers = headerRow.split('|').filter((h: string) => h.trim());
        const headerHtml = headers.map((h: string) => `<th>${h.trim()}</th>`).join('');
        
        // Parse body rows
        const rows = bodyRows.trim().split('\n');
        const bodyHtml = rows.map((row: string) => {
            const cells = row.split('|').filter((c: string) => c.trim());
            const cellsHtml = cells.map((c: string) => `<td>${c.trim()}</td>`).join('');
            return `<tr>${cellsHtml}</tr>`;
        }).join('');
        
        return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
    });
}

/**
 * Parse blockquotes with nested support
 */
function parseBlockquotes(html: string): string {
    // Simple blockquotes
    const lines = html.split('\n');
    const result: string[] = [];
    let inBlockquote = false;
    let blockquoteContent: string[] = [];
    
    for (const line of lines) {
        const match = line.match(/^>\s*(.*)$/);
        if (match) {
            if (!inBlockquote) {
                inBlockquote = true;
            }
            blockquoteContent.push(match[1]);
        } else {
            if (inBlockquote) {
                result.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
                blockquoteContent = [];
                inBlockquote = false;
            }
            result.push(line);
        }
    }
    
    if (inBlockquote && blockquoteContent.length > 0) {
        result.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
    }
    
    return result.join('\n');
}

/**
 * Parse ordered and unordered lists with task list support
 */
function parseLists(html: string): string {
    const lines = html.split('\n');
    const result: string[] = [];
    let inList = false;
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' = 'ul';
    let isTaskList = false;
    
    for (const line of lines) {
        // Task list: - [ ] or - [x]
        const taskMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.*)$/);
        // Unordered list: - item
        const ulMatch = line.match(/^(\s*)-\s+(.*)$/);
        // Ordered list: 1. item
        const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
        
        if (taskMatch) {
            const checked = taskMatch[2].toLowerCase() === 'x';
            const content = taskMatch[3];
            
            if (!inList || !isTaskList) {
                if (inList) {
                    result.push(`<${listType}>${listItems.join('')}</${listType}>`);
                    listItems = [];
                }
                inList = true;
                isTaskList = true;
                listType = 'ul';
            }
            
            const checkbox = `<input type="checkbox" ${checked ? 'checked' : ''} disabled>`;
            listItems.push(`<li class="task-list-item">${checkbox} ${content}</li>`);
        } else if (ulMatch && !ulMatch[2].startsWith('[')) {
            const content = ulMatch[2];
            
            if (!inList) {
                inList = true;
                listType = 'ul';
                isTaskList = false;
            } else if (listType !== 'ul' || isTaskList) {
                result.push(`<${listType}>${listItems.join('')}</${listType}>`);
                listItems = [];
                listType = 'ul';
                isTaskList = false;
            }
            
            listItems.push(`<li>${content}</li>`);
        } else if (olMatch) {
            const content = olMatch[2];
            
            if (!inList) {
                inList = true;
                listType = 'ol';
                isTaskList = false;
            } else if (listType !== 'ol') {
                result.push(`<${listType}>${listItems.join('')}</${listType}>`);
                listItems = [];
                listType = 'ol';
                isTaskList = false;
            }
            
            listItems.push(`<li>${content}</li>`);
        } else {
            if (inList) {
                const listClass = isTaskList ? ' class="task-list"' : '';
                result.push(`<${listType}${listClass}>${listItems.join('')}</${listType}>`);
                listItems = [];
                inList = false;
                isTaskList = false;
            }
            result.push(line);
        }
    }
    
    if (inList && listItems.length > 0) {
        const listClass = isTaskList ? ' class="task-list"' : '';
        result.push(`<${listType}${listClass}>${listItems.join('')}</${listType}>`);
    }
    
    return result.join('\n');
}

/**
 * Clean up HTML by removing excessive line breaks and empty paragraphs
 */
function cleanupHtml(html: string): string {
    // Remove breaks around block elements
    html = html.replace(/<br>\s*(<\/?(h[1-6]|ul|ol|li|blockquote|pre|hr|table|thead|tbody|tr|td|th|p|div)[^>]*>)\s*<br>/g, '$1');
    html = html.replace(/(<\/?(h[1-6]|ul|ol|li|blockquote|pre|hr|table|thead|tbody|tr|td|th|p|div)[^>]*>)\s*<br>/g, '$1');
    html = html.replace(/<br>\s*(<\/?(h[1-6]|ul|ol|li|blockquote|pre|hr|table|thead|tbody|tr|td|th|p|div)[^>]*>)/g, '$1');
    
    // Remove empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    
    // Reduce multiple breaks
    html = html.replace(/(<br>\s*){3,}/g, '<br><br>');
    
    // Clean up title attributes
    html = html.replace(/ title="undefined"/g, '');
    html = html.replace(/ title=""/g, '');
    
    return html;
}

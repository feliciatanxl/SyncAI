// Turns the AI's light Markdown (paragraphs, - or 1. lists, **bold**, *italic*, `code`, # headings) into React
// elements. Everything stays text, so React escapes it: no raw HTML from the AI ever reaches the page.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g

function inline(text, key) {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const k = `${key}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={k}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={k}>{part.slice(1, -1)}</code>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={k}>{part.slice(1, -1)}</em>
    return part
  })
}

const BULLET = /^\s*[-*•]\s+/
const NUMBER = /^\s*\d+[.)]\s+/
const HEADING = /^\s*#{1,6}\s+/

export function renderMarkdown(text) {
  const blocks = []
  let list = null
  const flush = () => { if (list) blocks.push(list); list = null }
  text.replace(/\r/g, '').split('\n').forEach((raw, i) => {
    const line = raw.trimEnd()
    const kind = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null
    if (kind) {
      if (list?.type !== kind) { flush(); list = { type: kind, items: [] } }
      list.items.push(inline(line.replace(kind === 'ul' ? BULLET : NUMBER, ''), `li${i}`))
      return
    }
    flush()
    if (!line.trim()) return
    if (HEADING.test(line)) blocks.push({ type: 'h', content: inline(line.replace(HEADING, ''), `h${i}`) })
    else blocks.push({ type: 'p', content: inline(line, `p${i}`) })
  })
  flush()
  return blocks.map((b, i) => {
    if (b.type === 'ul' || b.type === 'ol') {
      const List = b.type
      return <List key={i}>{b.items.map((item, j) => <li key={j}>{item}</li>)}</List>
    }
    return b.type === 'h' ? <p key={i}><strong>{b.content}</strong></p> : <p key={i}>{b.content}</p>
  })
}

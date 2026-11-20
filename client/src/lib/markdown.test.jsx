import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderMarkdown } from './markdown.jsx'

const html = (text) => renderToStaticMarkup(<>{renderMarkdown(text)}</>)

describe('renderMarkdown', () => {
  it('renders paragraphs, lists and inline styles', () => {
    expect(html('Open **Settings**.\n\n- Text size\n- *Theme*\n\n1. One\n2. `Two`')).toBe(
      '<p>Open <strong>Settings</strong>.</p><ul><li>Text size</li><li><em>Theme</em></li></ul><ol><li>One</li><li><code>Two</code></li></ol>',
    )
  })
  it('turns headings into bold lines', () => {
    expect(html('## Steps')).toBe('<p><strong>Steps</strong></p>')
  })
  it('never lets raw HTML through', () => {
    expect(html('<img src=x onerror=alert(1)> **<b>hi</b>**')).toBe('<p>&lt;img src=x onerror=alert(1)&gt; <strong>&lt;b&gt;hi&lt;/b&gt;</strong></p>')
  })
})

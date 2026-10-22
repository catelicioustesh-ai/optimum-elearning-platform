import { useRef } from 'react'

function inlineContent(text, keyPrefix) {
  const pattern = /(!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  const parts = []
  let cursor = 0
  let match
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    if (match[1]?.startsWith('![')) {
      parts.push(<img key={`${keyPrefix}-${index}`} src={match[3]} alt={match[2]} loading="lazy" referrerPolicy="no-referrer" className="my-3 max-h-96 max-w-full rounded-lg object-contain" />)
    } else if (match[4]) {
      parts.push(<a key={`${keyPrefix}-${index}`} href={match[5]} target="_blank" rel="noopener noreferrer">{match[4]}</a>)
    } else if (match[6]) {
      parts.push(<strong key={`${keyPrefix}-${index}`}>{match[6]}</strong>)
    } else if (match[7]) {
      parts.push(<em key={`${keyPrefix}-${index}`}>{match[7]}</em>)
    } else {
      parts.push(<code key={`${keyPrefix}-${index}`}>{match[8]}</code>)
    }
    cursor = pattern.lastIndex
    index += 1
  }

  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export function RichTextEditor({ value, onChange, rows = 6, placeholder, className = '' }) {
  const textarea = useRef(null)

  function wrapSelection(before, after = before) {
    const input = textarea.current
    if (!input) return
    const start = input.selectionStart
    const end = input.selectionEnd
    const selected = value.slice(start, end) || 'text'
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1" aria-label="Text formatting">
        <button type="button" onClick={() => wrapSelection('**')} className="rounded border border-line px-2 py-1 text-xs font-bold" aria-label="Bold">B</button>
        <button type="button" onClick={() => wrapSelection('*')} className="rounded border border-line px-2 py-1 text-xs italic" aria-label="Italic">I</button>
        <button type="button" onClick={() => wrapSelection('`')} className="rounded border border-line px-2 py-1 text-xs font-mono" aria-label="Inline code">{'{}'}</button>
        <button type="button" onClick={() => wrapSelection('\n```javascript\n', '\n```\n')} className="rounded border border-line px-2 py-1 text-xs" aria-label="Code block">Code block</button>
        <span className="ml-1 text-xs text-text-muted">Formatting uses Markdown</span>
      </div>
      <textarea
        ref={textarea}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
      />
    </div>
  )
}

export default function RichTextContent({ content, className = '' }) {
  const lines = (content || '').split(/\r?\n/)
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    if (/^```/.test(line)) {
      const code = []
      index += 1
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(<pre key={`code-${index}`}><code>{code.join('\n')}</code></pre>)
      continue
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const text = inlineContent(heading[2], `heading-${index}`)
      const Heading = `h${level + 1}`
      blocks.push(<Heading key={`heading-${index}`}>{text}</Heading>)
      index += 1
      continue
    }

    const listMatch = /^\s*([-*]|\d+\.)\s+/.exec(line)
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1])
      const items = []
      while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index])) {
        const item = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(lines[index])
        items.push(<li key={`item-${index}`}>{inlineContent(item[1], `item-${index}`)}</li>)
        index += 1
      }
      const List = ordered ? 'ol' : 'ul'
      blocks.push(<List key={`list-${index}`}>{items}</List>)
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s|^```|\s*([-*]|\d+\.)\s+/.test(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push(<p key={`paragraph-${index}`}>{inlineContent(paragraph.join('\n'), `paragraph-${index}`).map((part, partIndex) => (
      typeof part === 'string' ? part.split('\n').flatMap((value, lineIndex) => lineIndex ? [<br key={`${partIndex}-${lineIndex}`} />, value] : [value]) : part
    ))}</p>)
  }

  return (
    <div className={`rich-text-content [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mb-2 [&_h4]:mt-3 [&_h4]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ol]:mb-3 [&_ol]:list-decimal [&_li]:ml-5 [&_a]:text-blue-700 [&_a]:underline [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 ${className}`}>
      {blocks}
    </div>
  )
}

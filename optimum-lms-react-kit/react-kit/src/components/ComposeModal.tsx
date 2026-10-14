import { useState } from 'react'
import { Modal } from './ui/Modal'

export function ComposeModal({
  open,
  onClose,
  title,
  placeholder = 'Write something…',
  onSend,
}: {
  open: boolean
  onClose: () => void
  title: string
  placeholder?: string
  onSend: (message: string) => Promise<void> | void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendMessage() {
    const message = text.trim()
    if (!message || busy) return

    setBusy(true)
    setError('')
    try {
      await onSend(message)
      setText('')
      onClose()
    } catch (sendError) {
      setError(
        sendError instanceof Error && sendError.message
          ? sendError.message
          : 'Your message could not be sent. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <label htmlFor="cf">Message</label>
      <textarea
        id="cf"
        rows={4}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setError('')
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'compose-modal-error' : undefined}
      />
      {error && (
        <p
          id="compose-modal-error"
          role="alert"
          style={{ color: 'var(--bad)', fontSize: 12, margin: '0 0 12px' }}
        >
          {error}
        </p>
      )}
      <div className="dg-bt" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
        <button type="button" className="dg-gb dg-g2" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="dg-gb"
          disabled={busy || !text.trim()}
          onClick={sendMessage}
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </Modal>
  )
}

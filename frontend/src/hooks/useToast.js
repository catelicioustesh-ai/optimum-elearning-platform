import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

let nextToastId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success') => {
    const id = nextToastId++
    setToasts((items) => [...items, { id, message, type, leaving: false }])

    window.setTimeout(() => {
      setToasts((items) => items.map((item) => (item.id === id ? { ...item, leaving: true } : item)))
      window.setTimeout(() => {
        setToasts((items) => items.filter((item) => item.id !== id))
      }, 420)
    }, 3200)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return React.createElement(
    ToastContext.Provider,
    { value },
    children,
    React.createElement(
      'div',
      { className: 'dg-toasts', 'aria-live': 'polite', 'aria-atomic': 'true' },
      ...toasts.map((toastItem) =>
        React.createElement(
          'div',
          {
            key: toastItem.id,
            className: `dg-toast${toastItem.leaving ? ' dg-bye' : ''}`,
            'data-type': toastItem.type,
            role: toastItem.type === 'error' ? 'alert' : 'status',
          },
          React.createElement(
            'i',
            { 'aria-hidden': 'true' },
            React.createElement(
              'svg',
              { viewBox: '0 0 24 24' },
              React.createElement('path', {
                d: toastItem.type === 'error'
                  ? 'M6 6l12 12M18 6L6 18'
                  : toastItem.type === 'info'
                    ? 'M12 8h.01M11 12h1v4h1'
                    : 'M4 12l5 5L20 6',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: '2.4',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              })
            )
          ),
          React.createElement('span', null, toastItem.message),
          React.createElement('b', { 'aria-hidden': 'true' })
        )
      )
    )
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return context.toast
}

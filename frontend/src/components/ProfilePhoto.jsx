import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function ProfilePhoto({ photoPath, alt = '', className = '', fallback, fallbackClassName = '' }) {
  const [image, setImage] = useState(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    if (!photoPath) return undefined

    api.getBlob(photoPath)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setImage({ path: photoPath, url: objectUrl })
      })
      .catch(() => {
        if (!cancelled) setImage(null)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photoPath])

  if (image && image.path === photoPath) return <img src={image.url} alt={alt} className={className} />
  return (
    <span className={fallbackClassName} aria-label={alt || undefined}>
      {fallback}
    </span>
  )
}

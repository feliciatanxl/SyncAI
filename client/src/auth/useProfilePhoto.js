import { useEffect, useState } from 'react'
import { getProfilePhoto } from './msal.js'

// The signed-in person's Microsoft profile photo as an object URL (null until loaded, or if there's none).
// Keyed on the stable account ID because MSAL returns a fresh account object on every render.
export function useProfilePhoto(instance, accountId) {
  const [photo, setPhoto] = useState(null)
  useEffect(() => {
    if (!accountId) return undefined
    let url = null
    let live = true
    getProfilePhoto(instance, instance.getAccount({ homeAccountId: accountId })).then((u) => {
      url = u
      if (live) setPhoto(u)
    })
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [instance, accountId])
  return photo
}

import { useEffect, useState } from 'react'
import { action } from './client.ts'

type Visuals = { ready: boolean; message?: string; items: Record<string, string | null>; textures: Record<string, string | null> }
export function useVisuals(projectPath: string, itemIds: string[], textureIds: string[] = []) {
  const [value, setValue] = useState<Visuals>(), [attempt, retry] = useState(0)
  const key = JSON.stringify([itemIds, textureIds])
  useEffect(() => {
    let active = true; setValue(undefined)
    const timer = setTimeout(() => {
      const [itemIds, textureIds] = JSON.parse(key)
      void action<Visuals>({ operation: 'visuals', projectPath, itemIds, textureIds }).then(result => { if (active) setValue(result) }).catch(error => { if (active) setValue({ ready: false, message: String(error), items: {}, textures: {} }) })
    }, 180)
    return () => { active = false; clearTimeout(timer) }
  }, [projectPath, key, attempt])
  return { ...value, loading: !value, retry: () => retry(value => value + 1) }
}
export function ItemVisual({ image, label }: { image?: string | null; label: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [image])
  return image && !failed ? <img className="recipe-item-image" src={image} alt="" draggable={false} onError={() => setFailed(true)} /> : <span className="recipe-item-mark" aria-hidden title="无静态贴图">{label.slice(0, 2)}</span>
}

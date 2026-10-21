import { useEffect, useState } from 'react'

/** 画面を大きく使うのは、この幅以上（PC）のときだけ */
const MIN_WIDTH = 1024
/** 拡大前のレイアウトの幅（max-w-3xl）と、いちばん縦に長い場面（追加ダイスあり）の高さ */
const BASE_WIDTH = 768
const BASE_HEIGHT = 700
const MAX_ZOOM = 1.6

const fit = () => {
  if (typeof window === 'undefined' || window.innerWidth < MIN_WIDTH) return 1
  const z = Math.min((window.innerWidth - 32) / BASE_WIDTH, window.innerHeight / BASE_HEIGHT, MAX_ZOOM)
  return Math.max(1, Math.floor(z * 20) / 20)
}

/**
 * PCで余白が目立たないよう、画面の大きさに合わせた拡大率を返す（どの場面でも縦に収まる範囲で）。
 * 場面ごとに大きさが変わらないよう、いちばん縦に長い場面の高さで決める。
 */
export function useFitZoom() {
  const [zoom, setZoom] = useState(fit)
  useEffect(() => {
    const onResize = () => setZoom(fit())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return zoom
}

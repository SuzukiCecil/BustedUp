import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useGame } from '../game/store'

/** 摘発（BUSTED!）の全画面演出。表示中は下のボタンを押せず、画面を押すと閉じる */
export function Overlays() {
  const game = useGame((s) => s.game)
  const rolling = useGame((s) => s.rolling)
  const [fx, setFx] = useState<{ key: string } | null>(null)
  const outcome = !rolling ? game.last?.outcome : undefined
  const key = `${game.round}-${game.rolls}`

  useEffect(() => {
    // 摘発でなくなったら（次のラウンドに進んだなど）演出も閉じる
    if (outcome !== 'busted') return setFx(null)
    setFx({ key })
    const t = setTimeout(() => setFx(null), 1700)
    return () => clearTimeout(t)
  }, [outcome, key])

  return (
    <AnimatePresence>
      {fx && (
        <motion.div
          key={fx.key}
          className="police-flash fixed inset-0 z-40 flex cursor-pointer items-center justify-center"
          onClick={() => setFx(null)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="assertive"
        >
          <motion.div
            initial={{ scale: 3, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: -8, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            className="text-center"
          >
            <p className="rounded-xl border-4 border-white bg-red-600 px-6 py-2 text-5xl font-black italic tracking-tight text-white shadow-2xl sm:text-7xl">BUSTED!</p>
            <p className="mt-3 text-lg font-black text-white drop-shadow">摘発だ！ チップと供託は没収</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

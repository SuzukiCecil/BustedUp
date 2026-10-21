import { motion } from 'framer-motion'
import { Cherry, CircleDot, Club, Crown, Dices, Dog, Siren, Spade, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DICE, UP_FACES, UP_LABEL } from '../game/dice'
import type { DieId, Face, UpFace } from '../game/types'

/** 賭場ダイスの見た目（色とアイコン） */
export const DIE_STYLE: Record<DieId, { bg: string; ink: string; icon: LucideIcon }> = {
  chohan: { bg: '#f3eee6', ink: '#1c1924', icon: Dices },
  roulette: { bg: '#c81e1e', ink: '#ffffff', icon: CircleDot },
  blackjack: { bg: '#1f2433', ink: '#ffffff', icon: Spade },
  poker: { bg: '#6d28d9', ink: '#ffffff', icon: Club },
  slot: { bg: '#f59e0b', ink: '#1c1924', icon: Cherry },
  dogfight: { bg: '#7c2d12', ink: '#ffffff', icon: Dog },
}

/**
 * 出目1面ぶんの中身。ダイスの色によらず見分けられるよう、目の種類ごとに札の形と色を固定する。
 * - チップの目：黒い丸札（ポーカーチップ風の白い点線の縁）
 * - 供託の目：金色の角札（黒い縁）
 * - ◎（胴元ダイスを振る目）：右上に王冠の印
 * - サイレン：白い札に赤いサイレン（赤い縁）
 */
export function FaceMark({ face, small = false }: { face: Face; small?: boolean }) {
  if (face.kind === 'siren')
    return (
      <span
        aria-label="サイレン"
        className={`flex items-center justify-center rounded-lg border-red-600 bg-white text-red-600 ${small ? 'h-[16px] w-[16px] border' : 'h-10 w-10 border-2 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}
      >
        <Siren size={small ? 11 : 24} strokeWidth={2.75} />
      </span>
    )
  const pot = face.kind === 'pot'
  return (
    <span
      aria-label={`${pot ? '供託' : 'チップ'}${face.value}${face.star ? '（◎）' : ''}`}
      className={[
        'relative flex items-center justify-center font-black tabular-nums leading-none',
        small ? 'h-[16px] min-w-[16px] px-0.5 text-[9px]' : 'h-10 min-w-10 px-1 text-lg',
        pot
          ? `rounded-md bg-[var(--gold)] text-black ${small ? 'border' : 'border-2'} border-black`
          : `rounded-full bg-[#1c1924] text-white ${small ? 'border' : 'border-2'} border-dashed border-white`,
      ].join(' ')}
    >
      {face.value}
      {face.star && (
        <span
          className={`absolute flex items-center justify-center rounded-full border border-black bg-[var(--gold)] text-black ${small ? '-right-1 -top-1 h-[7px] w-[7px]' : '-right-2 -top-2 h-4 w-4'}`}
        >
          {!small && <Crown size={10} strokeWidth={3} />}
        </span>
      )}
    </span>
  )
}

/**
 * 賭場ダイス1個。rolling 中は出目をランダムに切り替えて転がす。
 * face が null なら出目なし（まだ振っていない）。
 */
export function Die({ die, face, rolling = false, size = 64, dim = false }: { die: DieId; face: Face | null; rolling?: boolean; size?: number; dim?: boolean }) {
  const s = DIE_STYLE[die]
  const Icon = s.icon
  const [spin, setSpin] = useState<Face | null>(null)
  useEffect(() => {
    if (!rolling) return
    const faces = DICE[die].faces
    const t = setInterval(() => setSpin(faces[Math.floor(Math.random() * faces.length)]), 80)
    return () => clearInterval(t)
  }, [rolling, die])
  const shown = rolling ? spin : face
  const siren = !rolling && face?.kind === 'siren'
  return (
    <motion.div
      animate={rolling ? { rotate: [0, -12, 10, -6, 0], y: [0, -10, 0, -4, 0] } : { rotate: 0, y: 0 }}
      transition={rolling ? { duration: 0.45, repeat: Infinity } : { type: 'spring', stiffness: 300, damping: 15 }}
      className={['relative flex flex-col items-center justify-center rounded-[22%] shadow-[0_4px_0_rgba(0,0,0,0.45),0_6px_14px_rgba(0,0,0,0.5)]', dim ? 'opacity-40' : '', siren ? 'ring-4 ring-red-500/70' : ''].join(' ')}
      style={{ width: size, height: size, background: s.bg, color: s.ink }}
      aria-label={`${DICE[die].name}${face && !rolling ? `：${face.kind === 'siren' ? 'サイレン' : `${face.value}${face.star ? '（◎）' : ''}`}` : ''}`}
    >
      <Icon className="absolute left-[8%] top-[8%] opacity-50" size={size * 0.2} />
      {shown ? <FaceMark face={shown} /> : <Icon size={size * 0.42} className="opacity-70" />}
    </motion.div>
  )
}

/** 胴元ダイス。face が null ならまだ振っていない */
export function UpDie({ face, rolling = false, size = 56 }: { face: UpFace | null; rolling?: boolean; size?: number }) {
  const [spin, setSpin] = useState<UpFace | null>(null)
  useEffect(() => {
    if (!rolling) return
    const t = setInterval(() => setSpin(UP_FACES[Math.floor(Math.random() * UP_FACES.length)]), 80)
    return () => clearInterval(t)
  }, [rolling])
  const shown = rolling ? spin : face
  return (
    <motion.div
      animate={rolling ? { rotate: [0, -12, 10, -6, 0], y: [0, -10, 0, -4, 0] } : { rotate: 0, y: 0 }}
      transition={rolling ? { duration: 0.45, repeat: Infinity } : { type: 'spring', stiffness: 300, damping: 15 }}
      className="relative flex shrink-0 items-center justify-center rounded-[22%] bg-[var(--gold)] text-black shadow-[0_4px_0_rgba(0,0,0,0.45),0_6px_14px_rgba(0,0,0,0.5)]"
      style={{ width: size, height: size }}
      aria-label={`胴元ダイス${face && !rolling ? `：${UP_LABEL[face].name}` : ''}`}
    >
      <Crown className="absolute left-[8%] top-[8%] opacity-50" size={size * 0.2} />
      {shown ? (
        <span className="px-0.5 text-center text-[11px] font-black leading-tight">{UP_LABEL[shown].name}</span>
      ) : (
        <span className="text-2xl font-black">?</span>
      )}
    </motion.div>
  )
}

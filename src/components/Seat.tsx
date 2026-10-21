import { AnimatePresence, motion } from 'framer-motion'
import { Armchair, Bot, Coins, Crown, DoorOpen, Siren, User, Vault } from 'lucide-react'
import { PERSONALITY } from '../game/cpu'
import type { GameState, Player } from '../game/types'

/**
 * プレイヤーの席。金庫（確定）とチップ（未確定）、席の状態、宣言の吹き出し、供託の取り分を出す。
 * compact は CPU の席（上段に横並び）。
 */
export function Seat({ player, game, compact = false }: { player: Player; game: GameState; compact?: boolean }) {
  const dealer = game.dealer === player.id
  const isMe = player.id === 'p1'
  const decision = game.decisions[player.id]
  const busted = game.roundEnd === 'busted' && !player.inRound && player.banked === null && game.phase !== 'choose'
  const left = !player.inRound && !busted
  const leader = Math.max(...game.players.map((p) => p.bank))
  const statusTone = busted ? 'text-red-400' : left ? 'text-[var(--muted)]' : 'text-emerald-300'
  const StatusIcon = busted ? Siren : left ? DoorOpen : Armchair
  const status = busted ? '摘発' : left ? `席を立った${player.banked !== null ? `（+${player.banked}）` : ''}` : game.phase === 'choose' ? '着席' : '席に残る'

  return (
    <section
      className={[
        'relative rounded-2xl border bg-[var(--panel)]/90 transition',
        compact ? 'p-2' : 'p-2.5',
        dealer ? 'border-[var(--gold)]/80' : 'border-[var(--border)]',
        left || busted ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1 text-sm font-bold">
          {isMe ? <User size={16} className="shrink-0" /> : <Bot size={16} className="shrink-0" />}
          <span className="truncate">{player.name}</span>
          {!isMe && !compact && <span className="text-[10px] text-[var(--muted)]">{PERSONALITY[player.id as keyof typeof PERSONALITY].label}</span>}
        </div>
        {/* 席の状態（CPUの席は、席を立った・摘発されたときだけアイコンで出す） */}
        {(!compact || left || busted) && (
          <span title={status} aria-label={status} className={`ml-auto flex shrink-0 items-center gap-0.5 text-[11px] font-bold leading-none ${statusTone}`}>
            <StatusIcon size={13} />
            {!compact && status}
          </span>
        )}
        {dealer && (
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--gold)] px-1.5 py-0.5 text-[10px] font-black text-black" title="胴元">
            <Crown size={11} />
            {!compact && '胴元'}
          </span>
        )}
      </div>
      {compact && !isMe && (
        <div className="hidden text-[10px] leading-tight text-[var(--muted)] sm:block">{PERSONALITY[player.id as keyof typeof PERSONALITY].label}</div>
      )}

      <div className={`grid gap-1 ${compact ? 'mt-1 grid-cols-1' : 'mt-1.5 grid-cols-2'}`}>
        <Stat
          icon={<Vault size={14} />}
          label="金庫"
          value={player.bank}
          lead={player.bank === leader && leader > 0}
          target={compact ? undefined : game.target}
        />
        <Stat icon={<Coins size={14} />} label="チップ" value={player.pool} live={player.inRound && game.phase !== 'choose'} />
      </div>

      {/* 去就の宣言（同時公開） */}
      <AnimatePresence>
        {decision && (
          <motion.span
            key={`${game.round}-${game.rolls}-${decision}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute -top-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-black shadow-lg ${decision === 'leave' ? 'bg-sky-400 text-black' : 'bg-emerald-500 text-black'}`}
          >
            {decision === 'leave' ? '立つ！' : '残る'}
          </motion.span>
        )}
      </AnimatePresence>

      {/* 席を立ったときの供託の取り分 */}
      <AnimatePresence>
        {!!player.share && (
          <motion.span
            key={`share-${game.round}-${player.share}`}
            initial={{ scale: 2.2, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            className="absolute -left-1 -top-2 z-10 rounded-md bg-[var(--gold)] px-1.5 py-0.5 text-xs font-black text-black shadow-lg"
          >
            供託+{player.share}
          </motion.span>
        )}
      </AnimatePresence>
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
  live = false,
  lead = false,
  target,
}: {
  icon: React.ReactNode
  label: string
  value: number
  live?: boolean
  lead?: boolean
  target?: number
}) {
  return (
    <div className="flex items-center justify-between gap-1 rounded-lg bg-[var(--card)] px-1.5 py-0.5">
      <span className="flex items-center gap-0.5 text-[10px] font-bold text-[var(--muted)]">
        {icon}
        {label}
      </span>
      <motion.span
        key={value}
        initial={{ scale: 1.4, color: live ? '#f2c14e' : '#f3eee6' }}
        animate={{ scale: 1, color: lead ? '#f2c14e' : '#f3eee6' }}
        className="text-sm font-black tabular-nums"
      >
        {value.toLocaleString()}
        {target && <span className="ml-0.5 text-[9px] font-bold text-[var(--muted)]">/{target.toLocaleString()}</span>}
      </motion.span>
    </div>
  )
}

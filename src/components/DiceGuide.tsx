import { Crown } from 'lucide-react'
import { DICE, DIE_IDS, UP_FACES } from '../game/dice'
import { useGame } from '../game/store'
import type { DieId, Face, UpFace } from '../game/types'
import { DIE_STYLE, FaceMark } from './Die'

/** 胴元ダイスの面の短い表記（一覧用） */
const UP_SHORT: Record<UpFace, string> = { extra1: '追1', extra2: '追2', extra3: '追3', tip: '+100', fee: '−100', double: '×2' }
/** 供託に効く胴元ダイスの目（供託の目と同じ金色で示す） */
const UP_POT: UpFace[] = ['tip', 'fee', 'double']

/**
 * ダイスごとの出目の一覧。このラウンドの賭場ダイス・追加ダイス・胴元ダイスを強調し、直近に出た目に印をつける。
 * 自分が胴元で賭場を選んでいる間は、選択画面に同じ情報があるので出さない。
 */
export function DiceGuide() {
  const game = useGame((s) => s.game)
  const rolling = useGame((s) => s.rolling)
  const rollingUp = useGame((s) => s.rollingUp)
  const rollingExtra = useGame((s) => s.rollingExtra)
  const extraPicked = useGame((s) => s.extraPicked)
  if (game.phase === 'choose' && game.dealer === 'p1') return null

  const last = rolling ? null : game.last
  const extra: DieId[] = rollingExtra ?? (game.phase === 'extra' ? extraPicked : (last?.extra.map((e) => e.die) ?? []))
  const shown = new Map<DieId, Face>([...(last?.dice ?? []), ...(rollingExtra ? [] : (last?.extra ?? []))].map((r) => [r.die, r.face]))
  const upInPlay = !rolling && (game.phase === 'up' || game.upPending || !!game.last?.up)
  const upFace = rollingUp ? null : (last?.up ?? null)

  return (
    <section aria-label="ダイスの出目一覧" className="rounded-xl bg-[var(--panel)] p-1">
      {/* 賭場ダイス6個（3個ずつ2行）と、区切り線の下に胴元ダイス・凡例 */}
      <ul aria-label="賭場ダイス" className="grid grid-cols-2 gap-1 md:grid-cols-3">
        {DIE_IDS.map((d) => {
          const role = game.chosen.includes(d) ? 'main' : extra.includes(d) ? 'extra' : null
          const face = shown.get(d)
          const hit = face ? DICE[d].faces.findIndex((f) => f === face || JSON.stringify(f) === JSON.stringify(face)) : -1
          const Icon = DIE_STYLE[d].icon
          return (
            <Row key={d} role={role} label={DICE[d].name}>
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded"
                style={{ background: DIE_STYLE[d].bg, color: DIE_STYLE[d].ink }}
              >
                <Icon size={12} />
              </span>
              {DICE[d].faces.map((f, i) => (
                <Cell key={i} hit={i === hit}>
                  <FaceMark face={f} small />
                </Cell>
              ))}
            </Row>
          )
        })}
      </ul>
      <ul aria-label="胴元ダイス" className="mt-1 grid grid-cols-2 gap-1 border-t border-dashed border-white/15 pt-1 md:grid-cols-3">
        <Row role={upInPlay ? 'up' : null} label="胴元ダイス">
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-[var(--gold)] text-black">
            <Crown size={12} />
          </span>
          {UP_FACES.map((f) => (
            <Cell key={f} hit={f === upFace}>
              <span className={`text-[8px] font-black leading-none tracking-tighter ${UP_POT.includes(f) ? 'rounded-sm bg-[var(--gold)] px-px text-black' : ''}`}>{UP_SHORT[f]}</span>
            </Cell>
          ))}
        </Row>
        <li className="flex items-center justify-center gap-1.5 whitespace-nowrap md:col-span-2 text-[10px] font-bold text-[var(--muted)]">
          <Legend className="border-[var(--gold)]" label="場" />
          <Legend className="border-sky-400" label="追加" />
          <span className="flex items-center gap-0.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-white bg-[#1c1924]" />
            チップ
          </span>
          <span className="flex items-center gap-0.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-black bg-[var(--gold)]" />
            供託
          </span>
        </li>
      </ul>
    </section>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-0.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm border-2 ${className}`} />
      {label}
    </span>
  )
}

function Row({ role, label, children }: { role: 'main' | 'extra' | 'up' | null; label: string; children: React.ReactNode }) {
  const tone =
    role === 'main' || role === 'up'
      ? 'border-[var(--gold)] bg-[var(--card)]'
      : role === 'extra'
        ? 'border-sky-400 bg-[var(--card)]'
        : 'border-transparent opacity-50'
  return (
    <li
      title={label}
      aria-label={`${label}${role === 'main' ? '（場）' : role === 'extra' ? '（追加）' : ''}`}
      className={`flex items-center gap-[3px] rounded-lg border-2 px-1 py-0.5 ${tone}`}
    >
      {children}
    </li>
  )
}

function Cell({ hit, children }: { hit: boolean; children: React.ReactNode }) {
  return (
    <span className={`flex h-[18px] min-w-0 flex-1 items-center justify-center rounded ${hit ? 'bg-white/90 text-black' : 'bg-white/10'}`}>{children}</span>
  )
}

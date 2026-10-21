import { AnimatePresence, motion } from 'framer-motion'
import { CircleHelp, Crown, RotateCcw, Siren, Trophy, Undo2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { LEVELS, PERSONALITY, type Level } from '../game/cpu'
import { DICE, DIE_IDS, UP_FACES, UP_LABEL } from '../game/dice'
import { PLAYER_NAMES } from '../game/engine'
import { useGame, type FirstDealer } from '../game/store'
import { SHARE_UNIT, TARGET_OPTIONS } from '../game/types'
import { DEBUG } from '../debug'
import { FaceMark } from './Die'

function Modal({ open, onClose, children }: { open: boolean; onClose?: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-2xl"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {onClose && (
              <button type="button" aria-label="閉じる" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 hover:bg-[var(--card)]">
                <X size={18} />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1.5 mt-4 text-xs font-bold text-[var(--muted)]">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-xl bg-[var(--card)] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg py-2 text-sm font-bold transition ${value === o.value ? 'bg-[var(--gold)] text-black shadow' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Title({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  return (
    <span className="flex flex-col leading-none">
      <span className={`neon whitespace-nowrap font-black italic tracking-tight text-[var(--gold)] ${size === 'lg' ? 'text-3xl' : 'text-lg'}`}>BUSTED UP!</span>
      <span className={`mt-0.5 font-bold text-[var(--muted)] ${size === 'lg' ? 'text-xs' : 'text-[10px]'}`}>inspired by Tally Up</span>
    </span>
  )
}

export function StartModal({ onRules }: { onRules: () => void }) {
  const setup = useGame((s) => s.setup)
  const settings = useGame((s) => s.settings)
  const update = useGame((s) => s.updateSettings)
  const start = useGame((s) => s.start)
  return (
    <Modal open={setup}>
      <div className="flex flex-col items-center text-center">
        <Title />
        <p className="mt-3 text-sm text-[var(--muted)]">摘発が入る前に、勝ち逃げしろ。</p>
      </div>
      <Segmented label="CPUの人数" value={settings.cpuCount} options={[2, 3].map((n) => ({ value: n, label: `${n}人` }))} onChange={(cpuCount) => update({ cpuCount })} />
      <p className="mt-1 text-center text-[11px] text-[var(--muted)]">
        {(['cpu1', 'cpu2', 'cpu3'] as const)
          .slice(0, settings.cpuCount)
          .map((id) => `${PLAYER_NAMES[id]}（${PERSONALITY[id].label}）`)
          .join('・')}
      </p>
      <Segmented
        label="CPUの強さ"
        value={settings.level}
        options={(Object.keys(LEVELS) as Level[]).map((lv) => ({ value: lv, label: LEVELS[lv].label }))}
        onChange={(level) => update({ level })}
      />
      <Segmented
        label="最初の胴元"
        value={settings.firstDealer}
        options={[
          { value: 'p1' as FirstDealer, label: 'あなた' },
          { value: 'cpu' as FirstDealer, label: 'CPU' },
          { value: 'random' as FirstDealer, label: 'ランダム' },
        ]}
        onChange={(firstDealer) => update({ firstDealer })}
      />
      <Segmented
        label="目標（金庫）"
        value={settings.target}
        options={TARGET_OPTIONS.map((t) => ({ value: t as number, label: t.toLocaleString() }))}
        onChange={(target) => update({ target })}
      />
      <label className="mt-4 flex items-center justify-between gap-2 text-sm font-bold">
        摘発確率のヒントを表示
        <input type="checkbox" checked={settings.hint} onChange={(e) => update({ hint: e.target.checked })} className="h-5 w-5 accent-[var(--gold)]" />
      </label>
      <button
        type="button"
        onClick={start}
        className="glow-pulse mt-5 w-full rounded-xl bg-[var(--gold)] py-3 text-base font-black text-black shadow transition hover:brightness-110"
      >
        賭場に入る
      </button>
      <button type="button" onClick={onRules} className="mx-auto mt-3 flex items-center gap-1 text-sm font-bold text-[var(--muted)] hover:text-[var(--text)]">
        <CircleHelp size={16} /> 遊び方
      </button>
    </Modal>
  )
}

/** これまでの記録（新しい順） */
export function LogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const log = useGame((s) => s.game.log)
  const tone = { bust: 'text-red-400', pot: 'text-[var(--gold)]', leave: 'text-sky-300', info: '' } as const
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="mb-3 text-lg font-black">記録</h2>
      <ul className="space-y-0.5 text-xs">
        {[...log].reverse().map((e, i) => (
          <li key={i} className={tone[e.tone ?? 'info']}>
            <span className="text-[var(--muted)]">R{e.round}</span> {e.text}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="mb-3 text-lg font-black">遊び方</h2>
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          舞台は地下の違法カジノ。手元のチップとテーブル中央の供託を、<b>警察の摘発が入る前に</b>持って帰ろう。金庫が目標額に届いたラウンドの終わりに、いちばん稼いだ人の勝ち。
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <b>開帳</b>：胴元（<Crown size={13} className="inline text-[var(--gold)]" />）が6つの賭場ダイスから3つを選ぶ。賭場ごとに当たりと危険度が違う。
          </li>
          <li>
            <b>振る</b>：出た目のうち、
            <span className="mx-0.5 rounded-full border border-dashed border-white bg-[#1c1924] px-1.5 font-bold text-white">チップの目（黒い丸）</span>
            は席に残っている全員のチップに、
            <span className="mx-0.5 rounded border border-black bg-[var(--gold)] px-1 font-bold text-black">供託の目（金の角）</span>
            はテーブル中央の供託に入る。
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px]">
              <li>
                <Siren size={13} className="inline text-red-500" />
                サイレン2つ以上で<b>摘発</b>：席に残っていた全員のチップと供託が没収され、ラウンド終了。
              </li>
              <li>◎付きの目（右上に金の印）が出たら、残る/立つを宣言してから胴元が胴元ダイス（胴元の気まぐれ）を振る。</li>
            </ul>
          </li>
          <li>
            <b>残るか、立つか</b>：全員が同時に宣言。席を立つとチップと供託の取り分を金庫に入れて、そのラウンドは抜ける。誰か1人でも残れば、また振る。
          </li>
        </ol>
        <div className="rounded-xl bg-[var(--card)] p-3">
          <p className="font-bold text-[var(--gold)]">供託の山分け</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>席を立った人は、同時に立った人数で供託を山分けする。1人で立てば独り占め。</li>
            <li>山分けは{SHARE_UNIT}点単位で切り捨て。端数は供託に残り、残った人があとで拾える（例：供託50を2人で→20ずつ、10が残る）。</li>
            <li>全員が立ってラウンドが終わったら、残った端数は消える。</li>
          </ul>
        </div>
        <div className="rounded-xl bg-[var(--card)] p-3">
          <p className="font-bold">賭場ダイス</p>
          <ul className="mt-1 space-y-1">
            {DIE_IDS.map((d) => (
              <li key={d} className="flex items-center gap-1.5 text-xs">
                <span className="w-24 shrink-0 font-bold">
                  {DICE[d].name}
                  <span className="ml-1 font-normal text-[var(--muted)]">{DICE[d].trait}</span>
                </span>
                <span className="flex flex-wrap gap-0.5">
                  {DICE[d].faces.map((f, i) => (
                    <span key={i} className="flex h-[18px] min-w-[18px] items-center justify-center rounded bg-white/10">
                      <FaceMark face={f} small />
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-[var(--card)] p-3">
          <p className="font-bold">胴元ダイス（胴元の気まぐれ）</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {UP_FACES.map((f) => (
              <li key={f}>
                <b>{UP_LABEL[f].name}</b>：{UP_LABEL[f].text}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-[var(--muted)]">追加で振るダイスは胴元が選ぶ（席を立った胴元は、残っている人を摘発させにくるかも）。追加で振ったダイスも含めてサイレン2つ以上なら摘発。</p>
        </div>
        <p className="text-xs text-[var(--muted)]">
          ※ BUSTED UP! はダイスゲーム「Tally Up」（Eric Olsen）に着想を得たオリジナル作品です。登場する賭博・チップは架空のもので、実際のお金とは一切関係ありません。
        </p>
      </div>
    </Modal>
  )
}

export function ResultModal() {
  const game = useGame((s) => s.game)
  const open = useGame((s) => s.showResult && s.game.phase === 'gameover')
  const reset = useGame((s) => s.reset)
  const undo = useGame((s) => s.undo)
  const canUndo = useGame((s) => s.history.length > 0)
  const ranking = [...game.players].sort((a, b) => b.bank - a.bank)
  const win = game.winners.includes('p1')
  const title = game.winners.length > 1 ? (win ? '引き分け' : `${game.winners.map((w) => PLAYER_NAMES[w]).join('・')}の勝ち`) : win ? '勝ち逃げ成功！' : `${PLAYER_NAMES[game.winners[0]]}の勝ち…`
  return (
    <Modal open={open}>
      <div className="text-center">
        <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', delay: 0.15 }} className="mx-auto mb-2 w-fit">
          <Trophy size={48} className={win ? 'text-[var(--gold)]' : 'text-[var(--muted)]'} />
        </motion.div>
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{game.round}ラウンドで決着</p>
        <ol className="my-4 space-y-1.5 text-left">
          {ranking.map((p, i) => (
            <li key={p.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${p.id === 'p1' ? 'bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/50' : 'bg-[var(--card)]'}`}>
              <span className="font-bold">
                {i + 1}位　{p.name}
              </span>
              <span className="font-black tabular-nums">{p.bank.toLocaleString()}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-6 py-2.5 font-black text-black shadow hover:brightness-110">
          <RotateCcw size={18} /> もう一度遊ぶ
        </button>
        {DEBUG && (
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="mx-auto mt-3 flex items-center gap-1 text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <Undo2 size={16} /> 一手戻る（デバッグ用）
          </button>
        )}
      </div>
    </Modal>
  )
}

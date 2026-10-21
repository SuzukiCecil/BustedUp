import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Gauge, Siren, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { DICE, DIE_IDS, UP_LABEL } from '../game/dice'
import { nextBustChance } from '../game/cpu'
import { extraCandidates, extraCount, PLAYER_NAMES } from '../game/engine'
import { bustChance, extraOptions } from '../game/odds'
import { useGame } from '../game/store'
import type { DieId, Face } from '../game/types'
import { Die, FaceMark, UpDie } from './Die'

const pct = (p: number) => `${Math.round(p * 100)}%`

/** テーブル中央：賭場ダイス、サイレンのランプ、胴元ダイス、結果 */
export function Table() {
  const game = useGame((s) => s.game)
  const rolling = useGame((s) => s.rolling)
  const hint = useGame((s) => s.settings.hint)
  const { last, chosen } = game
  const choosing = game.phase === 'choose'
  const rollingExtra = useGame((s) => s.rollingExtra)
  const sirens = rolling || !last ? 0 : Math.min(2, last.sirens)
  const warn = !rolling && last?.outcome === 'ok' && last.sirens === 1 && (game.phase === 'decide' || game.phase === 'up' || game.phase === 'extra')
  const picking = game.phase === 'extra' && game.dealer === 'p1' && !rollingExtra

  if (choosing && game.dealer === 'p1') return <DicePicker />

  return (
    <div className={`felt relative flex flex-col items-center gap-2 rounded-3xl px-3 py-3 ${warn ? 'siren-edge' : ''}`}>
      <div className="flex w-full items-center justify-between text-xs font-bold text-white/80">
        <span className="flex items-center gap-1">
          <Crown size={13} className="text-[var(--gold)]" />
          ラウンド{game.round}・胴元 {PLAYER_NAMES[game.dealer]}
        </span>
        {hint && chosen.length > 0 && (game.phase === 'roll' || game.phase === 'decide') && (
          <span className="ml-auto mr-2 flex items-center gap-0.5 text-[11px] font-bold text-white/70" title={game.upPending ? '胴元ダイスで摘発になる確率' : '次の1振りで摘発になる確率'}>
            <Gauge size={13} /> {game.upPending ? '胴元ダイスで' : '次'} 摘発{pct(nextBustChance(game))}
          </span>
        )}
        <span className="flex items-center gap-1" aria-label={`サイレン ${sirens}個`}>
          {[0, 1].map((i) => (
            <span
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${i < sirens ? 'border-red-400 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]' : 'border-white/20 bg-black/30'}`}
            >
              <Siren size={13} className={i < sirens ? 'text-white' : 'text-white/30'} />
            </span>
          ))}
        </span>
      </div>

      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span />
        {choosing ? (
          <p className="flex h-[80px] items-center text-sm font-bold text-white/80">{PLAYER_NAMES[game.dealer]}が賭場を選んでいます…</p>
        ) : (
          <div className="flex items-end gap-3">
            {chosen.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1">
                <Die die={d} face={last?.dice[i]?.face ?? null} rolling={rolling} size={58} />
                <span className="text-[10px] font-bold text-white/70">{DICE[d].name}</span>
              </div>
            ))}
          </div>
        )}
        <Pot value={game.pot} />
      </div>

      {/* 胴元ダイス（◎が出たら胴元が振る）と追加ダイス（胴元が選ぶ） */}
      {!rolling && last && (game.phase === 'up' || game.upPending || last.up) && (
        <div className="flex w-full flex-wrap items-stretch justify-center gap-2">
          {/* 追加ダイスを選んでいる間は、胴元ダイスの目は出目一覧で分かるので選択欄を広く取る */}
          {!picking && <UpArea compact={game.phase === 'extra' || last.extra.length > 0} />}
          {picking ? (
            <ExtraPicker />
          ) : rollingExtra ? (
            <ExtraRow dice={rollingExtra.map((die) => ({ die, face: null }))} rolling />
          ) : (
            last.extra.length > 0 && <ExtraRow dice={last.extra} />
          )}
        </div>
      )}

      <Result />

    </div>
  )
}

/** テーブル中央の供託 */
function Pot({ value }: { value: number }) {
  return (
    <div className="flex flex-col items-center justify-self-start rounded-xl border border-[var(--gold)]/70 bg-black/35 px-2 py-1" aria-label={`供託 ${value}`}>
      <span className="text-[10px] font-black text-[var(--gold)]">供託</span>
      <motion.span key={value} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="text-lg font-black tabular-nums leading-tight text-white">
        {value.toLocaleString()}
      </motion.span>
    </div>
  )
}

const gainText = (chips: number, pot: number) => [chips && `チップ+${chips}`, pot && `供託+${pot}`].filter(Boolean).join('・') || '+0'

function Result() {
  const game = useGame((s) => s.game)
  const rolling = useGame((s) => s.rolling)
  const rollingExtra = useGame((s) => s.rollingExtra)
  const rollingUp = useGame((s) => s.rollingUp)
  const last = game.last
  const extraSirens = last?.extra.filter((e) => e.face.kind === 'siren').length ?? 0
  let text = ''
  let tone = 'text-white'
  if (rolling) text = 'ダイスが転がる…'
  else if (rollingUp) text = '胴元ダイスが転がる…'
  else if (rollingExtra) text = '追加のダイスが転がる…'
  else if (!last) text = game.phase === 'choose' ? '' : 'まもなく開帳'
  else if (game.phase === 'up') {
    text = `${gainText(last.chips, last.pot)}　◎が出た！`
    tone = last.sirens === 1 ? 'text-amber-300' : 'text-[var(--gold)]'
  } else if (game.phase === 'decide' && game.upPending) {
    text = `${gainText(last.chips, last.pot)}　◎！ 胴元ダイスの前に去就を決めよう`
    tone = last.sirens === 1 ? 'text-amber-300' : 'text-[var(--gold)]'
  } else if (game.phase === 'extra') {
    text = game.dealer === 'p1' ? `追加で振る賭場を${extraCount(last)}つ選ぼう` : `${PLAYER_NAMES[game.dealer]}が追加の賭場を選んでいます…`
    tone = last.sirens === 1 ? 'text-amber-300' : 'text-[var(--gold)]'
  } else if (last.outcome === 'busted') {
    text = extraSirens > 0 ? `追加ダイスでサイレン${last.sirens}つ目！ 摘発、チップと供託は没収` : '摘発！ チップと供託は没収'
    tone = 'text-red-400'
  } else {
    text = `${gainText(last.chips, last.pot)}${last.sirens === 1 ? '　サイレン1つ…警察の気配' : ''}`
    tone = last.sirens === 1 ? 'text-amber-300' : 'text-[var(--gold)]'
  }
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={`${text}-${game.rolls}`}
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`min-h-5 text-center text-sm font-black ${tone}`}
      >
        {text}
      </motion.p>
    </AnimatePresence>
  )
}

/** 胴元ダイスと、その効果（自分が胴元なら振るボタン） */
function UpArea({ compact = false }: { compact?: boolean }) {
  const game = useGame((s) => s.game)
  const rollingUp = useGame((s) => s.rollingUp)
  const rollUp = useGame((s) => s.rollUp)
  const up = game.last?.up ?? null
  const mine = game.phase === 'up' && game.dealer === 'p1' && !rollingUp
  // 追加ダイスと並べるときは胴元ダイスだけを出す（効果は追加ダイスの列で分かる）
  if (compact && up && !rollingUp)
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-black/25 px-2 py-1.5" title={UP_LABEL[up].text}>
        <UpDie face={up} size={40} />
        <span className="text-[10px] font-bold text-[var(--gold)]">胴元ダイス</span>
      </div>
    )
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-black/25 px-2.5 py-1">
      <UpDie face={up} rolling={rollingUp} size={48} />
      <div className="min-w-0 text-left">
        <p className="flex items-center gap-1 text-[10px] font-black text-[var(--gold)]">
          <Sparkles size={11} /> 胴元ダイス
        </p>
        {mine ? (
          <button
            type="button"
            onClick={rollUp}
            className="glow-pulse mt-0.5 rounded-xl bg-[var(--gold)] px-4 py-1.5 text-sm font-black text-black shadow hover:brightness-110"
          >
            胴元ダイスを振る
          </button>
        ) : up && !rollingUp ? (
          <p className="text-xs font-bold text-white">
            <b className="text-[var(--gold)]">{UP_LABEL[up].name}</b>：{UP_LABEL[up].text}
          </p>
        ) : (
          <p className="text-xs font-bold text-white/80">{rollingUp ? '転がっています…' : game.phase === 'up' ? `${PLAYER_NAMES[game.dealer]}が振ります…` : `去就の宣言のあと、${PLAYER_NAMES[game.dealer]}が振ります`}</p>
        )}
      </div>
    </div>
  )
}

/** 追加で振った（振っている）ダイスの列 */
function ExtraRow({ dice, rolling = false }: { dice: { die: DieId; face: Face | null }[]; rolling?: boolean }) {
  return (
    <div className="flex items-end gap-2 rounded-2xl bg-black/25 px-2.5 py-1.5">
      <span className="self-center text-[10px] font-black text-white/60 [writing-mode:vertical-rl]">追加</span>
      {dice.map(({ die, face }) => (
        <div key={die} className="flex flex-col items-center gap-0.5">
          <Die die={die} face={face} rolling={rolling} size={40} />
          <span className="text-[10px] font-bold text-white/70">{DICE[die].name}</span>
        </div>
      ))}
    </div>
  )
}

/** 自分が胴元のときの追加ダイス選び（胴元ダイスの目と同じ数だけ選ぶ） */
function ExtraPicker() {
  const game = useGame((s) => s.game)
  const chooseExtra = useGame((s) => s.chooseExtra)
  const hint = useGame((s) => s.settings.hint)
  const picked = useGame((s) => s.extraPicked)
  const toggle = useGame((s) => s.toggleExtra)
  const n = extraCount(game.last)
  const sirens = game.last?.sirens ?? 0
  const chance = picked.length === n ? extraOptions(game.chosen, n, sirens).find((o) => o.dice.every((d) => picked.includes(d)))?.pBust : undefined
  return (
    <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--gold)]/60 bg-black/30 p-1.5">
      <div className="flex gap-2">
        {extraCandidates(game.chosen).map((d) => {
          const on = picked.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(d)}
              className={`flex flex-col items-center gap-0.5 rounded-xl border-2 p-1 transition ${on ? 'border-[var(--gold)] bg-black/40' : 'border-transparent opacity-70 hover:border-white/30 hover:opacity-100'}`}
            >
              <Die die={d} face={null} size={44} />
              <span className="whitespace-nowrap text-[10px] font-bold text-white/80">{DICE[d].name}</span>
              <span className="hidden text-[9px] text-white/60 sm:block">{DICE[d].trait}</span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="whitespace-nowrap text-[11px] font-bold text-white/70">{chance !== undefined && hint ? `摘発確率 ${pct(chance)}` : `${picked.length}/${n} 選択中`}</span>
        <button
          type="button"
          disabled={picked.length !== n}
          onClick={() => chooseExtra(picked)}
          className="whitespace-nowrap rounded-xl bg-[var(--gold)] px-3 py-1.5 text-sm font-black text-black shadow transition enabled:hover:brightness-110 disabled:opacity-40"
        >
          追加で振る
        </button>
      </div>
    </div>
  )
}

/** 自分が胴元のときの賭場選び（3個） */
function DicePicker() {
  const choose = useGame((s) => s.choose)
  const hint = useGame((s) => s.settings.hint)
  const [picked, setPicked] = useState<DieId[]>([])
  const toggle = (d: DieId) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : p.length < 3 ? [...p, d] : p))
  return (
    <div className="felt flex flex-col gap-2 rounded-3xl p-3">
      <p className="text-center text-sm font-black text-[var(--gold)]">
        <Crown size={14} className="mr-1 inline" />
        あなたが胴元。賭場を3つ選ぼう
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {DIE_IDS.map((d) => {
          const on = picked.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(d)}
              className={`flex flex-col gap-1 rounded-xl border-2 bg-black/30 p-1.5 text-left transition ${on ? 'border-[var(--gold)] bg-black/50' : 'border-transparent hover:border-white/30'}`}
            >
              <span className="flex items-center gap-1.5">
                <Die die={d} face={null} size={26} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-xs font-black">{DICE[d].name}</span>
                  <span className="block text-[10px] text-white/60">{DICE[d].trait}</span>
                </span>
              </span>
              <span className="flex justify-between gap-0.5">
                {DICE[d].faces.map((f, i) => (
                  <span key={i} className="flex h-[18px] min-w-[18px] flex-1 items-center justify-center rounded bg-white/10">
                    <FaceMark face={f} small />
                  </span>
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-white/70">
          {picked.length === 3 && hint ? `1回の摘発確率 ${pct(bustChance(picked))}` : `${picked.length}/3 選択中`}
        </span>
        <button
          type="button"
          disabled={picked.length !== 3}
          onClick={() => choose(picked)}
          className="rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-black text-black shadow transition enabled:hover:brightness-110 disabled:opacity-40"
        >
          この賭場で開帳
        </button>
      </div>
    </div>
  )
}

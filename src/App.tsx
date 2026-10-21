import { Armchair, CircleHelp, DoorOpen, RotateCcw, ScrollText, Siren, Undo2, LayoutGrid } from 'lucide-react'
import { HUB_URL } from './hub'
import { useState } from 'react'
import { DiceGuide } from './components/DiceGuide'
import { Overlays } from './components/Overlays'
import { LogModal, ResultModal, RulesModal, StartModal, Title } from './components/Modals'
import { Seat } from './components/Seat'
import { Table } from './components/Table'
import { DEBUG } from './debug'
import { PLAYER_NAMES } from './game/engine'
import { useGame } from './game/store'
import { useFitZoom } from './useFitZoom'

export default function App() {
  const game = useGame((s) => s.game)
  const setup = useGame((s) => s.setup)
  const reset = useGame((s) => s.reset)
  const undo = useGame((s) => s.undo)
  const canUndo = useGame((s) => !s.setup && s.history.length > 0)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const me = game.players.find((p) => p.id === 'p1')!
  const cpus = game.players.filter((p) => p.id !== 'p1')
  // PCでは画面に合わせて拡大する（モーダルや演出は画面全体を覆うので拡大しない）
  const zoom = useFitZoom()

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-4" style={zoom > 1 ? { maxWidth: `${48 * zoom}rem` } : undefined}>
      <header
        className="sticky top-0 z-30 -mx-4 mb-2 flex items-center justify-between gap-2 bg-[var(--bg)]/85 px-4 py-1.5 backdrop-blur md:py-2.5"
        style={zoom > 1 ? { zoom } : undefined}
      >
        <div className="flex min-w-0 items-center gap-1">
          <HubLink />
          <h1>
            <Title size="sm" />
          </h1>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1.5">
          {!setup && (
            <span className="whitespace-nowrap rounded-full bg-[var(--card)] px-2.5 py-1 text-xs font-bold">
              R{game.round}<span className="hidden sm:inline">・目標{game.target.toLocaleString()}</span>
            </span>
          )}
          {DEBUG && (
            <button type="button" aria-label="一手戻る（デバッグ用）" title="一手戻る（デバッグ用）" disabled={!canUndo} onClick={undo} className="rounded-full p-1.5 hover:bg-[var(--panel)] disabled:opacity-30 sm:p-2">
              <Undo2 size={20} />
            </button>
          )}
          {!setup && (
            <button type="button" aria-label="記録" title="記録" onClick={() => setLogOpen(true)} className="rounded-full p-1.5 hover:bg-[var(--panel)] sm:p-2">
              <ScrollText size={20} />
            </button>
          )}
          <button type="button" aria-label="遊び方" onClick={() => setRulesOpen(true)} className="rounded-full p-1.5 hover:bg-[var(--panel)] sm:p-2">
            <CircleHelp size={20} />
          </button>
          <button
            type="button"
            aria-label="リセット"
            onClick={() => {
              if (setup || game.phase === 'gameover' || confirm('ゲームをやめて最初の画面に戻りますか？')) reset()
            }}
            className="rounded-full p-1.5 hover:bg-[var(--panel)] sm:p-2"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-2 md:gap-3" style={zoom > 1 ? { zoom } : undefined}>
        {/* 対戦相手が上、自分が下 */}
        <div className="grid gap-1.5 pt-2" style={{ gridTemplateColumns: `repeat(${cpus.length}, minmax(0, 1fr))` }}>
          {cpus.map((p) => (
            <Seat key={p.id} player={p} game={game} compact />
          ))}
        </div>
        <Table />
        <DiceGuide />
        <Seat player={me} game={game} />
        <Controls />
      </main>

      <Overlays />
      <StartModal onRules={() => setRulesOpen(true)} />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <LogModal open={logOpen} onClose={() => setLogOpen(false)} />
      <ResultModal />
    </div>
  )
}

function Controls() {
  const game = useGame((s) => s.game)
  const rolling = useGame((s) => s.rolling)
  const decide = useGame((s) => s.decide)
  const next = useGame((s) => s.next)
  const me = game.players.find((p) => p.id === 'p1')!
  const myCall = game.phase === 'decide' && me.inRound && !rolling

  if (game.phase === 'roundEnd') {
    const busted = game.roundEnd === 'busted'
    return (
      <div className="flex items-center gap-2">
        <p className={`flex flex-1 items-center gap-1 text-sm font-bold ${busted ? 'text-red-400' : 'text-[var(--muted)]'}`}>
          {busted && <Siren size={16} />}
          {busted ? '摘発でラウンド終了' : '全員が席を立ってラウンド終了'}
        </p>
        <button type="button" onClick={next} className="glow-pulse rounded-xl bg-[var(--gold)] px-5 py-3 font-black text-black shadow hover:brightness-110">
          次のラウンドへ
        </button>
      </div>
    )
  }
  if (myCall) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => decide('stay')}
          className="flex flex-col items-center justify-center rounded-xl bg-emerald-600 py-2.5 font-black text-white shadow transition hover:brightness-110"
        >
          <span className="flex items-center gap-1.5">
            <Armchair size={18} /> 席に残る
          </span>
          <span className="text-[10px] font-bold opacity-80">{game.upPending ? '胴元ダイスへ' : 'もう1回振る'}</span>
        </button>
        <button
          type="button"
          onClick={() => decide('leave')}
          className="flex flex-col items-center justify-center rounded-xl bg-sky-500 py-2.5 font-black text-black shadow transition hover:brightness-110"
        >
          <span className="flex items-center gap-1.5">
            <DoorOpen size={18} /> 席を立つ
          </span>
          <span className="text-[10px] font-bold opacity-80">
            チップ{me.pool.toLocaleString()}
            {game.pot > 0 && `＋供託（1人なら${game.pot.toLocaleString()}）`}
          </span>
        </button>
      </div>
    )
  }
  if ((game.phase === 'choose' || game.phase === 'up' || game.phase === 'extra') && game.dealer === 'p1') return null
  const dealer = PLAYER_NAMES[game.dealer]
  const text =
    game.phase === 'gameover'
      ? 'ゲーム終了'
      : game.phase === 'choose'
        ? game.dealer === 'p1'
          ? '賭場を3つ選んで開帳しよう'
          : `${dealer}が賭場を選んでいます`
        : game.phase === 'up'
          ? `${dealer}が胴元ダイスを振ります`
          : game.phase === 'extra'
            ? `${dealer}が追加の賭場を選んでいます`
            : rolling
              ? 'ダイスが転がっています…'
              : me.inRound
                ? '全員の宣言を公開中…'
                : 'あなたは席を立ちました。残った人の行方を見守ろう'
  return <p className="flex min-h-[52px] items-center justify-center text-center text-sm font-bold text-[var(--muted)]">{text}</p>
}

/** ゲーム集の入口へ戻る */
function HubLink() {
  return (
    <a href={HUB_URL} aria-label="ゲーム一覧へ" title="ゲーム一覧へ" className="-ml-1.5 shrink-0 rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--text)]">
      <LayoutGrid size={18} />
    </a>
  )
}

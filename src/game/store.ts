import { create } from 'zustand'
import { cpuChoose, cpuChooseExtra, cpuDecision, LEVELS, type Level } from './cpu'
import { chooseDice, createGame, declare, extraCandidates, extraCount, nextRound, PLAYER_IDS, roll, rollExtra, rollUp } from './engine'
import { DEFAULT_TARGET, TARGET_OPTIONS, type Decision, type DieId, type GameState, type PlayerId } from './types'

export type FirstDealer = 'p1' | 'cpu' | 'random'
type CpuId = Exclude<PlayerId, 'p1'>

/** 演出の待ち時間（ms） */
export const TIMING = { cpuChoose: 1100, roll: 900, afterRoll: 500, reveal: 1300, cpuOnly: 700, result: 1400 }

export interface Settings {
  cpuCount: number
  level: Level
  firstDealer: FirstDealer
  target: number
  /** 摘発確率のヒントを表示する */
  hint: boolean
}

interface Store {
  game: GameState
  /** 開始画面を表示中 */
  setup: boolean
  settings: Settings
  updateSettings: (s: Partial<Settings>) => void
  /** ダイスを振っている演出中 */
  rolling: boolean
  /** 胴元ダイスを振っている演出中 */
  rollingUp: boolean
  /** 追加ダイスを振っている演出中（振っているダイス） */
  rollingExtra: DieId[] | null
  /** 結果画面を出してよいか（ゲーム終了直後の演出を見せてから出す） */
  showResult: boolean
  /** 進行中の非同期処理を無効化するための世代番号 */
  epoch: number
  start: () => void
  reset: () => void
  /** 自分が胴元のときの賭場選び */
  choose: (dice: DieId[]) => void
  /** 自分が胴元のときに胴元ダイスを振る */
  rollUp: () => void
  /** 追加ダイス選びで選択中のダイス（出目一覧にも出す） */
  extraPicked: DieId[]
  toggleExtra: (d: DieId) => void
  /** 自分が胴元のときの追加ダイス選び */
  chooseExtra: (dice: DieId[]) => void
  /** 自分の去就の宣言 */
  decide: (d: Decision) => void
  /** 次のラウンドへ */
  next: () => void
  /** デバッグ用：自分の操作の直前の局面 */
  history: GameState[]
  undo: () => void
}

const SETTINGS_KEY = 'bustedup.settings'
const DEFAULT_SETTINGS: Settings = { cpuCount: 2, level: 'normal', firstDealer: 'random', target: DEFAULT_TARGET, hint: true }
function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>
    const s = { ...DEFAULT_SETTINGS, ...raw }
    return {
      cpuCount: [2, 3].includes(s.cpuCount) ? s.cpuCount : DEFAULT_SETTINGS.cpuCount,
      level: s.level in LEVELS ? s.level : DEFAULT_SETTINGS.level,
      firstDealer: ['p1', 'cpu', 'random'].includes(s.firstDealer) ? s.firstDealer : DEFAULT_SETTINGS.firstDealer,
      target: (TARGET_OPTIONS as readonly number[]).includes(s.target) ? s.target : DEFAULT_SETTINGS.target,
      hint: typeof s.hint === 'boolean' ? s.hint : DEFAULT_SETTINGS.hint,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}
function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // 保存できなくても今回のゲームには反映する
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const HISTORY_LIMIT = 200

export const useGame = create<Store>((set, get) => {
  const alive = (epoch: number) => get().epoch === epoch
  const remember = (game: GameState) => ({ history: [...get().history, game].slice(-HISTORY_LIMIT) })

  const cpuDecisions = (game: GameState) => {
    const { level } = get().settings
    return Object.fromEntries(
      game.players.filter((p) => p.inRound && p.id !== 'p1').map((p) => [p.id, cpuDecision(game, p.id as CpuId, level)]),
    ) as Partial<Record<PlayerId, Decision>>
  }

  /** 自分の操作が要らない間、ゲームを自動で進める */
  async function advance(epoch: number) {
    for (;;) {
      if (!alive(epoch)) return
      const game = get().game
      if (game.phase === 'choose') {
        if (game.dealer === 'p1') return
        await wait(TIMING.cpuChoose)
        if (!alive(epoch)) return
        set({ game: chooseDice(game, cpuChoose(game, game.dealer as CpuId, get().settings.level)) })
      } else if (game.phase === 'roll') {
        set({ rolling: true })
        await wait(TIMING.roll)
        if (!alive(epoch)) return
        set({ game: roll(get().game, Math.random), rolling: false })
        await wait(TIMING.afterRoll)
      } else if (game.phase === 'up') {
        if (game.dealer === 'p1') return
        await wait(TIMING.cpuOnly)
        if (!alive(epoch)) return
        await rollUpWithFx(epoch)
      } else if (game.phase === 'extra') {
        if (game.dealer === 'p1') return
        await wait(TIMING.cpuChoose)
        if (!alive(epoch)) return
        await rollExtraWithFx(epoch, cpuChooseExtra(game, game.dealer as CpuId, get().settings.level))
      } else if (game.phase === 'decide') {
        if (game.players.find((p) => p.id === 'p1')!.inRound) return
        await wait(TIMING.cpuOnly)
        if (!alive(epoch)) return
        set({ game: declare(get().game, cpuDecisions(get().game)) })
        await wait(TIMING.reveal)
      } else if (game.phase === 'gameover') {
        await wait(TIMING.result)
        if (alive(epoch)) set({ showResult: true })
        return
      } else return // roundEnd：自分で「次のラウンド」を押す
    }
  }

  /** 胴元ダイスを転がす演出のあとに結果を反映する */
  async function rollUpWithFx(epoch: number) {
    set({ rollingUp: true })
    await wait(TIMING.roll)
    if (!alive(epoch)) return
    set({ game: rollUp(get().game, Math.random), rollingUp: false })
    await wait(TIMING.afterRoll)
  }

  /** 追加ダイスを転がす演出のあとに結果を反映する */
  async function rollExtraWithFx(epoch: number, dice: DieId[]) {
    set({ rollingExtra: dice })
    await wait(TIMING.roll)
    if (!alive(epoch)) return
    set({ game: rollExtra(get().game, dice, Math.random), rollingExtra: null })
    await wait(TIMING.afterRoll)
  }

  const restart = (patch: Partial<Store>) => {
    const epoch = get().epoch + 1
    set({ ...patch, epoch, rolling: false, rollingUp: false, rollingExtra: null, extraPicked: [], showResult: false })
    void advance(epoch)
  }

  return {
    game: createGame(),
    setup: true,
    settings: loadSettings(),
    updateSettings: (s) => {
      const settings = { ...get().settings, ...s }
      saveSettings(settings)
      set({ settings })
    },
    rolling: false,
    rollingUp: false,
    rollingExtra: null,
    extraPicked: [],
    toggleExtra: (d) => {
      const { game, extraPicked } = get()
      const n = extraCount(game.last)
      if (game.phase !== 'extra' || !extraCandidates(game.chosen).includes(d)) return
      set({ extraPicked: extraPicked.includes(d) ? extraPicked.filter((x) => x !== d) : extraPicked.length < n ? [...extraPicked, d] : extraPicked })
    },
    showResult: false,
    epoch: 0,
    history: [],
    start: () => {
      const { cpuCount, firstDealer, target } = get().settings
      const ids = PLAYER_IDS.slice(0, cpuCount + 1)
      const cpus = ids.slice(1)
      const dealer: PlayerId =
        firstDealer === 'p1' ? 'p1' : firstDealer === 'cpu' ? cpus[Math.floor(Math.random() * cpus.length)] : ids[Math.floor(Math.random() * ids.length)]
      restart({ game: createGame({ cpuCount, firstDealer: dealer, target }), setup: false, history: [] })
    },
    reset: () => set((s) => ({ setup: true, epoch: s.epoch + 1, rolling: false, rollingUp: false, rollingExtra: null, extraPicked: [], showResult: false, history: [] })),
    choose: (dice) => {
      const { game } = get()
      if (game.phase !== 'choose' || game.dealer !== 'p1') return
      const next = chooseDice(game, dice)
      if (next !== game) restart({ game: next, ...remember(game) })
    },
    rollUp: () => {
      const { game, rollingUp } = get()
      if (rollingUp || game.phase !== 'up' || game.dealer !== 'p1') return
      const epoch = get().epoch + 1
      set({ epoch, ...remember(game) })
      void rollUpWithFx(epoch).then(() => advance(epoch))
    },
    chooseExtra: (dice) => {
      const { game, rollingExtra } = get()
      if (rollingExtra || game.phase !== 'extra' || game.dealer !== 'p1') return
      if (rollExtra(game, dice, Math.random) === game) return
      const epoch = get().epoch + 1
      set({ epoch, extraPicked: [], ...remember(game) })
      void rollExtraWithFx(epoch, dice).then(() => advance(epoch))
    },
    decide: (d) => {
      const { game, rolling } = get()
      if (rolling || game.phase !== 'decide' || !game.players.find((p) => p.id === 'p1')!.inRound) return
      const next = declare(game, { ...cpuDecisions(game), p1: d })
      const epoch = get().epoch + 1
      set({ game: next, epoch, ...remember(game) })
      // 全員の宣言を見せてから進める
      void wait(TIMING.reveal).then(() => advance(epoch))
    },
    next: () => {
      const { game } = get()
      if (game.phase !== 'roundEnd') return
      restart({ game: nextRound(game) })
    },
    undo: () => {
      const { history } = get()
      const prev = history.at(-1)
      if (!prev) return
      set((s) => ({ game: prev, history: history.slice(0, -1), epoch: s.epoch + 1, rolling: false, rollingUp: false, rollingExtra: null, extraPicked: [], showResult: false }))
    },
  }
})

// 開発時だけ、ブラウザのコンソールから局面を操作できるようにする（動作確認用）
if (import.meta.env.DEV) Object.assign(window, { __bustedup: useGame })

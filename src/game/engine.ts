import { DICE, DIE_IDS, UP_FACES, UP_LABEL } from './dice'
import {
  DEFAULT_TARGET,
  FEE,
  SHARE_UNIT,
  TIP,
  type Decision,
  type DieId,
  type Face,
  type GameState,
  type LogEntry,
  type Player,
  type PlayerId,
  type Rng,
  type RollResult,
  type UpFace,
} from './types'

/**
 * BUSTED UP! のルール（純粋関数）。
 * 流れ：choose（胴元が賭場を選ぶ）→ roll → decide（残る/立つ）→ roll → … → roundEnd → choose …
 * ◎が出たら decide → up（胴元ダイス）→（追加なら extra）→ decide。
 * チップの目は席に残っている全員のチップに、供託の目はテーブル中央の供託に入る。
 * 席を立った人は、自分のチップと、同時に立った人で山分けした供託を金庫に入れる。
 */

export const PLAYER_IDS: PlayerId[] = ['p1', 'cpu1', 'cpu2', 'cpu3']
export const PLAYER_NAMES: Record<PlayerId, string> = { p1: 'あなた', cpu1: 'ジャック', cpu2: 'マダム', cpu3: 'ボス' }

/** 供託を n 人で山分けしたときの1人分（SHARE_UNIT 単位で切り捨て。端数は供託に残る） */
export const shareOf = (pot: number, n: number) => (n > 0 ? Math.floor(pot / n / SHARE_UNIT) * SHARE_UNIT : 0)

const pick = <T>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)]
function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface GameOptions {
  cpuCount?: number
  /** 最初の胴元 */
  firstDealer?: PlayerId
  target?: number
}

export function createGame({ cpuCount = 2, firstDealer = 'p1', target = DEFAULT_TARGET }: GameOptions = {}): GameState {
  const ids = PLAYER_IDS.slice(0, 1 + Math.min(3, Math.max(2, cpuCount)))
  const players: Player[] = ids.map((id) => ({ id, name: PLAYER_NAMES[id], bank: 0, pool: 0, inRound: true, banked: null, share: null }))
  const dealer = ids.includes(firstDealer) ? firstDealer : 'p1'
  return {
    players,
    dealer,
    round: 1,
    phase: 'choose',
    chosen: [],
    pot: 0,
    last: null,
    rolls: 0,
    decisions: {},
    upPending: false,
    roundEnd: null,
    target,
    winners: [],
    log: [{ round: 1, text: `ラウンド1開始。胴元は${PLAYER_NAMES[dealer]}`, tone: 'info' }],
  }
}

export const playerOf = (state: GameState, id: PlayerId) => state.players.find((p) => p.id === id)!
export const stayers = (state: GameState) => state.players.filter((p) => p.inRound)
const log = (state: GameState, text: string, tone?: LogEntry['tone']): LogEntry[] => [...state.log, { round: state.round, text, tone }]

/** 胴元が賭場ダイスを3個選ぶ（選んだらすぐ1回目を振れる状態になる） */
export function chooseDice(state: GameState, dice: DieId[]): GameState {
  if (state.phase !== 'choose') return state
  const unique = [...new Set(dice)].filter((d) => DIE_IDS.includes(d))
  if (unique.length !== 3) return state
  return {
    ...state,
    chosen: unique,
    phase: 'roll',
    log: log(state, `${PLAYER_NAMES[state.dealer]}が賭場を開帳：${unique.map((d) => DICE[d].name).join('・')}`, 'info'),
  }
}

const faceOf = (die: DieId, rng: Rng): Face => pick(DICE[die].faces, rng)
const sum = (rolled: { face: Face }[], kind: 'chip' | 'pot') => rolled.reduce((t, { face }) => t + (face.kind === kind ? face.value : 0), 0)
const sirensOf = (rolled: { face: Face }[]) => rolled.filter(({ face }) => face.kind === 'siren').length
export const isStar = (face: Face) => face.kind !== 'siren' && !!face.star

/** 賭場ダイス3個を振った結果（胴元ダイス・追加ダイスはまだ振らない）。サイレン2個以上で摘発 */
export function rollMain(chosen: DieId[], rng: Rng): RollResult {
  const dice = rollDice(chosen, rng)
  const sirens = sirensOf(dice)
  if (sirens >= 2) return { dice, up: null, extra: [], sirens, chips: 0, pot: 0, outcome: 'busted' }
  return { dice, up: null, extra: [], sirens, chips: sum(dice, 'chip'), pot: sum(dice, 'pot'), outcome: 'ok' }
}

/** 賭場ダイスに◎が出ていて、胴元ダイスをまだ振っていない */
export const needsUp = (r: RollResult) => r.outcome === 'ok' && r.up === null && r.dice.some(({ face }) => isStar(face))
export const rollUpFace = (rng: Rng): UpFace => pick(UP_FACES, rng)

export const rollDice = (dice: DieId[], rng: Rng): RollResult['extra'] => dice.map((die) => ({ die, face: faceOf(die, rng) }))

/** 胴元ダイスの「追加」で振るダイスの数（追加でなければ0） */
export function extraCount(r: Pick<RollResult, 'up' | 'outcome'> | null): number {
  if (!r || r.outcome !== 'ok') return 0
  return r.up === 'extra1' ? 1 : r.up === 'extra2' ? 2 : r.up === 'extra3' ? 3 : 0
}

/** 追加で振れる賭場ダイス（このラウンドで選ばれなかったもの） */
export const extraCandidates = (chosen: DieId[]) => DIE_IDS.filter((d) => !chosen.includes(d))

/** 賭場ダイスの結果に追加ダイスの結果を足す。追加ダイスを含めてサイレン2個以上は摘発 */
export function withExtra(main: RollResult, extra: RollResult['extra']): RollResult {
  const sirens = main.sirens + sirensOf(extra)
  if (sirens >= 2) return { ...main, extra, sirens, chips: 0, pot: 0, outcome: 'busted' }
  return { ...main, extra, sirens, chips: main.chips + sum(extra, 'chip'), pot: main.pot + sum(extra, 'pot'), outcome: 'ok' }
}

/** 振りの結果をまとめて決める（状態は変えない）。追加ダイスは pickExtra で選ぶ（既定はランダム） */
export function rollResult(chosen: DieId[], rng: Rng, pickExtra?: (n: number, candidates: DieId[]) => DieId[]): RollResult {
  const rolled = rollMain(chosen, rng)
  const main = needsUp(rolled) ? { ...rolled, up: rollUpFace(rng) } : rolled
  const n = extraCount(main)
  if (!n) return main
  const candidates = extraCandidates(chosen)
  const set = pickExtra ? pickExtra(n, candidates) : shuffle(candidates, rng).slice(0, n)
  return withExtra(main, rollDice(set, rng))
}

/** 胴元ダイスの効果を供託にかける（ご祝儀 +TIP、ショバ代 −FEE、ハイローラー ×2） */
export function applyUpToPot(pot: number, up: UpFace | null): number {
  if (up === 'tip') return pot + TIP
  if (up === 'fee') return Math.max(0, pot - FEE)
  if (up === 'double') return pot * 2
  return pot
}

/** チップの目を席に残っている全員に、供託の目を供託に入れる */
function gain(state: GameState, chips: number, pot: number): Pick<GameState, 'players' | 'pot'> {
  return { players: state.players.map((p) => (p.inRound ? { ...p, pool: p.pool + chips } : p)), pot: state.pot + pot }
}
const gainText = (chips: number, pot: number) => `チップ+${chips}・供託+${pot}`

/**
 * 席に残っている全員で振る。出た目はすぐチップと供託に入る。
 * ◎が出たら、去就を宣言してから胴元が胴元ダイスを振る（decide → up）。
 */
export function roll(state: GameState, rng: Rng, fixed?: RollResult): GameState {
  if (state.phase !== 'roll') return state
  const r = fixed ?? rollMain(state.chosen, rng)
  const base: GameState = { ...state, last: r, rolls: state.rolls + 1, decisions: {} }
  if (r.outcome === 'busted') return bust(base)
  let next: GameState = { ...base, ...gain(state, r.chips, r.pot), log: log(state, gainText(r.chips, r.pot), 'info') }
  // テスト用：胴元ダイスの目まで決めた結果を渡されたとき
  if (r.up && extraCount(r) && r.extra.length === 0) return { ...next, phase: 'extra' }
  if (r.up) next = { ...next, pot: applyUpToPot(next.pot, r.up) }
  if (needsUp(r)) return { ...next, phase: 'decide', upPending: true, log: log(next, '◎が出た！ 去就を決めてから胴元ダイスを振る', 'info') }
  return { ...next, phase: 'decide' }
}

/** 胴元が胴元ダイスを振る。供託が増減するか、追加ダイスを振る */
export function rollUp(state: GameState, rng: Rng, fixed?: UpFace): GameState {
  if (state.phase !== 'up' || !state.last) return state
  const up = fixed ?? rollUpFace(rng)
  const r: RollResult = { ...state.last, up }
  const base: GameState = { ...state, last: r, upPending: false, decisions: {}, log: log(state, `胴元ダイス：${UP_LABEL[up].name}`, 'pot') }
  if (extraCount(r)) return { ...base, phase: 'extra' }
  return { ...base, pot: applyUpToPot(state.pot, up), phase: 'decide' }
}

/** 胴元が追加で振る賭場ダイスを選んで振る。選ぶ数は胴元ダイスの目と同じ */
export function rollExtra(state: GameState, dice: DieId[], rng: Rng, fixed?: RollResult['extra']): GameState {
  if (state.phase !== 'extra' || !state.last) return state
  const candidates = extraCandidates(state.chosen)
  const unique = [...new Set(dice)].filter((d) => candidates.includes(d))
  if (unique.length !== extraCount(state.last)) return state
  const r = withExtra(state.last, fixed ?? rollDice(unique, rng))
  const base: GameState = { ...state, last: r, log: log(state, `追加で振る：${unique.map((d) => DICE[d].name).join('・')}`, 'info') }
  if (r.outcome === 'busted') return bust(base)
  const chips = r.chips - state.last.chips
  const pot = r.pot - state.last.pot
  return { ...base, ...gain(state, chips, pot), phase: 'decide', log: log(base, gainText(chips, pot), 'info') }
}

/** 摘発：席に残っている全員のチップと供託を没収してラウンド終了 */
function bust(state: GameState): GameState {
  const caught = stayers(state)
  const lost = caught.reduce((t, p) => t + p.pool, 0)
  const players = state.players.map((p) => (p.inRound ? { ...p, pool: 0, inRound: false } : p))
  const text = `摘発！ ${caught.map((p) => p.name).join('・')}のチップ計${lost}${state.pot ? `と供託${state.pot}` : ''}が没収された`
  return endRound({ ...state, players, pot: 0, log: log(state, text, 'bust') }, 'busted')
}

/**
 * 席に残っている全員の去就を同時に公開する。
 * 席を立った人は、自分のチップと、同時に立った人数で山分けした供託（SHARE_UNIT 単位で切り捨て）を金庫に入れる。端数は供託に残る。
 */
export function declare(state: GameState, decisions: Partial<Record<PlayerId, Decision>>): GameState {
  if (state.phase !== 'decide') return state
  const before = stayers(state)
  const leaving = new Set(before.filter((p) => (decisions[p.id] ?? 'stay') === 'leave').map((p) => p.id))
  const share = shareOf(state.pot, leaving.size)
  let entries = state.log
  const players: Player[] = state.players.map((p) => {
    if (!leaving.has(p.id)) return p
    entries = [...entries, { round: state.round, text: `${p.name}が席を立った（チップ${p.pool}${share ? `＋供託${share}` : ''}を金庫へ）`, tone: 'leave' }]
    return { ...p, bank: p.bank + p.pool + share, banked: p.pool + share, share, pool: 0, inRound: false }
  })
  const shown = Object.fromEntries(before.map((p) => [p.id, leaving.has(p.id) ? 'leave' : 'stay'])) as GameState['decisions']
  const next: GameState = { ...state, players, pot: state.pot - share * leaving.size, decisions: shown, log: entries }
  // 全員が立ったら、供託の端数は消える
  if (!players.some((p) => p.inRound)) return endRound({ ...next, pot: 0 }, 'cleared')
  // ◎が出ていれば、宣言のあとに胴元ダイスを振る
  return { ...next, phase: next.upPending ? 'up' : 'roll' }
}

function endRound(state: GameState, reason: 'busted' | 'cleared'): GameState {
  const ended: GameState = { ...state, roundEnd: reason, phase: 'roundEnd', upPending: false }
  const top = Math.max(...state.players.map((p) => p.bank))
  if (top < state.target) return ended
  const winners = state.players.filter((p) => p.bank === top).map((p) => p.id)
  return {
    ...ended,
    phase: 'gameover',
    winners,
    log: log(state, winners.length > 1 ? `ゲーム終了：引き分け（${top}）` : `ゲーム終了：${PLAYER_NAMES[winners[0]]}の勝ち（${top}）`, 'info'),
  }
}

/** 次のラウンドへ（胴元は時計回りに交代） */
export function nextRound(state: GameState): GameState {
  if (state.phase !== 'roundEnd') return state
  const ids = state.players.map((p) => p.id)
  const dealer = ids[(ids.indexOf(state.dealer) + 1) % ids.length]
  const round = state.round + 1
  return {
    ...state,
    dealer,
    round,
    phase: 'choose',
    chosen: [],
    pot: 0,
    last: null,
    rolls: 0,
    decisions: {},
    upPending: false,
    roundEnd: null,
    players: state.players.map((p) => ({ ...p, pool: 0, inRound: true, banked: null, share: null })),
    log: [...state.log, { round, text: `ラウンド${round}開始。胴元は${PLAYER_NAMES[dealer]}`, tone: 'info' }],
  }
}

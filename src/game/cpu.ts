import { DIE_IDS } from './dice'
import type { Decision, DieId, GameState, PlayerId, Rng } from './types'
import { extraCount, playerOf, shareOf, stayers } from './engine'
import { bustChance, continueValue, extraOptions, upBustChance, upValue, type Outlook } from './odds'

/**
 * CPUの思考。確率と期待値で「残る/立つ」と賭場選びを決める。
 * 去就の宣言は同時公開なので、他の人の今回の宣言は見ない（立ちそうかを見積もる）。
 */

export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Record<Level, { label: string; depth: number; noise: number; readOthers: boolean; scoreAware: boolean }> = {
  // やさしい：供託は独り占めできるつもりで、他の人の動きを読まない
  easy: { label: 'やさしい', depth: 1, noise: 0.35, readOthers: false, scoreAware: false },
  normal: { label: 'ふつう', depth: 2, noise: 0.1, readOthers: true, scoreAware: false },
  hard: { label: 'つよい', depth: 3, noise: 0, readOthers: true, scoreAware: true },
}

export interface Personality {
  label: string
  /** 続けたときの価値に掛ける係数（1より大きいほど強気） */
  risk: number
}
export const PERSONALITY: Record<Exclude<PlayerId, 'p1'>, Personality> = {
  cpu1: { label: '標準', risk: 1 },
  cpu2: { label: '慎重派', risk: 0.9 },
  cpu3: { label: 'ギャンブラー', risk: 1.15 },
}

/** 席ごとの性格（シミュレーションで「あなた」の席もCPUに打たせるときは標準） */
const personalityOf = (id: PlayerId): Personality => (id === 'p1' ? PERSONALITY.cpu1 : PERSONALITY[id])

/** 胴元が席を立っていると、追加ダイスは残っている人を摘発させる向きに選ばれる（と見積もる） */
export const dealerAway = (state: GameState) => !playerOf(state, state.dealer).inRound

/** 次に起きること（胴元ダイス or 次の振り）で摘発になる確率 */
export function nextBustChance(state: GameState): number {
  if (state.upPending) return upBustChance(state.chosen, state.last?.sirens ?? 0, dealerAway(state))
  return bustChance(state.chosen, dealerAway(state))
}

/** 先の宣言で、他の人1人が席を立つ確率の目安 */
const FUTURE_LEAVE = 0.25

/** 各人が確率 qs[i] で立つとき、立つ人数の分布 */
function countDist(qs: number[]): number[] {
  let dist = [1]
  for (const q of qs) {
    const next = new Array(dist.length + 1).fill(0)
    dist.forEach((p, k) => {
      next[k] += p * (1 - q)
      next[k + 1] += p * q
    })
    dist = next
  }
  return dist
}

/** 他に m 人が残っているときの先読みの前提（他の人を読まないなら、供託は独り占めできるつもり） */
function outlookFor(chosen: DieId[], hostile: boolean, m: number, risk: number, readOthers: boolean): Outlook {
  if (!readOthers || m === 0) return { chosen, hostile, snatch: 0, share: 1, risk }
  const share = countDist(new Array(m).fill(FUTURE_LEAVE)).reduce((t, p, k) => t + p / (k + 1), 0)
  return { chosen, hostile, snatch: 1 - (1 - FUTURE_LEAVE) ** m, share, risk }
}

/** 残ったときの価値。◎が出ていれば次は胴元ダイス、そうでなければ次の振り */
function stayValue(state: GameState, o: Outlook, pool: number, pot: number, depth: number, memo = new Map<string, number>()): number {
  if (state.upPending) return upValue(o, pool, pot, state.last?.sirens ?? 0, depth, memo)
  return continueValue(o, pool, pot, depth, memo)
}

/** 点差に応じた強気・弱気の補正（つよいのみ） */
function scoreRisk(state: GameState, id: PlayerId): number {
  const me = playerOf(state, id)
  const others = state.players.filter((p) => p.id !== id)
  const leader = Math.max(...others.map((p) => p.bank))
  const gap = (leader - me.bank) / state.target
  // 首位が目標点に近いほど、負けている側は粘る
  if (gap > 0 && leader > state.target * 0.6) return 1 + Math.min(0.5, gap) * 0.8
  if (gap < -0.15) return 0.92
  return 1
}

/** 相手がこの宣言で席を立ちそうか（相手のチップと供託から、他の人を読まない判断で大まかに見積もる） */
function leaveGuess(state: GameState, id: PlayerId): number {
  const p = playerOf(state, id)
  if (p.pool <= 0 && state.pot <= 0) return 0.05
  const m = stayers(state).length - 1
  const o = outlookFor(state.chosen, dealerAway(state), m, 1, true)
  const leave = p.pool + state.pot * o.share
  return stayValue(state, o, p.pool, state.pot, 2) < leave ? 0.6 : 0.15
}

export function cpuDecision(state: GameState, id: PlayerId, level: Level, rng: Rng = Math.random): Decision {
  const cfg = LEVELS[level]
  const me = playerOf(state, id)
  if (me.pool <= 0 && state.pot <= 0) return 'stay'
  const others = stayers(state).filter((p) => p.id !== id)
  let risk = personalityOf(id).risk * (cfg.scoreAware ? scoreRisk(state, id) : 1)
  if (cfg.noise) risk *= 1 + (rng() * 2 - 1) * cfg.noise

  // 今回の宣言で、自分と同時に立つ人数の見込み
  const dist = countDist(others.map((p) => (cfg.readOthers ? leaveGuess(state, p.id) : 0)))
  const leaveV = me.pool + dist.reduce((t, p, k) => t + p * shareOf(state.pot, k + 1), 0)

  if (cfg.scoreAware && me.bank + leaveV >= state.target) {
    // 立てば目標点に届く：誰にも届かれないなら立つ（他の人のチップはまだ摘発の危険があるので金庫だけで比べる）
    const best = Math.max(...state.players.filter((p) => p.id !== id).map((p) => p.bank))
    if (me.bank + leaveV > best) return 'leave'
  }

  // 残った場合：今回ほかの人が立てば、その人たちが供託を持っていく
  const o = outlookFor(state.chosen, dealerAway(state), others.length, risk, cfg.readOthers)
  const memo = new Map<string, number>()
  const stayV = dist.reduce((t, p, k) => t + p * stayValue(state, o, me.pool, state.pot - k * shareOf(state.pot, k), cfg.depth, memo), 0)
  return stayV > leaveV ? 'stay' : 'leave'
}

const combos3 = (): DieId[][] => {
  const out: DieId[][] = []
  for (let a = 0; a < DIE_IDS.length; a++)
    for (let b = a + 1; b < DIE_IDS.length; b++) for (let c = b + 1; c < DIE_IDS.length; c++) out.push([DIE_IDS[a], DIE_IDS[b], DIE_IDS[c]])
  return out
}
const ALL_COMBOS = combos3()

/** 組み合わせごとの価値はラウンド開始時の盤面によらないのでキャッシュする */
const comboCache = new Map<string, number[]>()
function comboValues(depth: number, risk: number, m: number, readOthers: boolean): number[] {
  const key = `${depth}|${risk}|${m}|${readOthers}`
  let v = comboCache.get(key)
  if (!v) comboCache.set(key, (v = ALL_COMBOS.map((dice) => continueValue(outlookFor(dice, false, m, risk, readOthers), 0, 0, depth))))
  return v
}

/** 胴元として賭場ダイスを選ぶ。自分の性格で最適に降りたときの価値が高い組み合わせを選ぶ */
export function cpuChoose(state: GameState, id: PlayerId, level: Level, rng: Rng = Math.random): DieId[] {
  const cfg = LEVELS[level]
  if (level === 'easy' && rng() < 0.6) return ALL_COMBOS[Math.floor(rng() * ALL_COMBOS.length)]
  // 計算結果をキャッシュで使い回せるよう、強気の係数は0.05刻みにする
  const risk = Math.round(personalityOf(id).risk * (cfg.scoreAware ? scoreRisk(state, id) : 1) * 20) / 20
  const base = comboValues(cfg.depth, risk, state.players.length - 1, cfg.readOthers)
  const scored = ALL_COMBOS.map((dice, i) => ({ dice, v: base[i] + rng() * 8 }))
  scored.sort((a, b) => b.v - a.v)
  // 上位から少しばらつかせる（毎回同じ賭場にならないように）
  return scored[Math.floor(rng() * Math.min(3, scored.length))].dice
}

/**
 * 胴元として追加で振る賭場ダイスを選ぶ。
 * 席に残っていれば自分の取り分の期待値が高いもの、席を立っていれば残っている人が摘発されやすいものを選ぶ。
 */
export function cpuChooseExtra(state: GameState, id: PlayerId, level: Level, rng: Rng = Math.random): DieId[] {
  const last = state.last!
  const options = extraOptions(state.chosen, extraCount(last), last.sirens)
  if (level === 'easy' && rng() < 0.5) return options[Math.floor(rng() * options.length)].dice
  const me = playerOf(state, id)
  // 供託のうち自分が受け取れそうな割合（残っている人数で割る目安）
  const share = 1 / Math.max(1, stayers(state).length)
  const score = me.inRound
    ? (o: (typeof options)[number]) => (1 - o.pBust) * (me.pool + state.pot * share) + o.eChips + o.ePot * share
    : (o: (typeof options)[number]) => o.pBust * 1000 - o.eChips - o.ePot
  return options.reduce((a, b) => (score(b) > score(a) ? b : a)).dice
}

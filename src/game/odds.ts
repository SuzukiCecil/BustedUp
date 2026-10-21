import { DICE, DIE_IDS, UP_FACES } from './dice'
import { applyUpToPot } from './engine'
import type { DieId, Face, UpFace } from './types'

/**
 * 賭場ダイス3個の組み合わせごとに、1回振ったときに起こりうる結果を確率つきで列挙する。
 * CPUの判断と「摘発確率」のヒント表示に使う。
 *
 * 胴元ダイスの「追加」で振るダイスは胴元が選ぶ。見積もりでは胴元の選び方を次のどちらかと仮定する：
 * - 味方（hostile=false）：胴元が席に残っている。摘発されにくいダイスを選ぶ
 * - 敵（hostile=true）：胴元が席を立った。残っている人を摘発させたいので、摘発されやすいダイスを選ぶ
 */

export interface Outcome {
  p: number
  kind: 'ok' | 'busted'
  chips: number
  pot: number
  /** 供託に効く胴元ダイスの目だけを残す */
  up: Extract<UpFace, 'tip' | 'fee' | 'double'> | null
}

const cache = new Map<string, Outcome[]>()

/** 長さ n の各ダイスの出目の全組み合わせ */
function combos(dice: DieId[]): Face[][] {
  return dice.reduce<Face[][]>((acc, d) => acc.flatMap((prev) => DICE[d].faces.map((f) => [...prev, f])), [[]])
}
const sirens = (fs: Face[]) => fs.filter((f) => f.kind === 'siren').length
const total = (fs: Face[], kind: 'chip' | 'pot') => fs.reduce((t, f) => t + (f.kind === kind ? f.value : 0), 0)
const starred = (fs: Face[]) => fs.some((f) => f.kind !== 'siren' && f.star)
function subsets<T>(arr: T[], n: number): T[][] {
  if (n === 0) return [[]]
  if (arr.length < n) return []
  const [head, ...rest] = arr
  return [...subsets(rest, n - 1).map((s) => [head, ...s]), ...subsets(rest, n)]
}

export interface ExtraOption {
  dice: DieId[]
  /** このダイスを追加で振ったときに摘発になる確率 */
  pBust: number
  /** 摘発にならなかったときの追加チップ・追加供託（確率で重みづけした合計） */
  eChips: number
  ePot: number
  /** 摘発にならなかった結果（確率と追加チップ・追加供託） */
  safe: { p: number; chips: number; pot: number }[]
}

const extraCache = new Map<string, ExtraOption[]>()
/** 追加ダイスの選び方ごとの結果。sirensSoFar は賭場ダイスで出ていたサイレンの数 */
export function extraOptions(chosen: DieId[], n: number, sirensSoFar: number): ExtraOption[] {
  const key = `${[...chosen].sort().join(',')}|${n}|${sirensSoFar}`
  const hit = extraCache.get(key)
  if (hit) return hit
  const list = subsets(
    DIE_IDS.filter((d) => !chosen.includes(d)),
    n,
  ).map((set) => {
    const all = combos(set)
    let pBust = 0
    let eChips = 0
    let ePot = 0
    const safe: ExtraOption['safe'] = []
    for (const ex of all) {
      const p = 1 / all.length
      if (sirensSoFar + sirens(ex) >= 2) pBust += p
      else {
        eChips += p * total(ex, 'chip')
        ePot += p * total(ex, 'pot')
        safe.push({ p, chips: total(ex, 'chip'), pot: total(ex, 'pot') })
      }
    }
    return { dice: set, pBust, eChips, ePot, safe }
  })
  extraCache.set(key, list)
  return list
}

/** 見積もり用の胴元の選び方（味方なら摘発されにくさ優先、敵なら摘発されやすさ優先） */
function assumedPick(options: ExtraOption[], hostile: boolean): ExtraOption {
  const gain = (o: ExtraOption) => o.eChips + o.ePot
  const score = (o: ExtraOption) => (hostile ? o.pBust * 1000 - gain(o) : -o.pBust * 1000 + gain(o))
  return options.reduce((a, b) => (score(b) > score(a) ? b : a))
}

export function outcomes(chosen: DieId[], hostile = false): Outcome[] {
  const key = `${[...chosen].sort().join(',')}|${hostile}`
  const hit = cache.get(key)
  if (hit) return hit
  const acc = new Map<string, Outcome>()
  const push = (o: Outcome) => {
    const k = `${o.kind}|${o.chips}|${o.pot}|${o.up}`
    const cur = acc.get(k)
    if (cur) cur.p += o.p
    else acc.set(k, { ...o })
  }
  const main = combos(chosen)
  const pMain = 1 / main.length
  for (const fs of main) {
    const s = sirens(fs)
    if (s >= 2) push({ p: pMain, kind: 'busted', chips: 0, pot: 0, up: null })
    else if (!starred(fs)) push({ p: pMain, kind: 'ok', chips: total(fs, 'chip'), pot: total(fs, 'pot'), up: null })
    else {
      const pUp = pMain / UP_FACES.length
      for (const up of UP_FACES) {
        if (up === 'tip' || up === 'fee' || up === 'double') {
          push({ p: pUp, kind: 'ok', chips: total(fs, 'chip'), pot: total(fs, 'pot'), up })
          continue
        }
        const pick = assumedPick(extraOptions(chosen, Number(up.slice(-1)), s), hostile)
        if (pick.pBust > 0) push({ p: pUp * pick.pBust, kind: 'busted', chips: 0, pot: 0, up: null })
        for (const o of pick.safe) push({ p: pUp * o.p, kind: 'ok', chips: total(fs, 'chip') + o.chips, pot: total(fs, 'pot') + o.pot, up: null })
      }
    }
  }
  const list = [...acc.values()]
  cache.set(key, list)
  return list
}

/**
 * 先読み用に、近い結果をまとめた一覧（チップと供託を BIN 点ごとの区間にまとめ、区間内の確率で重みづけした平均を10点単位で使う）。
 * 結果の種類が多いと先読みが重くなるため。摘発確率や期待値はほぼ変わらない。
 */
const BIN = 40
const binCache = new Map<string, Outcome[]>()
export function binnedOutcomes(chosen: DieId[], hostile = false): Outcome[] {
  const key = `${[...chosen].sort().join(',')}|${hostile}`
  const hit = binCache.get(key)
  if (hit) return hit
  const acc = new Map<string, { p: number; chips: number; pot: number; kind: Outcome['kind']; up: Outcome['up'] }>()
  for (const o of outcomes(chosen, hostile)) {
    const k = `${o.kind}|${Math.round(o.chips / BIN)}|${Math.round(o.pot / BIN)}|${o.up}`
    const cur = acc.get(k) ?? { p: 0, chips: 0, pot: 0, kind: o.kind, up: o.up }
    cur.p += o.p
    cur.chips += o.p * o.chips
    cur.pot += o.p * o.pot
    acc.set(k, cur)
  }
  const ten = (x: number) => Math.round(x / 10) * 10
  const list = [...acc.values()].map((b) => ({ p: b.p, kind: b.kind, up: b.up, chips: ten(b.chips / b.p), pot: ten(b.pot / b.p) }))
  binCache.set(key, list)
  return list
}

/** 次の1回で摘発になる確率 */
export const bustChance = (chosen: DieId[], hostile = false) => outcomes(chosen, hostile).reduce((t, o) => t + (o.kind === 'busted' ? o.p : 0), 0)

/** 胴元ダイスで摘発になる確率（「追加」で追加ダイスにサイレンが出る） */
export function upBustChance(chosen: DieId[], sirensSoFar: number, hostile = false): number {
  return UP_FACES.reduce((t, up) => {
    if (up !== 'extra1' && up !== 'extra2' && up !== 'extra3') return t
    return t + assumedPick(extraOptions(chosen, Number(up.slice(-1)), sirensSoFar), hostile).pBust / UP_FACES.length
  }, 0)
}

/**
 * 先読みの前提。
 * - snatch：自分が残っている間に、他の人が席を立って供託を持っていく確率（1回の宣言あたり）
 * - share：自分があとで席を立つとき、供託のうち自分が受け取れる割合の見込み
 * - risk：続けたときの価値に掛ける係数（1より大きいほど強気）
 */
export interface Outlook {
  chosen: DieId[]
  hostile: boolean
  snatch: number
  share: number
  risk: number
}

/** 価値計算のメモ（同じ前提の計算どうしで共有する） */
export type Memo = Map<string, number>

/**
 * 席に残っていて、宣言の直前にいるときの価値（最適に降りる。depth 回先まで読む）。
 * 立てばチップ＋供託の取り分。残れば、他の人に供託を持っていかれる可能性を見込んで次の振りへ。
 */
export function stopValue(o: Outlook, pool: number, pot: number, depth: number, memo: Memo = new Map()): number {
  const leave = pool + pot * o.share
  if (depth <= 0) return leave
  const key = `s|${pool}|${pot}|${depth}`
  const hit = memo.get(key)
  if (hit !== undefined) return hit
  const stay = (1 - o.snatch) * continueValue(o, pool, pot, depth, memo) + o.snatch * continueValue(o, pool, 0, depth, memo)
  const v = Math.max(leave, stay)
  memo.set(key, v)
  return v
}

/** 残ってもう1回振ったときの価値（以後は最適に降りる） */
export function continueValue(o: Outlook, pool: number, pot: number, depth: number, memo: Memo = new Map()): number {
  const key = `c|${pool}|${pot}|${depth}`
  const hit = memo.get(key)
  if (hit !== undefined) return hit
  let e = 0
  for (const r of binnedOutcomes(o.chosen, o.hostile)) {
    if (r.kind === 'busted') continue
    e += r.p * stopValue(o, pool + r.chips, applyUpToPot(pot + r.pot, r.up), depth - 1, memo)
  }
  const v = e * o.risk
  memo.set(key, v)
  return v
}

/**
 * ◎が出て、胴元ダイスを振る前に残ったときの価値（胴元ダイスの効果のあとは最適に降りる）。
 * sirensSoFar は今回の振りで出ているサイレンの数（追加ダイスで摘発されるかに効く）。
 */
export function upValue(o: Outlook, pool: number, pot: number, sirensSoFar: number, depth: number, memo: Memo = new Map()): number {
  const after = (x: number, y: number) => stopValue(o, x, y, depth - 1, memo)
  let e = 0
  for (const up of UP_FACES) {
    const p = 1 / UP_FACES.length
    if (up === 'tip' || up === 'fee' || up === 'double') e += p * after(pool, applyUpToPot(pot, up))
    else {
      const pick = assumedPick(extraOptions(o.chosen, Number(up.slice(-1)), sirensSoFar), o.hostile)
      for (const s of pick.safe) e += p * s.p * after(pool + s.chips, pot + s.pot)
    }
  }
  return e * o.risk
}

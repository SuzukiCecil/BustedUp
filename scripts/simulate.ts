// CPU同士の対戦： npx tsx scripts/simulate.ts [CPU人数(=プレイヤー数-1)] [局数] [強さ] [目標点]
// 環境変数 DICE_VARIANT に scripts/diceVariants.ts の案の名前を入れると、その出目で対戦する
import { chooseDice, createGame, declare, nextRound, roll, rollExtra, rollUp } from '../src/game/engine'
import { cpuChoose, cpuChooseExtra, cpuDecision, type Level } from '../src/game/cpu'
import { DICE } from '../src/game/dice'
import { applyVariant } from './diceVariants'
import { DEFAULT_TARGET, type GameState, type PlayerId } from '../src/game/types'

export function seeded(seed: number) {
  let s = seed % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
if (process.env.DICE_VARIANT) applyVariant(process.env.DICE_VARIANT)
const cpus = Number(process.argv[2] ?? 2), n = Number(process.argv[3] ?? 200), level = (process.argv[4] ?? 'hard') as Level, target = Number(process.argv[5] ?? DEFAULT_TARGET)
// 全員CPUとして扱う（p1 の席は自分の情報のまま、性格は標準で打たせる）
let rounds = 0, busts = 0, rollsTotal = 0
const gain = { dealer: 0, child: 0, dealerN: 0, childN: 0 }
const wins: Record<string, number> = {}
// 供託の行き先：同時に立った人数ごとの回数と受け取った額、摘発で没収された額、全員が立って消えた端数
const groups: Record<number, { times: number; shares: number }> = {}
const pot = { busted: 0, vanished: 0 }
// 胴元が選んだ賭場ダイスの回数
const picks: Record<string, number> = {}
for (let gi = 0; gi < n; gi++) {
  const rng = seeded(gi * 7919 + 1)
  let g: GameState = createGame({ cpuCount: cpus, firstDealer: (['p1', 'cpu1', 'cpu2', 'cpu3'] as PlayerId[])[gi % (cpus + 1)], target })
  for (let k = 0; g.phase !== 'gameover' && k < 1000; k++) {
    const before = g
    if (g.phase === 'choose') {
      const dice = cpuChoose(g, g.dealer, level, rng)
      for (const d of dice) picks[DICE[d].name] = (picks[DICE[d].name] ?? 0) + 1
      g = chooseDice(g, dice)
    }
    else if (g.phase === 'roll') g = roll(g, rng)
    else if (g.phase === 'up') g = rollUp(g, rng)
    else if (g.phase === 'extra') g = rollExtra(g, cpuChooseExtra(g, g.dealer, level, rng), rng)
    else if (g.phase === 'decide') {
      const d = Object.fromEntries(g.players.filter((p) => p.inRound).map((p) => [p.id, cpuDecision(g, p.id, level, rng)]))
      g = declare(g, d)
      const leavers = g.players.filter((p) => d[p.id] === 'leave')
      if (leavers.length) {
        const shares = leavers.reduce((t, p) => t + (p.share ?? 0), 0)
        const grp = (groups[leavers.length] ??= { times: 0, shares: 0 })
        grp.times++
        grp.shares += shares
        if (g.roundEnd === 'cleared') pot.vanished += before.pot - shares
      }
    }
    if (g.roundEnd === 'busted' && before.phase !== 'roundEnd') pot.busted += before.pot
    if (g.phase === 'roundEnd' || g.phase === 'gameover') {
      rounds++; rollsTotal += g.rolls; if (g.roundEnd === 'busted') busts++
      for (const p of g.players) {
        const got = p.banked ?? 0
        if (p.id === g.dealer) { gain.dealer += got; gain.dealerN++ } else { gain.child += got; gain.childN++ }
      }
      if (g.phase === 'roundEnd') g = nextRound(g)
    }
  }
  for (const w of g.winners) wins[w] = (wins[w] ?? 0) + 1 / g.winners.length
}
const leaves = Object.fromEntries(Object.entries(groups).map(([k, v]) => [`${k}人`, { 回数: v.times, 平均の取り分: Math.round(v.shares / v.times / Number(k)) }]))
console.log(JSON.stringify({ players: cpus + 1, level, target, games: n, roundsPerGame: +(rounds / n).toFixed(1), rollsPerRound: +(rollsTotal / rounds).toFixed(1),
  bustRate: +(busts / rounds).toFixed(2), dealerAvg: Math.round(gain.dealer / gain.dealerN), childAvg: Math.round(gain.child / gain.childN), wins,
  leaves, potBustedPerRound: Math.round(pot.busted / rounds), potVanishedPerRound: Math.round(pot.vanished / rounds),
  pickRate: Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, +(v / rounds).toFixed(2)])) }))

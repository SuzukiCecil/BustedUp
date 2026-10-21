/**
 * ダイスの強さの偏りを調べる。npx tsx scripts/diceBalance.ts [案の名前（scripts/diceVariants.ts）] [--detail]
 * 状況ごとに「上位5組」を出し、どのダイスもどこかの状況で選ぶ理由があるか（支配されていないか）を見る。
 * - 1人：最適に立ったときの価値（供託は独り占め、4手先まで読む）
 * - 1回・2回：1〜2回振ったら立つときの価値（実際の対局に近い短い勝負。4人卓の想定）
 * - 4人卓：他の3人も残っていて供託を持っていかれうる想定
 * - 逆転R：1ラウンドでR点（チップ＋供託）に届く確率（届くまで振り続ける。大差で負けている状況）
 */
import { DICE, DIE_IDS } from '../src/game/dice'
import { applyUpToPot, extraCount, needsUp, rollDice, rollMain, rollUpFace, withExtra } from '../src/game/engine'
import { bustChance, continueValue, extraOptions } from '../src/game/odds'
import type { DieId } from '../src/game/types'
import { applyVariant } from './diceVariants'

const name = process.argv[2] ?? 'current'
const detail = process.argv.includes('--detail')
const variant = applyVariant(name)

const combos: DieId[][] = []
for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let c = b + 1; c < 6; c++) combos.push([DIE_IDS[a], DIE_IDS[b], DIE_IDS[c]])
const label = (c: DieId[]) => c.map((d) => DICE[d].name).join('+')

function reach(chosen: DieId[], target: number, n: number): number {
  let hit = 0
  for (let i = 0; i < n; i++) {
    let pool = 0
    let pot = 0
    for (;;) {
      const rolled = rollMain(chosen, Math.random)
      let r = needsUp(rolled) ? { ...rolled, up: rollUpFace(Math.random) } : rolled
      const k = extraCount(r)
      if (k) {
        const opts = extraOptions(chosen, k, r.sirens)
        const pick = opts.reduce((x, y) => (y.pBust < x.pBust || (y.pBust === x.pBust && y.eChips + y.ePot > x.eChips + x.ePot) ? y : x))
        r = withExtra(r, rollDice(pick.dice, Math.random))
      }
      if (r.outcome === 'busted') break
      pool += r.chips
      pot = applyUpToPot(pot + r.pot, r.up)
      if (pool + pot >= target) {
        hit++
        break
      }
    }
  }
  return hit / n
}

const scenarios: { name: string; value: (c: DieId[]) => number; fmt: (v: number) => string }[] = [
  { name: '1人', value: (c) => continueValue({ chosen: c, hostile: false, snatch: 0, share: 1, risk: 1 }, 0, 0, 4), fmt: (v) => v.toFixed(0) },
  { name: '4人卓', value: (c) => continueValue({ chosen: c, hostile: false, snatch: 1 - 0.75 ** 3, share: 0.6, risk: 1 }, 0, 0, 4), fmt: (v) => v.toFixed(0) },
  { name: '1回(4人)', value: (c) => continueValue({ chosen: c, hostile: false, snatch: 1 - 0.75 ** 3, share: 0.6, risk: 1 }, 0, 0, 1), fmt: (v) => v.toFixed(0) },
  { name: '2回(4人)', value: (c) => continueValue({ chosen: c, hostile: false, snatch: 1 - 0.75 ** 3, share: 0.6, risk: 1 }, 0, 0, 2), fmt: (v) => v.toFixed(0) },
  { name: '逆転400', value: (c) => reach(c, 400, 6000), fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { name: '逆転800', value: (c) => reach(c, 800, 6000), fmt: (v) => `${(v * 100).toFixed(1)}%` },
]

console.log(`# 案 ${name}：${variant.note}`)
console.log('ダイス\tサイレン\tチップ\t供託\t計\t◎')
for (const d of DIE_IDS) {
  const fs = DICE[d].faces
  const ev = (k: 'chip' | 'pot') => fs.reduce((t, f) => t + (f.kind === k ? f.value : 0), 0) / 6
  console.log(`${DICE[d].name}\t${fs.filter((f) => f.kind === 'siren').length}\t${ev('chip').toFixed(1)}\t${ev('pot').toFixed(1)}\t${(ev('chip') + ev('pot')).toFixed(1)}\t${fs.filter((f) => f.kind !== 'siren' && f.star).length}`)
}

const top: Record<DieId, number[]> = Object.fromEntries(DIE_IDS.map((d) => [d, []])) as unknown as Record<DieId, number[]>
const avg: Record<DieId, string[]> = Object.fromEntries(DIE_IDS.map((d) => [d, []])) as unknown as Record<DieId, string[]>
console.log('\n状況\t最良\t最悪\t比\t最良の組')
for (const sc of scenarios) {
  const rows = combos.map((c) => ({ c, v: sc.value(c), bust: bustChance(c) })).sort((a, b) => b.v - a.v)
  const best = rows[0]
  const worst = rows.at(-1)!
  console.log(`${sc.name}\t${sc.fmt(best.v)}\t${sc.fmt(worst.v)}\t${(best.v / Math.max(worst.v, 1e-9)).toFixed(2)}\t${label(best.c)}`)
  for (const d of DIE_IDS) {
    top[d].push(rows.slice(0, 5).filter((r) => r.c.includes(d)).length)
    const inc = rows.filter((r) => r.c.includes(d))
    avg[d].push(sc.fmt(inc.reduce((t, r) => t + r.v, 0) / inc.length))
  }
  if (detail) for (const r of rows) console.log(`  ${sc.fmt(r.v)}\t摘発${(r.bust * 100).toFixed(0)}%\t${label(r.c)}`)
}
console.log(`\nダイス\t上位5組への登場（${scenarios.map((s) => s.name).join(' / ')}）\t含む組の平均`)
for (const d of DIE_IDS) console.log(`${DICE[d].name}\t${top[d].join(' / ')}\t${avg[d].join(' / ')}`)

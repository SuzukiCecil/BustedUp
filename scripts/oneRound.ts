/**
 * 1ラウンドで目標点に届く確率（降りずに振り続け、届いた時点で立つとした場合）。
 * npx tsx scripts/oneRound.ts [試行数]
 * - 供託込み：供託を1人で受け取れる（他の人は先に立っていない）とした最良の場合
 * - チップのみ：供託は他の人に持っていかれるとした場合
 * 追加ダイスは胴元が摘発されにくいものを選ぶ（味方）とする。
 */
import { DIE_IDS } from '../src/game/dice'
import { applyUpToPot, extraCount, needsUp, rollDice, rollMain, rollUpFace, shareOf, withExtra } from '../src/game/engine'
import { extraOptions } from '../src/game/odds'
import type { DieId } from '../src/game/types'

const N = Number(process.argv[2] ?? 100000)
const TARGETS = [1000, 1500, 2000]
const combos: DieId[][] = []
for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let c = b + 1; c < 6; c++) combos.push([DIE_IDS[a], DIE_IDS[b], DIE_IDS[c]])

function trial(chosen: DieId[], target: number, withPot: boolean): { hit: boolean; rolls: number } {
  let pool = 0
  let pot = 0
  for (let rolls = 1; rolls < 500; rolls++) {
    const rolled = rollMain(chosen, Math.random)
    let r = needsUp(rolled) ? { ...rolled, up: rollUpFace(Math.random) } : rolled
    const n = extraCount(r)
    if (n) {
      // 胴元は摘発されにくい（同じなら期待値の高い）追加ダイスを選ぶ
      const opts = extraOptions(chosen, n, r.sirens)
      const pick = opts.reduce((x, y) => (y.pBust < x.pBust || (y.pBust === x.pBust && y.eChips + y.ePot > x.eChips + x.ePot) ? y : x))
      r = withExtra(r, rollDice(pick.dice, Math.random))
    }
    if (r.outcome === 'busted') return { hit: false, rolls }
    pool += r.chips
    pot = applyUpToPot(pot + r.pot, r.up)
    if (pool + (withPot ? shareOf(pot, 1) : 0) >= target) return { hit: true, rolls }
  }
  return { hit: false, rolls: 500 }
}

for (const withPot of [true, false]) {
  console.log(withPot ? '\n## 供託込み（1人で受け取る）' : '\n## チップのみ')
  for (const t of TARGETS) {
    const rows = combos.map((c) => {
      let hit = 0
      let rollsHit = 0
      for (let i = 0; i < N; i++) {
        const r = trial(c, t, withPot)
        if (r.hit) {
          hit++
          rollsHit += r.rolls
        }
      }
      return { c: c.join('+'), p: hit / N, rolls: hit ? rollsHit / hit : 0 }
    })
    rows.sort((a, b) => b.p - a.p)
    const avg = rows.reduce((s, r) => s + r.p, 0) / rows.length
    console.log(`目標${t}: 平均 ${(avg * 100).toFixed(2)}% / 最良 ${rows[0].c} ${(rows[0].p * 100).toFixed(2)}%（届くまで${rows[0].rolls.toFixed(1)}回） / 最悪 ${rows.at(-1)!.c} ${(rows.at(-1)!.p * 100).toFixed(3)}%`)
  }
}

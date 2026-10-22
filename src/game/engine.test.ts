import { describe, expect, it } from 'vitest'
import { chooseDice, createGame, declare, nextRound, roll, rollExtra, rollResult, rollUp, shareOf } from './engine'
import { bustChance, outcomes } from './odds'
import { cpuChoose, cpuChooseExtra, cpuDecision, leaveWins } from './cpu'
import type { GameState, RollResult } from './types'

const ok = (chips: number, pot = 0, up: RollResult['up'] = null): RollResult => ({ dice: [], up, extra: [], sirens: 0, chips, pot, outcome: 'ok' })
const bust: RollResult = { dice: [], up: null, extra: [], sirens: 2, chips: 0, pot: 0, outcome: 'busted' }
const rng = () => 0.5

function started(cpuCount = 2, firstDealer: GameState['dealer'] = 'p1', chips = 130, pot = 0) {
  const g = chooseDice(createGame({ cpuCount, firstDealer }), ['chohan', 'roulette', 'blackjack'])
  return roll(g, rng, ok(chips, pot))
}
const pool = (g: GameState, id: string) => g.players.find((p) => p.id === id)!.pool
const bank = (g: GameState, id: string) => g.players.find((p) => p.id === id)!.bank

describe('ラウンドの進行', () => {
  it('賭場は3個ちょうど選ぶ', () => {
    const g = createGame()
    expect(chooseDice(g, ['chohan', 'chohan', 'poker'])).toBe(g)
    expect(chooseDice(g, ['chohan', 'slot', 'poker']).phase).toBe('roll')
  })

  it('チップの目は席に残っている全員のチップに、供託の目は供託に入る', () => {
    const g = started(2, 'p1', 130, 80)
    expect(g.players.map((p) => p.pool)).toEqual([130, 130, 130])
    expect(g.pot).toBe(80)
    expect(g.phase).toBe('decide')
  })

  it('胴元ダイスの効果は供託にかかる：ご祝儀・ショバ代・ハイローラー', () => {
    const g = chooseDice(createGame(), ['chohan', 'roulette', 'blackjack'])
    expect(roll(g, rng, ok(50, 60, 'tip')).pot).toBe(160)
    expect(roll(g, rng, ok(50, 60, 'fee')).pot).toBe(0)
    expect(roll(g, rng, ok(50, 60, 'double')).pot).toBe(120)
    expect(pool(roll(g, rng, ok(50, 60, 'double')), 'p1')).toBe(50)
  })

  it('摘発：残っていた人のチップと供託は没収、立った人は金庫に残る', () => {
    let g = started(2, 'p1', 130, 100)
    g = declare(g, { cpu1: 'leave' })
    expect(bank(g, 'cpu1')).toBe(230)
    g = roll(g, rng, { ...ok(0, 40) })
    expect(g.pot).toBe(40)
    g = declare(g, {})
    g = roll(g, rng, bust)
    expect(g.phase).toBe('roundEnd')
    expect(g.roundEnd).toBe('busted')
    expect(g.pot).toBe(0)
    expect(bank(g, 'cpu1')).toBe(230)
    expect(bank(g, 'p1')).toBe(0)
    expect(pool(g, 'p1')).toBe(0)
  })

  it('サイレンが2つ以上なら摘発（3つでも摘発）', () => {
    let seed = 7
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 300; i++) {
      const res = rollResult(['slot', 'poker', 'dogfight'], r)
      expect(res.outcome === 'busted').toBe(res.sirens >= 2)
    }
  })

  it('全員が立つとラウンド終了、供託の端数は消え、胴元は時計回りに交代', () => {
    let g = started(2, 'p1', 130, 50)
    g = declare(g, { p1: 'leave', cpu1: 'leave', cpu2: 'leave' })
    expect(g.roundEnd).toBe('cleared')
    expect(g.pot).toBe(0)
    g = nextRound(g)
    expect(g.dealer).toBe('cpu1')
    expect(g.round).toBe(2)
    expect(g.pot).toBe(0)
    expect(g.players.every((p) => p.inRound && p.pool === 0 && p.share === null)).toBe(true)
  })

  it('目標点に届いたらラウンド終了時にゲーム終了', () => {
    let g = { ...started(), target: 100 }
    g = declare(g, { p1: 'leave', cpu1: 'leave', cpu2: 'leave' })
    expect(g.phase).toBe('gameover')
    expect(g.winners).toEqual(['p1', 'cpu1', 'cpu2'])
  })
})

describe('供託の山分け', () => {
  it('10点単位で切り捨て', () => {
    expect(shareOf(50, 1)).toBe(50)
    expect(shareOf(50, 2)).toBe(20)
    expect(shareOf(50, 3)).toBe(10)
    expect(shareOf(0, 2)).toBe(0)
  })

  it('1人で立てば独り占め', () => {
    const g = declare(started(2, 'p1', 30, 50), { cpu1: 'leave' })
    expect(bank(g, 'cpu1')).toBe(80)
    expect(g.players.find((p) => p.id === 'cpu1')!.share).toBe(50)
    expect(g.pot).toBe(0)
  })

  it('2人同時なら20ずつ、端数10は供託に残り、あとで立った人が受け取る', () => {
    let g = declare(started(3, 'p1', 30, 50), { cpu1: 'leave', cpu2: 'leave' })
    expect(bank(g, 'cpu1')).toBe(50)
    expect(bank(g, 'cpu2')).toBe(50)
    expect(g.pot).toBe(10)
    g = declare(roll(g, rng, ok(0)), { cpu3: 'leave' })
    expect(bank(g, 'cpu3')).toBe(40)
    expect(g.pot).toBe(0)
  })

  it('3人同時なら10ずつ、端数20は供託に残る', () => {
    const g = declare(started(3, 'p1', 30, 50), { cpu1: 'leave', cpu2: 'leave', cpu3: 'leave' })
    expect([bank(g, 'cpu1'), bank(g, 'cpu2'), bank(g, 'cpu3')]).toEqual([40, 40, 40])
    expect(g.pot).toBe(20)
    expect(g.phase).toBe('roll')
  })
})

describe('確率とCPU', () => {
  it('結果の確率の合計は1', () => {
    for (const set of [['chohan', 'roulette', 'blackjack'], ['poker', 'slot', 'dogfight']] as const) {
      for (const hostile of [false, true]) {
        const total = outcomes([...set], hostile).reduce((t, o) => t + o.p, 0)
        expect(total).toBeCloseTo(1, 10)
      }
    }
  })

  it('危険な賭場ほど摘発されやすい', () => {
    expect(bustChance(['poker', 'slot', 'dogfight'])).toBeGreaterThan(bustChance(['chohan', 'roulette', 'blackjack']))
  })

  it('CPUはチップも供託も0なら残り、大量のチップを危険な賭場で抱えたら立つ', () => {
    let g = chooseDice(createGame({ cpuCount: 2 }), ['poker', 'slot', 'dogfight'])
    g = roll(g, rng, ok(0))
    expect(cpuDecision(g, 'cpu1', 'hard')).toBe('stay')
    g = { ...g, players: g.players.map((p) => (p.id === 'cpu1' ? { ...p, pool: 2000 } : p)) }
    expect(cpuDecision(g, 'cpu1', 'hard')).toBe('leave')
  })

  it('CPUは大きな供託を独り占めできそうなら立つ', () => {
    let g = chooseDice(createGame({ cpuCount: 2 }), ['poker', 'slot', 'dogfight'])
    g = roll(g, rng, ok(0, 1500))
    expect(cpuDecision(g, 'cpu1', 'hard')).toBe('leave')
  })

  it('CPUの判断は、その席自身のチップで決まる（シミュレーションで「あなた」の席を打たせる場合も）', () => {
    let g = chooseDice(createGame({ cpuCount: 2 }), ['poker', 'slot', 'dogfight'])
    g = roll(g, rng, ok(0))
    // あなた：チップ2000を抱えて残っている。CPUは全員席を立った
    g = { ...g, players: g.players.map((p) => (p.id === 'p1' ? { ...p, pool: 2000 } : { ...p, pool: 0, inRound: false })) }
    expect(cpuDecision(g, 'p1', 'hard')).toBe('leave')
  })

  it('どの強さでも、席を立てば確実に勝てるなら立つ（残っているのが自分だけで、立てば目標点に届き首位）', () => {
    let g = chooseDice(createGame({ cpuCount: 2 }), ['chohan', 'roulette', 'blackjack'])
    g = roll(g, rng, ok(0))
    // cpu1 だけが残っていて、金庫1400＋チップ60＋供託60で目標点1500に届く
    const setup = (others: number) => ({
      ...g,
      players: g.players.map((p) => (p.id === 'cpu1' ? { ...p, bank: 1400, pool: 60 } : { ...p, bank: others, pool: 0, inRound: false })),
      pot: 60,
    })
    for (const lv of ['easy', 'normal', 'hard'] as const) {
      for (let i = 0; i < 20; i++) expect(cpuDecision(setup(1000), 'cpu1', lv, Math.random)).toBe('leave')
    }
    expect(leaveWins(setup(1000), 'cpu1')).toBe(true)
    // ほかの人の金庫を上回れない・目標点に届かない・ほかにも残っている人がいる、なら確実ではない
    expect(leaveWins(setup(1520), 'cpu1')).toBe(false)
    expect(leaveWins({ ...setup(1000), pot: 0 }, 'cpu1')).toBe(false)
    const crowded = setup(1000)
    expect(leaveWins({ ...crowded, players: crowded.players.map((p) => (p.id === 'p1' ? { ...p, inRound: true } : p)) }, 'cpu1')).toBe(false)
  })

  it('CPUの人数は2〜3人（範囲外は寄せる）', () => {
    expect(createGame({ cpuCount: 1 }).players).toHaveLength(3)
    expect(createGame({ cpuCount: 5 }).players).toHaveLength(4)
  })

  it('CPUの賭場選びは3個の重複なし', () => {
    const g = createGame({ cpuCount: 3, firstDealer: 'cpu2' })
    for (const lv of ['easy', 'normal', 'hard'] as const) {
      expect(new Set(cpuChoose(g, 'cpu2', lv)).size).toBe(3)
    }
  })
})

describe('追加ダイス（胴元が選ぶ）', () => {
  const main = (sirens: number, up: RollResult['up']): RollResult => ({ dice: [], up, extra: [], sirens, chips: 50, pot: 0, outcome: 'ok' })
  const siren = { kind: 'siren' } as const
  const chip = (value: number) => ({ kind: 'chip', value }) as const
  const potFace = (value: number) => ({ kind: 'pot', value }) as const
  const begin = () => chooseDice(createGame({ cpuCount: 2, firstDealer: 'p1' }), ['chohan', 'roulette', 'blackjack'])

  it('「追加」が出たら胴元が選ぶまで追加分は確定しない', () => {
    const g = roll(begin(), rng, main(0, 'extra2'))
    expect(g.phase).toBe('extra')
    expect(pool(g, 'p1')).toBe(50)
  })

  it('選ぶ数は胴元ダイスの目と同じ。選ばれた賭場以外からだけ選べる', () => {
    const g = roll(begin(), rng, main(0, 'extra2'))
    expect(rollExtra(g, ['poker'], rng)).toBe(g)
    expect(rollExtra(g, ['poker', 'chohan'], rng)).toBe(g)
    expect(rollExtra(roll(begin(), rng, main(0, 'extra3')), ['poker', 'slot'], rng).phase).toBe('extra')
    const done = rollExtra(g, ['poker', 'slot'], rng, [
      { die: 'poker', face: chip(40) },
      { die: 'slot', face: potFace(140) },
    ])
    expect(done.phase).toBe('decide')
    expect(done.last?.extra.map((e) => e.die)).toEqual(['poker', 'slot'])
    expect(pool(done, 'p1')).toBe(90)
    expect(done.pot).toBe(140)
  })

  it('賭場ダイスのサイレン1つ＋追加ダイスのサイレン1つで摘発', () => {
    const g = roll(begin(), rng, main(1, 'extra1'))
    const done = rollExtra(g, ['dogfight'], rng, [{ die: 'dogfight', face: siren }])
    expect(done.roundEnd).toBe('busted')
    expect(done.last?.sirens).toBe(2)
  })

  it('CPUの胴元：残っていれば摘発されにくい追加ダイス、立っていれば摘発されやすい追加ダイスを選ぶ', () => {
    // 候補：ブラックジャック（サイレン2面）、スロット・闘犬（サイレン3面）
    let g = chooseDice(createGame({ cpuCount: 2, firstDealer: 'cpu1' }), ['chohan', 'roulette', 'poker'])
    g = roll(g, rng, ok(1000))
    g = roll(declare(g, {}), rng, main(1, 'extra1'))
    // チップを多く抱えているので安全なダイスを選ぶ
    expect(cpuChooseExtra(g, 'cpu1', 'hard')).toEqual(['blackjack'])
    g = { ...g, players: g.players.map((p) => (p.id === 'cpu1' ? { ...p, inRound: false } : p)) }
    expect(['slot', 'dogfight']).toContain(cpuChooseExtra(g, 'cpu1', 'hard')[0])
  })
})

describe('胴元ダイス（去就の宣言のあとに胴元が振る）', () => {
  const starred: RollResult = {
    dice: [{ die: 'chohan', face: { kind: 'chip', value: 30, star: true } }],
    up: null,
    extra: [],
    sirens: 0,
    chips: 30,
    pot: 40,
    outcome: 'ok',
  }
  const begin = () => chooseDice(createGame({ cpuCount: 2, firstDealer: 'p1' }), ['chohan', 'roulette', 'blackjack'])

  it('◎が出たら出目を入れて、胴元ダイスの前に去就を宣言する', () => {
    const g = roll(begin(), rng, starred)
    expect(g.phase).toBe('decide')
    expect(g.upPending).toBe(true)
    expect(pool(g, 'p1')).toBe(30)
    expect(g.pot).toBe(40)
    const up = declare(g, {})
    expect(up.phase).toBe('up')
    const done = rollUp(up, rng, 'double')
    expect(done.phase).toBe('decide')
    expect(done.upPending).toBe(false)
    expect(done.pot).toBe(80)
  })

  it('胴元ダイスの前に立った人は、それまでの供託を受け取る', () => {
    let g = roll(begin(), rng, starred)
    g = declare(g, { p1: 'leave' })
    expect(bank(g, 'p1')).toBe(70)
    expect(g.pot).toBe(0)
    expect(g.phase).toBe('up')
    g = rollUp(g, rng, 'tip')
    expect(g.pot).toBe(100)
  })

  it('胴元ダイスの前に全員が立てば胴元ダイスは振らずにラウンド終了', () => {
    const g = declare(roll(begin(), rng, starred), { p1: 'leave', cpu1: 'leave', cpu2: 'leave' })
    expect(g.phase).toBe('roundEnd')
    expect(g.upPending).toBe(false)
  })

  it('胴元ダイスが「追加」なら追加ダイスを選ぶ段階へ進む', () => {
    expect(rollUp(declare(roll(begin(), rng, starred), {}), rng, 'extra2').phase).toBe('extra')
  })
})

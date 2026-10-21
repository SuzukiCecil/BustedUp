import type { DieDef, DieId, Face, UpFace } from './types'

const S: Face = { kind: 'siren' }
const c = (value: number, star = false): Face => ({ kind: 'chip', value, star })
const p = (value: number, star = false): Face => ({ kind: 'pot', value, star })

/**
 * 賭場ダイス（c＝チップの目、p＝供託の目）。
 * 原作「Tally Up」の6色のダイス（サイレンの数）を土台に、CPU同士の対局でどのダイスもどこかの状況で選ばれるよう値を調整した（案F、docs/balance.md）。
 * チップ型（スロット）は供託を持っていかれる心配がない大人数の卓で、供託型（闘犬）は少人数の卓で強い。
 */
export const DICE: Record<DieId, DieDef> = {
  chohan: { id: 'chohan', name: '丁半', trait: '安定', faces: [S, c(40, true), p(60, true), c(40), c(30), p(60)] },
  roulette: { id: 'roulette', name: 'ルーレット', trait: '安定', faces: [S, c(30, true), p(40, true), c(30), p(60), p(90)] },
  blackjack: { id: 'blackjack', name: 'ブラックジャック', trait: '標準', faces: [S, S, c(60), p(140, true), c(70), p(140)] },
  poker: { id: 'poker', name: 'ポーカー', trait: '標準', faces: [S, S, c(60), p(100, true), p(130), c(110)] },
  slot: { id: 'slot', name: 'スロット', trait: '危険', faces: [S, S, S, c(130), p(240, true), c(150)] },
  dogfight: { id: 'dogfight', name: '闘犬', trait: '危険', faces: [S, S, S, c(100), p(200, true), p(280)] },
}
export const DIE_IDS = Object.keys(DICE) as DieId[]

export const UP_FACES: UpFace[] = ['extra1', 'extra2', 'extra3', 'tip', 'fee', 'double']
export const UP_LABEL: Record<UpFace, { name: string; text: string }> = {
  extra1: { name: '追加1', text: '選ばれなかった賭場ダイスから胴元が1個選んで追加で振る' },
  extra2: { name: '追加2', text: '選ばれなかった賭場ダイスから胴元が2個選んで追加で振る' },
  extra3: { name: '追加3', text: '選ばれなかった賭場ダイスから胴元が3個選んで追加で振る' },
  tip: { name: 'ご祝儀', text: '供託 +100' },
  fee: { name: 'ショバ代', text: '供託 −100（0未満にはならない）' },
  double: { name: 'ハイローラー', text: '供託が2倍' },
}

export const sirenCount = (die: DieId) => DICE[die].faces.filter((f) => f.kind === 'siren').length

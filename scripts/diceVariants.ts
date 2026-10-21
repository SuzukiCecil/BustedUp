/**
 * ダイスの出目の調整案（scripts/diceBalance.ts で比べる）。
 * 表記：S＝サイレン、c＝チップの目、p＝供託の目、*＝◎
 */
import { DICE, DIE_IDS } from '../src/game/dice'
import type { DieId, Face } from '../src/game/types'

export const VARIANTS: Record<string, { note: string; faces: Record<DieId, string> }> = {
  current: {
    note: '現行',
    faces: {
      chohan: 'S c20* p40* c20 c20 p40',
      roulette: 'S c10* p20* c10 p40 p100',
      blackjack: 'S S c30 p80* c40 p80',
      poker: 'S S c20 p40 p80* c70',
      slot: 'S S S c60 p140* c70',
      dogfight: 'S S S c50 p100* p200',
    },
  },
  A: {
    note: 'ルーレットを丁半並みに、標準・危険の値を上げる',
    faces: {
      chohan: 'S c20* p40* c20 c20 p40',
      roulette: 'S c10* p20* c10 p40 p60',
      blackjack: 'S S c40 p100* c50 p100',
      poker: 'S S c40 p60 p100* c90',
      slot: 'S S S c120 p200* c140',
      dogfight: 'S S S c80 p160* p220',
    },
  },
  A2: {
    note: 'Aより危険をさらに上げる',
    faces: {
      chohan: 'S c20* p40* c20 c20 p40',
      roulette: 'S c10* p20* c10 p40 p60',
      blackjack: 'S S c50 p120* c60 p120',
      poker: 'S S c50 p80* p120 c100',
      slot: 'S S S c180 p300* c200',
      dogfight: 'S S S c120 p240* p340',
    },
  },
  B: {
    note: 'A2の標準を上げる',
    faces: {
      chohan: 'S c20* p40* c20 c20 p40',
      roulette: 'S c10* p20* c10 p40 p60',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p140 c120',
      slot: 'S S S c180 p300* c200',
      dogfight: 'S S S c120 p240* p340',
    },
  },
  B2: {
    note: 'Bの安定を下げる',
    faces: {
      chohan: 'S c20* p30* c20 c10 p30',
      roulette: 'S c10* p20* c10 p30 p50',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p140 c120',
      slot: 'S S S c180 p300* c200',
      dogfight: 'S S S c120 p240* p340',
    },
  },
  C: {
    note: 'B2のスロットのチップを下げる（180/200→130/150）',
    faces: {
      chohan: 'S c20* p30* c20 c10 p30',
      roulette: 'S c10* p20* c10 p30 p50',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p140 c120',
      slot: 'S S S c130 p300* c150',
      dogfight: 'S S S c120 p240* p340',
    },
  },
  C2: {
    note: 'B2のスロットのチップをさらに下げる（180/200→100/120）',
    faces: {
      chohan: 'S c20* p30* c20 c10 p30',
      roulette: 'S c10* p20* c10 p30 p50',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p140 c120',
      slot: 'S S S c100 p300* c120',
      dogfight: 'S S S c120 p240* p340',
    },
  },
  D: {
    note: 'Cから危険の2個をどちらも下げる',
    faces: {
      chohan: 'S c20* p30* c20 c10 p30',
      roulette: 'S c10* p20* c10 p30 p50',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p140 c120',
      slot: 'S S S c130 p240* c150',
      dogfight: 'S S S c100 p200* p280',
    },
  },
  D2: {
    note: 'Dより危険をさらに下げる',
    faces: {
      chohan: 'S c20* p30* c20 c10 p30',
      roulette: 'S c10* p20* c10 p30 p50',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p140 c120',
      slot: 'S S S c110 p220* c130',
      dogfight: 'S S S c90 p180* p240',
    },
  },
  E: {
    note: 'Dから安定を上げ、ポーカーを少し下げる',
    faces: {
      chohan: 'S c40* p60* c40 c30 p60',
      roulette: 'S c30* p40* c30 p60 p90',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p120 c100',
      slot: 'S S S c130 p240* c150',
      dogfight: 'S S S c100 p200* p280',
    },
  },
  E2: {
    note: 'Eより安定をさらに上げる',
    faces: {
      chohan: 'S c50* p80* c50 c40 p80',
      roulette: 'S c40* p50* c40 p80 p120',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p120 c100',
      slot: 'S S S c130 p240* c150',
      dogfight: 'S S S c100 p200* p280',
    },
  },
  F: {
    note: 'Eのポーカーを少し上げる（計63→67）',
    faces: {
      chohan: 'S c40* p60* c40 c30 p60',
      roulette: 'S c30* p40* c30 p60 p90',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p130 c110',
      slot: 'S S S c130 p240* c150',
      dogfight: 'S S S c100 p200* p280',
    },
  },
  F2: {
    note: 'Eのポーカーを上げる（計63→70）',
    faces: {
      chohan: 'S c40* p60* c40 c30 p60',
      roulette: 'S c30* p40* c30 p60 p90',
      blackjack: 'S S c60 p140* c70 p140',
      poker: 'S S c60 p100* p140 c120',
      slot: 'S S S c130 p240* c150',
      dogfight: 'S S S c100 p200* p280',
    },
  },
}

const parse = (s: string): Face[] =>
  s.split(' ').map((t) => (t === 'S' ? { kind: 'siren' } : { kind: t[0] === 'c' ? 'chip' : 'pot', value: Number(t.slice(1).replace('*', '')), star: t.endsWith('*') }))

/** 案の出目に差し替える（確率計算のキャッシュが空のうち＝計算を始める前に呼ぶ） */
export function applyVariant(name: string) {
  const v = VARIANTS[name]
  if (!v) throw new Error(`案がありません：${name}`)
  for (const d of DIE_IDS) DICE[d].faces = parse(v.faces[d])
  return v
}

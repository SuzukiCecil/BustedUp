/**
 * 賭場ダイスの面。
 * chip＝席に残っている全員のチップに入る、pot＝テーブル中央の供託に入る、siren＝サイレン。
 * star＝◎付き（出ると胴元ダイスを振る）
 */
export type Face = { kind: 'chip'; value: number; star?: boolean } | { kind: 'pot'; value: number; star?: boolean } | { kind: 'siren' }

export type DieId = 'chohan' | 'roulette' | 'blackjack' | 'poker' | 'slot' | 'dogfight'

export interface DieDef {
  id: DieId
  name: string
  /** 性格（危険度の説明） */
  trait: string
  faces: Face[]
}

/** 胴元ダイスの面 */
export type UpFace = 'extra1' | 'extra2' | 'extra3' | 'tip' | 'fee' | 'double'

export type PlayerId = 'p1' | 'cpu1' | 'cpu2' | 'cpu3'

export interface Player {
  id: PlayerId
  name: string
  /** 確定した得点（金庫） */
  bank: number
  /** ラウンド中の未確定のチップ（プール） */
  pool: number
  /** このラウンドで席に残っているか */
  inRound: boolean
  /** このラウンドで席を立ったときに金庫へ移した額（チップ＋供託の取り分。表示用） */
  banked: number | null
  /** 席を立ったときの供託の取り分（表示用） */
  share: number | null
}

export type Decision = 'stay' | 'leave'

/** 1回の振りの結果 */
export interface RollResult {
  dice: { die: DieId; face: Face }[]
  /** 胴元ダイスの出目（◎が出たときだけ） */
  up: UpFace | null
  /** 胴元ダイスの追加分で振ったダイス（胴元が選ぶ） */
  extra: { die: DieId; face: Face }[]
  sirens: number
  /** チップの目の合計（追加分を含む） */
  chips: number
  /** 供託の目の合計（追加分を含む） */
  pot: number
  outcome: 'ok' | 'busted'
}

export type Phase =
  /** 胴元が賭場ダイスを選ぶ */
  | 'choose'
  /** 振る直前（席に残っている人がいる） */
  | 'roll'
  /** ◎が出て去就を宣言したあと。胴元が胴元ダイスを振る */
  | 'up'
  /** 胴元ダイスが「追加」。胴元が追加で振る賭場ダイスを選ぶ */
  | 'extra'
  /** 振った直後。席に残っている人が去就を決める */
  | 'decide'
  /** ラウンドが終わった（摘発 or 全員が席を立った） */
  | 'roundEnd'
  | 'gameover'

export interface LogEntry {
  round: number
  text: string
  tone?: 'bust' | 'pot' | 'leave' | 'info'
}

export interface GameState {
  players: Player[]
  dealer: PlayerId
  round: number
  phase: Phase
  /** このラウンドの賭場ダイス */
  chosen: DieId[]
  /** テーブル中央の供託。席を立った人で山分けする */
  pot: number
  /** 直近の振り（ラウンド開始時は null） */
  last: RollResult | null
  /** このラウンドで振った回数 */
  rolls: number
  /** 直近の去就の宣言（公開表示用） */
  decisions: Partial<Record<PlayerId, Decision>>
  /** ◎が出て、去就の宣言のあとに胴元ダイスを振る */
  upPending: boolean
  roundEnd: 'busted' | 'cleared' | null
  target: number
  winners: PlayerId[]
  log: LogEntry[]
}

export type Rng = () => number

/** 胴元ダイスの「ご祝儀」「ショバ代」で供託が増減する額 */
export const TIP = 100
export const FEE = 100
/** 供託の山分けの単位（端数は供託に残る） */
export const SHARE_UNIT = 10
export const TARGET_OPTIONS = [1000, 1500, 2000] as const
export const DEFAULT_TARGET = 1500

/** 開発時、または URL に ?debug を付けたときだけデバッグ機能（一手戻る）を出す */
export const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug')

export const Tags: { [k in Name]: Tag } = {
  succeedNow: 0,
  succeed: 1,
  fold: 2,
  failure: 3,
  async: 4,
  flatMap: 5,
  fork: 6,
  setInterruptStatus: 7
}

export const TagName: { [t in Tag]: Name } = {
  0: 'succeedNow',
  1: 'succeed',
  2: 'fold',
  3: 'failure',
  4: 'async',
  5: 'flatMap',
  6: 'fork',
  7: 'setInterruptStatus'
}

export type Name =
  | 'succeedNow'
  | 'succeed'
  | 'fold'
  | 'failure'
  | 'async'
  | 'flatMap'
  | 'fork'
  | 'setInterruptStatus'

export type Tag = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

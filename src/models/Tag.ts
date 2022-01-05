export const Tags: { [k in name]: Tag } = {
  succeedNow: 0,
  succeed: 1,
  fold: 2,
  failure: 3,
  async: 4,
  flatMap: 5,
  fork: 6
}

export type name =
  | 'succeedNow'
  | 'succeed'
  | 'fold'
  | 'failure'
  | 'async'
  | 'flatMap'
  | 'fork'
export type Tag = 0 | 1 | 2 | 3 | 4 | 5 | 6

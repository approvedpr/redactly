export type Blackout = {
  id: string;
  /** 0-based page index in the source file */
  pageIndex: number;
  /** 0..1, left of box */
  x: number;
  /** 0..1, top of box (view coordinates) */
  y: number;
  /** 0..1 width of box */
  w: number;
  /** 0..1 height of box */
  h: number;
};

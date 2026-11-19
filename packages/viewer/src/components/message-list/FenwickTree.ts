/**
 * Binary Indexed Tree (Fenwick Tree) for variable-height virtualized lists.
 * Supports O(log N) prefix-sum offset lookups, O(log N) height updates, and O(log N)
 * binary lifting search over 50,000+ message rows without layout thrashing.
 */
export class FenwickTree {
  readonly #size: number;
  readonly #heights: Float64Array;
  readonly #tree: Float64Array;

  constructor(size: number, defaultHeight = 72) {
    this.#size = size;
    this.#heights = new Float64Array(size);
    this.#tree = new Float64Array(size + 1);

    if (size > 0) {
      this.#heights.fill(defaultHeight);
      for (let i = 1; i <= size; i++) {
        this.#tree[i] = defaultHeight;
      }
      // O(N) Fenwick construction
      for (let i = 1; i <= size; i++) {
        const parent = i + (i & -i);
        if (parent <= size) {
          this.#tree[parent] = (this.#tree[parent] ?? 0) + (this.#tree[i] ?? 0);
        }
      }
    }
  }

  get size(): number {
    return this.#size;
  }

  getHeight(index: number): number {
    return this.#heights[index] ?? 0;
  }

  update(index: number, newHeight: number): void {
    if (index < 0 || index >= this.#size) return;
    const prev = this.#heights[index] ?? 0;
    const delta = newHeight - prev;
    if (Math.abs(delta) < 0.01) return;

    this.#heights[index] = newHeight;
    let idx = index + 1;
    while (idx <= this.#size) {
      this.#tree[idx] = (this.#tree[idx] ?? 0) + delta;
      idx += idx & -idx;
    }
  }

  /** Total height of items `[0, count)`. */
  prefixSum(count: number): number {
    if (count <= 0) return 0;
    let idx = Math.min(count, this.#size);
    let sum = 0;
    while (idx > 0) {
      sum += this.#tree[idx] ?? 0;
      idx -= idx & -idx;
    }
    return sum;
  }

  totalHeight(): number {
    return this.prefixSum(this.#size);
  }

  /**
   * Binary lifting over the Fenwick tree in O(log N) to find the item index
   * covering `offset` pixels from the top.
   */
  findIndexByOffset(offset: number): number {
    if (this.#size === 0 || offset <= 0) return 0;

    let idx = 0;
    let accum = 0;
    let bit = 1;
    while (bit << 1 <= this.#size) {
      bit <<= 1;
    }

    while (bit > 0) {
      const next = idx + bit;
      if (next <= this.#size && accum + (this.#tree[next] ?? 0) <= offset) {
        idx = next;
        accum += this.#tree[next] ?? 0;
      }
      bit >>= 1;
    }

    return Math.min(idx, this.#size - 1);
  }
}

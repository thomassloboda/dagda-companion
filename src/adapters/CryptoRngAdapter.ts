import type { RngPort } from "../ports";

export class CryptoRngAdapter implements RngPort {
  rollD6(): number {
    const arr = new Uint8Array(1);
    crypto.getRandomValues(arr);
    return (arr[0] % 6) + 1;
  }

  roll2D6(): [number, number] {
    return [this.rollD6(), this.rollD6()];
  }

  rollNd6(n: number): number[] {
    return Array.from({ length: n }, () => this.rollD6());
  }
}

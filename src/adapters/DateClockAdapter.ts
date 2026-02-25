import type { ClockPort } from "../ports";

export class DateClockAdapter implements ClockPort {
  now(): string {
    return new Date().toISOString();
  }
}

import { Telemetry } from "../interfaces/telemetry";

export class NoOpTelemetry implements Telemetry {
  recordDuration(operation: string, duration: number): void {
    // No-op
  }

  recordError(operation: string, error: Error): void {
    // No-op
  }

  recordHit(operation: string): void {
    // No-op
  }

  recordMiss(operation: string): void {
    // No-op
  }
} 
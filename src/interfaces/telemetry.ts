export interface Telemetry {
  recordDuration(operation: string, duration: number): void;
  recordError(operation: string, error: Error): void;
  recordHit(operation: string): void;
  recordMiss(operation: string): void;
}

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type ListingId = Brand<string, "ListingId">;
export type JobId = Brand<string, "JobId">;
export type CorrelationId = Brand<string, "CorrelationId">;

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

type AssertEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : never;

export type AssertContract<TSchema, TContract> =
  AssertEqual<TSchema, TContract> extends true ? TSchema : never;

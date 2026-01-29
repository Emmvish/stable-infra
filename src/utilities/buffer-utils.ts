import type { BufferLike, StableBufferInstance } from '../types/index.js';

export const isStableBuffer = (value: unknown): value is StableBufferInstance => {
  return (
    !!value &&
    typeof (value as StableBufferInstance).run === 'function' &&
    typeof (value as StableBufferInstance).read === 'function'
  );
};

export const withBuffer = async <T>(
  buffer: BufferLike | undefined,
  fn: (state: Record<string, any>) => T | Promise<T>
): Promise<T> => {
  if (isStableBuffer(buffer)) {
    return buffer.run(fn);
  }

  const resolved = (buffer ?? {}) as Record<string, any>;
  return fn(resolved);
};

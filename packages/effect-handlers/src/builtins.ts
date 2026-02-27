// ============================================================================
// ISL Effect System - Built-in Effects
// @isl-lang/effect-handlers/builtins
// ============================================================================

import type { EffectSignature, EffectOperation, Handler, Fiber, ScheduleId } from './types';
import { perform } from './effect';
import { handler } from './handler';

// ============================================================================
// CONSOLE EFFECT
// ============================================================================

export interface ConsoleEffect extends EffectSignature<{
  print: EffectOperation<string, void>;
  readLine: EffectOperation<void, string>;
  error: EffectOperation<string, void>;
}> {
  name: 'Console';
}

export const Console: ConsoleEffect = {
  name: 'Console',
  operations: {
    print: { name: 'print', _input: '' as string, _output: undefined as void, resumable: true },
    readLine: { name: 'readLine', _input: undefined as void, _output: '' as string, resumable: true },
    error: { name: 'error', _input: '' as string, _output: undefined as void, resumable: true },
  },
};

export const print = (message: string) => perform(Console, 'print', message);
export const readLine = () => perform(Console, 'readLine');
export const consoleError = (message: string) => perform(Console, 'error', message);

export const consoleHandler = handler<ConsoleEffect, void>(
  Console,
  {
    print: (message, resume) => {
      console.log(message);
      return resume(undefined);
    },
    readLine: (_args, resume) => {
      // Simplified - real implementation would use readline
      return resume('');
    },
    error: (message, resume) => {
      console.error(message);
      return resume(undefined);
    },
  },
  () => undefined
);

// ============================================================================
// STATE EFFECT
// ============================================================================

export interface StateEffect<S> extends EffectSignature<{
  get: EffectOperation<void, S>;
  put: EffectOperation<S, void>;
  modify: EffectOperation<(s: S) => S, void>;
}> {
  name: 'State';
}

export function State<S>(): StateEffect<S> {
  return {
    name: 'State',
    operations: {
      get: { name: 'get', _input: undefined as void, _output: undefined as S, resumable: true },
      put: { name: 'put', _input: undefined as S, _output: undefined as void, resumable: true },
      modify: { name: 'modify', _input: undefined as (s: S) => S, _output: undefined as void, resumable: true },
    },
  };
}

export function get<S>(effect: StateEffect<S>) {
  return perform(effect, 'get');
}

export function put<S>(effect: StateEffect<S>, value: S) {
  return perform(effect, 'put', value);
}

export function modify<S>(effect: StateEffect<S>, f: (s: S) => S) {
  return perform(effect, 'modify', f);
}

export function stateHandler<S>(initialState: S): Handler<StateEffect<S>, [unknown, S]> {
  let state = initialState;
  
  return handler<StateEffect<S>, [unknown, S]>(
    State<S>(),
    {
      get: (_args, resume) => resume(state),
      put: (newState, resume) => {
        state = newState;
        return resume(undefined);
      },
      modify: (f, resume) => {
        state = f(state);
        return resume(undefined);
      },
    },
    (value) => [value, state]
  );
}

// ============================================================================
// READER EFFECT
// ============================================================================

export interface ReaderEffect<R> extends EffectSignature<{
  ask: EffectOperation<void, R>;
  local: EffectOperation<{ f: (r: R) => R; computation: () => unknown }, unknown>;
}> {
  name: 'Reader';
}

export function Reader<R>(): ReaderEffect<R> {
  return {
    name: 'Reader',
    operations: {
      ask: { name: 'ask', _input: undefined as void, _output: undefined as R, resumable: true },
      local: { name: 'local', _input: undefined as any, _output: undefined as unknown, resumable: true },
    },
  };
}

export function ask<R>(effect: ReaderEffect<R>) {
  return perform(effect, 'ask');
}

export function readerHandler<R>(env: R): Handler<ReaderEffect<R>, unknown> {
  return handler<ReaderEffect<R>, unknown>(
    Reader<R>(),
    {
      ask: (_args, resume) => resume(env),
      local: ({ f, computation }, resume) => {
        // Would need more sophisticated implementation for local
        return resume(computation());
      },
    },
    (value) => value
  );
}

// ============================================================================
// ERROR EFFECT
// ============================================================================

export interface ErrorEffect<E> extends EffectSignature<{
  raise: EffectOperation<E, never>;
  catch: EffectOperation<{ computation: () => unknown; handler: (e: E) => unknown }, unknown>;
}> {
  name: 'Error';
}

export function ErrorEff<E>(): ErrorEffect<E> {
  return {
    name: 'Error',
    operations: {
      raise: { name: 'raise', _input: undefined as E, _output: undefined as never, resumable: false },
      catch: { name: 'catch', _input: undefined as any, _output: undefined as unknown, resumable: true },
    },
  };
}

export function raise<E>(effect: ErrorEffect<E>, error: E) {
  return perform(effect, 'raise', error);
}

export type Either<E, A> = { tag: 'Left'; value: E } | { tag: 'Right'; value: A };

export function errorHandler<E>(): Handler<ErrorEffect<E>, Either<E, unknown>> {
  return handler<ErrorEffect<E>, Either<E, unknown>>(
    ErrorEff<E>(),
    {
      raise: (error, _resume) => ({ tag: 'Left', value: error }),
      catch: ({ computation, handler: h }, resume) => {
        try {
          const result = computation();
          return resume(result);
        } catch (e) {
          return resume(h(e as E));
        }
      },
    },
    (value) => ({ tag: 'Right', value })
  );
}

// ============================================================================
// NON-DETERMINISM EFFECT
// ============================================================================

export interface NonDetEffect extends EffectSignature<{
  choose: EffectOperation<unknown[], unknown>;
  fail: EffectOperation<void, never>;
}> {
  name: 'NonDet';
}

export const NonDet: NonDetEffect = {
  name: 'NonDet',
  operations: {
    choose: { name: 'choose', _input: [] as unknown[], _output: undefined as unknown, resumable: true },
    fail: { name: 'fail', _input: undefined as void, _output: undefined as never, resumable: false },
  },
};

export function choose<A>(options: A[]) {
  return perform(NonDet, 'choose', options);
}

export const fail = () => perform(NonDet, 'fail');

export const nonDetHandler: Handler<NonDetEffect, unknown[]> = handler<NonDetEffect, unknown[]>(
  NonDet,
  {
    choose: (options, resume) => {
      const results: unknown[] = [];
      for (const option of options) {
        const r = resume(option);
        if (Array.isArray(r)) {
          results.push(...r);
        } else {
          results.push(r);
        }
      }
      return results;
    },
    fail: (_args, _resume) => [],
  },
  (value) => [value]
);

// ============================================================================
// ASYNC EFFECT
// ============================================================================

export interface AsyncEffect extends EffectSignature<{
  fork: EffectOperation<() => unknown, Fiber<unknown>>;
  await: EffectOperation<Fiber<unknown>, unknown>;
  sleep: EffectOperation<number, void>;
  timeout: EffectOperation<{ duration: number; computation: () => unknown }, unknown | null>;
  race: EffectOperation<Array<() => unknown>, unknown>;
  parallel: EffectOperation<Array<() => unknown>, unknown[]>;
}> {
  name: 'Async';
}

export const Async: AsyncEffect = {
  name: 'Async',
  operations: {
    fork: { name: 'fork', _input: undefined as () => unknown, _output: undefined as Fiber<unknown>, resumable: true },
    await: { name: 'await', _input: undefined as Fiber<unknown>, _output: undefined as unknown, resumable: true },
    sleep: { name: 'sleep', _input: 0 as number, _output: undefined as void, resumable: true },
    timeout: { name: 'timeout', _input: undefined as any, _output: undefined as unknown | null, resumable: true },
    race: { name: 'race', _input: undefined as Array<() => unknown>, _output: undefined as unknown, resumable: true },
    parallel: { name: 'parallel', _input: undefined as Array<() => unknown>, _output: undefined as unknown[], resumable: true },
  },
};

export const fork = <A>(computation: () => A) => perform(Async, 'fork', computation);
export const awaitFiber = <A>(fiber: Fiber<A>) => perform(Async, 'await', fiber);
export const sleep = (ms: number) => perform(Async, 'sleep', ms);

// ============================================================================
// LOG EFFECT
// ============================================================================

export interface LogEffect extends EffectSignature<{
  debug: EffectOperation<{ message: string; context?: Record<string, unknown> }, void>;
  info: EffectOperation<{ message: string; context?: Record<string, unknown> }, void>;
  warn: EffectOperation<{ message: string; context?: Record<string, unknown> }, void>;
  error: EffectOperation<{ message: string; context?: Record<string, unknown> }, void>;
}> {
  name: 'Log';
}

export const Log: LogEffect = {
  name: 'Log',
  operations: {
    debug: { name: 'debug', _input: undefined as any, _output: undefined as void, resumable: true },
    info: { name: 'info', _input: undefined as any, _output: undefined as void, resumable: true },
    warn: { name: 'warn', _input: undefined as any, _output: undefined as void, resumable: true },
    error: { name: 'error', _input: undefined as any, _output: undefined as void, resumable: true },
  },
};

export const logDebug = (message: string, context?: Record<string, unknown>) =>
  perform(Log, 'debug', { message, context });
export const logInfo = (message: string, context?: Record<string, unknown>) =>
  perform(Log, 'info', { message, context });
export const logWarn = (message: string, context?: Record<string, unknown>) =>
  perform(Log, 'warn', { message, context });
export const logError = (message: string, context?: Record<string, unknown>) =>
  perform(Log, 'error', { message, context });

export const logHandler: Handler<LogEffect, void> = handler<LogEffect, void>(
  Log,
  {
    debug: ({ message, context }, resume) => {
      console.debug(message, context);
      return resume(undefined);
    },
    info: ({ message, context }, resume) => {
      console.info(message, context);
      return resume(undefined);
    },
    warn: ({ message, context }, resume) => {
      console.warn(message, context);
      return resume(undefined);
    },
    error: ({ message, context }, resume) => {
      console.error(message, context);
      return resume(undefined);
    },
  },
  () => undefined
);

// ============================================================================
// TIME EFFECT
// ============================================================================

export interface TimeEffect extends EffectSignature<{
  now: EffectOperation<void, Date>;
  today: EffectOperation<void, string>;
  measure: EffectOperation<() => unknown, [unknown, number]>;
}> {
  name: 'Time';
}

export const Time: TimeEffect = {
  name: 'Time',
  operations: {
    now: { name: 'now', _input: undefined as void, _output: undefined as Date, resumable: true },
    today: { name: 'today', _input: undefined as void, _output: '' as string, resumable: true },
    measure: { name: 'measure', _input: undefined as () => unknown, _output: undefined as [unknown, number], resumable: true },
  },
};

export const now = () => perform(Time, 'now');
export const today = () => perform(Time, 'today');

export const timeHandler: Handler<TimeEffect, unknown> = handler<TimeEffect, unknown>(
  Time,
  {
    now: (_args, resume) => resume(new Date()),
    today: (_args, resume) => resume(new Date().toISOString().split('T')[0]),
    measure: (computation, resume) => {
      const start = Date.now();
      const result = computation();
      const duration = Date.now() - start;
      return resume([result, duration]);
    },
  },
  (value) => value
);

// ============================================================================
// RANDOM EFFECT
// ============================================================================

export interface RandomEffect extends EffectSignature<{
  nextInt: EffectOperation<{ min: number; max: number }, number>;
  nextFloat: EffectOperation<void, number>;
  nextBoolean: EffectOperation<void, boolean>;
  nextUuid: EffectOperation<void, string>;
  shuffle: EffectOperation<unknown[], unknown[]>;
}> {
  name: 'Random';
}

export const Random: RandomEffect = {
  name: 'Random',
  operations: {
    nextInt: { name: 'nextInt', _input: undefined as { min: number; max: number }, _output: 0 as number, resumable: true },
    nextFloat: { name: 'nextFloat', _input: undefined as void, _output: 0 as number, resumable: true },
    nextBoolean: { name: 'nextBoolean', _input: undefined as void, _output: false as boolean, resumable: true },
    nextUuid: { name: 'nextUuid', _input: undefined as void, _output: '' as string, resumable: true },
    shuffle: { name: 'shuffle', _input: [] as unknown[], _output: [] as unknown[], resumable: true },
  },
};

export const nextInt = (min: number, max: number) => perform(Random, 'nextInt', { min, max });
export const nextFloat = () => perform(Random, 'nextFloat');
export const nextBoolean = () => perform(Random, 'nextBoolean');
export const nextUuid = () => perform(Random, 'nextUuid');
export const shuffle = <A>(list: A[]) => perform(Random, 'shuffle', list);

export const randomHandler: Handler<RandomEffect, unknown> = handler<RandomEffect, unknown>(
  Random,
  {
    nextInt: ({ min, max }, resume) => resume(Math.floor(Math.random() * (max - min + 1)) + min),
    nextFloat: (_args, resume) => resume(Math.random()),
    nextBoolean: (_args, resume) => resume(Math.random() < 0.5),
    nextUuid: (_args, resume) => resume(crypto.randomUUID()),
    shuffle: (list, resume) => {
      const result = [...list];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return resume(result);
    },
  },
  (value) => value
);

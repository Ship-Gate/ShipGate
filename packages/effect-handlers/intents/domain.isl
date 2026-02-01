// ============================================================================
// ISL Effect System - Algebraic Effects and Handlers
// @intentos/effect-handlers
// ============================================================================
// 
// This module provides first-class algebraic effects for ISL, enabling:
// - Pure functional programming with controlled side effects
// - Composable effect handlers
// - Effect polymorphism
// - Resumable computations (delimited continuations)
// ============================================================================

domain EffectSystem {
  version: "1.0.0"
  owner: "isl-core-team"
  
  // ============================================================================
  // CORE EFFECT TYPES
  // ============================================================================
  
  /**
   * An effect signature defines the operations an effect provides.
   * Effects are like interfaces for side effects.
   */
  type EffectSignature<Ops> = {
    name: String
    operations: Ops
    laws: List<EffectLaw>?
  }
  
  /**
   * An effect operation is a single effectful action.
   */
  type EffectOperation<Input, Output> = {
    name: String
    input: Type<Input>
    output: Type<Output>
    resumable: Boolean  // Can the computation continue after this?
  }
  
  /**
   * Effect laws define algebraic properties effects must satisfy.
   */
  type EffectLaw = {
    name: String
    description: String
    property: Expression  // Quantified property
  }
  
  // ============================================================================
  // BUILT-IN EFFECT SIGNATURES
  // ============================================================================
  
  /**
   * Console I/O effect
   */
  effect Console {
    operations {
      print(message: String): Unit
      readLine(): String
      error(message: String): Unit
    }
    
    laws {
      // print is a no-op for unit return
      print_unit: forall msg. (print(msg); ()) == ()
    }
  }
  
  /**
   * State effect - mutable state
   */
  effect State<S> {
    operations {
      get(): S
      put(value: S): Unit
      modify(f: (S) -> S): Unit
    }
    
    laws {
      // get after put returns the put value
      get_put: forall s. { put(s); get() } == s
      // put after put keeps only the last
      put_put: forall s1, s2. { put(s1); put(s2) } == put(s2)
      // modify is get then put
      modify_def: forall f. modify(f) == { let s = get(); put(f(s)) }
    }
  }
  
  /**
   * Reader effect - read-only environment
   */
  effect Reader<R> {
    operations {
      ask(): R
      local(f: (R) -> R, computation: () -> A): A
    }
    
    laws {
      // ask returns the same value
      ask_idempotent: { let a = ask(); let b = ask(); a == b }
      // local modifies the environment for the inner computation
      local_ask: forall f. local(f, ask) == f(ask())
    }
  }
  
  /**
   * Error/Exception effect
   */
  effect Error<E> {
    operations {
      raise(error: E): Never
      catch(computation: () -> A, handler: (E) -> A): A
    }
    
    laws {
      // raise short-circuits
      raise_bind: forall e, f. { raise(e); f() } == raise(e)
      // catch handles raises
      catch_raise: forall e, h. catch(() -> raise(e), h) == h(e)
      // catch is no-op for success
      catch_success: forall a, h. catch(() -> a, h) == a
    }
  }
  
  /**
   * Non-determinism effect
   */
  effect NonDet {
    operations {
      choose<A>(options: List<A>): A
      fail(): Never
    }
    
    laws {
      // fail is identity for choose
      choose_fail: choose([]) == fail()
      // choose singleton returns the element
      choose_singleton: forall a. choose([a]) == a
    }
  }
  
  /**
   * Async effect - asynchronous computations
   */
  effect Async {
    operations {
      fork<A>(computation: () -> A): Fiber<A>
      await<A>(fiber: Fiber<A>): A
      sleep(duration: Duration): Unit
      timeout<A>(duration: Duration, computation: () -> A): A?
      race<A>(computations: List<() -> A>): A
      parallel<A>(computations: List<() -> A>): List<A>
    }
  }
  
  /**
   * Resource effect - managed resources
   */
  effect Resource {
    operations {
      acquire<R>(resource: () -> R, release: (R) -> Unit): R
      use<R, A>(resource: R, action: (R) -> A): A
      bracket<R, A>(
        acquire: () -> R,
        release: (R) -> Unit,
        use: (R) -> A
      ): A
    }
    
    laws {
      // bracket guarantees release
      bracket_release: forall acq, rel, use.
        bracket(acq, rel, use) ensures rel_called_on_exit
    }
  }
  
  /**
   * Logging effect
   */
  effect Log {
    operations {
      debug(message: String, context: Map<String, Any>?): Unit
      info(message: String, context: Map<String, Any>?): Unit
      warn(message: String, context: Map<String, Any>?): Unit
      error(message: String, context: Map<String, Any>?): Unit
      withContext(context: Map<String, Any>, computation: () -> A): A
    }
  }
  
  /**
   * Telemetry effect
   */
  effect Telemetry {
    operations {
      span<A>(name: String, computation: () -> A): A
      metric(name: String, value: Decimal, tags: Map<String, String>?): Unit
      event(name: String, attributes: Map<String, Any>?): Unit
    }
  }
  
  /**
   * Time effect
   */
  effect Time {
    operations {
      now(): Timestamp
      today(): Date
      measure<A>(computation: () -> A): (A, Duration)
      schedule(at: Timestamp, action: () -> Unit): ScheduleId
      cancel(id: ScheduleId): Boolean
    }
  }
  
  /**
   * Random effect
   */
  effect Random {
    operations {
      nextInt(min: Int, max: Int): Int
      nextFloat(): Float
      nextBoolean(): Boolean
      nextUuid(): UUID
      shuffle<A>(list: List<A>): List<A>
      sample<A>(list: List<A>, count: Int): List<A>
    }
  }
  
  // ============================================================================
  // EFFECT HANDLERS
  // ============================================================================
  
  /**
   * An effect handler provides implementations for effect operations.
   */
  type Handler<E, R> = {
    effect: EffectSignature<E>
    return: <A>(value: A) -> R
    operations: HandlerOperations<E, R>
  }
  
  /**
   * Handler operations map effect operations to implementations.
   */
  type HandlerOperations<E, R> = Map<String, HandlerClause<R>>
  
  /**
   * A handler clause handles one effect operation.
   * It receives the operation arguments and a resumption (continuation).
   */
  type HandlerClause<R> = {
    operation: String
    handler: <Args, Resume>(args: Args, resume: (Output) -> R) -> R
  }
  
  // ============================================================================
  // EFFECT COMPOSITION
  // ============================================================================
  
  /**
   * Effect row - a set of effects a computation may perform.
   */
  type EffectRow = List<EffectSignature<Any>>
  
  /**
   * Effectful computation type.
   * Eff<E, A> is a computation that may perform effects E and returns A.
   */
  type Eff<E: EffectRow, A> = {
    run: () -> A  // Internally tracked effects
  }
  
  /**
   * Pure computation - no effects.
   */
  type Pure<A> = Eff<[], A>
  
  /**
   * Effect evidence - proves an effect is in the effect row.
   */
  type Evidence<E, Row: EffectRow> = {
    index: Int
    effect: EffectSignature<E>
  }
  
  // ============================================================================
  // EFFECT BEHAVIORS
  // ============================================================================
  
  /**
   * Perform an effect operation.
   */
  behavior Perform<E, Op, A> {
    description: "Perform an effect operation"
    
    input {
      evidence: Evidence<E, Row>
      operation: Op
      args: Any
    }
    
    output {
      success: A
      errors {
        EFFECT_NOT_HANDLED {
          when: "No handler for this effect"
          returns: { effect: String, operation: String }
        }
      }
    }
    
    // Effects must be handled somewhere in the call stack
    requires effect_handler_in_scope(evidence.effect)
  }
  
  /**
   * Handle effects with a handler.
   */
  behavior Handle<E, R> {
    description: "Handle effects in a computation"
    
    input {
      computation: Eff<E + Row, A>
      handler: Handler<E, R>
    }
    
    output {
      success: Eff<Row, R>
    }
    
    postconditions {
      success implies {
        // All E effects are handled
        result.effect_row not_contains E
        // Remaining effects are unchanged
        result.effect_row == computation.effect_row - E
      }
    }
  }
  
  /**
   * Run a pure computation.
   */
  behavior RunPure<A> {
    description: "Run a computation with no effects"
    
    input {
      computation: Pure<A>
    }
    
    output {
      success: A
    }
    
    // No effects to handle - can run directly
    temporal {
      always terminates
    }
  }
  
  // ============================================================================
  // STANDARD HANDLERS
  // ============================================================================
  
  /**
   * State handler - run state effect with initial state
   */
  handler StateHandler<S> for State<S> {
    initial_state: S
    
    operations {
      get(resume) {
        let state = current_state
        resume(state)
      }
      
      put(value, resume) {
        current_state = value
        resume(())
      }
      
      modify(f, resume) {
        current_state = f(current_state)
        resume(())
      }
    }
    
    return(value) {
      (value, current_state)
    }
  }
  
  /**
   * Reader handler - run reader effect with environment
   */
  handler ReaderHandler<R> for Reader<R> {
    environment: R
    
    operations {
      ask(resume) {
        resume(environment)
      }
      
      local(f, computation, resume) {
        let new_env = f(environment)
        let result = with_environment(new_env, computation)
        resume(result)
      }
    }
    
    return(value) {
      value
    }
  }
  
  /**
   * Error handler - run error effect with handler
   */
  handler ErrorHandler<E> for Error<E> {
    operations {
      raise(error, _resume) {
        // Don't resume - short circuit
        Left(error)
      }
      
      catch(computation, handler, resume) {
        match computation() {
          Left(e) -> resume(handler(e))
          Right(a) -> resume(a)
        }
      }
    }
    
    return(value) {
      Right(value)
    }
  }
  
  /**
   * NonDet handler - collect all results
   */
  handler NonDetHandler for NonDet {
    operations {
      choose(options, resume) {
        options.flatMap(option -> resume(option))
      }
      
      fail(_resume) {
        []
      }
    }
    
    return(value) {
      [value]
    }
  }
  
  // ============================================================================
  // EFFECT INFERENCE
  // ============================================================================
  
  /**
   * Effect inference rules for automatic effect tracking.
   */
  invariants EffectInference {
    // Pure functions have no effects
    pure_no_effects: forall f: (A) -> B.
      is_pure(f) implies effects(f) == []
    
    // Effect composition is union
    compose_effects: forall f: Eff<E1, A>, g: (A) -> Eff<E2, B>.
      effects(f.flatMap(g)) == E1 union E2
    
    // Handler removes effect
    handle_removes: forall h: Handler<E, R>, c: Eff<E + Rest, A>.
      effects(handle(h, c)) == Rest
    
    // Subtyping: fewer effects is more general
    effect_subtyping: forall E1, E2.
      E1 subset E2 implies Eff<E1, A> <: Eff<E2, A>
  }
}

# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createActor, defineBehavior, stateless, stateful, ActorRef, ActorContext, ActorBehavior, ActorSignal, SupervisionStrategy, CancelToken, Envelope, ActorStatus, Actor
# dependencies: 

domain Actor {
  version: "1.0.0"

  type ActorRef = String
  type ActorContext = String
  type ActorBehavior = String
  type ActorSignal = String
  type SupervisionStrategy = String
  type CancelToken = String
  type Envelope = String
  type ActorStatus = String
  type Actor = String

  invariants exports_present {
    - true
  }
}

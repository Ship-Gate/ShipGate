# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: StandardEvents, AnalyticsConfig, ProviderConfig, AnalyticsProvider, Context, PageContext, DeviceContext, CampaignContext, ReferrerContext, LibraryContext, TrackInput, IdentifyInput, PageInput, GroupInput, AliasInput, TrackResult, IdentifyResult, PageResult, GroupResult, AliasResult, BaseError, TrackError, IdentifyError, PageError, GroupError, AliasError, EventQueue, QueuedEvent, TrackPayload, IdentifyPayload, PagePayload, GroupPayload, AliasPayload, StandardEventName, StandardUserTraits, StandardGroupTraits
# dependencies: 

domain Types {
  version: "1.0.0"

  type AnalyticsConfig = String
  type ProviderConfig = String
  type AnalyticsProvider = String
  type Context = String
  type PageContext = String
  type DeviceContext = String
  type CampaignContext = String
  type ReferrerContext = String
  type LibraryContext = String
  type TrackInput = String
  type IdentifyInput = String
  type PageInput = String
  type GroupInput = String
  type AliasInput = String
  type TrackResult = String
  type IdentifyResult = String
  type PageResult = String
  type GroupResult = String
  type AliasResult = String
  type BaseError = String
  type TrackError = String
  type IdentifyError = String
  type PageError = String
  type GroupError = String
  type AliasError = String
  type EventQueue = String
  type QueuedEvent = String
  type TrackPayload = String
  type IdentifyPayload = String
  type PagePayload = String
  type GroupPayload = String
  type AliasPayload = String
  type StandardEventName = String
  type StandardUserTraits = String
  type StandardGroupTraits = String

  invariants exports_present {
    - true
  }
}

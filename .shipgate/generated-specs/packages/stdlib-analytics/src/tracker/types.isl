# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TrackerConfig, AnalyticsEvent, EventType, EventContext, PageContext, DeviceContext, CampaignContext, TrackInput, TrackResult, FlushCallback
# dependencies: 

domain Types {
  version: "1.0.0"

  type TrackerConfig = String
  type AnalyticsEvent = String
  type EventType = String
  type EventContext = String
  type PageContext = String
  type DeviceContext = String
  type CampaignContext = String
  type TrackInput = String
  type TrackResult = String
  type FlushCallback = String

  invariants exports_present {
    - true
  }
}

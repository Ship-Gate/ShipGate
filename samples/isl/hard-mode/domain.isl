# Hard Mode: Invariants + Temporal Constraints — Canonical Sample
# Distributed reservation system with complex invariants, temporal deadlines,
# conflict resolution, and state machine constraints
# Covers: deep invariants, temporal windows, scenarios, pre/post

domain HardMode {
  version: "1.0.0"

  enum ReservationStatus {
    PENDING
    HELD
    CONFIRMED
    EXPIRED
    CANCELLED
    CONFLICT
  }

  enum ResourceType {
    SEAT
    ROOM
    EQUIPMENT
    TIME_SLOT
  }

  entity Resource {
    id: UUID [immutable, unique]
    type: ResourceType [indexed]
    name: String
    capacity: Int [default: 1]
    is_available: Boolean [default: true]

    invariants {
      capacity >= 1
      active_reservations_count <= capacity
    }
  }

  entity Reservation {
    id: UUID [immutable, unique]
    resource_id: UUID [immutable, indexed]
    user_id: UUID [indexed]
    status: ReservationStatus [default: PENDING, indexed]
    starts_at: Timestamp
    ends_at: Timestamp
    held_until: Timestamp?
    confirmed_at: Timestamp?
    created_at: Timestamp [immutable]
    version: Int [default: 0]

    invariants {
      starts_at < ends_at
      ends_at - starts_at <= 24 hours
      ends_at - starts_at >= 15 minutes
      status == HELD implies held_until != null
      status == HELD implies held_until > now()
      status == CONFIRMED implies confirmed_at != null
      status == EXPIRED implies held_until != null and held_until <= now()
    }
  }

  entity ConflictLog {
    id: UUID [immutable, unique]
    resource_id: UUID [immutable, indexed]
    reservation_a_id: UUID [immutable]
    reservation_b_id: UUID [immutable]
    overlap_start: Timestamp [immutable]
    overlap_end: Timestamp [immutable]
    resolution: String?
    detected_at: Timestamp [immutable]

    invariants {
      overlap_start < overlap_end
      reservation_a_id != reservation_b_id
    }
  }

  behavior CreateReservation {
    description: "Create a pending reservation with a hold window"

    input {
      resource_id: UUID
      user_id: UUID
      starts_at: Timestamp
      ends_at: Timestamp
    }

    output {
      success: Reservation
      errors {
        RESOURCE_NOT_FOUND {
          when: "Resource does not exist"
          retriable: false
        }
        RESOURCE_UNAVAILABLE {
          when: "Resource is disabled"
          retriable: false
        }
        TIME_CONFLICT {
          when: "Overlapping confirmed/held reservation exists"
          retriable: false
        }
        INVALID_DURATION {
          when: "Duration outside 15min–24hr range"
          retriable: true
        }
        PAST_START_TIME {
          when: "starts_at is in the past"
          retriable: true
        }
        CAPACITY_EXCEEDED {
          when: "Resource capacity fully booked for this time slot"
          retriable: false
        }
      }
    }

    pre {
      Resource.exists(resource_id)
      Resource.lookup(resource_id).is_available
      starts_at > now()
      starts_at < ends_at
      ends_at - starts_at >= 15 minutes
      ends_at - starts_at <= 24 hours
      no_overlap(resource_id, starts_at, ends_at)
      active_reservation_count(resource_id, starts_at, ends_at) < Resource.lookup(resource_id).capacity
    }

    post success {
      - Reservation.exists(result.id)
      - result.status == HELD
      - result.held_until == now() + 10 minutes
      - result.version == 1
    }

    invariants {
      - no two HELD or CONFIRMED reservations for same resource overlap in time
        when resource capacity == 1
      - for capacity > 1: concurrent reservations <= capacity at any point in time
      - held_until is exactly 10 minutes from creation
    }

    temporal {
      within 500ms (p99): reservation created
      deadline 10 minutes: must confirm or auto-expire
    }
  }

  behavior ConfirmReservation {
    description: "Confirm a held reservation before the hold expires"

    input {
      reservation_id: UUID
      expected_version: Int
    }

    output {
      success: Reservation
      errors {
        RESERVATION_NOT_FOUND {
          when: "Reservation does not exist"
          retriable: false
        }
        NOT_HELD {
          when: "Reservation is not in HELD status"
          retriable: false
        }
        HOLD_EXPIRED {
          when: "Hold window has elapsed — reservation auto-expired"
          retriable: false
        }
        VERSION_CONFLICT {
          when: "Optimistic concurrency conflict"
          retriable: true
        }
      }
    }

    pre {
      Reservation.exists(reservation_id)
      Reservation.lookup(reservation_id).status == HELD
      Reservation.lookup(reservation_id).held_until > now()
      Reservation.lookup(reservation_id).version == expected_version
    }

    post success {
      - result.status == CONFIRMED
      - result.confirmed_at == now()
      - result.version == input.expected_version + 1
    }

    invariants {
      - confirmation after held_until is rejected (no grace period)
      - confirmed reservation holds the slot permanently until cancelled or ends_at
    }

    temporal {
      within 200ms (p99): confirmation processed
    }
  }

  behavior CancelReservation {
    description: "Cancel a held or confirmed reservation"

    input {
      reservation_id: UUID
      reason: String
    }

    output {
      success: Reservation
      errors {
        RESERVATION_NOT_FOUND {
          when: "Reservation does not exist"
          retriable: false
        }
        ALREADY_TERMINAL {
          when: "Reservation is already expired or cancelled"
          retriable: false
        }
        TOO_LATE_TO_CANCEL {
          when: "Cannot cancel within 1 hour of starts_at"
          retriable: false
        }
      }
    }

    pre {
      Reservation.exists(reservation_id)
      Reservation.lookup(reservation_id).status in [HELD, CONFIRMED]
      Reservation.lookup(reservation_id).starts_at - now() > 1 hour
    }

    post success {
      - result.status == CANCELLED
      - Resource capacity freed for the time slot
    }

    invariants {
      - cancellation within 1 hour of start is blocked
      - cancellation frees capacity immediately
    }
  }

  behavior ExpireHolds {
    description: "System job: expire all reservations past their hold window"

    input {}

    output {
      success: {
        expired_count: Int
        expired_ids: List<UUID>
      }
    }

    post success {
      - result.expired_ids.all(id => Reservation.lookup(id).status == EXPIRED)
      - result.expired_ids.all(id => Reservation.lookup(id).held_until <= now())
      - result.expired_count == result.expired_ids.length
    }

    invariants {
      - only HELD reservations with held_until <= now() are expired
      - CONFIRMED reservations are never expired by this job
      - runs atomically: no partial expiration
    }

    temporal {
      runs every 30 seconds
      within 5s (p99): batch completes
    }
  }

  behavior DetectConflicts {
    description: "Scan for overlapping reservations that violate capacity"

    input {
      resource_id: UUID
      time_window_start: Timestamp
      time_window_end: Timestamp
    }

    output {
      success: {
        conflicts: List<ConflictLog>
        is_clean: Boolean
      }
    }

    pre {
      Resource.exists(resource_id)
      time_window_start < time_window_end
    }

    post success {
      - result.is_clean == (result.conflicts.length == 0)
      - result.conflicts.all(c => c.resource_id == input.resource_id)
      - result.conflicts.all(c => c.overlap_start >= input.time_window_start)
      - result.conflicts.all(c => c.overlap_end <= input.time_window_end)
    }

    invariants {
      - conflict detection is read-only
      - detects any time point where active reservations > capacity
    }
  }

  # ---- Complex Invariants (the "hard" part) ----

  invariants {
    # Global: at any point in time t, for any resource r:
    #   count(reservations where status in [HELD, CONFIRMED]
    #     and starts_at <= t and ends_at > t) <= r.capacity
    - capacity_never_exceeded_at_any_point_in_time

    # No reservation can be both CONFIRMED and EXPIRED
    - status is mutually exclusive: terminal states are irreversible

    # State machine transitions:
    #   PENDING -> HELD -> CONFIRMED -> CANCELLED
    #   PENDING -> HELD -> EXPIRED
    #   PENDING -> HELD -> CANCELLED
    # No other transitions allowed
    - valid_state_transitions_only

    # Temporal consistency:
    #   confirmed_at < starts_at (you confirm before the event)
    #   held_until < starts_at (hold expires before event starts)
    - temporal_ordering_of_timestamps

    # Conflict resolution:
    #   if DetectConflicts finds violations, at least one reservation
    #   must be moved to CONFLICT status
    - conflicts_must_be_resolved
  }

  scenario "Hold expiration under deadline" {
    step res = CreateReservation({ resource_id: room1, user_id: u1, starts_at: tomorrow_10am, ends_at: tomorrow_11am })
    assert res.result.status == HELD
    assert res.result.held_until == now() + 10 minutes

    # Simulate 11 minutes passing without confirmation
    step expire = ExpireHolds({})
    assert res.result.id in expire.result.expired_ids

    step check = Reservation.lookup(res.result.id)
    assert check.status == EXPIRED
  }

  scenario "Capacity-based double booking allowed" {
    # Resource with capacity 2 allows 2 concurrent reservations
    step r1 = CreateReservation({ resource_id: dual_room, user_id: u1, starts_at: tomorrow_2pm, ends_at: tomorrow_3pm })
    assert r1.success

    step r2 = CreateReservation({ resource_id: dual_room, user_id: u2, starts_at: tomorrow_2pm, ends_at: tomorrow_3pm })
    assert r2.success

    step r3 = CreateReservation({ resource_id: dual_room, user_id: u3, starts_at: tomorrow_2pm, ends_at: tomorrow_3pm })
    assert r3.error == CAPACITY_EXCEEDED
  }

  scenario "Optimistic concurrency on confirm" {
    step res = CreateReservation({ resource_id: room1, user_id: u1, starts_at: tomorrow_10am, ends_at: tomorrow_11am })

    step c1 = ConfirmReservation({ reservation_id: res.result.id, expected_version: 1 })
    assert c1.success
    assert c1.result.version == 2

    step c2 = ConfirmReservation({ reservation_id: res.result.id, expected_version: 1 })
    assert c2.error == VERSION_CONFLICT
  }

  scenario "Late cancellation blocked" {
    step res = CreateReservation({ resource_id: room1, user_id: u1, starts_at: in_30_minutes, ends_at: in_90_minutes })
    step confirm = ConfirmReservation({ reservation_id: res.result.id, expected_version: 1 })

    step cancel = CancelReservation({ reservation_id: res.result.id, reason: "changed plans" })
    assert cancel.error == TOO_LATE_TO_CANCEL
  }
}

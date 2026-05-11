# ShiftSync Backend Decisions

1. **De-certified staff** — `UserLocation` row is deleted. Existing `ShiftAssignment` rows are preserved and remain readable via the API. New assignments are blocked. Any `PENDING_ACCEPT` or `PENDING_MANAGER` swap requests involving those shifts are cancelled immediately with notifications to all parties.
2. **Desired hours** — advisory only. Never blocks an assignment. Surfaced in `/api/analytics/distribution` as `desiredHours` vs `scheduledHours` for manager visibility.
3. **Consecutive day calculation** — any shift of any length on a calendar day counts as a full worked day. Calendar day is determined by the shift's local start time in the location's IANA timezone.
4. **Shift edited post-swap-approval** — if a shift is edited while its swap is in `PENDING_MANAGER`, a BullMQ job fires immediately: swap → `CANCELLED`, original `ShiftAssignment` restored to `assigned`, all parties (requester, target, approving manager) notified.
5. **Timezone boundary locations** — each `Location` has exactly one IANA timezone string reflecting its physical address. All shift display and availability checking uses that location's timezone, regardless of where the staff member lives or what device timezone they are using.

import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'delivery-slot-booking',
  title: 'Delivery Slot Booking',
  difficulty: 'Intermediate',
  icon: 'pi pi-truck',
  color: '#84cc16',
  readTimeMinutes: 17,
  patterns: ['Strategy', 'Observer', 'Factory Method'],
  companies: ['Amazon', 'BigBasket', 'Blinkit', 'Swiggy Instamart', 'Zepto'],
  summary:
    'A quick-commerce delivery slot booking system where every (delivery zone, time slot) pair has a fixed concurrent-order capacity rather than a single seat - booking atomically increments a shared counter instead of claiming one identity-bound resource, cancellation decrements it and promotes the next FIFO waitlisted order the moment the slot was previously full, and overlapping slots for the same address are rejected outright.',

  functionalRequirements: [
    'Model delivery zones, each exposing a set of discrete time slots per day (e.g. 6-8pm), and configure a maximum concurrent order capacity per (zone, slot) pair (e.g. 50 deliveries).',
    'Booking a slot for an order must atomically check-and-increment the used-count for that (zone, slot) - it succeeds only while strictly under capacity, with no separate read-then-write step.',
    'Support a short-lived HOLD on a capacity unit while the customer finishes checkout (address confirmation, payment), which must self-expire and give the unit back if never confirmed.',
    'Confirming a hold before it expires converts it into a permanent Order that keeps the capacity unit consumed until delivered or cancelled.',
    'Cancelling a confirmed order decrements the used-count for its (zone, slot); if that slot had been completely full, automatically promote the next FIFO-queued waitlisted order for that exact (zone, slot) into a fresh hold.',
    'Reject booking a new slot for an address that already has a CONFIRMED or HELD slot whose time window overlaps the requested one - an address cannot receive two deliveries at once.',
    'Let a customer join a per-(zone, slot) waitlist when that slot is at capacity, and get notified automatically the moment a unit frees up there.',
  ],
  nonFunctionalRequirements: [
    'The capacity check-and-increment must be a single atomic operation (CAS-loop style), never a get() followed by a separate put()/increment - the classic "last remaining capacity unit" race must be provably race-free under concurrent load.',
    'The waitlist must be scoped per (zone, slot), not global - a rush of orders on one zone\'s 6-8pm slot must never block, delay, or reorder the waitlist for an unrelated zone or slot.',
    'Swapping the admission rule for a slot (hard cap vs. a small overbooking buffer to offset predictable no-shows) must not require touching the booking/cancellation orchestration code (open/closed principle).',
    'A hold that is abandoned mid-checkout must eventually give its capacity unit back without a customer, or an operator, having to intervene manually.',
  ],

  coreEntities: [
    { name: 'DeliveryZone', description: 'A geographic delivery area (e.g. a pincode cluster) - just an id and a name; all capacity configuration lives one level down, per slot.' },
    { name: 'TimeSlot', description: 'A discretized delivery window (date, start time, duration) with an overlaps() check - the same value object shape as a table-booking slot, but here it is paired with a zone instead of a single physical resource.' },
    { name: 'ZoneSlotKey', description: 'Composite key (zoneId + TimeSlot) that every capacity counter, hold, and waitlist queue is keyed on - the true unit of scarcity, exactly one counter per zone per slot.' },
    { name: 'CapacityPolicy', description: 'Interface deciding whether one more order can be admitted given the current used-count and configured max - the swappable admission rule (strict cap vs. buffered overbooking).' },
    { name: 'SlotCapacityCounter', description: 'The scarce resource itself - an AtomicInteger used-count plus a max, admitting or releasing one unit at a time via a CAS loop guarded by its CapacityPolicy. Unlike a table, it has no identity: any one of its free units is interchangeable.' },
    { name: 'SlotHold', description: 'A provisional, time-boxed claim on one unit of a ZoneSlotKey\'s capacity, created while checkout completes; carries an expiry and, once expired, must be explicitly reaped to give its unit back (there is no lazy "is this occupant expired" check like a table has, because a counter has no per-unit identity to inspect).' },
    { name: 'Order', description: 'A confirmed booking - what a SlotHold becomes once checkout finishes in time. Tracks CONFIRMED / CANCELLED status and permanently owns one capacity unit until cancelled.' },
    { name: 'WaitlistEntry / SlotWaitlist', description: 'A customer waiting for a specific (zone, slot); queued per-ZoneSlotKey FIFO so a stampede on one zone\'s slot never starves another zone\'s waitlist.' },
    { name: 'SlotCapacityFreedObserver', description: 'Interface notified whenever a ZoneSlotKey transitions from full back to having a free unit (cancellation only, since that is the only moment a full slot becomes bookable again) - the waitlist promoter is the one implementation.' },
    { name: 'DeliverySlotBookingService', description: 'The aggregate root - owns zone/slot capacity configuration, the counters, the address-conflict index, the waitlist, and the observers; orchestrates hold/confirm/cancel and the atomic capacity claim.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class DeliveryZone {
    -String zoneId
    -String name
  }
  class TimeSlot {
    -LocalDate date
    -LocalTime startTime
    -int durationMinutes
    +overlaps(TimeSlot) boolean
    +equals(Object) boolean
    +hashCode() int
  }
  class ZoneSlotKey {
    -String zoneId
    -TimeSlot slot
    +equals(Object) boolean
    +hashCode() int
  }
  class CapacityPolicy {
    <<interface>>
    +canAdmitOneMore(int, int) boolean
  }
  class StrictCapacityPolicy {
    +canAdmitOneMore(int, int) boolean
  }
  class BufferedCapacityPolicy {
    -double overbookFactor
    +canAdmitOneMore(int, int) boolean
  }
  class SlotCapacityCounter {
    -int maxCapacity
    -CapacityPolicy policy
    -AtomicInteger usedCount
    +tryReserve() boolean
    +release() boolean
    +getRemainingCapacity() int
  }
  class SlotHold {
    -String holdId
    -String zoneId
    -TimeSlot slot
    -String customerId
    -String deliveryAddress
    -Instant expiresAt
    +isExpired() boolean
  }
  class SlotHoldFactory {
    +createHold(String, TimeSlot, String, String, boolean) SlotHold
  }
  class OrderStatus {
    <<enumeration>>
    CONFIRMED
    CANCELLED
  }
  class Order {
    -String orderId
    -String zoneId
    -TimeSlot slot
    -String customerId
    -String deliveryAddress
    -OrderStatus status
    +cancel() void
  }
  class SlotWaitlist {
    -Map~ZoneSlotKey, Queue~WaitlistEntry~~ queuesByKey
    +join(ZoneSlotKey, String, String) WaitlistEntry
    +peekHead(ZoneSlotKey) WaitlistEntry
    +removeHead(ZoneSlotKey) void
  }
  class WaitlistEntry {
    -String entryId
    -ZoneSlotKey key
    -String customerId
    -String deliveryAddress
  }
  class SlotCapacityFreedObserver {
    <<interface>>
    +onCapacityFreed(ZoneSlotKey) void
  }
  class WaitlistPromoter {
    +onCapacityFreed(ZoneSlotKey) void
  }
  class SlotCapacityUnavailableException
  class DeliverySlotBookingService {
    -ConcurrentHashMap~ZoneSlotKey, SlotCapacityCounter~ capacityByKey
    -ConcurrentHashMap~String, SlotHold~ holdsById
    -ConcurrentHashMap~ZoneSlotKey, Queue~String~~ holdsByKey
    -ConcurrentHashMap~String, Order~ ordersById
    -ConcurrentHashMap~String, List~TimeSlot~~ activeSlotsByAddress
    -SlotWaitlist waitlist
    -List~SlotCapacityFreedObserver~ observers
    +registerSlotCapacity(String, TimeSlot, int, CapacityPolicy) void
    +holdSlot(String, TimeSlot, String, String) SlotHold
    +confirmHold(String) Order
    +cancelOrder(String) void
    +joinWaitlist(String, TimeSlot, String, String) WaitlistEntry
  }

  CapacityPolicy <|.. StrictCapacityPolicy
  CapacityPolicy <|.. BufferedCapacityPolicy
  SlotCapacityCounter o-- CapacityPolicy
  SlotHold ..> SlotHoldFactory : created by
  SlotHold o-- TimeSlot
  Order o-- TimeSlot
  Order --> OrderStatus
  ZoneSlotKey o-- TimeSlot
  SlotWaitlist o-- WaitlistEntry
  SlotCapacityFreedObserver <|.. WaitlistPromoter
  DeliverySlotBookingService o-- DeliveryZone
  DeliverySlotBookingService o-- SlotCapacityCounter
  DeliverySlotBookingService o-- SlotWaitlist
  DeliverySlotBookingService o-- SlotCapacityFreedObserver
  DeliverySlotBookingService ..> ZoneSlotKey : keys capacity by
  DeliverySlotBookingService ..> SlotCapacityUnavailableException : throws`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'CapacityPolicy + StrictCapacityPolicy / BufferedCapacityPolicy', why: 'Whether a slot is "full" is a swappable admission rule, not a hardcoded comparison - a hard cap protects delivery-fleet SLAs while a buffered policy tolerates a small overbook to offset predictable no-shows, and SlotCapacityCounter never branches on which is active. Note this Strategy answers "is there room for one more?", not "which resource wins?" like restaurant-booking\'s allocation strategy - there is no allocation decision here because every capacity unit is fungible.' },
    { pattern: 'Observer', where: 'SlotCapacityFreedObserver / WaitlistPromoter', why: 'cancelOrder() fires "this (zone, slot) just transitioned from full to having a unit free" without knowing a waitlist exists. Crucially it only fires when the release() call reports the slot was previously full - unlike restaurant-booking\'s capacity-of-1 case where every cancellation is automatically the interesting one, here 46/50 -> 45/50 is a no-op for anyone waiting, so gating the notification on the full-to-not-full transition avoids waking the promoter on every routine cancellation.' },
    { pattern: 'Factory Method', where: 'SlotHoldFactory.createHold()', why: 'Centralizes the hold-expiry policy in one place - a surge zone during a lunch rush gets a shorter TTL (3 minutes) to cycle scarce capacity faster than a quiet suburb (10 minutes), and DeliverySlotBookingService never sees a raw Duration or Instant.now() call.' },
  ],

  dataStructures: [
    { component: '(zone, slot) capacity', structure: 'ConcurrentHashMap<ZoneSlotKey, SlotCapacityCounter>, each counter backed by AtomicInteger and claimed via a get()/compareAndSet() loop', why: 'A table can be claimed with one compute() call because it either belongs to nobody or to exactly one occupant; a slot with capacity 50 has no such single identity to swap - the CAS loop is the counter-based equivalent of compute(): exactly one caller ever advances usedCount from 49 to 50, and every loser sees the retry naturally fail closed once the policy rejects them.' },
    { component: 'Leaked-hold tracking', structure: 'ConcurrentHashMap<String, SlotHold> holdsById + ConcurrentHashMap<ZoneSlotKey, Queue<String>> holdsByKey, reaped via computeIfPresent()', why: 'Because a counter has no per-unit identity, an expired hold cannot be lazily discovered the way an expired table Hold is (nobody is "looking at" a specific unit). Reaping is scoped per ZoneSlotKey so a full 6-8pm slot triggers a scan of only its own holds, and computeIfPresent() guarantees two threads reaping the same expired holdId concurrently never both call counter.release() for it.' },
    { component: 'Per-(zone, slot) waitlist', structure: 'ConcurrentHashMap<ZoneSlotKey, ConcurrentLinkedQueue<WaitlistEntry>>', why: 'Each ZoneSlotKey gets its own FIFO queue - O(1) enqueue/dequeue, and a rush on zone A\'s 6-8pm slot can never block or reorder zone B\'s waitlist, or even a different slot within zone A.' },
    { component: 'Address overlap index', structure: 'ConcurrentHashMap<String, List<TimeSlot>> activeSlotsByAddress, mutated only inside compute()', why: 'Conflict detection ("does this address already have an overlapping delivery window?") is itself a check-then-act on a shared list, so it is wrapped in the same key-scoped compute() atomicity used everywhere else in this design rather than a separate lock object per address.' },
  ],

  walkthroughs: [
    {
      title: 'Capacity Claim Happy Path (and the last-unit race)',
      steps: [
        'Zone Z-DOWNTOWN\'s 18:00-20:00 slot is configured with maxCapacity=50 under a StrictCapacityPolicy; after a normal evening of bookings, SlotCapacityCounter.usedCount sits at 49.',
        'Customer #50 calls holdSlot("Z-DOWNTOWN", slot18to20, "cust-501", "12 Baker St"); the service first atomically reserves the address via activeSlotsByAddress.compute() (no existing overlapping slot for that address, so it succeeds) and then calls counter.tryReserve().',
        'tryReserve() reads usedCount=49, asks StrictCapacityPolicy.canAdmitOneMore(49, 50) which returns true (49 < 50), and calls compareAndSet(49, 50) - it succeeds in one atomic step, so this caller is now the 50th and last order for that slot.',
        'A near-simultaneous customer #51 races in on a different thread: tryReserve() reads usedCount=50, canAdmitOneMore(50, 50) returns false immediately - the CAS is never even attempted, so this caller fails cleanly with no wasted contention on the AtomicInteger.',
        'The service creates a SlotHold via SlotHoldFactory (10-minute TTL, since Z-DOWNTOWN is not flagged as a surge zone) and returns it to customer #501, who has 10 minutes to finish checkout before the unit is reclaimed.',
        'Customer #501 confirms within the TTL: confirmHold(holdId) finds the hold still present and unexpired, removes it from holdsById/holdsByKey, and creates a CONFIRMED Order under the same address reservation - the capacity unit stays consumed, now permanently instead of provisionally, and the slot sits at exactly 50/50.',
      ],
    },
    {
      title: 'Full Slot -> Waitlist -> Cancellation-Triggered FIFO Promotion',
      steps: [
        'Z-DOWNTOWN\'s 18:00-20:00 slot is at 50/50. A new request from "cust-777" calls holdSlot(); tryReserve() fails (canAdmitOneMore(50, 50) is false), and before giving up the service calls reapExpiredHolds() for that ZoneSlotKey to reclaim any abandoned checkout - it finds none, so holdSlot() throws SlotCapacityUnavailableException.',
        'The caller catches that and calls joinWaitlist("Z-DOWNTOWN", slot18to20, "cust-777", "44 Elm St"); SlotWaitlist.join() enqueues a WaitlistEntry onto the ConcurrentLinkedQueue kept specifically for ZoneSlotKey(Z-DOWNTOWN, 18:00-20:00).',
        'Fifteen minutes later, an earlier customer calls cancelOrder() on one of the 50 confirmed orders; the Order is marked CANCELLED, its address reservation is released, and counter.release() atomically decrements usedCount from 50 to 49 while evaluating canAdmitOneMore(50, 50) beforehand - since that was false, release() returns wasFull=true.',
        'Because wasFull was true, cancelOrder() invokes onCapacityFreed(ZoneSlotKey(Z-DOWNTOWN, 18:00-20:00)) on every registered SlotCapacityFreedObserver - here, a single WaitlistPromoter.',
        'WaitlistPromoter peeks the head of that ZoneSlotKey\'s queue (cust-777, still first in line), and calls the exact same holdSlot() entry point a live customer would use on cust-777\'s behalf: usedCount is 49, canAdmitOneMore(49, 50) is true, so the CAS from 49 to 50 succeeds and a fresh SlotHold is returned.',
        'Only on that successful hold does the promoter call waitlist.removeHead() and "notify" cust-777 (a console line here; a push notification in production) that a delivery slot is being held for them - if the head entry\'s address had picked up a conflicting overlapping slot in the meantime and the hold attempt threw, the promoter would leave the queue untouched for the next cancellation to retry.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'TimeSlot.java',
      rationale: 'A value object over (date, startTime, durationMinutes) with equals/hashCode so it is safe as part of a map key, plus an overlaps() check that address-conflict detection relies on - two slots conflict only if they share a date and their [start, end) windows intersect.',
      code: `import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Objects;

public final class TimeSlot {
    private final LocalDate date;
    private final LocalTime startTime;
    private final int durationMinutes;

    public TimeSlot(LocalDate date, LocalTime startTime, int durationMinutes) {
        this.date = date;
        this.startTime = startTime;
        this.durationMinutes = durationMinutes;
    }

    public LocalDate getDate() { return date; }
    public LocalTime getStartTime() { return startTime; }
    public LocalTime getEndTime() { return startTime.plusMinutes(durationMinutes); }

    /** Two slots conflict only if they fall on the same date and their [start, end) windows intersect. */
    public boolean overlaps(TimeSlot other) {
        if (!date.equals(other.date)) {
            return false;
        }
        return startTime.isBefore(other.getEndTime()) && other.startTime.isBefore(getEndTime());
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TimeSlot)) return false;
        TimeSlot other = (TimeSlot) o;
        return durationMinutes == other.durationMinutes
                && date.equals(other.date)
                && startTime.equals(other.startTime);
    }

    @Override
    public int hashCode() {
        return Objects.hash(date, startTime, durationMinutes);
    }

    @Override
    public String toString() {
        return date + " " + startTime + "-" + getEndTime();
    }
}`,
    },
    {
      filename: 'ZoneSlotKey.java',
      rationale: 'The true unit of scarcity is not "the zone" but "the zone during this slot" - every capacity counter, hold registry, and waitlist queue is keyed on this composite so the same zone can independently track its 12-2pm and 6-8pm windows.',
      code: `import java.util.Objects;

public final class ZoneSlotKey {
    private final String zoneId;
    private final TimeSlot slot;

    public ZoneSlotKey(String zoneId, TimeSlot slot) {
        this.zoneId = zoneId;
        this.slot = slot;
    }

    public String getZoneId() { return zoneId; }
    public TimeSlot getSlot() { return slot; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ZoneSlotKey)) return false;
        ZoneSlotKey other = (ZoneSlotKey) o;
        return zoneId.equals(other.zoneId) && slot.equals(other.slot);
    }

    @Override
    public int hashCode() {
        return Objects.hash(zoneId, slot);
    }

    @Override
    public String toString() {
        return "ZoneSlotKey{" + zoneId + " @ " + slot + "}";
    }
}`,
    },
    {
      filename: 'DeliveryZone.java',
      rationale: 'Deliberately thin - a zone carries no capacity of its own. Capacity lives one level down, per (zone, slot), because the same zone can be nearly empty at noon and completely full during a dinner rush.',
      code: `public final class DeliveryZone {
    private final String zoneId;
    private final String name;

    public DeliveryZone(String zoneId, String name) {
        this.zoneId = zoneId;
        this.name = name;
    }

    public String getZoneId() { return zoneId; }
    public String getName() { return name; }

    @Override
    public String toString() {
        return "DeliveryZone{" + zoneId + " (" + name + ")}";
    }
}`,
    },
    {
      filename: 'CapacityPolicy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This is the swappable question "is there room for one more?" - not "which resource should I hand out?" like restaurant-booking\'s TableAllocationStrategy. Because every capacity unit is fungible, there is no allocation decision to make here, only an admission decision, and that difference is exactly why the interface only takes counts, never a resource reference.',
      rationale: 'Kept to a single pure method with no side effects, so it can be called from inside a CAS loop as many times as contention requires without any risk of double-counting.',
      code: `public interface CapacityPolicy {
    /** True if one more unit can be admitted given the current used count and the slot's configured max. */
    boolean canAdmitOneMore(int currentUsedCount, int maxCapacity);
}`,
    },
    {
      filename: 'StrictCapacityPolicy.java',
      rationale: 'The default: never admit past the configured hard cap. Used for zones where exceeding capacity would blow a delivery-fleet SLA (not enough riders to cover the window).',
      code: `public final class StrictCapacityPolicy implements CapacityPolicy {
    @Override
    public boolean canAdmitOneMore(int currentUsedCount, int maxCapacity) {
        return currentUsedCount < maxCapacity;
    }
}`,
    },
    {
      filename: 'BufferedCapacityPolicy.java',
      rationale: 'Deliberately admits slightly past the "true" max - historical data shows a predictable fraction of orders cancel or fail payment before confirmation, so a modest overbook keeps rider utilization high without the risk of a hard block on every borderline slot.',
      code: `public final class BufferedCapacityPolicy implements CapacityPolicy {
    private final double overbookFactor;

    /** overbookFactor > 1.0 permits admitting past maxCapacity, e.g. 1.10 for a 10% buffer. */
    public BufferedCapacityPolicy(double overbookFactor) {
        this.overbookFactor = overbookFactor;
    }

    @Override
    public boolean canAdmitOneMore(int currentUsedCount, int maxCapacity) {
        int effectiveCapacity = (int) Math.floor(maxCapacity * overbookFactor);
        return currentUsedCount < effectiveCapacity;
    }
}`,
    },
    {
      filename: 'SlotCapacityCounter.java',
      calloutTitle: '💡 CAS loop, not compute() - the counter has no identity',
      callout:
        'restaurant-booking claims a table+slot with one ConcurrentHashMap.compute() call because there is exactly one occupant to install. A slot with capacity 50 has no single occupant to swap in - so the atomic primitive here is a get()/compareAndSet() retry loop on a plain AtomicInteger, re-reading usedCount and re-checking the policy on every retry until either the CAS wins or the policy rejects the caller outright. That loop is what makes the "last remaining unit" race provably safe: only one thread\'s compareAndSet(49, 50) can ever succeed.',
      rationale: 'release() reuses the exact same policy check to compute wasFull before decrementing, so "was this slot full a moment ago" and "can one more order fit right now" are never allowed to drift into two different definitions of full.',
      code: `import java.util.concurrent.atomic.AtomicInteger;

public final class SlotCapacityCounter {
    private final int maxCapacity;
    private final CapacityPolicy policy;
    private final AtomicInteger usedCount = new AtomicInteger(0);

    public SlotCapacityCounter(int maxCapacity, CapacityPolicy policy) {
        this.maxCapacity = maxCapacity;
        this.policy = policy;
    }

    /** Atomically admits one more unit iff the policy allows it - a CAS loop, never a read-then-write. */
    public boolean tryReserve() {
        while (true) {
            int current = usedCount.get();
            if (!policy.canAdmitOneMore(current, maxCapacity)) {
                return false;
            }
            if (usedCount.compareAndSet(current, current + 1)) {
                return true;
            }
            // Another thread changed usedCount between get() and compareAndSet() - retry with a fresh read.
        }
    }

    /** Atomically releases one unit; returns true iff the slot was already full immediately beforehand. */
    public boolean release() {
        while (true) {
            int current = usedCount.get();
            if (current <= 0) {
                return false;
            }
            boolean wasFull = !policy.canAdmitOneMore(current, maxCapacity);
            if (usedCount.compareAndSet(current, current - 1)) {
                return wasFull;
            }
        }
    }

    public int getUsedCount() { return usedCount.get(); }
    public int getMaxCapacity() { return maxCapacity; }
    public int getRemainingCapacity() { return Math.max(0, maxCapacity - usedCount.get()); }
}`,
    },
    {
      filename: 'SlotHold.java',
      rationale: 'Immutable except for the passage of time, same as a table Hold - but note there is nothing here that lets anyone lazily discover "which unit" expired, because units are not individually addressable. That is precisely why the service must track holds explicitly rather than relying on a self-reporting occupant.',
      code: `import java.time.Instant;

public final class SlotHold {
    private final String holdId;
    private final String zoneId;
    private final TimeSlot slot;
    private final String customerId;
    private final String deliveryAddress;
    private final Instant expiresAt;

    public SlotHold(String holdId, String zoneId, TimeSlot slot, String customerId, String deliveryAddress, Instant expiresAt) {
        this.holdId = holdId;
        this.zoneId = zoneId;
        this.slot = slot;
        this.customerId = customerId;
        this.deliveryAddress = deliveryAddress;
        this.expiresAt = expiresAt;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public String getHoldId() { return holdId; }
    public String getZoneId() { return zoneId; }
    public TimeSlot getSlot() { return slot; }
    public String getCustomerId() { return customerId; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public Instant getExpiresAt() { return expiresAt; }
}`,
    },
    {
      filename: 'SlotHoldFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'The hold-expiry policy lives in exactly one place. A surge zone during lunch rush gets a 3-minute TTL to cycle scarce capacity fast; a quiet suburb gets 10 minutes so customers are not rushed - DeliverySlotBookingService never sees a raw Duration or Instant.now() call, so tuning TTLs per zone-type is a one-line change here.',
      rationale: 'Also owns UUID generation for holdId, keeping identity-minting out of the service class.',
      code: `import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

public final class SlotHoldFactory {
    private static final Duration DEFAULT_TTL = Duration.ofMinutes(10);
    private static final Duration SURGE_ZONE_TTL = Duration.ofMinutes(3);

    private SlotHoldFactory() {}

    public static SlotHold createHold(String zoneId, TimeSlot slot, String customerId, String deliveryAddress, boolean isSurgeZone) {
        Duration ttl = isSurgeZone ? SURGE_ZONE_TTL : DEFAULT_TTL;
        Instant now = Instant.now();
        return new SlotHold(UUID.randomUUID().toString(), zoneId, slot, customerId, deliveryAddress, now.plus(ttl));
    }
}`,
    },
    {
      filename: 'Order.java',
      rationale: 'OrderStatus is nested since no other class needs it independently of an Order. cancel() guards against a double-cancel instead of silently no-op-ing, mirroring Reservation.cancel() in restaurant-booking.',
      code: `public final class Order {

    public enum OrderStatus { CONFIRMED, CANCELLED }

    private final String orderId;
    private final String zoneId;
    private final TimeSlot slot;
    private final String customerId;
    private final String deliveryAddress;
    private OrderStatus status;

    public Order(String orderId, String zoneId, TimeSlot slot, String customerId, String deliveryAddress) {
        this.orderId = orderId;
        this.zoneId = zoneId;
        this.slot = slot;
        this.customerId = customerId;
        this.deliveryAddress = deliveryAddress;
        this.status = OrderStatus.CONFIRMED;
    }

    public void cancel() {
        if (status == OrderStatus.CANCELLED) {
            throw new IllegalStateException("Order " + orderId + " is already cancelled");
        }
        this.status = OrderStatus.CANCELLED;
    }

    public String getOrderId() { return orderId; }
    public String getZoneId() { return zoneId; }
    public TimeSlot getSlot() { return slot; }
    public String getCustomerId() { return customerId; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public OrderStatus getStatus() { return status; }
}`,
    },
    {
      filename: 'SlotWaitlist.java',
      rationale: 'WaitlistEntry is nested since it never leaves SlotWaitlist except as an opaque handle. Queues are created lazily per ZoneSlotKey so thousands of configured (zone, slot) pairs do not pre-allocate empty queues nobody ever waits on.',
      code: `import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

public final class SlotWaitlist {

    public static final class WaitlistEntry {
        private final String entryId;
        private final ZoneSlotKey key;
        private final String customerId;
        private final String deliveryAddress;

        WaitlistEntry(String entryId, ZoneSlotKey key, String customerId, String deliveryAddress) {
            this.entryId = entryId;
            this.key = key;
            this.customerId = customerId;
            this.deliveryAddress = deliveryAddress;
        }

        public String getEntryId() { return entryId; }
        public ZoneSlotKey getKey() { return key; }
        public String getCustomerId() { return customerId; }
        public String getDeliveryAddress() { return deliveryAddress; }
    }

    private final ConcurrentHashMap<ZoneSlotKey, Queue<WaitlistEntry>> queuesByKey = new ConcurrentHashMap<>();

    public WaitlistEntry join(ZoneSlotKey key, String customerId, String deliveryAddress) {
        WaitlistEntry entry = new WaitlistEntry(UUID.randomUUID().toString(), key, customerId, deliveryAddress);
        queuesByKey.computeIfAbsent(key, k -> new ConcurrentLinkedQueue<>()).add(entry);
        return entry;
    }

    public WaitlistEntry peekHead(ZoneSlotKey key) {
        Queue<WaitlistEntry> queue = queuesByKey.get(key);
        return queue == null ? null : queue.peek();
    }

    public void removeHead(ZoneSlotKey key) {
        Queue<WaitlistEntry> queue = queuesByKey.get(key);
        if (queue != null) {
            queue.poll();
        }
    }
}`,
    },
    {
      filename: 'SlotCapacityFreedObserver.java',
      rationale: 'One-method interface, deliberately unaware of SlotWaitlist - a rider-dispatch alert or an ops dashboard could implement this same interface tomorrow without the waitlist knowing.',
      code: `public interface SlotCapacityFreedObserver {
    void onCapacityFreed(ZoneSlotKey key);
}`,
    },
    {
      filename: 'WaitlistPromoter.java',
      calloutTitle: '💡 Observer Pattern',
      callout:
        'DeliverySlotBookingService has zero knowledge that a waitlist exists - it just calls onCapacityFreed() on whatever observers are registered, and only when release() reports the slot had actually been full. This promoter then reuses the *exact same* holdSlot() entry point a live customer would use, so a waitlisted order gets the identical hold-then-confirm protection (and the same address-conflict check) instead of a special-cased "instant order".',
      rationale: 'Deliberately prints to the console instead of calling a real push-notification API - production code would swap that one line, the pattern is the point here.',
      code: `public final class WaitlistPromoter implements SlotCapacityFreedObserver {
    private final DeliverySlotBookingService bookingService;
    private final SlotWaitlist waitlist;

    public WaitlistPromoter(DeliverySlotBookingService bookingService, SlotWaitlist waitlist) {
        this.bookingService = bookingService;
        this.waitlist = waitlist;
    }

    @Override
    public void onCapacityFreed(ZoneSlotKey key) {
        SlotWaitlist.WaitlistEntry head = waitlist.peekHead(key);
        if (head == null) {
            return;
        }
        try {
            SlotHold hold = bookingService.holdSlot(key.getZoneId(), key.getSlot(), head.getCustomerId(), head.getDeliveryAddress());
            waitlist.removeHead(key);
            System.out.println("[Waitlist] Auto-claimed a unit for " + head.getCustomerId()
                    + " in zone " + key.getZoneId() + " @ " + key.getSlot()
                    + " (holdId=" + hold.getHoldId() + "). Confirm before it expires!");
        } catch (SlotCapacityUnavailableException | IllegalStateException e) {
            // Freed unit got re-taken by a concurrent live booking, or the head's address picked up a
            // conflicting slot in the meantime - leave the head queued for the next cancellation to retry.
        }
    }
}`,
    },
    {
      filename: 'SlotCapacityUnavailableException.java',
      rationale: 'A checked business exception - callers must explicitly decide what to do (retry, join waitlist) rather than treating "slot is full" as an unexpected crash.',
      code: `public final class SlotCapacityUnavailableException extends Exception {
    public SlotCapacityUnavailableException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'DeliverySlotBookingService.java',
      calloutTitle: '💡 Reap-then-CAS: releasing a leaked hold exactly once',
      callout:
        'reapExpiredHolds() uses ConcurrentHashMap.computeIfPresent() on holdsById exactly like restaurant-booking uses compute() to claim a table - here it is used defensively, so that if two threads both stumble onto the same expired holdId while reaping the same ZoneSlotKey, only one of them ever sees a non-null hold to remove, and therefore only one of them ever calls counter.release(). Without that guarantee a leaked hold could be reaped twice and hand back a capacity unit that was never actually free.',
      rationale:
        'The aggregate root. It delegates "is there room" to the counter+policy, "who to tell" to the observers, and keeps its own methods focused on orchestration plus the two concurrency-critical operations: the capacity CAS and the address-conflict compute().',
      code: `import java.util.List;
import java.util.Queue;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicLong;

public final class DeliverySlotBookingService {
    private final ConcurrentHashMap<ZoneSlotKey, SlotCapacityCounter> capacityByKey = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, SlotHold> holdsById = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<ZoneSlotKey, Queue<String>> holdsByKey = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Order> ordersById = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<TimeSlot>> activeSlotsByAddress = new ConcurrentHashMap<>();
    private final java.util.Set<String> surgeZoneIds = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private final SlotWaitlist waitlist;
    private final List<SlotCapacityFreedObserver> observers = new ArrayList<>();
    private final AtomicLong orderSequence = new AtomicLong();

    public DeliverySlotBookingService(SlotWaitlist waitlist) {
        this.waitlist = waitlist;
    }

    public void registerObserver(SlotCapacityFreedObserver observer) {
        observers.add(observer);
    }

    public void markSurgeZone(String zoneId) {
        surgeZoneIds.add(zoneId);
    }

    public void registerSlotCapacity(String zoneId, TimeSlot slot, int maxCapacity, CapacityPolicy policy) {
        capacityByKey.putIfAbsent(new ZoneSlotKey(zoneId, slot), new SlotCapacityCounter(maxCapacity, policy));
    }

    public SlotHold holdSlot(String zoneId, TimeSlot slot, String customerId, String deliveryAddress)
            throws SlotCapacityUnavailableException {
        ZoneSlotKey key = new ZoneSlotKey(zoneId, slot);
        SlotCapacityCounter counter = capacityByKey.get(key);
        if (counter == null) {
            throw new SlotCapacityUnavailableException("Zone/slot not configured: " + key);
        }
        if (!tryReserveAddress(deliveryAddress, slot)) {
            throw new IllegalStateException("Address " + deliveryAddress + " already has an overlapping delivery slot");
        }
        if (!counter.tryReserve()) {
            reapExpiredHolds(key, counter);
            if (!counter.tryReserve()) {
                releaseAddress(deliveryAddress, slot);
                throw new SlotCapacityUnavailableException("No capacity left for " + key);
            }
        }
        SlotHold hold = SlotHoldFactory.createHold(zoneId, slot, customerId, deliveryAddress, surgeZoneIds.contains(zoneId));
        holdsById.put(hold.getHoldId(), hold);
        holdsByKey.computeIfAbsent(key, k -> new ConcurrentLinkedQueue<>()).add(hold.getHoldId());
        return hold;
    }

    public Order confirmHold(String holdId) throws SlotCapacityUnavailableException {
        SlotHold hold = holdsById.get(holdId);
        if (hold == null) {
            throw new SlotCapacityUnavailableException("Unknown or already-resolved hold: " + holdId);
        }
        if (hold.isExpired()) {
            holdsById.remove(holdId);
            ZoneSlotKey key = new ZoneSlotKey(hold.getZoneId(), hold.getSlot());
            capacityByKey.get(key).release();
            releaseAddress(hold.getDeliveryAddress(), hold.getSlot());
            throw new SlotCapacityUnavailableException("Hold " + holdId + " expired before confirmation");
        }
        holdsById.remove(holdId);
        Order order = new Order(
                "ORD-" + orderSequence.incrementAndGet(), hold.getZoneId(), hold.getSlot(), hold.getCustomerId(), hold.getDeliveryAddress());
        ordersById.put(order.getOrderId(), order);
        return order;
    }

    public void cancelOrder(String orderId) {
        Order order = ordersById.remove(orderId);
        if (order == null) {
            throw new IllegalArgumentException("Unknown order: " + orderId);
        }
        order.cancel();
        ZoneSlotKey key = new ZoneSlotKey(order.getZoneId(), order.getSlot());
        boolean wasFull = capacityByKey.get(key).release();
        releaseAddress(order.getDeliveryAddress(), order.getSlot());
        if (wasFull) {
            observers.forEach(o -> o.onCapacityFreed(key));
        }
    }

    public SlotWaitlist.WaitlistEntry joinWaitlist(String zoneId, TimeSlot slot, String customerId, String deliveryAddress) {
        return waitlist.join(new ZoneSlotKey(zoneId, slot), customerId, deliveryAddress);
    }

    /** Reclaims capacity units held by abandoned checkouts for this ZoneSlotKey before giving up on tryReserve(). */
    private void reapExpiredHolds(ZoneSlotKey key, SlotCapacityCounter counter) {
        Queue<String> holdIds = holdsByKey.get(key);
        if (holdIds == null) {
            return;
        }
        for (String holdId : holdIds) {
            SlotHold[] reaped = { null };
            holdsById.computeIfPresent(holdId, (id, existingHold) -> {
                if (existingHold.isExpired()) {
                    reaped[0] = existingHold;
                    return null; // removes it from holdsById atomically for exactly one caller
                }
                return existingHold;
            });
            if (reaped[0] != null) {
                counter.release();
                releaseAddress(reaped[0].getDeliveryAddress(), reaped[0].getSlot());
            }
        }
        holdIds.removeIf(id -> !holdsById.containsKey(id));
    }

    private boolean tryReserveAddress(String address, TimeSlot slot) {
        boolean[] reserved = { false };
        activeSlotsByAddress.compute(address, (addr, existing) -> {
            List<TimeSlot> slots = existing == null ? new ArrayList<>() : existing;
            boolean overlaps = slots.stream().anyMatch(s -> s.overlaps(slot));
            if (!overlaps) {
                slots.add(slot);
                reserved[0] = true;
            }
            return slots;
        });
        return reserved[0];
    }

    private void releaseAddress(String address, TimeSlot slot) {
        if (address == null || slot == null) {
            return;
        }
        activeSlotsByAddress.computeIfPresent(address, (addr, slots) -> {
            slots.remove(slot);
            return slots.isEmpty() ? null : slots;
        });
    }

    public Map<ZoneSlotKey, SlotCapacityCounter> snapshotCapacity() {
        return Map.copyOf(capacityByKey);
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy path up to capacity, the address-conflict rejection, a fully-booked slot routing to the waitlist and then getting notified on a cancellation, and - since race-free claiming is a stated non-functional requirement - a concurrency stress test proving many threads racing for a single remaining capacity unit produce exactly one winner.',
      code: `import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public final class Demo {
    public static void main(String[] args) throws Exception {
        SlotWaitlist waitlist = new SlotWaitlist();
        DeliverySlotBookingService service = new DeliverySlotBookingService(waitlist);
        service.registerObserver(new WaitlistPromoter(service, waitlist));

        TimeSlot eveningSlot = new TimeSlot(LocalDate.of(2026, 8, 10), LocalTime.of(18, 0), 120);
        service.registerSlotCapacity("Z-DOWNTOWN", eveningSlot, 5, new StrictCapacityPolicy());

        // --- Happy path: fill 4 of 5 units ---
        List<String> holdIds = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            SlotHold hold = service.holdSlot("Z-DOWNTOWN", eveningSlot, "cust-" + i, i + " Baker St");
            holdIds.add(hold.getHoldId());
        }
        List<String> orderIds = new ArrayList<>();
        for (String holdId : holdIds) {
            orderIds.add(service.confirmHold(holdId).getOrderId());
        }
        System.out.println("Confirmed 4/5 orders for Z-DOWNTOWN 18:00-20:00");

        // --- Address conflict: same address, overlapping slot must be rejected ---
        try {
            service.holdSlot("Z-DOWNTOWN", eveningSlot, "cust-dup", "0 Baker St");
            System.out.println("Unexpected: duplicate address slot should have been rejected");
        } catch (IllegalStateException e) {
            System.out.println("Expected address-conflict rejection: " + e.getMessage());
        }

        // --- Take the 5th and last unit, then confirm the slot is genuinely full ---
        SlotHold fifthHold = service.holdSlot("Z-DOWNTOWN", eveningSlot, "cust-4", "4 Baker St");
        service.confirmHold(fifthHold.getHoldId());
        System.out.println("Slot now at 5/5");

        // --- Fully booked -> waitlist -> cancellation promotes the waitlisted customer ---
        try {
            service.holdSlot("Z-DOWNTOWN", eveningSlot, "cust-777", "44 Elm St");
            System.out.println("Unexpected: cust-777 should not have found capacity");
        } catch (SlotCapacityUnavailableException e) {
            System.out.println("Expected: " + e.getMessage());
            service.joinWaitlist("Z-DOWNTOWN", eveningSlot, "cust-777", "44 Elm St");
            System.out.println("cust-777 joined the Z-DOWNTOWN 18:00-20:00 waitlist");
        }
        service.cancelOrder(orderIds.get(0)); // frees one unit; slot was full, so this should auto-promote cust-777

        // --- Concurrency stress test: 25 threads race for the single remaining unit on a near-full slot ---
        TimeSlot lunchSlot = new TimeSlot(LocalDate.of(2026, 8, 10), LocalTime.of(12, 0), 120);
        service.registerSlotCapacity("Z-SUBURB", lunchSlot, 20, new StrictCapacityPolicy());
        for (int i = 0; i < 19; i++) {
            SlotHold hold = service.holdSlot("Z-SUBURB", lunchSlot, "warm-" + i, "warm-addr-" + i);
            service.confirmHold(hold.getHoldId());
        }
        System.out.println("Z-SUBURB 12:00-14:00 primed to 19/20 - exactly one unit left");

        ExecutorService pool = Executors.newFixedThreadPool(25);
        AtomicInteger successCount = new AtomicInteger();
        CountDownLatch done = new CountDownLatch(25);
        for (int i = 0; i < 25; i++) {
            final String customerId = "stress-customer-" + i;
            pool.submit(() -> {
                try {
                    service.holdSlot("Z-SUBURB", lunchSlot, customerId, "stress-addr-" + customerId);
                    successCount.incrementAndGet();
                } catch (SlotCapacityUnavailableException ignored) {
                    // Expected for every thread except the single winner of the last remaining unit.
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();
        System.out.println("Threads that won the last unit on Z-SUBURB @ 12:00-14:00: " + successCount.get() + " (expected 1)");
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Hold / Order Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> HELD: holdSlot() reserves one counter unit
  HELD --> CONFIRMED: confirmHold() before TTL
  HELD --> EXPIRED: TTL elapses before confirm
  EXPIRED --> RECLAIMED: reapExpiredHolds() releases the unit
  CONFIRMED --> CANCELLED: cancelOrder() releases the unit
  RECLAIMED --> [*]
  CONFIRMED --> [*]
  CANCELLED --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Cancellation Triggering Waitlist Promotion',
    mermaid: `sequenceDiagram
  autonumber
  participant Customer
  participant Service as DeliverySlotBookingService
  participant Counter as SlotCapacityCounter
  participant Waitlist as SlotWaitlist
  participant Promoter as WaitlistPromoter

  Customer->>Service: cancelOrder(orderId)
  Service->>Counter: release()
  Counter-->>Service: wasFull = true
  Service->>Promoter: onCapacityFreed(zoneSlotKey)
  Promoter->>Waitlist: peekHead(zoneSlotKey)
  Waitlist-->>Promoter: WaitlistEntry(cust-777)
  Promoter->>Service: holdSlot(zoneId, slot, cust-777, address)
  Service->>Counter: tryReserve()
  Counter-->>Service: true (CAS succeeded)
  Service-->>Promoter: SlotHold
  Promoter->>Waitlist: removeHead(zoneSlotKey)
  Promoter-->>Customer: notification - slot held, confirm before TTL`,
  },

  extensions: [
    { extension: 'Rider-capacity-aware limits', implementation: 'Feed maxCapacity per (zone, slot) from a live rider-availability forecast instead of a static config value, recomputing SlotCapacityCounter limits on a schedule rather than at zone setup time.' },
    { extension: 'Background hold sweeper', implementation: 'Add a ScheduledExecutorService that periodically walks holdsByKey for every ZoneSlotKey and proactively reaps expired holds, instead of only reclaiming them lazily the next time someone contends for that same slot.' },
    { extension: 'Priority waitlist for subscription customers', implementation: 'Swap the ConcurrentLinkedQueue inside SlotWaitlist for a PriorityBlockingQueue ordered by subscription tier and join time, behind the same SlotWaitlist API.' },
    { extension: 'Cross-zone address conflict at the building level', implementation: 'Normalize deliveryAddress to a canonical building/geo id before indexing activeSlotsByAddress, so two orders to different unit numbers in the same apartment complex still conflict if that is the desired business rule.' },
    { extension: 'Dynamic surge pricing tied to remaining capacity', implementation: 'Read counter.getRemainingCapacity() at quote time and apply a pricing decorator once remaining capacity drops below a threshold, mirroring how a pricing decorator wraps a PricingStrategy in the parking-lot design.' },
    { extension: 'Partial-day capacity re-balancing', implementation: 'Allow an ops tool to atomically raise or lower maxCapacity on an existing SlotCapacityCounter mid-day (e.g. a rider calling in sick), guarding the resize itself with the same CAS-loop discipline so it never races an in-flight tryReserve().' },
  ],

  interviewerChecklist: [
    'Is the capacity claim a genuine atomic CAS loop on a counter, or did the candidate do a check-then-act (get usedCount, compare, then a separate increment) that races on the last remaining unit?',
    'Does the candidate model the resource as a per-(zone, slot) counter rather than reusing an identity-based "claim one object" pattern that does not fit an N-capacity slot?',
    'Is hold expiry actually reclaimed somewhere (even lazily, on next contention) - and does the candidate recognize that a counter has no per-unit identity, so expiry cannot be discovered the same way an identity-based Hold\'s isExpired() would be?',
    'Is the waitlist scoped per (zone, slot), and is promotion gated on the slot having actually been full (not fired on every routine cancellation)?',
    'Is address-conflict detection treated as its own atomic check rather than a plain get()-then-add() on a shared list?',
    'Can the admission rule (hard cap vs. buffered overbooking) change without touching the hold/confirm/cancel orchestration code?',
  ],

  relatedDesigns: ['restaurant-booking', 'parking-lot', 'order-management'],
  keyTakeaways: [
    'When a resource has capacity N > 1 instead of exactly 1, the atomic primitive shifts from "claim this one object" (compute() on a map) to "advance this counter" (a CAS loop on an AtomicInteger) - same atomicity guarantee, different mechanism, because there is no single occupant identity to swap.',
    'A composite key (zone + time slot) is still what makes each counter independently scarce, exactly as (table + time slot) does in restaurant-booking - the difference is what sits behind the key, not whether a composite key is needed at all.',
    'Gate observer notifications on a genuine state transition (full -> not full), not on every mutation - with capacity 1 those are the same event, but at capacity 50 they are not, and conflating them wakes a waitlist promoter 49 times for nothing.',
    'Anything without a stable identity (a fungible capacity unit) cannot be lazily expired the way an identity-bound object can; it needs an explicit registry (holdsById/holdsByKey here) that gets reaped on demand, guarded by the same map-level atomicity used everywhere else.',
  ],
}

export default problem

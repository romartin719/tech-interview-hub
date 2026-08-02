import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'restaurant-booking',
  title: 'Restaurant Booking',
  difficulty: 'Advanced',
  icon: 'pi pi-calendar',
  color: '#14b8a6',
  readTimeMinutes: 19,
  patterns: ['Strategy', 'Observer', 'Factory Method', 'State'],
  companies: ['OpenTable', 'Resy', 'Zomato', 'Yelp', 'Toast'],
  summary:
    'A restaurant table-booking system that matches party size to the right table for a requested time slot, protects a table with a short-lived hold while the customer finishes booking, and runs a per-slot waitlist that gets notified the moment a matching table frees up - all without ever double-booking a table for the same slot.',

  functionalRequirements: [
    'Model a fixed set of tables of varying capacity, and discretize a service day into fixed-length time slots (e.g. 30 or 60 minutes) per table.',
    'Given a party size and a requested slot, find a table that fits using a pluggable allocation strategy (e.g. smallest table that fits, or first available regardless of waste).',
    'Place a short-lived HOLD on the chosen table+slot while the customer finishes the booking flow (contact info, payment); the hold must expire on its own if never confirmed, releasing the table back to the pool.',
    'Confirm a hold into a permanent Reservation before it expires; a confirmed reservation keeps the table+slot occupied until it is cancelled or the party is seated.',
    'Support cancelling a reservation, freeing the table+slot immediately for others.',
    'When a requested slot has no table that fits, let the customer join a per-slot waitlist and get notified automatically the next time a matching table frees up (via cancellation or hold expiry).',
  ],
  nonFunctionalRequirements: [
    'Claiming a table+slot must be race-free: two customers hitting "book" at the same instant for the same table+slot must never both succeed.',
    'A single scarce resource is really (table, slot) - the data model must key on that pair, not the table alone, so the same table can be booked for 7pm and 9pm independently.',
    'Adding a new allocation strategy or a new waitlist notification channel must not require touching the core hold/confirm/cancel flow (open/closed principle).',
  ],

  coreEntities: [
    { name: 'Table', description: 'A physical table - an id and a seating capacity. Capacity never changes once the restaurant is configured.' },
    { name: 'TimeSlot', description: 'A discretized booking window (date, start time, duration) - the other half of the resource being reserved, alongside the table.' },
    { name: 'TableSlotKey', description: 'Composite key (tableId + TimeSlot) used everywhere occupancy is checked or claimed - the true unit of scarcity in this system.' },
    { name: 'Hold', description: 'A provisional, time-boxed claim on a TableSlotKey created while a customer is completing their booking; carries an expiry timestamp.' },
    { name: 'Reservation', description: 'A confirmed booking - what a Hold becomes once the customer finishes in time. Tracks its own status (CONFIRMED / SEATED / CANCELLED).' },
    { name: 'TableAllocationStrategy', description: 'Interface for choosing which free table to offer a party of a given size - the interchangeable "which table wins" policy.' },
    { name: 'WaitlistEntry / Waitlist', description: 'A customer waiting for a specific TimeSlot, queued per-slot so a rush on one seating never blocks another.' },
    { name: 'TableFreedObserver', description: 'Interface notified whenever a TableSlotKey becomes free again (cancellation or lazy expiry) - the waitlist notifier is one implementation.' },
    { name: 'RestaurantBookingService', description: 'The aggregate root - owns all tables, the occupancy map, the allocation strategy, and the waitlist; orchestrates hold/confirm/cancel.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Table {
    -String id
    -int capacity
    +getCapacity() int
  }
  class TimeSlot {
    -LocalDate date
    -LocalTime startTime
    -int durationMinutes
    +equals(Object) boolean
    +hashCode() int
  }
  class TableSlotKey {
    -String tableId
    -TimeSlot slot
    +equals(Object) boolean
    +hashCode() int
  }
  class SlotOccupant {
    <<interface>>
    +isExpired() boolean
  }
  class Hold {
    -String holdId
    -Table table
    -TimeSlot slot
    -String customerId
    -Instant expiresAt
    +isExpired() boolean
  }
  class HoldFactory {
    +createHold(Table, TimeSlot, String) Hold
  }
  class ReservationStatus {
    <<enumeration>>
    CONFIRMED
    SEATED
    CANCELLED
  }
  class Reservation {
    -String reservationId
    -Table table
    -TimeSlot slot
    -String customerId
    -ReservationStatus status
    +seat() void
    +cancel() void
    +isExpired() boolean
  }
  class TableAllocationStrategy {
    <<interface>>
    +findTable(int, Predicate~Table~) Optional~Table~
  }
  class BestFitAllocationStrategy {
    -NavigableMap~Integer, List~Table~~ tablesByCapacity
    +findTable(int, Predicate~Table~) Optional~Table~
  }
  class FirstAvailableAllocationStrategy {
    -List~Table~ tables
    +findTable(int, Predicate~Table~) Optional~Table~
  }
  class WaitlistEntry {
    -String entryId
    -TimeSlot slot
    -int partySize
    -String customerId
  }
  class Waitlist {
    -Map~TimeSlot, Queue~WaitlistEntry~~ queuesBySlot
    +join(TimeSlot, int, String) WaitlistEntry
    +peekHead(TimeSlot) WaitlistEntry
    +removeHead(TimeSlot) void
  }
  class TableFreedObserver {
    <<interface>>
    +onTableFreed(TimeSlot) void
  }
  class NotifyOnFreeSlotObserver {
    +onTableFreed(TimeSlot) void
  }
  class TableUnavailableException
  class RestaurantBookingService {
    -List~Table~ tables
    -ConcurrentHashMap~TableSlotKey, SlotOccupant~ slotOccupancy
    -ConcurrentHashMap~String, Reservation~ reservationsById
    -TableAllocationStrategy allocationStrategy
    -Waitlist waitlist
    -List~TableFreedObserver~ observers
    +holdTable(TimeSlot, int, String) Hold
    +confirmHold(Hold) Reservation
    +cancelReservation(String) void
    +joinWaitlist(TimeSlot, int, String) WaitlistEntry
  }

  SlotOccupant <|.. Hold
  SlotOccupant <|.. Reservation
  Reservation --> ReservationStatus
  TableAllocationStrategy <|.. BestFitAllocationStrategy
  TableAllocationStrategy <|.. FirstAvailableAllocationStrategy
  TableFreedObserver <|.. NotifyOnFreeSlotObserver
  Hold ..> HoldFactory : created by
  Hold o-- Table
  Hold o-- TimeSlot
  Reservation o-- Table
  Reservation o-- TimeSlot
  Waitlist o-- WaitlistEntry
  RestaurantBookingService o-- Table
  RestaurantBookingService o-- TableAllocationStrategy
  RestaurantBookingService o-- Waitlist
  RestaurantBookingService o-- TableFreedObserver
  RestaurantBookingService ..> TableSlotKey : keys occupancy by
  RestaurantBookingService ..> TableUnavailableException : throws`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'TableAllocationStrategy + BestFitAllocationStrategy / FirstAvailableAllocationStrategy', why: 'Which free table wins for a given party size is a swappable policy - best-fit minimizes wasted seats, first-available minimizes lookup latency - and holdTable() never branches on which one is active.' },
    { pattern: 'Observer', where: 'TableFreedObserver / NotifyOnFreeSlotObserver', why: 'The core booking flow fires "a table just freed up for this slot" without knowing a waitlist exists - swapping console output for a real SMS/push notifier means writing a new observer, not touching RestaurantBookingService.' },
    { pattern: 'Factory Method', where: 'HoldFactory.createHold()', why: 'Centralizes the hold-expiry policy (the TTL) in one place - a VIP grace period or a shorter TTL during a dinner rush is a one-line change here, not a hunt through every call site that builds a Hold.' },
    { pattern: 'State', where: 'ReservationStatus enum + Reservation.seat()/cancel() guarded transitions', why: 'Encodes the legal lifecycle (CONFIRMED -> SEATED, CONFIRMED -> CANCELLED) directly on the entity so seating an already-cancelled reservation fails loudly instead of silently corrupting the occupancy map.' },
  ],

  dataStructures: [
    { component: 'Table+slot occupancy', structure: 'ConcurrentHashMap<TableSlotKey, SlotOccupant>, claimed via compute()', why: 'compute() on a single key is atomic per bucket - it is the map equivalent of AtomicBoolean.compareAndSet(): exactly one caller ever installs a fresh Hold for a given (table, slot), with no explicit lock.' },
    { component: 'Tables indexed by capacity', structure: 'NavigableMap<Integer, List<Table>> (TreeMap) keyed by exact capacity', why: 'BestFitAllocationStrategy calls tailMap(partySize) to jump straight to capacities >= the party size in O(log n) instead of scanning every table in the restaurant regardless of size, then returns the first that is actually free for the slot.' },
    { component: 'Per-slot waitlist', structure: 'ConcurrentHashMap<TimeSlot, ConcurrentLinkedQueue<WaitlistEntry>>', why: 'Each TimeSlot gets its own FIFO queue - O(1) enqueue/dequeue, and a stampede on the 7pm slot never blocks or reorders the 9pm waitlist.' },
    { component: 'Reservations by id', structure: 'ConcurrentHashMap<String, Reservation>', why: 'O(1) lookup for cancel/seat calls that only carry a reservation id, without scanning the occupancy map for a matching value.' },
  ],

  walkthroughs: [
    {
      title: 'Hold -> Confirm Flow (happy-path booking)',
      steps: [
        'Customer requests a table for a party of 4 at the 19:00 slot; RestaurantBookingService.holdTable() delegates the "which table" decision to the configured TableAllocationStrategy.',
        'BestFitAllocationStrategy calls tablesByCapacity.tailMap(4) and walks capacities ascending, testing each candidate against a Predicate<Table> backed by slotOccupancy - it returns table T-6 (capacity 4) instead of T-12 (capacity 8), which was also free but would waste four seats.',
        'holdTable() atomically claims TableSlotKey(T-6, 19:00) via slotOccupancy.compute(): if the entry is absent or the existing occupant is expired, a fresh Hold from HoldFactory (5-minute TTL) is installed and returned; if another thread already installed a live Hold or Reservation there, this call loses and retries the whole search.',
        "The Hold (holdId, table, slot, expiresAt) is handed back to the customer's app, which starts a 5-minute countdown for finishing the booking form.",
        'Customer submits contact details within the TTL; confirmHold(hold) re-checks that the exact same holdId still occupies that key and has not expired, then atomically replaces it with a new CONFIRMED Reservation under the same TableSlotKey - the table stays occupied for that slot, now permanently instead of provisionally.',
        'The Reservation is indexed in reservationsById for O(1) lookup, and a confirmation is returned to the customer.',
      ],
    },
    {
      title: 'Fully Booked -> Waitlist -> Notified Flow',
      steps: [
        'A different customer requests a party of 2 at the same 19:00 slot, but every table with capacity >= 2 is already HELD or CONFIRMED for that slot - findTable() returns empty and holdTable() throws TableUnavailableException.',
        'The app catches that and calls joinWaitlist(19:00, 2, customerId); Waitlist.join() enqueues a WaitlistEntry onto the ConcurrentLinkedQueue kept specifically for the 19:00 TimeSlot.',
        'Ten minutes later, a different party at 19:00 calls cancelReservation(); the Reservation is removed from reservationsById, its TableSlotKey entry is cleared from slotOccupancy, and every registered TableFreedObserver.onTableFreed(19:00) is invoked.',
        "NotifyOnFreeSlotObserver peeks the head of the 19:00 waitlist queue and calls RestaurantBookingService.holdTable() on that waitlisted customer's behalf, using the exact same allocation strategy that live customers use.",
        'Only on a successful hold does the observer remove that entry from the queue and "notify" the customer (a console line here; an SMS/push in production) that a table is being held for them under the usual TTL.',
        "If the head entry still does not fit any currently free table (e.g. a party of 8 waiting while only a freed 2-top exists), the observer leaves the queue untouched so that same entry gets another chance at the next cancellation or expiry.",
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Table.java',
      rationale: 'A plain immutable value object - capacity is fixed at restaurant setup time, so nothing about a Table itself ever needs to change after construction.',
      code: `public final class Table {
    private final String id;
    private final int capacity;

    public Table(String id, int capacity) {
        this.id = id;
        this.capacity = capacity;
    }

    public String getId() { return id; }
    public int getCapacity() { return capacity; }

    @Override
    public String toString() {
        return "Table{" + id + ", cap=" + capacity + "}";
    }
}`,
    },
    {
      filename: 'TimeSlot.java',
      rationale: 'A value object over (date, startTime, durationMinutes) with equals/hashCode so it can be used safely as part of a map key - two TimeSlot instances describing the same window must compare equal.',
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
    public int getDurationMinutes() { return durationMinutes; }

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
        return date + " " + startTime + " (" + durationMinutes + "m)";
    }
}`,
    },
    {
      filename: 'TableSlotKey.java',
      rationale: 'The true unit of scarcity is not "the table" but "the table during this slot" - keying the occupancy map on this composite is what lets the same table be booked for 7pm and 9pm independently.',
      code: `import java.util.Objects;

public final class TableSlotKey {
    private final String tableId;
    private final TimeSlot slot;

    public TableSlotKey(String tableId, TimeSlot slot) {
        this.tableId = tableId;
        this.slot = slot;
    }

    public String getTableId() { return tableId; }
    public TimeSlot getSlot() { return slot; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TableSlotKey)) return false;
        TableSlotKey other = (TableSlotKey) o;
        return tableId.equals(other.tableId) && slot.equals(other.slot);
    }

    @Override
    public int hashCode() {
        return Objects.hash(tableId, slot);
    }

    @Override
    public String toString() {
        return "TableSlotKey{" + tableId + " @ " + slot + "}";
    }
}`,
    },
    {
      filename: 'SlotOccupant.java',
      rationale: 'Both a provisional Hold and a confirmed Reservation can occupy a TableSlotKey - this single-method interface is what lets the occupancy map treat them uniformly when deciding "is this key actually free right now?"',
      code: `public interface SlotOccupant {
    /** True once this occupant no longer blocks the table+slot (expired hold, or cancelled reservation). */
    boolean isExpired();
}`,
    },
    {
      filename: 'Hold.java',
      rationale: 'Immutable except for the passage of time - isExpired() is computed from a fixed expiresAt rather than mutated by some background job, so it is always correct even if no sweeper ever runs.',
      code: `import java.time.Instant;

public final class Hold implements SlotOccupant {
    private final String holdId;
    private final Table table;
    private final TimeSlot slot;
    private final String customerId;
    private final Instant createdAt;
    private final Instant expiresAt;

    public Hold(String holdId, Table table, TimeSlot slot, String customerId, Instant createdAt, Instant expiresAt) {
        this.holdId = holdId;
        this.table = table;
        this.slot = slot;
        this.customerId = customerId;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    @Override
    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public String getHoldId() { return holdId; }
    public Table getTable() { return table; }
    public TimeSlot getSlot() { return slot; }
    public String getCustomerId() { return customerId; }
    public Instant getExpiresAt() { return expiresAt; }
}`,
    },
    {
      filename: 'HoldFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'The hold-expiry policy (5 minutes, by default) lives in exactly one place. If dinner-rush Fridays need a 2-minute TTL, or VIP loyalty members get 10 minutes, only this factory changes - RestaurantBookingService never sees a raw Duration or Instant.now() call.',
      rationale: 'Also owns UUID generation for holdId, keeping identity-minting out of the service class.',
      code: `import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

public final class HoldFactory {
    private static final Duration DEFAULT_TTL = Duration.ofMinutes(5);

    private HoldFactory() {}

    public static Hold createHold(Table table, TimeSlot slot, String customerId) {
        return createHold(table, slot, customerId, DEFAULT_TTL);
    }

    public static Hold createHold(Table table, TimeSlot slot, String customerId, Duration ttl) {
        Instant now = Instant.now();
        return new Hold(UUID.randomUUID().toString(), table, slot, customerId, now, now.plus(ttl));
    }
}`,
    },
    {
      filename: 'Reservation.java',
      rationale:
        'ReservationStatus is nested here rather than a top-level enum because no other class ever needs it independently of a Reservation. seat()/cancel() guard against illegal transitions instead of silently no-op-ing on a bad call.',
      code: `public final class Reservation implements SlotOccupant {

    public enum ReservationStatus { CONFIRMED, SEATED, CANCELLED }

    private final String reservationId;
    private final Table table;
    private final TimeSlot slot;
    private final String customerId;
    private ReservationStatus status;

    public Reservation(String reservationId, Table table, TimeSlot slot, String customerId) {
        this.reservationId = reservationId;
        this.table = table;
        this.slot = slot;
        this.customerId = customerId;
        this.status = ReservationStatus.CONFIRMED;
    }

    public void seat() {
        if (status != ReservationStatus.CONFIRMED) {
            throw new IllegalStateException("Cannot seat a reservation in state " + status);
        }
        this.status = ReservationStatus.SEATED;
    }

    public void cancel() {
        if (status == ReservationStatus.CANCELLED) {
            throw new IllegalStateException("Reservation " + reservationId + " is already cancelled");
        }
        this.status = ReservationStatus.CANCELLED;
    }

    @Override
    public boolean isExpired() {
        // A cancelled reservation no longer occupies its table+slot; SEATED and CONFIRMED still do.
        return status == ReservationStatus.CANCELLED;
    }

    public String getReservationId() { return reservationId; }
    public Table getTable() { return table; }
    public TimeSlot getSlot() { return slot; }
    public String getCustomerId() { return customerId; }
    public ReservationStatus getStatus() { return status; }
}`,
    },
    {
      filename: 'TableAllocationStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This one interface is why holdTable() never contains an if/else on "which allocation policy is active". The predicate parameter is the key design choice: the strategy decides table order and fit, but the service (not the strategy) owns the source of truth for what counts as "free".',
      rationale: 'Kept to a single method, taking a Predicate<Table> so implementations never need direct access to the occupancy map or any locking concern.',
      code: `import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

public interface TableAllocationStrategy {
    Optional<Table> findTable(int partySize, Predicate<Table> isFreeForSlot);
}`,
    },
    {
      filename: 'BestFitAllocationStrategy.java',
      rationale: 'Minimizes wasted seats: among tables big enough for the party, it always offers the smallest one that is actually free, using the capacity-sorted TreeMap so it never has to sort at request time.',
      code: `import java.util.*;
import java.util.function.Predicate;

public final class BestFitAllocationStrategy implements TableAllocationStrategy {
    private final NavigableMap<Integer, List<Table>> tablesByCapacity;

    public BestFitAllocationStrategy(List<Table> tables) {
        this.tablesByCapacity = new TreeMap<>();
        for (Table table : tables) {
            tablesByCapacity.computeIfAbsent(table.getCapacity(), k -> new ArrayList<>()).add(table);
        }
    }

    @Override
    public Optional<Table> findTable(int partySize, Predicate<Table> isFreeForSlot) {
        for (List<Table> bucket : tablesByCapacity.tailMap(partySize, true).values()) {
            for (Table table : bucket) {
                if (isFreeForSlot.test(table)) {
                    return Optional.of(table);
                }
            }
        }
        return Optional.empty();
    }
}`,
    },
    {
      filename: 'FirstAvailableAllocationStrategy.java',
      rationale: 'Optimizes for lookup speed over seat efficiency - useful for a fast-casual spot that would rather seat a party of 2 at a free 6-top immediately than make them wait for a 2-top to turn over.',
      code: `import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

public final class FirstAvailableAllocationStrategy implements TableAllocationStrategy {
    private final List<Table> tables;

    public FirstAvailableAllocationStrategy(List<Table> tables) {
        this.tables = tables;
    }

    @Override
    public Optional<Table> findTable(int partySize, Predicate<Table> isFreeForSlot) {
        for (Table table : tables) {
            if (table.getCapacity() >= partySize && isFreeForSlot.test(table)) {
                return Optional.of(table);
            }
        }
        return Optional.empty();
    }
}`,
    },
    {
      filename: 'Waitlist.java',
      rationale: 'WaitlistEntry is nested since it never leaves Waitlist except as an opaque handle. Queues are created lazily per TimeSlot so a restaurant with hundreds of slots does not pre-allocate empty queues for slots nobody has waited on.',
      code: `import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

public final class Waitlist {

    public static final class WaitlistEntry {
        private final String entryId;
        private final TimeSlot slot;
        private final int partySize;
        private final String customerId;

        WaitlistEntry(String entryId, TimeSlot slot, int partySize, String customerId) {
            this.entryId = entryId;
            this.slot = slot;
            this.partySize = partySize;
            this.customerId = customerId;
        }

        public String getEntryId() { return entryId; }
        public TimeSlot getSlot() { return slot; }
        public int getPartySize() { return partySize; }
        public String getCustomerId() { return customerId; }
    }

    private final ConcurrentHashMap<TimeSlot, Queue<WaitlistEntry>> queuesBySlot = new ConcurrentHashMap<>();

    public WaitlistEntry join(TimeSlot slot, int partySize, String customerId) {
        WaitlistEntry entry = new WaitlistEntry(UUID.randomUUID().toString(), slot, partySize, customerId);
        queuesBySlot.computeIfAbsent(slot, s -> new ConcurrentLinkedQueue<>()).add(entry);
        return entry;
    }

    public WaitlistEntry peekHead(TimeSlot slot) {
        Queue<WaitlistEntry> queue = queuesBySlot.get(slot);
        return queue == null ? null : queue.peek();
    }

    public void removeHead(TimeSlot slot) {
        Queue<WaitlistEntry> queue = queuesBySlot.get(slot);
        if (queue != null) {
            queue.poll();
        }
    }
}`,
    },
    {
      filename: 'TableFreedObserver.java',
      rationale: 'One-method interface, deliberately unaware of Waitlist - a metrics collector or an ops dashboard could implement this same interface tomorrow without the waitlist knowing.',
      code: `public interface TableFreedObserver {
    void onTableFreed(TimeSlot slot);
}`,
    },
    {
      filename: 'NotifyOnFreeSlotObserver.java',
      calloutTitle: '💡 Observer Pattern',
      callout:
        'RestaurantBookingService has zero knowledge that a waitlist exists - it just calls onTableFreed() on whatever observers were registered. This observer then reuses the *exact same* holdTable() entry point a live customer would use, so a waitlisted party gets the identical hold-then-confirm protection instead of a special-cased "instant reservation".',
      rationale: 'Deliberately prints to the console instead of calling a real SMS/push API - production code would swap that one line, the pattern is the point here.',
      code: `public final class NotifyOnFreeSlotObserver implements TableFreedObserver {
    private final RestaurantBookingService bookingService;
    private final Waitlist waitlist;

    public NotifyOnFreeSlotObserver(RestaurantBookingService bookingService, Waitlist waitlist) {
        this.bookingService = bookingService;
        this.waitlist = waitlist;
    }

    @Override
    public void onTableFreed(TimeSlot slot) {
        Waitlist.WaitlistEntry head = waitlist.peekHead(slot);
        if (head == null) {
            return;
        }
        try {
            Hold hold = bookingService.holdTable(head.getSlot(), head.getPartySize(), head.getCustomerId());
            waitlist.removeHead(slot);
            System.out.println("[Waitlist] Notified " + head.getCustomerId()
                    + " - table " + hold.getTable().getId() + " held for " + slot
                    + " (holdId=" + hold.getHoldId() + "). Confirm before it expires!");
        } catch (TableUnavailableException e) {
            // Head of the queue still doesn't fit any currently-free table; leave it for next time.
        }
    }
}`,
    },
    {
      filename: 'TableUnavailableException.java',
      rationale: 'A checked business exception - callers must explicitly decide what to do (retry, join waitlist) rather than treating "no table fits" as an unexpected crash.',
      code: `public final class TableUnavailableException extends Exception {
    public TableUnavailableException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'RestaurantBookingService.java',
      calloutTitle: '💡 Atomic claim via compute()',
      callout:
        'tryClaim() uses ConcurrentHashMap.compute() the same way ParkingSpot.tryOccupy() uses AtomicBoolean.compareAndSet(): the check ("is this key free or expired?") and the act ("install the new occupant") happen as one atomic step per key, so two racing threads can never both walk away thinking they hold the same table+slot.',
      rationale:
        'The aggregate root. It delegates "which table" to the strategy and "who to tell" to the observers, keeping its own methods focused purely on orchestration and the one concurrency-critical operation.',
      code: `import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

public final class RestaurantBookingService {
    private static final int MAX_CLAIM_ATTEMPTS = 5;

    private final List<Table> tables;
    private final TableAllocationStrategy allocationStrategy;
    private final Waitlist waitlist;
    private final List<TableFreedObserver> observers = new java.util.ArrayList<>();
    private final ConcurrentHashMap<TableSlotKey, SlotOccupant> slotOccupancy = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Reservation> reservationsById = new ConcurrentHashMap<>();
    private final AtomicLong reservationSequence = new AtomicLong();

    public RestaurantBookingService(List<Table> tables, TableAllocationStrategy allocationStrategy, Waitlist waitlist) {
        this.tables = tables;
        this.allocationStrategy = allocationStrategy;
        this.waitlist = waitlist;
    }

    public void registerObserver(TableFreedObserver observer) {
        observers.add(observer);
    }

    public Hold holdTable(TimeSlot slot, int partySize, String customerId) throws TableUnavailableException {
        for (int attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
            Optional<Table> candidate = allocationStrategy.findTable(partySize, table -> isFree(table, slot));
            if (candidate.isEmpty()) {
                throw new TableUnavailableException("No table fits a party of " + partySize + " at " + slot);
            }
            Table table = candidate.get();
            TableSlotKey key = new TableSlotKey(table.getId(), slot);
            Optional<Hold> hold = tryClaim(key, () -> HoldFactory.createHold(table, slot, customerId));
            if (hold.isPresent()) {
                return hold.get();
            }
            // Lost the race between "found it free" and "claimed it" - another thread won; retry the search.
        }
        throw new TableUnavailableException("Could not secure a table for party of " + partySize + " at " + slot + " under contention");
    }

    public Reservation confirmHold(Hold hold) throws TableUnavailableException {
        TableSlotKey key = new TableSlotKey(hold.getTable().getId(), hold.getSlot());
        AtomicReference<Reservation> confirmed = new AtomicReference<>();
        slotOccupancy.compute(key, (k, occupant) -> {
            if (occupant instanceof Hold currentHold
                    && currentHold.getHoldId().equals(hold.getHoldId())
                    && !currentHold.isExpired()) {
                Reservation reservation = new Reservation(
                        "R-" + reservationSequence.incrementAndGet(), hold.getTable(), hold.getSlot(), hold.getCustomerId());
                confirmed.set(reservation);
                return reservation;
            }
            return occupant;
        });
        if (confirmed.get() == null) {
            throw new TableUnavailableException("Hold " + hold.getHoldId() + " expired or was already released");
        }
        reservationsById.put(confirmed.get().getReservationId(), confirmed.get());
        return confirmed.get();
    }

    public void cancelReservation(String reservationId) {
        Reservation reservation = reservationsById.remove(reservationId);
        if (reservation == null) {
            throw new IllegalArgumentException("Unknown reservation: " + reservationId);
        }
        reservation.cancel();
        TableSlotKey key = new TableSlotKey(reservation.getTable().getId(), reservation.getSlot());
        slotOccupancy.computeIfPresent(key, (k, occupant) ->
                occupant == reservation ? null : occupant);
        observers.forEach(o -> o.onTableFreed(reservation.getSlot()));
    }

    public Waitlist.WaitlistEntry joinWaitlist(TimeSlot slot, int partySize, String customerId) {
        return waitlist.join(slot, partySize, customerId);
    }

    private boolean isFree(Table table, TimeSlot slot) {
        SlotOccupant occupant = slotOccupancy.get(new TableSlotKey(table.getId(), slot));
        return occupant == null || occupant.isExpired();
    }

    /** Atomically installs a fresh occupant if the key is absent or its current occupant has expired. */
    private Optional<Hold> tryClaim(TableSlotKey key, Supplier<Hold> holdSupplier) {
        AtomicReference<Hold> claimed = new AtomicReference<>();
        slotOccupancy.compute(key, (k, existing) -> {
            if (existing != null && !existing.isExpired()) {
                return existing; // still genuinely occupied - claim fails, leave untouched
            }
            Hold fresh = holdSupplier.get();
            claimed.set(fresh);
            return fresh;
        });
        return Optional.ofNullable(claimed.get());
    }

    public List<Table> getTables() { return tables; }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy path, hold expiry releasing a table back to the pool, a fully-booked slot routing to the waitlist and then getting notified on a cancellation, and - since race-free claiming is a stated non-functional requirement - a concurrency stress test proving two threads can never both hold the same table+slot.',
      code: `import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public final class Demo {
    public static void main(String[] args) throws Exception {
        List<Table> tables = List.of(
                new Table("T-1", 2),
                new Table("T-2", 2),
                new Table("T-6", 4),
                new Table("T-12", 8));

        Waitlist waitlist = new Waitlist();
        RestaurantBookingService service = new RestaurantBookingService(
                tables, new BestFitAllocationStrategy(tables), waitlist);
        service.registerObserver(new NotifyOnFreeSlotObserver(service, waitlist));

        TimeSlot sevenPM = new TimeSlot(LocalDate.of(2026, 8, 7), LocalTime.of(19, 0), 60);

        // --- Happy path: hold then confirm ---
        Hold holdA = service.holdTable(sevenPM, 4, "alice");
        System.out.println("Held " + holdA.getTable().getId() + " for alice (best fit, not the 8-top)");
        Reservation reservationA = service.confirmHold(holdA);
        System.out.println("Confirmed " + reservationA.getReservationId() + " for alice");

        // --- Hold expiry releases the table back to the pool ---
        Hold shortHold = HoldFactory.createHold(new Table("T-2", 2), sevenPM, "temp-bob", Duration.ofMillis(50));
        System.out.println("Short-lived hold expired already? " + shortHold.isExpired());
        Thread.sleep(100);
        System.out.println("Short-lived hold expired after wait? " + shortHold.isExpired());

        // --- Fill the remaining two-tops, then route a fully-booked request to the waitlist ---
        Hold holdB = service.holdTable(sevenPM, 2, "carol");
        Reservation reservationB = service.confirmHold(holdB);
        Hold holdC = service.holdTable(sevenPM, 2, "dave");
        service.confirmHold(holdC);
        try {
            service.holdTable(sevenPM, 2, "erin");
            System.out.println("Unexpected: erin should not have found a table");
        } catch (TableUnavailableException e) {
            System.out.println("Expected: " + e.getMessage());
            service.joinWaitlist(sevenPM, 2, "erin");
            System.out.println("erin joined the 7pm waitlist");
        }

        // Cancelling carol's reservation frees her table, which should auto-notify erin from the waitlist.
        service.cancelReservation(reservationB.getReservationId());

        // --- Concurrency stress test: 30 threads race for the single remaining free slot on T-6 at 8pm ---
        TimeSlot eightPM = new TimeSlot(LocalDate.of(2026, 8, 7), LocalTime.of(20, 0), 60);
        ExecutorService pool = Executors.newFixedThreadPool(30);
        AtomicInteger successCount = new AtomicInteger();
        CountDownLatch done = new CountDownLatch(30);
        for (int i = 0; i < 30; i++) {
            final String customerId = "stress-customer-" + i;
            pool.submit(() -> {
                try {
                    service.holdTable(eightPM, 4, customerId);
                    successCount.incrementAndGet();
                } catch (TableUnavailableException ignored) {
                    // Expected for every thread except the single winner for T-6 @ 8pm.
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();
        System.out.println("Threads that won T-6 @ 8pm: " + successCount.get() + " (expected 1)");
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Booking Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> HELD: holdTable()
  HELD --> CONFIRMED: confirmHold() before TTL
  HELD --> EXPIRED: TTL elapses before confirm
  CONFIRMED --> SEATED: seatReservation()
  CONFIRMED --> CANCELLED: cancelReservation()
  EXPIRED --> [*]
  SEATED --> [*]
  CANCELLED --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Hold then Confirm',
    mermaid: `sequenceDiagram
  autonumber
  participant Customer
  participant Service as RestaurantBookingService
  participant Strategy as TableAllocationStrategy
  participant Map as slotOccupancy

  Customer->>Service: holdTable(slot, partySize, customerId)
  Service->>Strategy: findTable(partySize, isFreeForSlot)
  Strategy-->>Service: Optional<Table>
  Service->>Map: compute(TableSlotKey) - atomic claim
  Map-->>Service: fresh Hold installed
  Service-->>Customer: Hold (holdId, expiresAt)
  Customer->>Service: confirmHold(hold)
  Service->>Map: compute(TableSlotKey) - swap Hold for Reservation
  Map-->>Service: Reservation
  Service-->>Customer: Reservation confirmed`,
  },

  extensions: [
    { extension: 'Deposit / no-show protection', implementation: 'Wrap confirmHold() with a decorator that charges a card via a payment gateway before the Hold is allowed to become a Reservation, mirroring how WeekendSurchargeDecorator wraps PricingStrategy in the parking-lot design.' },
    { extension: 'Background hold sweeper', implementation: 'Add a ScheduledExecutorService that periodically scans slotOccupancy for expired Holds and proactively fires onTableFreed(), instead of only discovering expiry lazily the next time someone searches that slot.' },
    { extension: 'Priority waitlist for loyalty tiers', implementation: 'Swap the ConcurrentLinkedQueue inside Waitlist for a PriorityBlockingQueue ordered by loyalty tier and join time, behind the same Waitlist API.' },
    { extension: 'Multi-location restaurants', implementation: 'Run one RestaurantBookingService per location, or add a restaurantId dimension to TableSlotKey if a single shared occupancy map is preferred.' },
    { extension: 'Combining adjoining tables for large parties', implementation: 'Add a CombinedTableStrategy that claims two TableSlotKeys as one unit via a two-phase compute (claim the first, and roll it back if the second fails).' },
    { extension: 'Recurring / standing reservations', implementation: 'Add a scheduler that calls holdTable() + confirmHold() for the same customer and slot every week, skipping the interactive hold-then-confirm dance entirely.' },
  ],

  interviewerChecklist: [
    'Is the hold-then-confirm two-phase flow explicit, or did the candidate jump straight to a permanent reservation with no protection against an abandoned booking form?',
    'Does claiming a table+slot use a genuine atomic operation (compute/CAS-style) rather than a check-then-act race (get() null-check followed by a separate put())?',
    'Is hold expiry handled at all - even a simple lazy check on read - or do abandoned holds permanently lock a table forever?',
    'Is the waitlist scoped per time-slot (not one global queue), and does a non-matching head entry get retried later instead of dropped?',
    'Can a new allocation strategy (combine tables, prioritize regulars) be added without touching the core hold/confirm/cancel code path?',
    'Does the candidate model the resource as (table, slot) rather than just (table), and explain why that composite key matters?',
  ],

  relatedDesigns: ['parking-lot', 'elevator-system'],
  keyTakeaways: [
    'Hold-before-confirm - a short-lived reservation-of-intent with an expiry - is the standard shape for any "temporarily lock a scarce resource while a human fills out a form" problem: table booking, seat selection, checkout carts.',
    'A composite key (resource + time slot) is what makes this genuinely different from a single-resource claim like parking-lot: the same physical table is a distinct lockable unit per slot.',
    'ConcurrentHashMap.compute() gives the same atomic check-and-set guarantee as AtomicBoolean.compareAndSet(), just keyed - it is the general-purpose tool for "claim this entry in a map without a coarse lock."',
    'Observer decouples "a table just freed up" from "who cares" - the booking core never imports Waitlist, exactly as ParkingFloor never imports DisplayBoard.',
  ],
}

export default problem

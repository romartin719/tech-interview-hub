import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'inventory-management',
  title: 'Inventory Management',
  difficulty: 'Advanced',
  icon: 'pi pi-warehouse',
  color: '#f97316',
  readTimeMinutes: 20,
  patterns: ['Strategy', 'Observer', 'Factory', 'Command'],
  companies: ['Amazon', 'Walmart', 'Flipkart', 'Shopify'],
  summary:
    'A multi-warehouse inventory system that tracks available, reserved, and committed stock per SKU, holds a temporary reservation while an order is in flight (auto-releasing it if the order times out), fires low-stock alerts to whoever is listening, and reorders using a restock policy that can vary per SKU - all without letting two concurrent orders oversell the same unit.',

  functionalRequirements: [
    'Maintain a catalog of SKUs, each stocked across one or more warehouses, with independently tracked available / reserved / committed quantities per (SKU, warehouse) pair.',
    'reserve(orderId, sku, warehouse, qty) places a temporary hold that moves qty from available to reserved, rejecting the request with a clear error if available quantity is insufficient.',
    'Every reservation is either commit()-able exactly once (order ships - moves qty from reserved to committed) or release()-able exactly once (order cancelled - moves qty back from reserved to available).',
    'A reservation that is neither committed nor released within its TTL must auto-expire and return its quantity to available without any caller having to poll for it.',
    'When available stock for a SKU/warehouse falls to or below a configurable low-stock threshold, notify every subscribed observer (e.g. a dashboard and an auto-replenishment service).',
    'Support a restock/replenishment policy that can be configured per SKU and determines how many units to reorder once a low-stock trigger fires.',
  ],
  nonFunctionalRequirements: [
    'reserve()/commit()/release() must never let two concurrent orders oversell the same unit of stock - correctness under concurrency is the core requirement, not an afterthought.',
    'Reservation expiry must not require a linear scan over every outstanding reservation - the sweeper must always find the next-to-expire reservation without scanning the rest.',
    'Adding a new restock policy or a new low-stock subscriber must not require touching ReservationService or StockLevel (open/closed).',
  ],

  coreEntities: [
    { name: 'Sku / Warehouse', description: 'Sku is a product identity carrying its own low-stock threshold and RestockPolicy; Warehouse is just a physical location id/name. Neither knows about quantities - that lives one level down.' },
    { name: 'StockLevel', description: 'The atomic unit of truth for one (SKU, warehouse) pair - tracks available, reserved, and committed quantities behind a single lock so a reserve/commit/release is one indivisible move between two counters, never a torn read.' },
    { name: 'Reservation', description: 'A time-boxed hold tied to one order - carries a quantity, an expiry timestamp, and a status that can only ever move from ACTIVE to exactly one terminal state (COMMITTED, RELEASED, or EXPIRED).' },
    { name: 'ReservationFactory', description: 'Mints Reservation objects with a fresh id and expiry timestamp, centralizing validation so ReservationService never constructs one directly.' },
    { name: 'RestockPolicy', description: 'The Strategy interface for "how many units to reorder" - FixedReorderQuantityPolicy and EconomicOrderQuantityPolicy are two interchangeable implementations of the same math.' },
    { name: 'InventoryObserver', description: 'The Observer interface for "something to do when stock gets low" - LowStockAlertService just logs, ReplenishmentService actually orders more.' },
    { name: 'StockAdjustmentCommand', description: 'The Command interface for a stock-mutating operation (ReceiveStockCommand, WriteOffStockCommand) that can be captured as an object, queued, and applied later by a dedicated consumer thread.' },
    { name: 'StockAdjustmentQueue', description: 'A single-consumer queue that applies StockAdjustmentCommands in submission order and keeps an audit log - the only path by which warehouse-side adjustments (restocks, write-offs) reach a StockLevel.' },
    { name: 'ReservationService', description: 'The aggregate root - owns every StockLevel and Reservation, runs the expiry sweeper thread, and is the only class order/checkout code ever talks to.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Warehouse {
    -String warehouseId
    -String name
  }
  class Sku {
    -String skuId
    -String name
    -int lowStockThreshold
    -RestockPolicy restockPolicy
  }
  class StockLevel {
    -StockKey key
    -int available
    -int reserved
    -int committed
    -ReentrantLock lock
    +reserve(int) void
    +commit(int) void
    +release(int) void
    +restock(int) void
    +writeOff(int) void
    +snapshot() StockSnapshot
  }
  class StockKey {
    -String skuId
    -String warehouseId
    +equals(Object) boolean
    +hashCode() int
  }
  class StockSnapshot {
    +int available
    +int reserved
    +int committed
  }
  class ReservationStatus {
    <<enumeration>>
    ACTIVE
    COMMITTED
    RELEASED
    EXPIRED
  }
  class Reservation {
    -String reservationId
    -String orderId
    -StockKey key
    -int quantity
    -Instant expiresAt
    -AtomicReference~ReservationStatus~ status
    +tryTransitionFrom(ReservationStatus) boolean
    +getDelay(TimeUnit) long
    +compareTo(Delayed) int
  }
  class ReservationFactory {
    +createReservation(String, StockKey, int, Duration) Reservation
  }
  class RestockPolicy {
    <<interface>>
    +reorderQuantity(int, int) int
  }
  class FixedReorderQuantityPolicy {
    +reorderQuantity(int, int) int
  }
  class EconomicOrderQuantityPolicy {
    +reorderQuantity(int, int) int
  }
  class InventoryObserver {
    <<interface>>
    +onLowStock(StockKey, int, int) void
  }
  class LowStockAlertService {
    +onLowStock(StockKey, int, int) void
  }
  class ReplenishmentService {
    +onLowStock(StockKey, int, int) void
  }
  class StockAdjustmentCommand {
    <<interface>>
    +apply(StockLevel) void
    +describe() String
  }
  class ReceiveStockCommand {
    +apply(StockLevel) void
  }
  class WriteOffStockCommand {
    +apply(StockLevel) void
  }
  class StockAdjustmentQueue {
    -BlockingQueue~Entry~ pending
    -List~String~ auditLog
    +submit(StockKey, StockAdjustmentCommand) void
  }
  class InsufficientStockException {
    <<exception>>
  }
  class ReservationService {
    -Map~StockKey, StockLevel~ stockLevels
    -Map~String, Reservation~ reservationsById
    -DelayQueue~Reservation~ expiryQueue
    -List~InventoryObserver~ observers
    +reserve(String, String, String, int) Reservation
    +commit(String) void
    +release(String) void
    +registerObserver(InventoryObserver) void
  }

  Sku o-- RestockPolicy
  RestockPolicy <|.. FixedReorderQuantityPolicy
  RestockPolicy <|.. EconomicOrderQuantityPolicy
  InventoryObserver <|.. LowStockAlertService
  InventoryObserver <|.. ReplenishmentService
  StockAdjustmentCommand <|.. ReceiveStockCommand
  StockAdjustmentCommand <|.. WriteOffStockCommand
  StockAdjustmentQueue ..> StockAdjustmentCommand : applies
  ReplenishmentService ..> StockAdjustmentQueue : submits
  ReplenishmentService ..> Sku : reads RestockPolicy
  StockLevel *-- StockKey
  StockLevel ..> StockSnapshot : produces
  StockLevel ..> InsufficientStockException : throws
  Reservation *-- ReservationStatus
  Reservation o-- StockKey
  ReservationService o-- StockLevel
  ReservationService o-- Reservation
  ReservationService o-- InventoryObserver
  ReservationService ..> ReservationFactory : uses
  ReservationFactory ..> Reservation : creates`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'RestockPolicy + FixedReorderQuantityPolicy / EconomicOrderQuantityPolicy', why: 'Each Sku is configured with whichever reorder formula fits it (a flat reorder quantity for a slow mover, EOQ math for a high-volume one) without ReplenishmentService or ReservationService ever branching on which SKU it is.' },
    { pattern: 'Observer', where: 'InventoryObserver / LowStockAlertService / ReplenishmentService', why: 'StockLevel and ReservationService have zero knowledge that a dashboard or an auto-replenishment service exists - they just call onLowStock() on whatever observers were registered.' },
    { pattern: 'Factory Method', where: 'ReservationFactory.createReservation()', why: 'Centralizes reservation-id minting, expiry-timestamp calculation, and quantity validation in one place so ReservationService never hand-assembles a Reservation.' },
    { pattern: 'Command', where: 'StockAdjustmentCommand + ReceiveStockCommand / WriteOffStockCommand, applied via StockAdjustmentQueue', why: 'A restock arrival or a damage write-off is captured as an object with an apply() method instead of an immediate direct call, so it can be queued, logged for audit, and applied later by one dedicated consumer thread - decoupling "something wants to adjust stock" from "when and on which thread it actually happens".' },
  ],

  dataStructures: [
    { component: 'Stock levels per (SKU, warehouse)', structure: 'ConcurrentHashMap<StockKey, StockLevel> keyed by an immutable value object with proper equals()/hashCode()', why: 'O(1) lookup by composite key; a hand-rolled Key with real equals/hashCode is what makes a HashMap-family collection behave correctly for a two-part key at all.' },
    { component: 'Concurrency guard inside StockLevel', structure: 'One ReentrantLock per StockLevel, guarding all three counters together', why: 'reserve()/commit()/release() each move quantity between two counters as one logical step (available-,reserved+ / reserved-,committed+ / reserved-,available+). A pair of independent AtomicIntegers cannot make a two-field move atomic - you would still need an outer lock to stop a reader observing available already decremented but reserved not yet incremented - so we skip the redundant CAS layer and lock directly. The lock is scoped to one (SKU, warehouse) pair, so a hot SKU never blocks reservations against an unrelated one.' },
    { component: 'Reservation TTL expiry', structure: 'DelayQueue<Reservation> ordered by expiresAt', why: 'A DelayQueue is a priority queue under the hood, so insertion is O(log n) and take() always returns the single soonest-to-expire reservation in O(1) - one sweeper thread services every outstanding reservation instead of a per-reservation timer thread or a linear scan for "what has expired".' },
    { component: 'Outstanding reservations by id', structure: 'ConcurrentHashMap<String, Reservation>', why: 'commit(reservationId) and release(reservationId) need O(1) lookup by id, independent of the DelayQueue\'s expiry ordering - the two structures index the same reservations by two different keys for two different access patterns.' },
  ],

  walkthroughs: [
    {
      title: 'Reserve -> Commit (happy-path fulfillment) with a low-stock trigger',
      steps: [
        'The order service calls ReservationService.reserve(orderId, skuId, warehouseId, qty).',
        'ReservationService resolves (or lazily creates) the StockLevel for that StockKey in its ConcurrentHashMap - O(1), no scan.',
        'StockLevel.reserve(qty) takes its lock, checks available >= qty, and moves qty from available to reserved in one lock-guarded step; if available < qty it throws InsufficientStockException before anything is mutated.',
        'ReservationFactory mints a Reservation with a fresh id and an expiresAt timestamp; ReservationService stores it in the reservations-by-id map and offers it to the DelayQueue sweeper.',
        "ReservationService reads a fresh snapshot and compares available against the SKU's lowStockThreshold - if crossed, it fans out onLowStock() to every registered InventoryObserver (LowStockAlertService logs, ReplenishmentService computes a reorder quantity via the SKU's RestockPolicy and submits a ReceiveStockCommand to the StockAdjustmentQueue).",
        'When the order later ships, the order service calls commit(reservationId); ReservationService looks it up in O(1), calls StockLevel.commit(qty) to move qty from reserved to committed, and CAS-marks the Reservation COMMITTED so the sweeper ignores it if it later pops off the DelayQueue.',
      ],
    },
    {
      title: 'Concurrent Oversell Prevention + Abandoned-Reservation Timeout',
      steps: [
        'Two order threads race to reserve the last 5 units of a SKU at the same warehouse: thread A requests 3, thread B requests 4.',
        'Both threads resolve the exact same StockLevel instance from the ConcurrentHashMap (computeIfAbsent only ever creates one), so only one of them can hold that StockLevel\'s lock at a time.',
        'Thread A acquires the lock first, sees available=5 >= 3, moves to available=2 / reserved=3, and releases the lock.',
        'Thread B acquires the lock next, sees available=2 < 4, and StockLevel.reserve() throws InsufficientStockException without touching any counter - thread B\'s order is rejected instead of silently overselling stock A already claimed.',
        "Separately, thread A's customer abandons checkout - nothing ever calls commit() or release() for thread A's Reservation, which was offered to the DelayQueue with a TTL.",
        "The sweeper thread's expiryQueue.take() blocks until that Reservation's delay elapses, pops it, calls tryTransitionFrom(EXPIRED) (a compare-and-set that only succeeds if no one already closed it), and - on success - calls StockLevel.release(3) to return the 3 units to available.",
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Warehouse.java',
      rationale: 'A plain, immutable location record. Warehouse deliberately knows nothing about stock quantities - that responsibility belongs entirely to StockLevel, keyed by (skuId, warehouseId).',
      code: `public final class Warehouse {
    private final String warehouseId;
    private final String name;

    public Warehouse(String warehouseId, String name) {
        this.warehouseId = warehouseId;
        this.name = name;
    }

    public String getWarehouseId() { return warehouseId; }
    public String getName() { return name; }
}`,
    },
    {
      filename: 'Sku.java',
      rationale: 'The RestockPolicy lives on the Sku itself, not on the warehouse or on ReplenishmentService, because "how to reorder this product" is a property of the product - two SKUs stocked in the same warehouse can use completely different reorder math with zero conditional logic anywhere else.',
      code: `public final class Sku {
    private final String skuId;
    private final String name;
    private final int lowStockThreshold;
    private final RestockPolicy restockPolicy;

    public Sku(String skuId, String name, int lowStockThreshold, RestockPolicy restockPolicy) {
        this.skuId = skuId;
        this.name = name;
        this.lowStockThreshold = lowStockThreshold;
        this.restockPolicy = restockPolicy;
    }

    public String getSkuId() { return skuId; }
    public String getName() { return name; }
    public int getLowStockThreshold() { return lowStockThreshold; }
    public RestockPolicy getRestockPolicy() { return restockPolicy; }
}`,
    },
    {
      filename: 'InsufficientStockException.java',
      rationale: 'A domain exception carrying the shortfall, not just a message string - callers (or a fallback/backorder flow) can programmatically ask "by how much did this miss?" instead of parsing text.',
      code: `public final class InsufficientStockException extends RuntimeException {
    private final int requested;
    private final int available;

    public InsufficientStockException(String skuId, String warehouseId, int requested, int available) {
        super("Cannot reserve " + requested + " unit(s) of " + skuId + " at " + warehouseId
                + " - only " + available + " available");
        this.requested = requested;
        this.available = available;
    }

    public int getShortfall() {
        return requested - available;
    }
}`,
    },
    {
      filename: 'StockLevel.java',
      calloutTitle: '💡 One lock per key, not three independent atomics',
      callout:
        'reserve()/commit()/release() each move a quantity between two of the three counters as a single unit. AtomicInteger could make any one counter\'s update lock-free, but it cannot make a two-field move atomic - you would still need an outer lock to stop a reader from ever seeing available already decremented but reserved not yet incremented. So StockLevel locks directly, once, around the whole move. The lock is scoped to this one (SKU, warehouse) pair, so a hot SKU never blocks a reservation against an unrelated one - correctness without a global lock.',
      rationale: 'The three counters (available, reserved, committed) are never exposed individually for mutation from outside - every state change goes through one of five named, intention-revealing methods, and snapshot() is the only way to read all three consistently.',
      code: `import java.util.Objects;
import java.util.concurrent.locks.ReentrantLock;

public final class StockLevel {
    private final Key key;
    private final ReentrantLock lock = new ReentrantLock();
    private int available;
    private int reserved;
    private int committed;

    public StockLevel(Key key, int initialAvailable) {
        this.key = key;
        this.available = initialAvailable;
    }

    /** Moves quantity from available -> reserved as one lock-guarded step. Throws if not enough is free. */
    public void reserve(int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be positive, got " + quantity);
        }
        lock.lock();
        try {
            if (available < quantity) {
                throw new InsufficientStockException(key.getSkuId(), key.getWarehouseId(), quantity, available);
            }
            available -= quantity;
            reserved += quantity;
        } finally {
            lock.unlock();
        }
    }

    /** Order shipped: moves quantity from reserved -> committed. */
    public void commit(int quantity) {
        lock.lock();
        try {
            reserved -= quantity;
            committed += quantity;
        } finally {
            lock.unlock();
        }
    }

    /** Order cancelled or reservation expired: moves quantity from reserved back to available. */
    public void release(int quantity) {
        lock.lock();
        try {
            reserved -= quantity;
            available += quantity;
        } finally {
            lock.unlock();
        }
    }

    /** A purchase order arrived: grows available directly. */
    public void restock(int quantity) {
        lock.lock();
        try {
            available += quantity;
        } finally {
            lock.unlock();
        }
    }

    /** Damage, loss, or a physical recount correction: shrinks available directly. */
    public void writeOff(int quantity) {
        lock.lock();
        try {
            if (available < quantity) {
                throw new InsufficientStockException(key.getSkuId(), key.getWarehouseId(), quantity, available);
            }
            available -= quantity;
        } finally {
            lock.unlock();
        }
    }

    /** A consistent point-in-time read of all three counters together - never a torn mix of old and new values. */
    public Snapshot snapshot() {
        lock.lock();
        try {
            return new Snapshot(available, reserved, committed);
        } finally {
            lock.unlock();
        }
    }

    public Key getKey() {
        return key;
    }

    public static final class Key {
        private final String skuId;
        private final String warehouseId;

        public Key(String skuId, String warehouseId) {
            this.skuId = skuId;
            this.warehouseId = warehouseId;
        }

        public String getSkuId() { return skuId; }
        public String getWarehouseId() { return warehouseId; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key)) return false;
            Key other = (Key) o;
            return skuId.equals(other.skuId) && warehouseId.equals(other.warehouseId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(skuId, warehouseId);
        }

        @Override
        public String toString() {
            return skuId + "@" + warehouseId;
        }
    }

    public static final class Snapshot {
        public final int available;
        public final int reserved;
        public final int committed;

        Snapshot(int available, int reserved, int committed) {
            this.available = available;
            this.reserved = reserved;
            this.committed = committed;
        }
    }
}`,
    },
    {
      filename: 'Reservation.java',
      calloutTitle: '💡 Exactly-once reservation closure',
      callout:
        'commit(), release(), and the expiry sweeper can all race to close the same Reservation. status is an AtomicReference and tryTransitionFrom() is a compare-and-set from ACTIVE to a target state - only one of those three code paths can ever win for a given reservation. Without this, an order that ships one millisecond after its reservation expires could have its stock released by the sweeper and then committed again by the order thread, double-counting the same units.',
      rationale: 'Implements Delayed so a plain java.util.concurrent.DelayQueue can order reservations by expiresAt with zero custom comparator plumbing.',
      code: `import java.time.Instant;
import java.util.concurrent.Delayed;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

public final class Reservation implements Delayed {

    public enum Status { ACTIVE, COMMITTED, RELEASED, EXPIRED }

    private final String reservationId;
    private final String orderId;
    private final StockLevel.Key key;
    private final int quantity;
    private final Instant expiresAt;
    private final AtomicReference<Status> status = new AtomicReference<>(Status.ACTIVE);

    public Reservation(String reservationId, String orderId, StockLevel.Key key, int quantity, Instant expiresAt) {
        this.reservationId = reservationId;
        this.orderId = orderId;
        this.key = key;
        this.quantity = quantity;
        this.expiresAt = expiresAt;
    }

    /**
     * Atomically moves this reservation from ACTIVE to {@code target}, and only from ACTIVE.
     * Returns false if commit(), release(), or the expiry sweeper already closed it, so the
     * caller never double-applies a stock movement for the same reservation.
     */
    public boolean tryTransitionFrom(Status target) {
        return status.compareAndSet(Status.ACTIVE, target);
    }

    public Status getStatus() { return status.get(); }
    public String getReservationId() { return reservationId; }
    public String getOrderId() { return orderId; }
    public StockLevel.Key getKey() { return key; }
    public int getQuantity() { return quantity; }

    @Override
    public long getDelay(TimeUnit unit) {
        long remainingMillis = expiresAt.toEpochMilli() - System.currentTimeMillis();
        return unit.convert(remainingMillis, TimeUnit.MILLISECONDS);
    }

    @Override
    public int compareTo(Delayed other) {
        return Long.compare(this.getDelay(TimeUnit.MILLISECONDS), other.getDelay(TimeUnit.MILLISECONDS));
    }

    @Override
    public String toString() {
        return reservationId + "[" + key + " x" + quantity + ", " + status.get() + "]";
    }
}`,
    },
    {
      filename: 'ReservationFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'ReservationService never calls "new Reservation(...)" itself - it goes through this factory. If reservation ids later need to be globally unique across a cluster (say, a UUID plus a shard prefix) or the TTL calculation needs to account for order priority, only this one method changes; every caller is untouched.',
      rationale: 'Validation (positive quantity, non-blank orderId) lives here once instead of being duplicated at every call site that could construct a Reservation.',
      code: `import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

public final class ReservationFactory {
    private final AtomicLong sequence = new AtomicLong();

    public Reservation createReservation(String orderId, StockLevel.Key key, int quantity, Duration ttl) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Reservation quantity must be positive, got " + quantity);
        }
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("Reservation requires a non-blank order id");
        }
        String reservationId = "RSV-" + sequence.incrementAndGet();
        Instant expiresAt = Instant.now().plus(ttl);
        return new Reservation(reservationId, orderId, key, quantity, expiresAt);
    }
}`,
    },
    {
      filename: 'RestockPolicy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'Sku holds a reference to whichever RestockPolicy it was configured with, and ReplenishmentService just calls sku.getRestockPolicy().reorderQuantity(...) - it never branches on "which formula does this SKU use". A slow-moving SKU can use a flat FixedReorderQuantityPolicy while a high-volume one uses EconomicOrderQuantityPolicy, and a brand-new policy (e.g. seasonal demand forecasting) drops in without touching ReplenishmentService, ReservationService, or Sku.',
      rationale: 'A single method keeps every implementation trivially unit-testable in isolation - pass in two ints, assert on one int back.',
      code: `public interface RestockPolicy {
    /**
     * How many units to reorder, given the current available quantity and the threshold that
     * just triggered this call. Implementations only do math here - they never touch StockLevel
     * or the adjustment queue directly.
     */
    int reorderQuantity(int currentAvailable, int lowStockThreshold);
}

final class FixedReorderQuantityPolicy implements RestockPolicy {
    private final int fixedQuantity;

    FixedReorderQuantityPolicy(int fixedQuantity) {
        if (fixedQuantity <= 0) {
            throw new IllegalArgumentException("fixedQuantity must be positive");
        }
        this.fixedQuantity = fixedQuantity;
    }

    @Override
    public int reorderQuantity(int currentAvailable, int lowStockThreshold) {
        return fixedQuantity;
    }
}

final class EconomicOrderQuantityPolicy implements RestockPolicy {
    private final double annualDemand;
    private final double orderCostPerBatch;
    private final double holdingCostPerUnitPerYear;

    EconomicOrderQuantityPolicy(double annualDemand, double orderCostPerBatch, double holdingCostPerUnitPerYear) {
        this.annualDemand = annualDemand;
        this.orderCostPerBatch = orderCostPerBatch;
        this.holdingCostPerUnitPerYear = holdingCostPerUnitPerYear;
    }

    @Override
    public int reorderQuantity(int currentAvailable, int lowStockThreshold) {
        // Classic EOQ formula: sqrt(2 * D * S / H). Deliberately ignores currentAvailable/threshold -
        // EOQ answers "what is the most cost-efficient batch size", not "how far below threshold are we".
        double economicOrderQuantity = Math.sqrt((2 * annualDemand * orderCostPerBatch) / holdingCostPerUnitPerYear);
        return Math.max(1, (int) Math.ceil(economicOrderQuantity));
    }
}`,
    },
    {
      filename: 'InventoryObserver.java',
      calloutTitle: '💡 Observer Pattern',
      callout:
        'StockLevel never imports LowStockAlertService or ReplenishmentService, and ReservationService only ever calls onLowStock() on whatever is in its observers list. Wiring in a new subscriber (an SMS alert, a Slack webhook) means writing a new InventoryObserver, not touching the reservation path at all.',
      rationale: 'A single-method interface keeps every subscriber dead simple to implement and test - it only ever needs to react, never to ask questions back.',
      code: `public interface InventoryObserver {
    void onLowStock(StockLevel.Key key, int available, int lowStockThreshold);
}

final class LowStockAlertService implements InventoryObserver {
    @Override
    public void onLowStock(StockLevel.Key key, int available, int lowStockThreshold) {
        System.out.println("[ALERT] " + key + " is low on stock: available=" + available
                + ", threshold=" + lowStockThreshold);
    }
}`,
    },
    {
      filename: 'ReplenishmentService.java',
      rationale: 'The glue between three patterns at once: it is itself an Observer subscriber, it asks the triggering SKU\'s Strategy (RestockPolicy) how much to reorder, and it hands the result to the adjustment queue as a Command - none of which ReservationService or StockLevel ever has to know about.',
      code: `import java.util.Map;

public final class ReplenishmentService implements InventoryObserver {
    private final Map<String, Sku> skuCatalog;
    private final StockAdjustmentQueue adjustmentQueue;

    public ReplenishmentService(Map<String, Sku> skuCatalog, StockAdjustmentQueue adjustmentQueue) {
        this.skuCatalog = skuCatalog;
        this.adjustmentQueue = adjustmentQueue;
    }

    @Override
    public void onLowStock(StockLevel.Key key, int available, int lowStockThreshold) {
        Sku sku = skuCatalog.get(key.getSkuId());
        if (sku == null) {
            return; // Unknown SKU - nothing sensible to reorder against.
        }
        int reorderQuantity = sku.getRestockPolicy().reorderQuantity(available, lowStockThreshold);
        System.out.println("[REPLENISH] " + key + " triggered a reorder of " + reorderQuantity
                + " units via " + sku.getRestockPolicy().getClass().getSimpleName());
        adjustmentQueue.submit(key, new ReceiveStockCommand(reorderQuantity));
    }
}`,
    },
    {
      filename: 'StockAdjustmentCommand.java',
      rationale: 'Two tiny implementations, both package-visible since only ReplenishmentService and the demo/test code ever construct them directly - callers of the queue interact purely through the StockAdjustmentCommand interface.',
      code: `public interface StockAdjustmentCommand {
    void apply(StockLevel stockLevel);
    String describe();
}

final class ReceiveStockCommand implements StockAdjustmentCommand {
    private final int quantity;

    ReceiveStockCommand(int quantity) {
        this.quantity = quantity;
    }

    @Override
    public void apply(StockLevel stockLevel) {
        stockLevel.restock(quantity);
    }

    @Override
    public String describe() {
        return "RECEIVE +" + quantity;
    }
}

final class WriteOffStockCommand implements StockAdjustmentCommand {
    private final int quantity;
    private final String reason;

    WriteOffStockCommand(int quantity, String reason) {
        this.quantity = quantity;
        this.reason = reason;
    }

    @Override
    public void apply(StockLevel stockLevel) {
        stockLevel.writeOff(quantity);
    }

    @Override
    public String describe() {
        return "WRITE_OFF -" + quantity + " (" + reason + ")";
    }
}`,
    },
    {
      filename: 'StockAdjustmentQueue.java',
      calloutTitle: '💡 Command Pattern',
      callout:
        'submit() does not apply the command - it just hands the (key, command) pair to a BlockingQueue and returns immediately. One dedicated daemon thread drains that queue and calls apply() itself, one command at a time, in submission order. That single-threaded consumer is what gives adjustments a clean audit trail and means a restock and an order\'s reserve() call are never fighting over StockLevel\'s lock from the submitter\'s thread - the caller of submit() never even blocks on it.',
      rationale: 'Holds a reference to the exact same StockLevel map ReservationService uses, so a restock applied through the queue is visible to the very next reserve() call, not a stale copy.',
      code: `import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

public final class StockAdjustmentQueue {
    private final Map<StockLevel.Key, StockLevel> stockLevels;
    private final BlockingQueue<Entry> pending = new LinkedBlockingQueue<>();
    private final List<String> auditLog = new CopyOnWriteArrayList<>();
    private volatile boolean running = true;

    public StockAdjustmentQueue(Map<StockLevel.Key, StockLevel> stockLevels) {
        this.stockLevels = stockLevels;
        Thread consumer = new Thread(this::processLoop, "stock-adjustment-consumer");
        consumer.setDaemon(true);
        consumer.start();
    }

    /** Fire-and-forget from the caller's point of view - the command runs later, on the single consumer thread. */
    public void submit(StockLevel.Key key, StockAdjustmentCommand command) {
        pending.add(new Entry(key, command));
    }

    public List<String> getAuditLog() {
        return auditLog;
    }

    public void shutdown() {
        running = false;
    }

    private void processLoop() {
        while (running) {
            try {
                Entry entry = pending.poll(200, TimeUnit.MILLISECONDS);
                if (entry == null) {
                    continue;
                }
                StockLevel level = stockLevels.get(entry.key);
                if (level == null) {
                    continue; // Adjustment for a SKU/warehouse pair that was never initialized - drop, don't crash the consumer.
                }
                entry.command.apply(level);
                auditLog.add(entry.key + " :: " + entry.command.describe());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    private static final class Entry {
        final StockLevel.Key key;
        final StockAdjustmentCommand command;

        Entry(StockLevel.Key key, StockAdjustmentCommand command) {
            this.key = key;
            this.command = command;
        }
    }
}`,
    },
    {
      filename: 'ReservationService.java',
      rationale: 'The aggregate root. It delegates counter bookkeeping to StockLevel, reservation construction to ReservationFactory, and low-stock reactions to InventoryObserver - its own methods stay focused purely on orchestration and never touch a counter directly.',
      code: `import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.DelayQueue;

public final class ReservationService {
    private final Map<String, Sku> skuCatalog;
    private final Map<StockLevel.Key, StockLevel> stockLevels = new ConcurrentHashMap<>();
    private final Map<String, Reservation> reservationsById = new ConcurrentHashMap<>();
    private final DelayQueue<Reservation> expiryQueue = new DelayQueue<>();
    private final List<InventoryObserver> observers = new CopyOnWriteArrayList<>();
    private final ReservationFactory reservationFactory = new ReservationFactory();
    private final Duration defaultTtl;

    public ReservationService(Map<String, Sku> skuCatalog, Duration defaultTtl) {
        this.skuCatalog = skuCatalog;
        this.defaultTtl = defaultTtl;
        Thread sweeper = new Thread(this::runExpirySweeper, "reservation-expiry-sweeper");
        sweeper.setDaemon(true);
        sweeper.start();
    }

    /** Setup-time only: seed a SKU/warehouse pair with its starting available quantity. */
    public void initializeStock(String skuId, String warehouseId, int initialAvailable) {
        StockLevel.Key key = new StockLevel.Key(skuId, warehouseId);
        stockLevels.putIfAbsent(key, new StockLevel(key, initialAvailable));
    }

    public void registerObserver(InventoryObserver observer) {
        observers.add(observer);
    }

    /** Live map, shared with StockAdjustmentQueue - a restock applied through the queue is instantly visible here. */
    public Map<StockLevel.Key, StockLevel> getStockLevels() {
        return stockLevels;
    }

    public StockLevel.Snapshot getSnapshot(String skuId, String warehouseId) {
        StockLevel level = stockLevels.get(new StockLevel.Key(skuId, warehouseId));
        return level == null ? null : level.snapshot();
    }

    /** Places a temporary hold on stock for an in-progress order. Throws InsufficientStockException if there isn't enough. */
    public Reservation reserve(String orderId, String skuId, String warehouseId, int quantity) {
        StockLevel.Key key = new StockLevel.Key(skuId, warehouseId);
        StockLevel level = stockLevels.computeIfAbsent(key, k -> new StockLevel(k, 0));

        level.reserve(quantity); // Throws InsufficientStockException before any Reservation object is even created.

        Reservation reservation = reservationFactory.createReservation(orderId, key, quantity, defaultTtl);
        reservationsById.put(reservation.getReservationId(), reservation);
        expiryQueue.offer(reservation);

        notifyIfLowStock(key, level);
        return reservation;
    }

    /** Order shipped: permanently converts a reservation's held quantity into committed stock. */
    public void commit(String reservationId) {
        Reservation reservation = requireReservation(reservationId);
        if (!reservation.tryTransitionFrom(Reservation.Status.COMMITTED)) {
            throw new IllegalStateException("Reservation " + reservationId + " was already closed as " + reservation.getStatus());
        }
        stockLevels.get(reservation.getKey()).commit(reservation.getQuantity());
        reservationsById.remove(reservationId);
    }

    /** Order cancelled: returns the held quantity to available stock. */
    public void release(String reservationId) {
        Reservation reservation = requireReservation(reservationId);
        if (!reservation.tryTransitionFrom(Reservation.Status.RELEASED)) {
            throw new IllegalStateException("Reservation " + reservationId + " was already closed as " + reservation.getStatus());
        }
        stockLevels.get(reservation.getKey()).release(reservation.getQuantity());
        reservationsById.remove(reservationId);
    }

    private Reservation requireReservation(String reservationId) {
        Reservation reservation = reservationsById.get(reservationId);
        if (reservation == null) {
            throw new IllegalArgumentException("Unknown or already-closed reservation: " + reservationId);
        }
        return reservation;
    }

    private void notifyIfLowStock(StockLevel.Key key, StockLevel level) {
        Sku sku = skuCatalog.get(key.getSkuId());
        if (sku == null) {
            return;
        }
        StockLevel.Snapshot snapshot = level.snapshot();
        if (snapshot.available <= sku.getLowStockThreshold()) {
            for (InventoryObserver observer : observers) {
                observer.onLowStock(key, snapshot.available, sku.getLowStockThreshold());
            }
        }
    }

    /**
     * Runs on its own daemon thread. expiryQueue.take() blocks until the single soonest-to-expire
     * reservation's delay has elapsed - one thread services every outstanding reservation, and it is
     * always looking at the correct next one because DelayQueue keeps them ordered by expiresAt.
     */
    private void runExpirySweeper() {
        while (true) {
            try {
                Reservation expired = expiryQueue.take();
                if (expired.tryTransitionFrom(Reservation.Status.EXPIRED)) {
                    StockLevel level = stockLevels.get(expired.getKey());
                    if (level != null) {
                        level.release(expired.getQuantity());
                    }
                    reservationsById.remove(expired.getReservationId());
                    System.out.println("[EXPIRE] " + expired + " timed out - released back to available.");
                }
                // else: commit() or release() already won the race for this reservation - nothing left to do.
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Walks through reserve->commit, reserve->release, a rejected over-request, an abandoned reservation that auto-expires and fans out through the Observer/Strategy/Command chain to a logged restock, a manual write-off, and - since oversell-proofing is the stated non-functional requirement - a concurrent stress test proving available + reserved never drifts from the starting stock.',
      code: `import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;

public final class Demo {
    public static void main(String[] args) throws Exception {
        Map<String, Sku> skuCatalog = new HashMap<>();
        skuCatalog.put("SKU-WIDGET", new Sku("SKU-WIDGET", "Widget", 5, new FixedReorderQuantityPolicy(50)));
        skuCatalog.put("SKU-GADGET", new Sku("SKU-GADGET", "Gadget", 10,
                new EconomicOrderQuantityPolicy(1200, 40, 2.5)));

        // Short TTL so the demo can observe a real expiry without a long sleep.
        ReservationService reservations = new ReservationService(skuCatalog, Duration.ofMillis(300));
        reservations.initializeStock("SKU-WIDGET", "WH-EAST", 8);
        reservations.initializeStock("SKU-GADGET", "WH-EAST", 100);

        StockAdjustmentQueue adjustmentQueue = new StockAdjustmentQueue(reservations.getStockLevels());
        reservations.registerObserver(new LowStockAlertService());
        reservations.registerObserver(new ReplenishmentService(skuCatalog, adjustmentQueue));

        // --- 1. Happy path: reserve then commit -------------------------------------------------
        Reservation r1 = reservations.reserve("ORDER-1", "SKU-WIDGET", "WH-EAST", 3);
        System.out.println("Reserved: " + r1 + " | " + describe(reservations, "SKU-WIDGET", "WH-EAST"));
        reservations.commit(r1.getReservationId());
        System.out.println("Committed " + r1.getReservationId() + " | " + describe(reservations, "SKU-WIDGET", "WH-EAST"));

        // --- 2. Reserve then explicitly release (customer cancels before shipping) --------------
        Reservation r2 = reservations.reserve("ORDER-2", "SKU-WIDGET", "WH-EAST", 2);
        System.out.println("Reserved: " + r2 + " | " + describe(reservations, "SKU-WIDGET", "WH-EAST"));
        reservations.release(r2.getReservationId());
        System.out.println("Released " + r2.getReservationId() + " | " + describe(reservations, "SKU-WIDGET", "WH-EAST"));

        // --- 3. Insufficient stock is rejected, not silently oversold ---------------------------
        try {
            reservations.reserve("ORDER-3", "SKU-WIDGET", "WH-EAST", 999);
        } catch (InsufficientStockException e) {
            System.out.println("Expected rejection: " + e.getMessage());
        }

        // --- 4. Abandoned reservation auto-expires, crossing the low-stock threshold on the way ---
        // available is back to 5 after steps 1-2 above; reserving 1 more drops it to 4 <= threshold(5),
        // which should fire LowStockAlertService and ReplenishmentService via the Observer chain.
        Reservation r3 = reservations.reserve("ORDER-4", "SKU-WIDGET", "WH-EAST", 1);
        System.out.println("Reserved (will be abandoned): " + r3);
        Thread.sleep(600); // Past the 300ms TTL - the sweeper should have released it back to available.
        System.out.println("After timeout, " + describe(reservations, "SKU-WIDGET", "WH-EAST") + " | status=" + r3.getStatus());
        Thread.sleep(300); // give the async StockAdjustmentQueue consumer a moment to apply the auto-reorder
        System.out.println("Adjustment audit log so far: " + adjustmentQueue.getAuditLog());

        // --- 5. Manual write-off (damage found during a cycle count on a different SKU) ---------
        adjustmentQueue.submit(new StockLevel.Key("SKU-GADGET", "WH-EAST"), new WriteOffStockCommand(2, "damaged in transit"));
        Thread.sleep(300);
        System.out.println("After write-off, " + describe(reservations, "SKU-GADGET", "WH-EAST"));
        adjustmentQueue.shutdown();

        // --- 6. Concurrency stress test: many threads hammer the same SKU/warehouse; the total
        //        reserved quantity must never exceed the starting available, no matter the interleaving.
        Map<String, Sku> stressCatalog = new HashMap<>();
        stressCatalog.put("SKU-STRESS", new Sku("SKU-STRESS", "StressItem", 0, new FixedReorderQuantityPolicy(1)));
        ReservationService stressService = new ReservationService(stressCatalog, Duration.ofSeconds(30));
        int startingStock = 100;
        stressService.initializeStock("SKU-STRESS", "WH-STRESS", startingStock);

        int threadCount = 50;
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);
        CountDownLatch done = new CountDownLatch(threadCount);
        AtomicInteger totalReserved = new AtomicInteger();
        AtomicInteger rejections = new AtomicInteger();

        for (int i = 0; i < threadCount; i++) {
            final int orderIndex = i;
            pool.submit(() -> {
                try {
                    int qty = ThreadLocalRandom.current().nextInt(1, 6); // 1-5 units per attempted order
                    try {
                        stressService.reserve("STRESS-ORDER-" + orderIndex, "SKU-STRESS", "WH-STRESS", qty);
                        totalReserved.addAndGet(qty);
                    } catch (InsufficientStockException e) {
                        rejections.incrementAndGet();
                    }
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();

        StockLevel.Snapshot stressSnapshot = stressService.getSnapshot("SKU-STRESS", "WH-STRESS");
        System.out.println("Stress test: totalReserved=" + totalReserved.get()
                + ", rejections=" + rejections.get()
                + ", available=" + stressSnapshot.available + ", reserved=" + stressSnapshot.reserved);
        boolean neverOversold = stressSnapshot.available >= 0
                && (stressSnapshot.available + stressSnapshot.reserved == startingStock);
        System.out.println("No-oversell proof (available + reserved == starting stock, available never negative): " + neverOversold);
    }

    private static String describe(ReservationService service, String skuId, String warehouseId) {
        StockLevel.Snapshot snapshot = service.getSnapshot(skuId, warehouseId);
        return "snapshot(available=" + snapshot.available + ", reserved=" + snapshot.reserved + ", committed=" + snapshot.committed + ")";
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Reservation Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> ACTIVE: reserve() succeeds
  ACTIVE --> COMMITTED: commit() wins the CAS
  ACTIVE --> RELEASED: release() wins the CAS
  ACTIVE --> EXPIRED: sweeper wins the CAS after TTL elapses
  COMMITTED --> [*]
  RELEASED --> [*]
  EXPIRED --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - reserve() with a Low-Stock Trigger',
    mermaid: `sequenceDiagram
  autonumber
  participant Order as OrderService
  participant RS as ReservationService
  participant SL as StockLevel
  participant Obs as InventoryObserver(s)
  participant Repl as ReplenishmentService
  participant Q as StockAdjustmentQueue

  Order->>RS: reserve(orderId, sku, warehouse, qty)
  RS->>SL: reserve(qty)
  alt available >= qty
    SL-->>RS: ok (available -= qty, reserved += qty)
    RS->>RS: reservationFactory.createReservation(...)
    RS->>RS: expiryQueue.offer(reservation)
    RS->>SL: snapshot()
    alt available <= lowStockThreshold
      RS->>Obs: onLowStock(key, available, threshold)
      Obs->>Repl: onLowStock(key, available, threshold)
      Repl->>Repl: sku.getRestockPolicy().reorderQuantity(...)
      Repl->>Q: submit(key, ReceiveStockCommand(qty))
    end
    RS-->>Order: Reservation
  else available < qty
    SL-->>RS: throws InsufficientStockException
    RS-->>Order: InsufficientStockException
  end`,
  },

  extensions: [
    { extension: 'Multi-warehouse fulfillment', implementation: 'reserve() tries a ranked list of warehouse keys for the same SKU and stops at the first StockLevel whose reserve() succeeds, mirroring how ParkingLot falls through floors looking for a free spot.' },
    { extension: 'Partial reservations / backorders', implementation: 'Add a BackorderReservation subtype (returned by ReservationFactory when available < requested but the caller opts in) that reserves what is on hand now and queues the shortfall to auto-fulfill off the next ReceiveStockCommand.' },
    { extension: 'Per-warehouse restock policy overrides', implementation: 'Change Sku.restockPolicy from a single field to a Map<warehouseId, RestockPolicy> with a default fallback, resolved inside ReplenishmentService instead of Sku.' },
    { extension: 'Priority-based reservation TTLs', implementation: 'Pass ttl as a parameter into reserve() instead of one service-wide default, sourced from an OrderPriority enum (e.g. VIP checkout gets a longer hold).' },
    { extension: 'Surviving a process restart', implementation: 'Back reservationsById and the DelayQueue with a write-ahead log or a database table so an in-flight reservation is not lost (and its stock permanently stuck as "reserved") if the process crashes.' },
    { extension: 'Real supplier integration for restock', implementation: 'Swap ReceiveStockCommand\'s synchronous apply() for one that calls a supplier API and only calls stockLevel.restock() once a delivery webhook confirms the shipment actually arrived.' },
  ],

  interviewerChecklist: [
    'Does reserve() have a real, provable guard against two threads overselling the same unit, or is concurrency hand-waved as "the database will handle it"?',
    'Are available, reserved, and committed modeled as three distinct numbers, or collapsed into one "quantity" field that loses the ability to answer "how much is truly free right now"?',
    'Is reservation expiry driven by a real timer/priority structure (DelayQueue, scheduled sweep) instead of "we would cron a nightly cleanup job"?',
    'Can commit(), release(), and expiry race each other on the same reservation - and if so, does exactly one of them win, provably?',
    'Can a new restock formula or a new low-stock subscriber be added without touching ReservationService or StockLevel?',
    'Does the candidate distinguish a "stock adjustment" (restock, write-off - a warehouse-side operation) from a "reservation" (a hold tied to one order), or conflate the two?',
  ],

  relatedDesigns: ['parking-lot', 'multilevel-cache'],
  keyTakeaways: [
    'Model available / reserved / committed as three explicit numbers, not one - most real "we oversold a SKU" incidents trace back to collapsing this into a single quantity field.',
    'A lock (or atomic pair) scoped to one (SKU, warehouse) key gives correctness without a global lock - contention on a hot SKU never blocks an unrelated one.',
    'Observer decouples "stock crossed the low-stock threshold" from "what to do about it" - the reservation path never imports LowStockAlertService or ReplenishmentService.',
    'Command turns a stock adjustment into a first-class object that can be queued, logged, and applied by one dedicated consumer thread, instead of every caller racing directly against StockLevel\'s lock.',
  ],
}

export default problem

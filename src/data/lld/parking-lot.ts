import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'parking-lot',
  title: 'Parking Lot',
  difficulty: 'Beginner',
  icon: 'pi pi-car',
  color: '#3b82f6',
  readTimeMinutes: 16,
  patterns: ['Strategy', 'Factory', 'Builder', 'Observer'],
  companies: ['Flipkart', 'PhonePe', 'Amazon', 'Google', 'Uber'],
  summary:
    'A multi-floor parking lot that assigns the right-sized spot to each vehicle, prices tickets with swappable strategies (hourly, weekend surcharge), and stays correct under concurrent entry attempts.',

  functionalRequirements: [
    'Support multiple vehicle types (motorcycle, car, truck/bus) and multiple spot types (motorcycle, compact, large) with size-compatible assignment.',
    'A parking lot has multiple floors; each floor has a fixed number of spots of each type.',
    'On entry, find an available compatible spot, assign it, and issue a ticket recording the vehicle, spot, and entry time.',
    'On exit, compute the fee from the ticket, free the spot, and close the ticket with an exit time.',
    'Support at least two pricing strategies (flat hourly rate, weekend surcharge) that can be swapped without changing the checkout code.',
    'Reject entry with a clear error when the lot has no compatible spot free.',
  ],
  nonFunctionalRequirements: [
    'Spot assignment must be thread-safe - two vehicles arriving at the same instant must never be assigned the same spot.',
    'Finding a free spot of a given type should be O(1) on average, not a linear scan of every spot on every floor.',
    'Adding a new vehicle type, spot type, or pricing rule should not require touching the core entry/exit flow (open/closed principle).',
  ],

  coreEntities: [
    { name: 'VehicleType / SpotType', description: 'Enums classifying vehicles and spots so assignment can check size compatibility.' },
    { name: 'Vehicle', description: 'A licensed vehicle attempting to park - plate number plus its type.' },
    { name: 'ParkingSpot', description: 'One physical spot on a floor; tracks its type and whether it is currently occupied.' },
    { name: 'ParkingFloor', description: 'Owns a pool of spots per type and hands out/reclaims them with O(1) lookups.' },
    { name: 'Ticket', description: "A receipt for one parking session - vehicle, assigned spot, entry time, and (once closed) exit time and fee." },
    { name: 'PricingStrategy', description: 'Interface for computing a fee from a ticket - the interchangeable part of checkout.' },
    { name: 'ParkingLot', description: 'The aggregate root - owns all floors, orchestrates entry/exit, and is assembled via a Builder.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class VehicleType {
    <<enumeration>>
    MOTORCYCLE
    CAR
    TRUCK
  }
  class SpotType {
    <<enumeration>>
    MOTORCYCLE_SPOT
    COMPACT
    LARGE
  }
  class Vehicle {
    -String licensePlate
    -VehicleType type
    +getType() VehicleType
  }
  class ParkingSpot {
    -String id
    -SpotType type
    -AtomicBoolean occupied
    +tryOccupy() boolean
    +vacate() void
  }
  class ParkingFloor {
    -int floorNumber
    -Map~SpotType, Deque~ParkingSpot~~ freeSpotsByType
    +findAndOccupySpot(SpotType) ParkingSpot
    +releaseSpot(ParkingSpot) void
  }
  class Ticket {
    -String ticketId
    -Vehicle vehicle
    -ParkingSpot spot
    -LocalDateTime entryTime
    -LocalDateTime exitTime
    +close(LocalDateTime) void
  }
  class PricingStrategy {
    <<interface>>
    +calculateFee(Ticket) BigDecimal
  }
  class HourlyPricingStrategy {
    +calculateFee(Ticket) BigDecimal
  }
  class WeekendSurchargeDecorator {
    -PricingStrategy wrapped
    +calculateFee(Ticket) BigDecimal
  }
  class VehicleFactory {
    +createVehicle(String, VehicleType) Vehicle
  }
  class ParkingLotObserver {
    <<interface>>
    +onFloorFull(int) void
  }
  class DisplayBoard {
    +onFloorFull(int) void
  }
  class ParkingLot {
    -List~ParkingFloor~ floors
    -PricingStrategy pricingStrategy
    -List~ParkingLotObserver~ observers
    +parkVehicle(Vehicle) Ticket
    +unparkVehicle(Ticket) BigDecimal
  }
  class ParkingLotBuilder {
    +withFloors(int) ParkingLotBuilder
    +withSpotsPerFloor(SpotType, int) ParkingLotBuilder
    +build() ParkingLot
  }

  PricingStrategy <|.. HourlyPricingStrategy
  PricingStrategy <|.. WeekendSurchargeDecorator
  WeekendSurchargeDecorator o-- PricingStrategy
  ParkingLotObserver <|.. DisplayBoard
  ParkingLot o-- ParkingFloor
  ParkingLot o-- PricingStrategy
  ParkingLot o-- ParkingLotObserver
  ParkingFloor o-- ParkingSpot
  Ticket o-- Vehicle
  Ticket o-- ParkingSpot
  ParkingLotBuilder ..> ParkingLot : builds
  VehicleFactory ..> Vehicle : creates`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'PricingStrategy + HourlyPricingStrategy', why: 'Swap pricing rules (hourly, monthly pass, EV-charging surcharge) at runtime without touching ParkingLot.unparkVehicle().' },
    { pattern: 'Decorator', where: 'WeekendSurchargeDecorator wraps PricingStrategy', why: 'Adds a weekend surcharge on top of any base strategy without subclassing every combination (hourly+weekend, monthly+weekend, ...).' },
    { pattern: 'Factory Method', where: 'VehicleFactory.createVehicle()', why: 'Centralizes vehicle-type-specific construction so callers never branch on VehicleType themselves.' },
    { pattern: 'Builder', where: 'ParkingLotBuilder', why: 'ParkingLot construction has many optional knobs (floor count, spots per type per floor) - a telescoping constructor would be unreadable.' },
    { pattern: 'Observer', where: 'ParkingLotObserver / DisplayBoard', why: 'Lets a display board (or an alerting service) react to a floor filling up without ParkingLot knowing anything about displays.' },
  ],

  dataStructures: [
    { component: 'Free spots per type, per floor', structure: 'ArrayDeque<ParkingSpot> keyed by SpotType in a HashMap', why: 'Push/pop from a deque is O(1) - assignment never scans every spot, and returning a spot on exit is also O(1).' },
    { component: 'Occupied flag on ParkingSpot', structure: 'AtomicBoolean', why: 'compareAndSet gives a lock-free, thread-safe "claim this spot" operation instead of a coarse-grained lock around the whole floor.' },
    { component: 'Open tickets', structure: 'ConcurrentHashMap<String, Ticket> keyed by ticketId', why: 'O(1) lookup on exit by ticket ID, safe for concurrent entry/exit from multiple gates.' },
  ],

  walkthroughs: [
    {
      title: 'Entry Flow (park a vehicle)',
      steps: [
        'Gate scans the plate and vehicle type; VehicleFactory.createVehicle() builds the Vehicle object.',
        'ParkingLot.parkVehicle() maps the vehicle to a required SpotType (e.g. CAR -> COMPACT) and asks each floor, in order, for a free spot of that type.',
        'The first floor with a free spot pops one from its ArrayDeque and calls spot.tryOccupy() - an atomic compare-and-set that can only succeed once.',
        'If a floor becomes empty of that spot type after the pop, it notifies registered ParkingLotObserver instances (DisplayBoard flips to "FULL" for that type).',
        'A new Ticket is created with the vehicle, the claimed spot, and the current timestamp, and stored in the open-tickets map.',
        'If every floor reports no free spot of the right type, parkVehicle() throws ParkingFullException instead of returning a half-valid ticket.',
      ],
    },
    {
      title: 'Exit Flow (unpark a vehicle)',
      steps: [
        'Gate reads the ticket ID and calls ParkingLot.unparkVehicle(ticketId).',
        'The ticket is looked up in the open-tickets map (O(1)); a missing or already-closed ticket ID fails fast with a clear error.',
        'ticket.close(now) stamps the exit time, then the configured PricingStrategy computes the fee from (entryTime, exitTime, vehicle type).',
        "The spot is returned to its floor's free deque via releaseSpot(), making it immediately available to the next arriving vehicle.",
        'The ticket is removed from the open-tickets map and the fee is returned to the gate for payment.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'VehicleType.java',
      rationale:
        'Two small enums up front give the compiler (not a string comparison at runtime) the job of catching an invalid vehicle/spot type anywhere in the codebase.',
      code: `public enum VehicleType {
    MOTORCYCLE,
    CAR,
    TRUCK
}`,
    },
    {
      filename: 'SpotType.java',
      rationale: 'Kept separate from VehicleType because the mapping between them is a business rule, not a 1:1 identity - a CAR fits a COMPACT spot, but so could a MOTORCYCLE in a pinch.',
      code: `public enum SpotType {
    MOTORCYCLE_SPOT,
    COMPACT,
    LARGE
}`,
    },
    {
      filename: 'Vehicle.java',
      rationale: 'A plain immutable value object. Immutability means a Vehicle can be safely shared across threads (the gate thread and the ticketing thread) without defensive copying.',
      code: `public final class Vehicle {
    private final String licensePlate;
    private final VehicleType type;

    public Vehicle(String licensePlate, VehicleType type) {
        this.licensePlate = licensePlate;
        this.type = type;
    }

    public String getLicensePlate() { return licensePlate; }
    public VehicleType getType() { return type; }
}`,
    },
    {
      filename: 'VehicleFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'The factory is the single place that knows how to turn raw gate input into a domain object. If motorcycles later need an extra "sidecar" flag, only this method changes - every caller stays untouched.',
      rationale: 'Gates call this instead of "new Vehicle(...)" directly, so validation (e.g. plate format) has one home.',
      code: `public final class VehicleFactory {
    public static Vehicle createVehicle(String licensePlate, VehicleType type) {
        if (licensePlate == null || licensePlate.isBlank()) {
            throw new IllegalArgumentException("License plate is required");
        }
        return new Vehicle(licensePlate, type);
    }

    public static SpotType requiredSpotType(VehicleType type) {
        switch (type) {
            case MOTORCYCLE: return SpotType.MOTORCYCLE_SPOT;
            case CAR: return SpotType.COMPACT;
            case TRUCK: return SpotType.LARGE;
            default: throw new IllegalStateException("Unhandled vehicle type: " + type);
        }
    }
}`,
    },
    {
      filename: 'ParkingSpot.java',
      calloutTitle: '💡 Lock-free occupancy',
      callout:
        'tryOccupy() uses AtomicBoolean.compareAndSet(false, true) - it atomically checks "is this free?" and "claim it" in one CPU instruction, so two threads racing for the same spot can never both win.',
      rationale: 'The spot itself owns its concurrency safety instead of relying on the caller to remember to synchronize.',
      code: `import java.util.concurrent.atomic.AtomicBoolean;

public final class ParkingSpot {
    private final String id;
    private final SpotType type;
    private final AtomicBoolean occupied = new AtomicBoolean(false);

    public ParkingSpot(String id, SpotType type) {
        this.id = id;
        this.type = type;
    }

    public boolean tryOccupy() {
        return occupied.compareAndSet(false, true);
    }

    public void vacate() {
        occupied.set(false);
    }

    public String getId() { return id; }
    public SpotType getType() { return type; }
}`,
    },
    {
      filename: 'ParkingFloor.java',
      rationale:
        'Free spots are pre-partitioned by type into their own deques at construction time, so parkVehicle() never has to filter or scan - it just pops from the right bucket.',
      code: `import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class ParkingFloor {
    private final int floorNumber;
    private final Map<SpotType, Deque<ParkingSpot>> freeSpotsByType = new ConcurrentHashMap<>();
    private final List<ParkingLotObserver> observers;

    public ParkingFloor(int floorNumber, Map<SpotType, Integer> spotCounts, List<ParkingLotObserver> observers) {
        this.floorNumber = floorNumber;
        this.observers = observers;
        for (Map.Entry<SpotType, Integer> entry : spotCounts.entrySet()) {
            Deque<ParkingSpot> deque = new ArrayDeque<>();
            for (int i = 0; i < entry.getValue(); i++) {
                deque.push(new ParkingSpot(floorNumber + "-" + entry.getKey() + "-" + i, entry.getKey()));
            }
            freeSpotsByType.put(entry.getKey(), deque);
        }
    }

    public synchronized ParkingSpot findAndOccupySpot(SpotType type) {
        Deque<ParkingSpot> deque = freeSpotsByType.get(type);
        if (deque == null || deque.isEmpty()) return null;

        ParkingSpot spot = deque.pop();
        if (!spot.tryOccupy()) {
            // Extremely unlikely race guard: put it back and report no luck this call.
            deque.push(spot);
            return null;
        }
        if (deque.isEmpty()) {
            observers.forEach(o -> o.onFloorFull(floorNumber));
        }
        return spot;
    }

    public synchronized void releaseSpot(ParkingSpot spot) {
        spot.vacate();
        freeSpotsByType.get(spot.getType()).push(spot);
    }

    public int getFloorNumber() { return floorNumber; }
}`,
    },
    {
      filename: 'Ticket.java',
      rationale: 'A ticket is mutable only in the one way that matters (closing it) - every other field is set once at issuance and never changes.',
      code: `import java.time.LocalDateTime;

public final class Ticket {
    private final String ticketId;
    private final Vehicle vehicle;
    private final ParkingSpot spot;
    private final LocalDateTime entryTime;
    private LocalDateTime exitTime;

    public Ticket(String ticketId, Vehicle vehicle, ParkingSpot spot, LocalDateTime entryTime) {
        this.ticketId = ticketId;
        this.vehicle = vehicle;
        this.spot = spot;
        this.entryTime = entryTime;
    }

    public void close(LocalDateTime exitTime) {
        if (this.exitTime != null) {
            throw new IllegalStateException("Ticket " + ticketId + " is already closed");
        }
        this.exitTime = exitTime;
    }

    public String getTicketId() { return ticketId; }
    public Vehicle getVehicle() { return vehicle; }
    public ParkingSpot getSpot() { return spot; }
    public LocalDateTime getEntryTime() { return entryTime; }
    public LocalDateTime getExitTime() { return exitTime; }
}`,
    },
    {
      filename: 'PricingStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This one interface is the entire reason unparkVehicle() never needs an if/else on "which pricing plan is active". Any class that implements calculateFee() can be dropped in via ParkingLot.setPricingStrategy() - including at runtime.',
      rationale: 'Kept to a single method so implementations stay trivially testable.',
      code: `import java.math.BigDecimal;

public interface PricingStrategy {
    BigDecimal calculateFee(Ticket ticket);
}`,
    },
    {
      filename: 'HourlyPricingStrategy.java',
      rationale: 'The baseline strategy - every other strategy either replaces or decorates this one.',
      code: `import java.math.BigDecimal;
import java.time.Duration;

public final class HourlyPricingStrategy implements PricingStrategy {
    private final BigDecimal ratePerHour;

    public HourlyPricingStrategy(BigDecimal ratePerHour) {
        this.ratePerHour = ratePerHour;
    }

    @Override
    public BigDecimal calculateFee(Ticket ticket) {
        Duration parked = Duration.between(ticket.getEntryTime(), ticket.getExitTime());
        long billableHours = Math.max(1, (parked.toMinutes() + 59) / 60); // round up, minimum 1 hour
        return ratePerHour.multiply(BigDecimal.valueOf(billableHours));
    }
}`,
    },
    {
      filename: 'WeekendSurchargeDecorator.java',
      calloutTitle: '💡 Decorator Pattern',
      callout:
        'Instead of a WeekendHourlyPricingStrategy and a separate WeekendMonthlyPricingStrategy (combinatorial explosion), this wraps ANY PricingStrategy and adds a flat surcharge on top - one class covers every combination.',
      rationale: 'Composition over inheritance: the decorator holds a reference to the strategy it wraps rather than extending it.',
      code: `import java.math.BigDecimal;
import java.time.DayOfWeek;

public final class WeekendSurchargeDecorator implements PricingStrategy {
    private final PricingStrategy wrapped;
    private final BigDecimal surcharge;

    public WeekendSurchargeDecorator(PricingStrategy wrapped, BigDecimal surcharge) {
        this.wrapped = wrapped;
        this.surcharge = surcharge;
    }

    @Override
    public BigDecimal calculateFee(Ticket ticket) {
        BigDecimal base = wrapped.calculateFee(ticket);
        DayOfWeek exitDay = ticket.getExitTime().getDayOfWeek();
        boolean isWeekend = exitDay == DayOfWeek.SATURDAY || exitDay == DayOfWeek.SUNDAY;
        return isWeekend ? base.add(surcharge) : base;
    }
}`,
    },
    {
      filename: 'ParkingFullException.java',
      rationale: 'A checked business exception - callers are forced to handle "the lot is full" explicitly rather than treating it like an unexpected crash.',
      code: `public final class ParkingFullException extends Exception {
    public ParkingFullException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'ParkingLotObserver.java',
      rationale: 'One-method interface; DisplayBoard is only the first subscriber - an SMS alert to the facility manager could implement this same interface tomorrow.',
      code: `public interface ParkingLotObserver {
    void onFloorFull(int floorNumber);
}`,
    },
    {
      filename: 'DisplayBoard.java',
      calloutTitle: '💡 Observer Pattern',
      callout:
        'ParkingFloor has zero knowledge that a DisplayBoard exists - it just calls onFloorFull() on whatever observers were registered. Swapping the physical LED board for a mobile push notification means writing a new observer, not touching ParkingFloor.',
      rationale: 'Deliberately dumb - production code would push to an actual display API, but the pattern is the point here.',
      code: `public final class DisplayBoard implements ParkingLotObserver {
    @Override
    public void onFloorFull(int floorNumber) {
        System.out.println("[DisplayBoard] Floor " + floorNumber + " is now FULL for that spot type.");
    }
}`,
    },
    {
      filename: 'ParkingLot.java',
      rationale:
        'The aggregate root. It delegates spot bookkeeping to ParkingFloor and fee math to PricingStrategy, keeping its own two public methods (parkVehicle/unparkVehicle) focused purely on orchestration.',
      code: `import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public final class ParkingLot {
    private final List<ParkingFloor> floors;
    private final Map<String, Ticket> openTickets = new ConcurrentHashMap<>();
    private final AtomicLong ticketSequence = new AtomicLong();
    private PricingStrategy pricingStrategy;

    ParkingLot(List<ParkingFloor> floors, PricingStrategy pricingStrategy) {
        this.floors = floors;
        this.pricingStrategy = pricingStrategy;
    }

    public void setPricingStrategy(PricingStrategy strategy) {
        this.pricingStrategy = strategy;
    }

    public Ticket parkVehicle(Vehicle vehicle) throws ParkingFullException {
        SpotType required = VehicleFactory.requiredSpotType(vehicle.getType());
        for (ParkingFloor floor : floors) {
            ParkingSpot spot = floor.findAndOccupySpot(required);
            if (spot != null) {
                String ticketId = "T-" + ticketSequence.incrementAndGet();
                Ticket ticket = new Ticket(ticketId, vehicle, spot, LocalDateTime.now());
                openTickets.put(ticketId, ticket);
                return ticket;
            }
        }
        throw new ParkingFullException("No available " + required + " spot for vehicle " + vehicle.getLicensePlate());
    }

    public BigDecimal unparkVehicle(String ticketId) {
        Ticket ticket = openTickets.remove(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("Unknown or already-closed ticket: " + ticketId);
        }
        ticket.close(LocalDateTime.now());
        floors.stream()
              .filter(f -> f.getFloorNumber() == floorOf(ticket))
              .findFirst()
              .ifPresent(f -> f.releaseSpot(ticket.getSpot()));
        return pricingStrategy.calculateFee(ticket);
    }

    private int floorOf(Ticket ticket) {
        // Spot IDs are minted as "<floor>-<type>-<index>" in ParkingFloor's constructor.
        return Integer.parseInt(ticket.getSpot().getId().split("-")[0]);
    }
}`,
    },
    {
      filename: 'ParkingLotBuilder.java',
      calloutTitle: '💡 Builder Pattern',
      callout:
        'ParkingLot has an open-ended, order-independent set of construction options (how many floors, how many of each spot type per floor, which pricing strategy). A constructor with six positional parameters would be an easy place to swap two arguments by mistake.',
      rationale: 'Fluent methods return "this" so floor/spot configuration reads top-to-bottom like a spec, not a nested call.',
      code: `import java.util.*;

public final class ParkingLotBuilder {
    private int floorCount = 1;
    private final Map<SpotType, Integer> spotsPerFloor = new EnumMap<>(SpotType.class);
    private PricingStrategy pricingStrategy = new HourlyPricingStrategy(new java.math.BigDecimal("2.00"));
    private final List<ParkingLotObserver> observers = new ArrayList<>();

    public ParkingLotBuilder withFloors(int count) {
        this.floorCount = count;
        return this;
    }

    public ParkingLotBuilder withSpotsPerFloor(SpotType type, int count) {
        this.spotsPerFloor.put(type, count);
        return this;
    }

    public ParkingLotBuilder withPricingStrategy(PricingStrategy strategy) {
        this.pricingStrategy = strategy;
        return this;
    }

    public ParkingLotBuilder withObserver(ParkingLotObserver observer) {
        this.observers.add(observer);
        return this;
    }

    public ParkingLot build() {
        List<ParkingFloor> floors = new ArrayList<>();
        for (int i = 1; i <= floorCount; i++) {
            floors.add(new ParkingFloor(i, spotsPerFloor, observers));
        }
        return new ParkingLot(floors, pricingStrategy);
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy path, the ParkingFullException edge case, a live pricing-strategy swap, and - since thread-safety is a stated non-functional requirement - a concurrent stress test proving two threads never get the same spot.',
      code: `import java.math.BigDecimal;
import java.util.concurrent.*;

public final class Demo {
    public static void main(String[] args) throws Exception {
        ParkingLot lot = new ParkingLotBuilder()
                .withFloors(1)
                .withSpotsPerFloor(SpotType.COMPACT, 2)
                .withSpotsPerFloor(SpotType.MOTORCYCLE_SPOT, 1)
                .withObserver(new DisplayBoard())
                .build();

        // Happy path
        Ticket t1 = lot.parkVehicle(VehicleFactory.createVehicle("KA-01-1234", VehicleType.CAR));
        System.out.println("Parked car, ticket " + t1.getTicketId());

        // Fill the last compact spot, then trigger ParkingFullException on the third car
        lot.parkVehicle(VehicleFactory.createVehicle("KA-01-5678", VehicleType.CAR));
        try {
            lot.parkVehicle(VehicleFactory.createVehicle("KA-01-9999", VehicleType.CAR));
        } catch (ParkingFullException e) {
            System.out.println("Expected failure: " + e.getMessage());
        }

        // Swap in a weekend-surcharge strategy at runtime, no ParkingLot code change required
        lot.setPricingStrategy(new WeekendSurchargeDecorator(
                new HourlyPricingStrategy(new BigDecimal("2.00")), new BigDecimal("5.00")));
        BigDecimal fee = lot.unparkVehicle(t1.getTicketId());
        System.out.println("Fee for " + t1.getTicketId() + ": $" + fee);

        // Concurrency check: 20 threads race for the 1 motorcycle spot that just freed up conceptually.
        // In a fresh lot with exactly 1 motorcycle spot, exactly one thread should succeed.
        ParkingLot tinyLot = new ParkingLotBuilder().withFloors(1).withSpotsPerFloor(SpotType.MOTORCYCLE_SPOT, 1).build();
        ExecutorService pool = Executors.newFixedThreadPool(20);
        AtomicIntegerLike successCount = new AtomicIntegerLike();
        CountDownLatch done = new CountDownLatch(20);
        for (int i = 0; i < 20; i++) {
            final int idx = i;
            pool.submit(() -> {
                try {
                    tinyLot.parkVehicle(VehicleFactory.createVehicle("BIKE-" + idx, VehicleType.MOTORCYCLE));
                    successCount.increment();
                } catch (ParkingFullException ignored) {
                    // Expected for the other 19 threads.
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();
        System.out.println("Threads that won the single motorcycle spot: " + successCount.get() + " (expected 1)");
    }

    // Tiny helper so this file has no extra dependency beyond java.util.concurrent.
    static final class AtomicIntegerLike {
        private final java.util.concurrent.atomic.AtomicInteger value = new java.util.concurrent.atomic.AtomicInteger();
        void increment() { value.incrementAndGet(); }
        int get() { return value.get(); }
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Spot Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> Free
  Free --> Occupied: tryOccupy() succeeds
  Occupied --> Free: releaseSpot()
  Occupied --> Occupied: tryOccupy() fails (already taken)`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Park Vehicle',
    mermaid: `sequenceDiagram
  autonumber
  participant Gate
  participant Lot as ParkingLot
  participant Floor as ParkingFloor
  participant Spot as ParkingSpot
  participant Board as DisplayBoard

  Gate->>Lot: parkVehicle(vehicle)
  Lot->>Floor: findAndOccupySpot(COMPACT)
  Floor->>Spot: tryOccupy()
  Spot-->>Floor: true
  alt last compact spot on this floor
    Floor->>Board: onFloorFull(floorNumber)
  end
  Floor-->>Lot: spot
  Lot->>Lot: create Ticket(vehicle, spot, now)
  Lot-->>Gate: ticket`,
  },

  extensions: [
    { extension: 'Reserved / VIP spots', implementation: 'Add a RESERVED SpotType and a reservation lookup consulted before falling back to the general pool.' },
    { extension: 'New vehicle or spot sizes', implementation: 'Add an enum value plus one line in VehicleFactory.requiredSpotType() - no other class changes.' },
    { extension: 'Multiple entry gates', implementation: 'Each gate holds a reference to the same ParkingLot instance; the AtomicBoolean/synchronized floor logic already makes cross-gate races safe.' },
    { extension: 'Monthly subscription pricing', implementation: 'Add a MonthlyPassPricingStrategy implementing PricingStrategy; ParkingLot code is untouched.' },
    { extension: 'Live occupancy app', implementation: 'Add a PushNotificationObserver implementing ParkingLotObserver alongside DisplayBoard.' },
    { extension: 'EV charging spots', implementation: 'Model as a SpotType plus a decorator on PricingStrategy that adds a per-kWh charge, mirroring WeekendSurchargeDecorator.' },
  ],

  interviewerChecklist: [
    'Does spot assignment use a real data structure (deque/map), not a linear scan through every spot?',
    'Is there an explicit concurrency story (AtomicBoolean, synchronized, or a lock) rather than an assumption that "it just works"?',
    'Can a new pricing rule or vehicle type be added without editing ParkingLot itself?',
    'Is the full/empty edge case handled with a domain exception instead of returning null or a magic ticket?',
    'Are entities immutable where nothing forces them to be mutable (Vehicle, Ticket\'s core fields)?',
    'Does the candidate explain why Builder over a long constructor, and why Decorator over strategy subclassing?',
  ],

  relatedDesigns: ['elevator-system', 'vending-machine'],
  keyTakeaways: [
    'Strategy + Decorator together solve "many interchangeable rules that also need to compose" - Strategy swaps the whole algorithm, Decorator layers behavior on top of it.',
    'Push concurrency safety down into the smallest object that can enforce it (AtomicBoolean on the spot) instead of one big lock around the whole lot.',
    'A Builder is worth it the moment a constructor would need more than ~3 parameters or has optional pieces.',
    'Observer decouples "something happened" from "what to do about it" - the core flow never imports DisplayBoard.',
  ],
}

export default problem

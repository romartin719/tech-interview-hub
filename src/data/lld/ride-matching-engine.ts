import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'ride-matching-engine',
  title: 'Ride Matching Engine',
  difficulty: 'Advanced',
  icon: 'pi pi-map-marker',
  color: '#0891b2',
  readTimeMinutes: 22,
  patterns: ['Strategy', 'State', 'Observer'],
  companies: ['Uber', 'Lyft', 'Ola', 'Grab', 'Bolt'],
  summary:
    'A ride-hailing matching engine that finds the nearest available driver for a pickup using a spatial index instead of a linear scan, offers the trip to one driver at a time with a fallback to the next-nearest on reject or timeout, drives the trip through an explicit guarded lifecycle, and prices the ride with a pluggable base-plus-surge fare strategy - all while guaranteeing two riders can never both lock the same driver.',

  functionalRequirements: [
    'Track drivers by a frequently-updating location and a status (OFFLINE / AVAILABLE / EN_ROUTE / ON_TRIP); only AVAILABLE drivers are eligible to be matched to a new request.',
    "Given a rider's pickup location, find the nearest AVAILABLE driver within a configurable search radius using a spatial index, not a scan of every driver in the fleet.",
    'Offer the trip to the best-ranked candidate and give them a bounded window to accept or reject; on reject or timeout, fall through to the next-nearest available driver instead of failing the whole request.',
    'Model the trip as an explicit lifecycle - REQUESTED -> MATCHED -> DRIVER_ARRIVING -> IN_PROGRESS -> COMPLETED/CANCELLED - with guarded transitions that reject illegal jumps (e.g. starting a trip that was never matched, completing a trip twice).',
    "Calculate a fare from a base fee, a distance/time-based component, and a surge multiplier derived from real-time supply/demand in the pickup's zone, via a pluggable pricing strategy.",
    "Notify the rider as the matched driver's location streams in en route to pickup, and again on every trip-status change, without the matching/orchestration code hardcoding who is listening.",
  ],
  nonFunctionalRequirements: [
    'Two concurrent ride requests must never both be matched to and lock the same driver - claiming a driver for an offer must be a single atomic operation, never a check-then-act race.',
    'Driver location pings can arrive out of order or in rapid bursts; a stale or reordered update must never overwrite a newer position or leave the spatial index pointing at the wrong grid cell for that driver.',
    "Proximity search cost must scale with driver density near the pickup, not with total fleet size - a city with tens of thousands of drivers online must not require scanning all of them to answer 'who is near this pickup?'",
    'Swapping the matching algorithm (nearest-distance vs least-ETA) or the fare model (flat vs surge-aware) must not require touching trip orchestration code (open/closed principle).',
  ],

  coreEntities: [
    { name: 'Location', description: 'A (latitude, longitude) value object with a distanceKm() helper - the unit every proximity and fare calculation is built on.' },
    { name: 'Driver', description: "A driver's identity, current location, and status (OFFLINE/AVAILABLE/EN_ROUTE/ON_TRIP); location and status are both held in atomics so concurrent pings and claims never tear the object's state." },
    { name: 'DriverLocationIndex', description: 'A grid-bucketed spatial index of drivers - the data structure that answers "who is near this pickup?" without touching every driver in the system.' },
    { name: 'MatchingStrategy', description: 'Interface for ranking a set of nearby drivers for a pickup - the interchangeable "which driver gets offered first" policy (nearest-distance vs least-ETA).' },
    { name: 'FarePricingStrategy', description: 'Interface for turning a trip\'s distance/time (and pickup zone) into a fare - the interchangeable pricing policy, kept fully outside trip orchestration.' },
    { name: 'SurgeZoneTracker', description: 'Tracks live open-request (demand) and available-driver (supply) counts per zone, and exposes the surge multiplier a pricing strategy reads at fare time.' },
    { name: 'DriverOffer', description: 'A provisional, time-boxed claim on one driver for one trip while that driver decides whether to accept - the ride-matching analog of a Hold on a table+slot.' },
    { name: 'Trip', description: 'The aggregate for a single ride: pickup/dropoff, the guarded status lifecycle, the assigned driver, and the final fare once completed.' },
    { name: 'TripObserver', description: 'Interface notified on every driver location update and every trip status change for a rider - the rider-notification channel, decoupled from the matching/orchestration core.' },
    { name: 'RideMatchingEngine', description: 'The aggregate root - owns the driver registry, the spatial index, the pluggable strategies, the per-driver offer claims, and every in-flight Trip; orchestrates request -> offer -> accept/fallback -> lifecycle -> fare.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Location {
    -double latitude
    -double longitude
    +distanceKm(Location) double
  }
  class DriverStatus {
    <<enumeration>>
    OFFLINE
    AVAILABLE
    EN_ROUTE
    ON_TRIP
  }
  class Driver {
    -String driverId
    -AtomicReference~Location~ currentLocation
    -AtomicReference~DriverStatus~ status
    -AtomicLong lastLocationEventEpochMillis
    -double averageSpeedKmh
    +updateLocationIfNewer(Location, long) boolean
    +getStatus() DriverStatus
    +setStatus(DriverStatus) void
  }
  class DriverLocationIndex {
    -ConcurrentHashMap~String, Set~Driver~~ driversByCell
    -ConcurrentHashMap~String, String~ currentCellByDriverId
    +registerDriver(Driver) void
    +updateDriverLocation(Driver, Location, long) boolean
    +findNearby(Location, double, DriverStatus) List~Driver~
  }
  class MatchingStrategy {
    <<interface>>
    +rankCandidates(Location, List~Driver~) List~Driver~
  }
  class NearestDriverStrategy {
    +rankCandidates(Location, List~Driver~) List~Driver~
  }
  class LeastEtaStrategy {
    +rankCandidates(Location, List~Driver~) List~Driver~
  }
  class FarePricingStrategy {
    <<interface>>
    +calculateFare(double, double, String) BigDecimal
  }
  class SurgeAwareFarePricingStrategy {
    -BigDecimal baseFare
    -BigDecimal perKmRate
    -BigDecimal perMinuteRate
    -SurgeZoneTracker surgeZoneTracker
    +calculateFare(double, double, String) BigDecimal
  }
  class SurgeZoneTracker {
    -ConcurrentHashMap~String, AtomicInteger~ openRequestsByZone
    -ConcurrentHashMap~String, AtomicInteger~ availableDriversByZone
    +recordRequestOpened(String) void
    +recordRequestClosed(String) void
    +driverBecameAvailable(String) void
    +driverBecameUnavailable(String) void
    +getSurgeMultiplier(String) double
  }
  class TripStatus {
    <<enumeration>>
    REQUESTED
    MATCHED
    DRIVER_ARRIVING
    IN_PROGRESS
    COMPLETED
    CANCELLED
  }
  class Trip {
    -String tripId
    -String riderId
    -Location pickup
    -Location dropoff
    -AtomicReference~TripStatus~ status
    -String assignedDriverId
    -BigDecimal fare
    +matchDriver(Driver) void
    +markDriverArriving() void
    +startTrip() void
    +completeTrip(BigDecimal) void
    +cancel(String) void
  }
  class DriverOffer {
    -String offerId
    -String driverId
    -String tripId
    -Instant expiresAt
    +isExpired() boolean
  }
  class TripObserver {
    <<interface>>
    +onDriverLocationUpdated(Trip, Driver, Location) void
    +onTripStatusChanged(Trip, TripStatus, TripStatus) void
  }
  class RiderNotifier {
    +onDriverLocationUpdated(Trip, Driver, Location) void
    +onTripStatusChanged(Trip, TripStatus, TripStatus) void
  }
  class NoDriverAvailableException
  class RideMatchingEngine {
    -ConcurrentHashMap~String, Driver~ driversById
    -DriverLocationIndex locationIndex
    -MatchingStrategy matchingStrategy
    -FarePricingStrategy farePricingStrategy
    -SurgeZoneTracker surgeZoneTracker
    -ConcurrentHashMap~String, DriverOffer~ activeOfferByDriverId
    -ConcurrentHashMap~String, Deque~Driver~~ pendingCandidatesByTripId
    -ConcurrentHashMap~String, Trip~ tripsById
    -List~TripObserver~ observers
    +registerDriver(Driver) void
    +updateDriverLocation(String, Location, long) void
    +requestRide(String, Location, Location) DriverOffer
    +respondToOffer(String, String, boolean) void
    +driverArrived(String) void
    +startTrip(String) void
    +completeTrip(String, double, double) Trip
    +cancelTrip(String, String) void
  }

  Driver --> DriverStatus
  Trip --> TripStatus
  DriverLocationIndex o-- Driver
  MatchingStrategy <|.. NearestDriverStrategy
  MatchingStrategy <|.. LeastEtaStrategy
  FarePricingStrategy <|.. SurgeAwareFarePricingStrategy
  SurgeAwareFarePricingStrategy ..> SurgeZoneTracker
  TripObserver <|.. RiderNotifier
  DriverOffer ..> Trip : offers a driver for
  RideMatchingEngine o-- Driver
  RideMatchingEngine o-- DriverLocationIndex
  RideMatchingEngine o-- MatchingStrategy
  RideMatchingEngine o-- FarePricingStrategy
  RideMatchingEngine o-- SurgeZoneTracker
  RideMatchingEngine o-- Trip
  RideMatchingEngine o-- DriverOffer
  RideMatchingEngine o-- TripObserver
  RideMatchingEngine ..> NoDriverAvailableException : throws`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'MatchingStrategy + NearestDriverStrategy / LeastEtaStrategy', why: 'Which nearby driver gets offered first is a swappable policy - raw distance is cheap and fine most of the time, ETA-aware ranking accounts for a driver going the wrong way down a one-way street - and requestRide() never branches on which one is configured.' },
    { pattern: 'Strategy', where: 'FarePricingStrategy + SurgeAwareFarePricingStrategy', why: 'The fare formula (and whether surge even applies) is fully outside trip orchestration - completeTrip() just calls calculateFare() and hands the result to Trip; a promo-discount strategy or a flat-rate strategy for a fixed corporate contract is a new class, not a rewrite of the trip lifecycle.' },
    { pattern: 'State', where: 'Trip.TripStatus + Trip.matchDriver()/markDriverArriving()/startTrip()/completeTrip()/cancel() guarded transitions', why: 'Each transition is a compareAndSet from exactly the status that legally precedes it, so starting a trip that was never matched, or completing a trip twice, fails loudly with an IllegalStateException instead of silently corrupting the lifecycle - the same rigor as Reservation.seat()/cancel() in the restaurant-booking design, just CAS-guarded because a cancel and a driver-accept really can race on the same trip.' },
    { pattern: 'Observer', where: 'TripObserver + RiderNotifier', why: "The matching engine has zero knowledge of how a rider actually gets notified - it just calls onDriverLocationUpdated()/onTripStatusChanged() on whatever observers were registered. Swapping console output for a real push-notification service means writing a new observer, not touching RideMatchingEngine." },
  ],

  dataStructures: [
    { component: 'Driver spatial index', structure: 'ConcurrentHashMap<String cellKey, Set<Driver>> bucketed on a fixed-size lat/lng grid (a simplified geohash/H3 stand-in)', why: "findNearby() only ever scans the pickup's cell and however many neighbor rings the search radius requires - the work scales with local driver density in that neighborhood, never with how many drivers are online city-wide." },
    { component: 'Per-driver offer claim', structure: 'ConcurrentHashMap<String driverId, DriverOffer> claimed via compute()', why: "Exactly the same shape as restaurant-booking's TableSlotKey -> SlotOccupant claim, just keyed on driverId instead of (table, slot) - compute() makes 'is this driver free, and if so take them' one atomic step per key, so two riders can never both walk away thinking they locked the same driver." },
    { component: 'Out-of-order location guard', structure: "AtomicLong lastLocationEventEpochMillis + a compareAndSet retry loop on the driver's location", why: "A location update is only applied if its event timestamp is strictly newer than the last one actually accepted - last-write-wins by when the GPS reading was taken, not by network arrival order, and it costs one CAS loop, no lock." },
    { component: 'Per-zone supply/demand counters', structure: 'ConcurrentHashMap<String zoneKey, AtomicInteger> for open requests and for available drivers', why: 'Opening/closing a request or a driver going available/busy is a single AtomicInteger increment or decrement - the surge multiplier is a cheap read-time ratio over two counters, never a scan of every request or every driver in the zone.' },
    { component: "A trip's fallback candidate queue", structure: 'ConcurrentHashMap<String tripId, Deque<Driver>>, populated once per requestRide()', why: "On a reject or timeout, popping the next-nearest candidate is O(1) and reuses the ranking already computed for that trip - a fallback never re-runs the spatial search or the strategy ranking from scratch." },
  ],

  walkthroughs: [
    {
      title: 'Proximity Match -> Reject -> Fallback -> Accept -> Complete (happy path with one simulated decline)',
      steps: [
        "A rider requests a ride from pickup P; requestRide() opens demand on P's surge zone and asks DriverLocationIndex.findNearby(P, radiusKm, AVAILABLE), which expands outward from P's grid cell only as many rings as the radius requires and returns every AVAILABLE driver within range - never a scan of the whole fleet.",
        'The configured MatchingStrategy (say, NearestDriverStrategy) sorts those candidates ascending by distance to P; the engine stores the full ranked list as a per-trip fallback queue and immediately tries to claim the head candidate, D1.',
        "tryClaimDriver(D1) calls activeOfferByDriverId.compute(D1.driverId, ...): the key is absent and D1.status is AVAILABLE, so the lambda installs a fresh DriverOffer (15s TTL) and flips D1 to EN_ROUTE, all inside that single atomic compute step. The offer is returned to the rider's app as 'driver found, awaiting confirmation'.",
        "D1's driver app calls respondToOffer(D1, tripId, false) - a decline, maybe they're about to end their shift. The engine removes D1's offer, flips D1 back to AVAILABLE, and immediately pops the next candidate, D2, off that same trip's fallback queue instead of failing the ride request.",
        'tryClaimDriver(D2) succeeds the same way; D2 accepts, and Trip.matchDriver(D2) performs a guarded compareAndSet from REQUESTED to MATCHED - every registered TripObserver is notified of that status change.',
        "As D2 drives to the pickup, each location ping runs through Driver.updateLocationIfNewer() (rejecting anything older than the last accepted reading) and, because D2 currently holds a live offer for this trip, the engine forwards the accepted position to RiderNotifier so the rider sees the driver's live progress.",
        'D2 signals arrival (Trip.markDriverArriving(), MATCHED -> DRIVER_ARRIVING), the rider boards (Trip.startTrip(), DRIVER_ARRIVING -> IN_PROGRESS, and D2 flips to ON_TRIP), and at drop-off completeTrip() asks the configured FarePricingStrategy for a fare based on the trip distance/duration and the current surge multiplier for P\'s zone, then transitions IN_PROGRESS -> COMPLETED and releases D2 back to AVAILABLE.',
      ],
    },
    {
      title: 'Two Riders, One Nearby Driver - Resolving the Claim Race',
      steps: [
        'Riders R1 and R2 request a ride within moments of each other from pickup points only a couple hundred meters apart - close enough that the same single AVAILABLE driver D is the #1-ranked candidate returned by findNearby()+rankCandidates() for both requestRide() calls, running concurrently on two different threads.',
        "Both threads reach the same conclusion independently and that is fine - findNearby() and rankCandidates() only ever read the spatial index and each driver's current (location, status); neither one touches any shared claim state, so there is nothing to race over yet.",
        "Both threads then call tryClaimDriver(D, theirTripId) at essentially the same instant. ConcurrentHashMap.compute() on key D.driverId serializes the two calls - the map guarantees only one lambda for that key executes at a time, and whichever one runs first sees the key absent (or its old offer expired) and D.status == AVAILABLE, so it installs a fresh DriverOffer for its trip and flips D to EN_ROUTE.",
        "The second thread's compute() call is only permitted to run after the first has fully returned - by the time it does, it sees either a live, unexpired DriverOffer already occupying that key, or D.status no longer AVAILABLE. Either way its lambda leaves the entry untouched and tryClaimDriver reports failure for that rider's request.",
        "The losing thread does not fail the whole ride request - RideMatchingEngine.offerNextCandidate() simply pops the next-nearest driver off that rider's own fallback queue and retries the claim there, exactly as it would after a genuine driver rejection.",
        'Net effect: exactly one of R1/R2 ends up holding D at any moment - never both, and never a corrupted state where two Trips both believe they own the same driverId - while the other rider is transparently routed to their next-nearest option with, at worst, a slightly longer ETA.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Location.java',
      rationale: 'A plain immutable value object with the one piece of math everything else depends on - a distance calculation. Haversine is used instead of flat Euclidean distance so distances stay accurate at city scale regardless of latitude.',
      code: `import java.util.Objects;

public final class Location {
    private final double latitude;
    private final double longitude;

    public Location(double latitude, double longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public double getLatitude() { return latitude; }
    public double getLongitude() { return longitude; }

    /** Haversine great-circle distance in kilometers - accurate enough for city-scale matching. */
    public double distanceKm(Location other) {
        final double earthRadiusKm = 6371.0;
        double dLat = Math.toRadians(other.latitude - this.latitude);
        double dLon = Math.toRadians(other.longitude - this.longitude);
        double lat1 = Math.toRadians(this.latitude);
        double lat2 = Math.toRadians(other.latitude);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Location)) return false;
        Location other = (Location) o;
        return Double.compare(latitude, other.latitude) == 0 && Double.compare(longitude, other.longitude) == 0;
    }

    @Override
    public int hashCode() { return Objects.hash(latitude, longitude); }

    @Override
    public String toString() { return "(" + latitude + ", " + longitude + ")"; }
}`,
    },
    {
      filename: 'Driver.java',
      rationale: "Location and status live in atomics rather than plain fields - both are read by the matching search on one thread while potentially being written by a location-update thread or an offer-claim thread on another, and nothing here should ever require a coarse lock just to read a driver's current position.",
      code: `import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

public final class Driver {

    public enum DriverStatus { OFFLINE, AVAILABLE, EN_ROUTE, ON_TRIP }

    private final String driverId;
    private final AtomicReference<Location> currentLocation;
    private final AtomicReference<DriverStatus> status;
    private final AtomicLong lastLocationEventEpochMillis = new AtomicLong(Long.MIN_VALUE);
    private final double averageSpeedKmh;

    public Driver(String driverId, Location initialLocation) {
        this(driverId, initialLocation, 30.0);
    }

    public Driver(String driverId, Location initialLocation, double averageSpeedKmh) {
        this.driverId = driverId;
        this.currentLocation = new AtomicReference<>(initialLocation);
        this.status = new AtomicReference<>(DriverStatus.OFFLINE);
        this.averageSpeedKmh = averageSpeedKmh;
    }

    public String getDriverId() { return driverId; }
    public Location getLocation() { return currentLocation.get(); }
    public DriverStatus getStatus() { return status.get(); }
    public void setStatus(DriverStatus newStatus) { status.set(newStatus); }
    public double getAverageSpeedKmh() { return averageSpeedKmh; }

    /**
     * Applies a location ping only if it is strictly newer (by event time, not arrival time) than
     * the last one this driver actually accepted. This is what keeps a reordered or duplicated GPS
     * ping from overwriting a fresher position with a stale one - a classic hazard once pings are
     * delivered over a lossy mobile network instead of arriving in send order.
     */
    public boolean updateLocationIfNewer(Location newLocation, long eventEpochMillis) {
        long observed = lastLocationEventEpochMillis.get();
        while (eventEpochMillis > observed) {
            if (lastLocationEventEpochMillis.compareAndSet(observed, eventEpochMillis)) {
                currentLocation.set(newLocation);
                return true;
            }
            observed = lastLocationEventEpochMillis.get();
        }
        return false; // stale or duplicate ping - ignored
    }

    @Override
    public String toString() {
        return "Driver{" + driverId + ", " + status.get() + ", " + currentLocation.get() + "}";
    }
}`,
    },
    {
      filename: 'DriverLocationIndex.java',
      calloutTitle: '💡 Grid-bucketed spatial index',
      callout:
        "This is the actual answer to \"how do you find nearby drivers efficiently\" instead of scanning every driver in the fleet. Drivers are bucketed by a fixed-size lat/lng cell (a deliberately simplified stand-in for a geohash or Uber's H3 index) so findNearby() only ever inspects the cells a search radius could possibly reach - work that scales with local driver density around the pickup, never with how many drivers are online across the whole city.",
      rationale: 'Also owns the out-of-order-safe location update path, since moving a driver between grid cells has to happen atomically with accepting (or rejecting) its new position.',
      code: `import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class DriverLocationIndex {
    private static final double CELL_SIZE_DEGREES = 0.01; // one grid cell
    private static final double CELL_SIZE_KM = 1.11;      // approx size of one cell at the equator

    private final ConcurrentHashMap<String, Set<Driver>> driversByCell = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> currentCellByDriverId = new ConcurrentHashMap<>();

    public void registerDriver(Driver driver) {
        String cell = cellKeyFor(driver.getLocation());
        driversByCell.computeIfAbsent(cell, c -> ConcurrentHashMap.newKeySet()).add(driver);
        currentCellByDriverId.put(driver.getDriverId(), cell);
    }

    public void removeDriver(Driver driver) {
        String cell = currentCellByDriverId.remove(driver.getDriverId());
        if (cell != null) {
            Set<Driver> bucket = driversByCell.get(cell);
            if (bucket != null) bucket.remove(driver);
        }
    }

    /** Moves the driver to its new cell only if the location update itself was accepted (not stale/out-of-order). */
    public boolean updateDriverLocation(Driver driver, Location newLocation, long eventEpochMillis) {
        if (!driver.updateLocationIfNewer(newLocation, eventEpochMillis)) {
            return false;
        }
        String newCell = cellKeyFor(newLocation);
        String oldCell = currentCellByDriverId.put(driver.getDriverId(), newCell);
        if (oldCell != null && !oldCell.equals(newCell)) {
            Set<Driver> oldBucket = driversByCell.get(oldCell);
            if (oldBucket != null) oldBucket.remove(driver);
        }
        driversByCell.computeIfAbsent(newCell, c -> ConcurrentHashMap.newKeySet()).add(driver);
        return true;
    }

    /**
     * Returns drivers within radiusKm of the pickup with the given status, nearest-first. The
     * search ring expands only as far as the radius requires (ceil(radius / cellSize), plus one
     * cell of slack since the pickup is rarely exactly at a cell's center) - a 500m search and a
     * 5km search touch very different amounts of the grid, but neither ever touches the whole grid.
     */
    public List<Driver> findNearby(Location pickup, double radiusKm, Driver.DriverStatus requiredStatus) {
        int ringSize = Math.max(1, (int) Math.ceil(radiusKm / CELL_SIZE_KM) + 1);
        PriorityQueue<Driver> byDistance = new PriorityQueue<>(
                Comparator.comparingDouble(d -> pickup.distanceKm(d.getLocation())));

        for (String cell : neighborCells(pickup, ringSize)) {
            Set<Driver> bucket = driversByCell.get(cell);
            if (bucket == null) continue;
            for (Driver driver : bucket) {
                if (driver.getStatus() != requiredStatus) continue;
                if (pickup.distanceKm(driver.getLocation()) <= radiusKm) {
                    byDistance.add(driver);
                }
            }
        }

        List<Driver> result = new ArrayList<>();
        while (!byDistance.isEmpty()) {
            result.add(byDistance.poll());
        }
        return result;
    }

    private String cellKeyFor(Location location) {
        long cellSizeMicro = (long) (CELL_SIZE_DEGREES * 1_000_000);
        long latBucket = Math.floorDiv((long) (location.getLatitude() * 1_000_000), cellSizeMicro);
        long lonBucket = Math.floorDiv((long) (location.getLongitude() * 1_000_000), cellSizeMicro);
        return latBucket + "_" + lonBucket;
    }

    private List<String> neighborCells(Location center, int ringSize) {
        List<String> cells = new ArrayList<>();
        for (int dLat = -ringSize; dLat <= ringSize; dLat++) {
            for (int dLon = -ringSize; dLon <= ringSize; dLon++) {
                Location shifted = new Location(
                        center.getLatitude() + dLat * CELL_SIZE_DEGREES,
                        center.getLongitude() + dLon * CELL_SIZE_DEGREES);
                cells.add(cellKeyFor(shifted));
            }
        }
        return cells;
    }
}`,
    },
    {
      filename: 'MatchingStrategy.java',
      rationale: 'A single method taking the already-filtered nearby-and-available candidates, so implementations never touch the spatial index, the offer-claim map, or any concurrency concern - they only ever decide an order.',
      code: `import java.util.List;

public interface MatchingStrategy {
    /** Returns nearbyDrivers ordered best-candidate-first; index 0 is who gets offered the trip. */
    List<Driver> rankCandidates(Location pickup, List<Driver> nearbyDrivers);
}`,
    },
    {
      filename: 'NearestDriverStrategy.java',
      rationale: 'The simplest, cheapest-to-compute policy - straight-line distance to the pickup, ascending. Good default when driver density is high enough that "nearest" and "fastest to arrive" are usually the same driver anyway.',
      code: `import java.util.ArrayList;
import java.util.List;

public final class NearestDriverStrategy implements MatchingStrategy {
    @Override
    public List<Driver> rankCandidates(Location pickup, List<Driver> nearbyDrivers) {
        List<Driver> ranked = new ArrayList<>(nearbyDrivers);
        ranked.sort((a, b) -> Double.compare(
                pickup.distanceKm(a.getLocation()), pickup.distanceKm(b.getLocation())));
        return ranked;
    }
}`,
    },
    {
      filename: 'LeastEtaStrategy.java',
      rationale: "Ranks by estimated time-to-pickup (distance divided by that driver's average speed) rather than raw distance, so a driver 1.5km away doing highway speeds can beat one 900m away stuck on surface streets. A real system would swap the speed estimate for a routing-API ETA behind this same interface.",
      code: `import java.util.ArrayList;
import java.util.List;

public final class LeastEtaStrategy implements MatchingStrategy {
    @Override
    public List<Driver> rankCandidates(Location pickup, List<Driver> nearbyDrivers) {
        List<Driver> ranked = new ArrayList<>(nearbyDrivers);
        ranked.sort((a, b) -> Double.compare(etaMinutes(pickup, a), etaMinutes(pickup, b)));
        return ranked;
    }

    private double etaMinutes(Location pickup, Driver driver) {
        double distanceKm = pickup.distanceKm(driver.getLocation());
        return (distanceKm / driver.getAverageSpeedKmh()) * 60.0;
    }
}`,
    },
    {
      filename: 'FarePricingStrategy.java',
      rationale: 'zoneKey is passed in rather than a Location so implementations never need to know how zones are derived from coordinates - that mapping stays entirely inside the engine and the SurgeZoneTracker.',
      code: `import java.math.BigDecimal;

public interface FarePricingStrategy {
    /** zoneKey identifies the pickup's surge zone so implementations can look up local supply/demand. */
    BigDecimal calculateFare(double distanceKm, double estimatedMinutes, String zoneKey);
}`,
    },
    {
      filename: 'SurgeAwareFarePricingStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This is the whole reason surge pricing never has to touch Trip, RideMatchingEngine, or the matching logic. completeTrip() calls exactly one method - calculateFare() - and has no idea whether the answer came from this surge-aware formula, a flat corporate rate, or a promo-discount decorator wrapped around either one. Changing how surge is computed, or removing it entirely, is a one-class swap.',
      rationale: 'Deliberately takes the already-computed distance/duration rather than recomputing them, so this class stays pure pricing math with no spatial or trip-lifecycle knowledge.',
      code: `import java.math.BigDecimal;
import java.math.RoundingMode;

public final class SurgeAwareFarePricingStrategy implements FarePricingStrategy {
    private final BigDecimal baseFare;
    private final BigDecimal perKmRate;
    private final BigDecimal perMinuteRate;
    private final SurgeZoneTracker surgeZoneTracker;

    public SurgeAwareFarePricingStrategy(BigDecimal baseFare, BigDecimal perKmRate,
                                          BigDecimal perMinuteRate, SurgeZoneTracker surgeZoneTracker) {
        this.baseFare = baseFare;
        this.perKmRate = perKmRate;
        this.perMinuteRate = perMinuteRate;
        this.surgeZoneTracker = surgeZoneTracker;
    }

    @Override
    public BigDecimal calculateFare(double distanceKm, double estimatedMinutes, String zoneKey) {
        BigDecimal metered = baseFare
                .add(perKmRate.multiply(BigDecimal.valueOf(distanceKm)))
                .add(perMinuteRate.multiply(BigDecimal.valueOf(estimatedMinutes)));
        double surgeMultiplier = surgeZoneTracker.getSurgeMultiplier(zoneKey);
        return metered.multiply(BigDecimal.valueOf(surgeMultiplier)).setScale(2, RoundingMode.HALF_UP);
    }
}`,
    },
    {
      filename: 'SurgeZoneTracker.java',
      rationale: 'Keeps supply and demand as two independent per-zone AtomicInteger counters rather than recomputing either from scratch on every fare calculation - registering/releasing a driver or opening/closing a request is an O(1) increment, and the multiplier is a cheap read-time ratio over whatever the counters currently say.',
      code: `import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public final class SurgeZoneTracker {
    private static final double MAX_MULTIPLIER = 3.0;
    private static final double SENSITIVITY = 0.5;

    private final ConcurrentHashMap<String, AtomicInteger> openRequestsByZone = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicInteger> availableDriversByZone = new ConcurrentHashMap<>();

    public void recordRequestOpened(String zoneKey) {
        openRequestsByZone.computeIfAbsent(zoneKey, z -> new AtomicInteger()).incrementAndGet();
    }

    public void recordRequestClosed(String zoneKey) {
        openRequestsByZone.computeIfAbsent(zoneKey, z -> new AtomicInteger()).decrementAndGet();
    }

    public void driverBecameAvailable(String zoneKey) {
        availableDriversByZone.computeIfAbsent(zoneKey, z -> new AtomicInteger()).incrementAndGet();
    }

    public void driverBecameUnavailable(String zoneKey) {
        availableDriversByZone.computeIfAbsent(zoneKey, z -> new AtomicInteger()).decrementAndGet();
    }

    /** 1.0x when supply covers demand; scales up toward MAX_MULTIPLIER as demand outstrips supply. */
    public double getSurgeMultiplier(String zoneKey) {
        int demand = openRequestsByZone.getOrDefault(zoneKey, new AtomicInteger()).get();
        int supply = Math.max(1, availableDriversByZone.getOrDefault(zoneKey, new AtomicInteger()).get());
        double imbalance = Math.max(0, demand - supply) / (double) supply;
        return Math.min(MAX_MULTIPLIER, 1.0 + imbalance * SENSITIVITY);
    }
}`,
    },
    {
      filename: 'Trip.java',
      rationale: "TripStatus is nested since nothing else needs it independently of a Trip. Every transition is a compareAndSet from the one status that may legally precede it - not a plain field write guarded by an if - because a rider's cancel click and a driver's accept can genuinely arrive on different threads for the same trip at nearly the same time.",
      code: `import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicReference;

public final class Trip {

    public enum TripStatus { REQUESTED, MATCHED, DRIVER_ARRIVING, IN_PROGRESS, COMPLETED, CANCELLED }

    private final String tripId;
    private final String riderId;
    private final Location pickup;
    private final Location dropoff;
    private final AtomicReference<TripStatus> status = new AtomicReference<>(TripStatus.REQUESTED);
    private volatile String assignedDriverId;
    private volatile BigDecimal fare;
    private volatile String cancellationReason;

    public Trip(String tripId, String riderId, Location pickup, Location dropoff) {
        this.tripId = tripId;
        this.riderId = riderId;
        this.pickup = pickup;
        this.dropoff = dropoff;
    }

    public void matchDriver(Driver driver) {
        if (!status.compareAndSet(TripStatus.REQUESTED, TripStatus.MATCHED)) {
            throw new IllegalStateException("Cannot match a driver onto trip " + tripId + " in state " + status.get());
        }
        this.assignedDriverId = driver.getDriverId();
    }

    public void markDriverArriving() {
        if (!status.compareAndSet(TripStatus.MATCHED, TripStatus.DRIVER_ARRIVING)) {
            throw new IllegalStateException("Cannot mark driver arriving for trip " + tripId + " in state " + status.get());
        }
    }

    public void startTrip() {
        if (!status.compareAndSet(TripStatus.DRIVER_ARRIVING, TripStatus.IN_PROGRESS)) {
            throw new IllegalStateException("Cannot start trip " + tripId + " in state " + status.get());
        }
    }

    public void completeTrip(BigDecimal finalFare) {
        if (!status.compareAndSet(TripStatus.IN_PROGRESS, TripStatus.COMPLETED)) {
            throw new IllegalStateException("Cannot complete trip " + tripId + " in state " + status.get());
        }
        this.fare = finalFare;
    }

    public void cancel(String reason) {
        TripStatus current = status.get();
        if (current == TripStatus.IN_PROGRESS || current == TripStatus.COMPLETED || current == TripStatus.CANCELLED) {
            throw new IllegalStateException("Cannot cancel trip " + tripId + " in state " + current);
        }
        if (!status.compareAndSet(current, TripStatus.CANCELLED)) {
            throw new IllegalStateException("Trip " + tripId + " changed state concurrently - retry cancel");
        }
        this.cancellationReason = reason;
    }

    public String getTripId() { return tripId; }
    public String getRiderId() { return riderId; }
    public Location getPickup() { return pickup; }
    public Location getDropoff() { return dropoff; }
    public TripStatus getStatus() { return status.get(); }
    public String getAssignedDriverId() { return assignedDriverId; }
    public BigDecimal getFare() { return fare; }
    public String getCancellationReason() { return cancellationReason; }
}`,
    },
    {
      filename: 'DriverOffer.java',
      rationale: 'Immutable except for the passage of time, exactly like Hold in the restaurant-booking design - isExpired() is computed from a fixed expiresAt instead of relying on some background job to mark it expired, so it is always correct even if nothing ever sweeps it.',
      code: `import java.time.Instant;

public final class DriverOffer {
    private final String offerId;
    private final String driverId;
    private final String tripId;
    private final Instant expiresAt;

    public DriverOffer(String offerId, String driverId, String tripId, Instant expiresAt) {
        this.offerId = offerId;
        this.driverId = driverId;
        this.tripId = tripId;
        this.expiresAt = expiresAt;
    }

    public boolean isExpired() { return Instant.now().isAfter(expiresAt); }

    public String getOfferId() { return offerId; }
    public String getDriverId() { return driverId; }
    public String getTripId() { return tripId; }
    public Instant getExpiresAt() { return expiresAt; }
}`,
    },
    {
      filename: 'TripObserver.java',
      rationale: 'Two narrow methods instead of one generic "somethingChanged" callback, so an implementation that only cares about status changes (e.g. an ops dashboard) is not forced to also handle a firehose of location pings.',
      code: `public interface TripObserver {
    void onDriverLocationUpdated(Trip trip, Driver driver, Location location);
    void onTripStatusChanged(Trip trip, Trip.TripStatus previousStatus, Trip.TripStatus newStatus);
}`,
    },
    {
      filename: 'RiderNotifier.java',
      rationale: 'Prints to the console instead of calling a real push-notification API - production code would swap those two lines; RideMatchingEngine would not change at all, which is the entire point of routing this through the TripObserver interface.',
      code: `public final class RiderNotifier implements TripObserver {
    @Override
    public void onDriverLocationUpdated(Trip trip, Driver driver, Location location) {
        System.out.println("[Notify " + trip.getRiderId() + "] driver " + driver.getDriverId()
                + " is now at " + location + " (trip " + trip.getTripId() + ")");
    }

    @Override
    public void onTripStatusChanged(Trip trip, Trip.TripStatus previousStatus, Trip.TripStatus newStatus) {
        System.out.println("[Notify " + trip.getRiderId() + "] trip " + trip.getTripId()
                + ": " + previousStatus + " -> " + newStatus);
    }
}`,
    },
    {
      filename: 'NoDriverAvailableException.java',
      rationale: 'A checked business exception - callers must explicitly decide what to do (widen the radius, ask the rider to wait, surface a "try again" message) rather than treating "nobody accepted" as an unexpected crash.',
      code: `public final class NoDriverAvailableException extends Exception {
    public NoDriverAvailableException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'RideMatchingEngine.java',
      calloutTitle: '💡 Atomic driver claim via compute()',
      callout:
        "tryClaimDriver() is the exact same shape as RestaurantBookingService.tryClaim() in the table-booking design - a ConcurrentHashMap.compute() on a single key - just keyed on driverId instead of a (table, slot) pair. The check ('is this driver free right now?') and the act ('take them') happen as one atomic step per key, with no explicit lock, so two riders racing for the same nearby driver can never both walk away believing they hold it.",
      rationale: 'The aggregate root. It delegates "who to search" to DriverLocationIndex, "who to rank first" to MatchingStrategy, "what it costs" to FarePricingStrategy, and "who to tell" to the observers - keeping its own methods focused on orchestrating the request -> offer -> fallback -> lifecycle flow and the one concurrency-critical operation.',
      code: `import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

public final class RideMatchingEngine {
    private static final Duration OFFER_TTL = Duration.ofSeconds(15);
    private static final double SEARCH_RADIUS_KM = 5.0;

    private final ConcurrentHashMap<String, Driver> driversById = new ConcurrentHashMap<>();
    private final DriverLocationIndex locationIndex;
    private final MatchingStrategy matchingStrategy;
    private final FarePricingStrategy farePricingStrategy;
    private final SurgeZoneTracker surgeZoneTracker;
    private final ConcurrentHashMap<String, DriverOffer> activeOfferByDriverId = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Driver>> pendingCandidatesByTripId = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> offeredDriverIdByTripId = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Trip> tripsById = new ConcurrentHashMap<>();
    private final List<TripObserver> observers = new ArrayList<>();
    private final AtomicLong tripSequence = new AtomicLong();
    private final AtomicLong offerSequence = new AtomicLong();

    public RideMatchingEngine(DriverLocationIndex locationIndex, MatchingStrategy matchingStrategy,
                               FarePricingStrategy farePricingStrategy, SurgeZoneTracker surgeZoneTracker) {
        this.locationIndex = locationIndex;
        this.matchingStrategy = matchingStrategy;
        this.farePricingStrategy = farePricingStrategy;
        this.surgeZoneTracker = surgeZoneTracker;
    }

    public void registerObserver(TripObserver observer) { observers.add(observer); }

    public void registerDriver(Driver driver) {
        driversById.put(driver.getDriverId(), driver);
        driver.setStatus(Driver.DriverStatus.AVAILABLE);
        locationIndex.registerDriver(driver);
        surgeZoneTracker.driverBecameAvailable(zoneKeyFor(driver.getLocation()));
    }

    public void updateDriverLocation(String driverId, Location newLocation, long eventEpochMillis) {
        Driver driver = driversById.get(driverId);
        if (driver == null) return;
        boolean applied = locationIndex.updateDriverLocation(driver, newLocation, eventEpochMillis);
        if (!applied) return; // stale/out-of-order ping - already dropped
        String tripId = activeOfferByDriverId.containsKey(driverId) ? activeOfferByDriverId.get(driverId).getTripId() : null;
        if (tripId != null) {
            Trip trip = tripsById.get(tripId);
            if (trip != null) {
                observers.forEach(o -> o.onDriverLocationUpdated(trip, driver, newLocation));
            }
        }
    }

    /**
     * Finds nearby AVAILABLE drivers, ranks them, and atomically claims the best one that is still
     * actually free by the time the claim runs. Returns the pending offer for the caller (the
     * rider's app) to await a driver decision on.
     */
    public DriverOffer requestRide(String riderId, Location pickup, Location dropoff) throws NoDriverAvailableException {
        String tripId = "TRIP-" + tripSequence.incrementAndGet();
        Trip trip = new Trip(tripId, riderId, pickup, dropoff);
        tripsById.put(tripId, trip);
        surgeZoneTracker.recordRequestOpened(zoneKeyFor(pickup));

        List<Driver> nearby = locationIndex.findNearby(pickup, SEARCH_RADIUS_KM, Driver.DriverStatus.AVAILABLE);
        Deque<Driver> ranked = new ArrayDeque<>(matchingStrategy.rankCandidates(pickup, nearby));
        pendingCandidatesByTripId.put(tripId, ranked);

        DriverOffer offer = offerNextCandidate(trip);
        if (offer == null) {
            trip.cancel("No driver accepted the trip");
            surgeZoneTracker.recordRequestClosed(zoneKeyFor(pickup));
            throw new NoDriverAvailableException("No available driver found near " + pickup);
        }
        return offer;
    }

    /** Pops candidates off this trip's fallback queue, atomically claiming each, until one succeeds. */
    private DriverOffer offerNextCandidate(Trip trip) {
        Deque<Driver> remaining = pendingCandidatesByTripId.get(trip.getTripId());
        if (remaining == null) return null;
        Driver candidate;
        while ((candidate = remaining.poll()) != null) {
            Optional<DriverOffer> claimed = tryClaimDriver(candidate, trip.getTripId());
            if (claimed.isPresent()) {
                offeredDriverIdByTripId.put(trip.getTripId(), candidate.getDriverId());
                return claimed.get();
            }
            // Someone else already holds this driver, or it went offline between search and claim - try the next.
        }
        return null;
    }

    /**
     * Atomically claims a driver for a trip via ConcurrentHashMap.compute() keyed on driverId - the
     * exact same shape as claiming a (table, slot) pair, just keyed on the driver instead. Exactly
     * one caller ever installs a live, unexpired DriverOffer for a given driver at a time.
     */
    private Optional<DriverOffer> tryClaimDriver(Driver driver, String tripId) {
        AtomicReference<DriverOffer> claimed = new AtomicReference<>();
        activeOfferByDriverId.compute(driver.getDriverId(), (driverId, existing) -> {
            if (existing != null && !existing.isExpired()) {
                return existing; // another trip's offer is still live on this driver - claim fails
            }
            if (driver.getStatus() != Driver.DriverStatus.AVAILABLE) {
                return existing; // went offline/on-trip between the search and this claim attempt
            }
            DriverOffer fresh = new DriverOffer(
                    "OFFER-" + offerSequence.incrementAndGet(), driverId, tripId, Instant.now().plus(OFFER_TTL));
            driver.setStatus(Driver.DriverStatus.EN_ROUTE);
            surgeZoneTracker.driverBecameUnavailable(zoneKeyFor(driver.getLocation()));
            claimed.set(fresh);
            return fresh;
        });
        return Optional.ofNullable(claimed.get());
    }

    /** Driver accepts or rejects a pending offer; a rejection or a too-late acceptance falls through to the next candidate. */
    public void respondToOffer(String driverId, String tripId, boolean accepted) {
        DriverOffer offer = activeOfferByDriverId.get(driverId);
        Driver driver = driversById.get(driverId);
        Trip trip = tripsById.get(tripId);
        if (offer == null || driver == null || trip == null || !offer.getTripId().equals(tripId)) {
            return; // stale response - nothing to do
        }

        if (accepted && !offer.isExpired()) {
            Trip.TripStatus previous = trip.getStatus();
            trip.matchDriver(driver);
            observers.forEach(o -> o.onTripStatusChanged(trip, previous, trip.getStatus()));
            return;
        }

        // Rejected, or accepted too late - release the driver and try the next-nearest candidate.
        releaseDriver(driver);
        DriverOffer nextOffer = offerNextCandidate(trip);
        if (nextOffer == null) {
            trip.cancel("No driver accepted the trip");
            offeredDriverIdByTripId.remove(tripId);
            surgeZoneTracker.recordRequestClosed(zoneKeyFor(trip.getPickup()));
        }
    }

    public void driverArrived(String tripId) {
        Trip trip = requireTrip(tripId);
        Trip.TripStatus previous = trip.getStatus();
        trip.markDriverArriving();
        observers.forEach(o -> o.onTripStatusChanged(trip, previous, trip.getStatus()));
    }

    public void startTrip(String tripId) {
        Trip trip = requireTrip(tripId);
        Trip.TripStatus previous = trip.getStatus();
        trip.startTrip();
        Driver driver = driversById.get(trip.getAssignedDriverId());
        if (driver != null) {
            driver.setStatus(Driver.DriverStatus.ON_TRIP);
        }
        observers.forEach(o -> o.onTripStatusChanged(trip, previous, trip.getStatus()));
    }

    public Trip completeTrip(String tripId, double distanceKm, double durationMinutes) {
        Trip trip = requireTrip(tripId);
        Trip.TripStatus previous = trip.getStatus();
        BigDecimal fare = farePricingStrategy.calculateFare(distanceKm, durationMinutes, zoneKeyFor(trip.getPickup()));
        trip.completeTrip(fare);
        Driver driver = driversById.get(trip.getAssignedDriverId());
        if (driver != null) {
            releaseDriver(driver);
        }
        offeredDriverIdByTripId.remove(tripId);
        surgeZoneTracker.recordRequestClosed(zoneKeyFor(trip.getPickup()));
        observers.forEach(o -> o.onTripStatusChanged(trip, previous, trip.getStatus()));
        return trip;
    }

    public void cancelTrip(String tripId, String reason) {
        Trip trip = requireTrip(tripId);
        Trip.TripStatus previous = trip.getStatus();
        trip.cancel(reason);
        String driverId = trip.getAssignedDriverId();
        if (driverId == null) {
            driverId = offeredDriverIdByTripId.get(tripId); // still just a pending, unaccepted offer
        }
        if (driverId != null) {
            Driver driver = driversById.get(driverId);
            if (driver != null) releaseDriver(driver);
        }
        offeredDriverIdByTripId.remove(tripId);
        surgeZoneTracker.recordRequestClosed(zoneKeyFor(trip.getPickup()));
        observers.forEach(o -> o.onTripStatusChanged(trip, previous, trip.getStatus()));
    }

    public String getOfferedDriverId(String tripId) { return offeredDriverIdByTripId.get(tripId); }

    private void releaseDriver(Driver driver) {
        activeOfferByDriverId.remove(driver.getDriverId());
        driver.setStatus(Driver.DriverStatus.AVAILABLE);
        surgeZoneTracker.driverBecameAvailable(zoneKeyFor(driver.getLocation()));
    }

    private Trip requireTrip(String tripId) {
        Trip trip = tripsById.get(tripId);
        if (trip == null) throw new IllegalArgumentException("Unknown trip: " + tripId);
        return trip;
    }

    /** A coarser grid than DriverLocationIndex's - surge is tracked per neighborhood, not per city block. */
    private String zoneKeyFor(Location location) {
        long latZone = Math.floorDiv((long) (location.getLatitude() * 100), 10);
        long lonZone = Math.floorDiv((long) (location.getLongitude() * 100), 10);
        return "zone_" + latZone + "_" + lonZone;
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy path, a simulated driver decline that falls through to the next-nearest candidate, and - since race-free driver claiming is a stated non-functional requirement - a concurrency stress test proving that 40 riders hammering the same tiny pool of nearby drivers never results in two riders claiming the same one.',
      code: `import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public final class Demo {
    public static void main(String[] args) throws Exception {
        SurgeZoneTracker surgeZoneTracker = new SurgeZoneTracker();
        DriverLocationIndex locationIndex = new DriverLocationIndex();
        FarePricingStrategy farePricingStrategy = new SurgeAwareFarePricingStrategy(
                BigDecimal.valueOf(2.50), BigDecimal.valueOf(1.20), BigDecimal.valueOf(0.35), surgeZoneTracker);
        RideMatchingEngine engine = new RideMatchingEngine(
                locationIndex, new NearestDriverStrategy(), farePricingStrategy, surgeZoneTracker);
        engine.registerObserver(new RiderNotifier());

        Location downtown = new Location(37.7749, -122.4194);
        Driver near = new Driver("D-1", new Location(37.7755, -122.4200)); // a couple hundred meters away
        Driver mid = new Driver("D-2", new Location(37.7800, -122.4250));  // roughly 0.7km away
        Driver far = new Driver("D-3", new Location(37.7900, -122.4400));  // roughly 2.5km away, still in radius
        engine.registerDriver(near);
        engine.registerDriver(mid);
        engine.registerDriver(far);

        // --- Happy path: proximity match -> accept -> arrive -> start -> complete ---
        DriverOffer offer1 = engine.requestRide("alice", downtown, new Location(37.8044, -122.2712));
        System.out.println("alice offered driver " + offer1.getDriverId() + " (expected D-1, the nearest)");
        engine.respondToOffer(offer1.getDriverId(), offer1.getTripId(), true);
        engine.driverArrived(offer1.getTripId());
        engine.startTrip(offer1.getTripId());
        Trip completedTripA = engine.completeTrip(offer1.getTripId(), 13.4, 22.0);
        System.out.println("alice's trip completed, fare=$" + completedTripA.getFare());

        // --- Fallback: nearest driver declines, engine falls through to the next-nearest ---
        DriverOffer offer2 = engine.requestRide("bob", downtown, new Location(37.7955, -122.3937));
        System.out.println("bob initially offered " + offer2.getDriverId() + " (D-1 again, now free after alice's trip)");
        engine.respondToOffer(offer2.getDriverId(), offer2.getTripId(), false); // simulate a decline
        String fallbackDriverId = engine.getOfferedDriverId(offer2.getTripId());
        System.out.println("after decline, bob was rerouted to " + fallbackDriverId + " (expected D-2, next-nearest)");
        engine.respondToOffer(fallbackDriverId, offer2.getTripId(), true);
        engine.driverArrived(offer2.getTripId());
        engine.startTrip(offer2.getTripId());
        engine.completeTrip(offer2.getTripId(), 6.1, 14.0);

        // --- Concurrency stress test: 40 riders race for a pool of only 3 nearby AVAILABLE drivers ---
        Driver s1 = new Driver("S-1", new Location(40.7128, -74.0060));
        Driver s2 = new Driver("S-2", new Location(40.7135, -74.0065));
        Driver s3 = new Driver("S-3", new Location(40.7140, -74.0070));
        engine.registerDriver(s1);
        engine.registerDriver(s2);
        engine.registerDriver(s3);
        Location stressPickup = new Location(40.7130, -74.0062);

        int riderCount = 40;
        ExecutorService pool = Executors.newFixedThreadPool(riderCount);
        AtomicInteger successCount = new AtomicInteger();
        Set<String> claimedDriverIds = ConcurrentHashMap.newKeySet();
        CountDownLatch done = new CountDownLatch(riderCount);
        for (int i = 0; i < riderCount; i++) {
            String riderId = "stress-rider-" + i;
            pool.submit(() -> {
                try {
                    DriverOffer offer = engine.requestRide(riderId, stressPickup, downtown);
                    successCount.incrementAndGet();
                    claimedDriverIds.add(offer.getDriverId());
                } catch (NoDriverAvailableException ignored) {
                    // Expected once all 3 nearby drivers have already been claimed by other threads.
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();
        System.out.println("Riders matched: " + successCount.get() + " (expected 3)");
        System.out.println("Distinct drivers claimed: " + claimedDriverIds.size() + " (expected 3 - no driver double-claimed)");
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Trip Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> REQUESTED: requestRide()
  REQUESTED --> MATCHED: driver accepts offer
  REQUESTED --> CANCELLED: no driver accepts / rider cancels
  MATCHED --> DRIVER_ARRIVING: driver reaches pickup
  MATCHED --> CANCELLED: rider or driver cancels before pickup
  DRIVER_ARRIVING --> IN_PROGRESS: startTrip()
  DRIVER_ARRIVING --> CANCELLED: rider no-show / driver cancels
  IN_PROGRESS --> COMPLETED: completeTrip()
  COMPLETED --> [*]
  CANCELLED --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Request, Match, and Fall Back on Decline',
    mermaid: `sequenceDiagram
  autonumber
  participant Rider
  participant Engine as RideMatchingEngine
  participant Index as DriverLocationIndex
  participant Strategy as MatchingStrategy
  participant Offers as activeOfferByDriverId
  participant D1 as Driver (nearest)
  participant D2 as Driver (next-nearest)

  Rider->>Engine: requestRide(riderId, pickup, dropoff)
  Engine->>Index: findNearby(pickup, radiusKm, AVAILABLE)
  Index-->>Engine: candidate drivers
  Engine->>Strategy: rankCandidates(pickup, candidates)
  Strategy-->>Engine: ranked [D1, D2, ...]
  Engine->>Offers: compute(D1.driverId) - atomic claim
  Offers-->>Engine: fresh DriverOffer installed, D1 -> EN_ROUTE
  Engine-->>Rider: DriverOffer (pending D1's decision)
  D1->>Engine: respondToOffer(D1, tripId, accepted=false)
  Engine->>D1: release (status -> AVAILABLE)
  Engine->>Offers: compute(D2.driverId) - atomic claim
  Offers-->>Engine: fresh DriverOffer installed, D2 -> EN_ROUTE
  D2->>Engine: respondToOffer(D2, tripId, accepted=true)
  Engine->>Engine: Trip.matchDriver(D2) - REQUESTED -> MATCHED
  Engine-->>Rider: tripStatusChanged: MATCHED (driver D2)`,
  },

  extensions: [
    { extension: 'Real routing-based ETA', implementation: "Swap LeastEtaStrategy's straight-line/average-speed estimate for a call to a routing service (OSRM, Google Directions) behind the same MatchingStrategy interface - nothing in RideMatchingEngine changes." },
    { extension: 'Batched / pooled matching', implementation: 'Replace the one-driver-at-a-time greedy offer loop with a periodic bipartite-matching solver over all open requests and available drivers in a zone, still claiming winners through the exact same tryClaimDriver() atomic primitive.' },
    { extension: 'Background offer sweeper', implementation: 'Add a ScheduledExecutorService that proactively scans activeOfferByDriverId for expired offers and triggers the fallback path itself, instead of only discovering an expired offer lazily the next time respondToOffer() or a claim attempt touches that driver.' },
    { extension: 'Multiple vehicle types (X / XL / Pool)', implementation: 'Add a vehicleType dimension to Driver and to findNearby()/rankCandidates(), and give each vehicle type its own FarePricingStrategy instance.' },
    { extension: 'Acceptance-rate-aware ranking', implementation: "Feed a driver's historical accept/reject rate and rating into MatchingStrategy so a driver who reliably declines long pickups is ranked below a slightly-farther driver who reliably accepts." },
    { extension: 'City/region sharding', implementation: 'Run one RideMatchingEngine (and one DriverLocationIndex, one SurgeZoneTracker) per city, exactly like running one RestaurantBookingService per location - a trip never needs to search across a city boundary.' },
  ],

  interviewerChecklist: [
    "Does the candidate use a real spatial data structure (grid/geohash/quadtree) for proximity search, or default to \"loop over every driver and compute distance\"? Can they explain why that does not scale?",
    'Is claiming a driver for an offer a genuine atomic operation (compute()/CAS) rather than a check-then-act race (get() null-check followed by a separate write)?',
    'Does a driver rejection or offer timeout fall through to the next-nearest candidate automatically, or does the candidate let the whole ride request fail on a single "no"?',
    'Is the trip lifecycle modeled with explicit guarded transitions, and does the candidate explain why cancel() needs to check state before writing it, given that a cancel and an accept can race?',
    'Is fare calculation (and specifically surge) pulled out behind an interface, or hardcoded inline in whatever method also does the matching?',
    'Does the candidate address out-of-order or duplicate location updates at all, or assume pings always arrive in send order?',
  ],

  relatedDesigns: ['restaurant-booking', 'order-management', 'elevator-system'],
  keyTakeaways: [
    'A grid/geohash-bucketed index is the standard answer to "find nearby X efficiently" for any location-based matching problem - the trick is always to bucket by a spatial key so a search only touches nearby buckets, never the whole dataset.',
    "ConcurrentHashMap.compute() keyed on the scarce resource - a (table, slot) pair in restaurant-booking, a driverId here - is the general-purpose tool for 'claim this atomically without a coarse lock,' regardless of what the resource actually is.",
    "Offer-with-timeout-and-fallback (claim a candidate, give it a bounded decision window, fall through to the next on reject/timeout) is the same shape as hold-with-expiry: a short-lived, self-expiring claim that never depends on a background sweeper to stay correct.",
    'Strategy for both the ranking policy and the pricing policy keeps two completely independent business decisions - who gets offered a ride, and what it costs - from ever tangling with each other or with the trip lifecycle code.',
  ],
}

export default problem

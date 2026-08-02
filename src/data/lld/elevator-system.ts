import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'elevator-system',
  title: 'Elevator System',
  difficulty: 'Advanced',
  icon: 'pi pi-sort-alt',
  color: '#ef4444',
  readTimeMinutes: 22,
  patterns: ['Strategy', 'State', 'Facade'],
  companies: ['Amazon', 'Google', 'Otis', 'Uber'],
  summary:
    'A multi-car elevator bank that dispatches hall calls to whichever car can serve them fastest - including cars already en route in a compatible direction - while each car independently schedules its own pending stops and the whole system stays correct under concurrent button presses.',

  functionalRequirements: [
    'Support N elevator cars in one shaft group, each independently tracking its own current floor and travel state.',
    "A hall call (floor button pressed on a landing, with a direction) triggers a dispatch decision that assigns exactly one car to answer it.",
    'A cabin call (floor button pressed inside a car) adds a stop directly to that specific car and never goes through dispatch.',
    "A car already moving toward a hall call's floor in a compatible direction should be preferred over sending a farther, idle car, so it can pick the rider up en route instead of dispatching a second car.",
    'Each car services its pending stops nearest-first in its current direction of travel, and only reverses direction once it has no more stops on that side.',
    "Two hall calls arriving at the same instant must never both be assigned in a way that drops one or double-books a single car's next move.",
    'The dispatch algorithm itself must be swappable (e.g. a zone-restricted lobby elevator) without changing how hall panels or cabin panels talk to the system.',
  ],
  nonFunctionalRequirements: [
    "Mutating a single car's stop list (addStop) and advancing its trajectory (step) must be safe under concurrent hall/cabin calls from multiple panels - via a per-car lock, not one lock for the whole building.",
    'Selecting a car for a hall call and committing that car to the stop must be atomic together, otherwise two near-simultaneous hall calls can both score the same car as "best" before either one commits.',
    'Scoring cars for dispatch must be O(number of cars), not O(cars x floors) - it must never scan a car\'s entire stop list just to answer "how close is this car?".',
    'Finding the next stop a car should visit must be O(log n) in that car\'s pending-stop count, not a linear scan or re-sort on every simulation tick.',
  ],

  coreEntities: [
    { name: 'Direction', description: 'Enum (UP / DOWN) used both for what a hall-call rider wants and for comparing it against a car\'s current travel direction.' },
    { name: 'ElevatorState', description: 'Enum (IDLE, MOVING_UP, MOVING_DOWN, DOORS_OPEN) that drives exactly what addStop() and step() do next on a car.' },
    { name: 'Request', description: 'A value object for one hall call - the floor where the button was pressed plus the direction the rider wants to travel.' },
    { name: 'ElevatorCar', description: "One physical cabin. Owns its own floor, state, and two TreeSets of pending stops split above/below its current floor." },
    { name: 'DispatchStrategy', description: 'Interface for choosing which car answers a hall call - the swappable brain behind requestElevator().' },
    { name: 'NearestCarDispatchStrategy', description: 'The concrete strategy implemented here: scores en-route compatibility before raw floor distance.' },
    { name: 'ElevatorSystem', description: 'The facade - the only object hall panels and cabin panels ever hold a reference to.' },
    { name: 'HallCallPanel / CabinPanel', description: 'The two thin client entry points the facade was built to keep dumb - a floor number and a button, nothing about dispatch.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Direction {
    <<enumeration>>
    UP
    DOWN
  }
  class ElevatorState {
    <<enumeration>>
    IDLE
    MOVING_UP
    MOVING_DOWN
    DOORS_OPEN
  }
  class Request {
    -int floor
    -Direction direction
    +getFloor() int
    +getDirection() Direction
  }
  class ElevatorCar {
    -String id
    -int currentFloor
    -ElevatorState state
    -TreeSet~Integer~ stopsAbove
    -TreeSet~Integer~ stopsBelow
    +addStop(int) void
    +step() void
    +getCurrentFloor() int
    +getState() ElevatorState
  }
  class DispatchStrategy {
    <<interface>>
    +selectCar(List~ElevatorCar~, Request) ElevatorCar
  }
  class NearestCarDispatchStrategy {
    +selectCar(List~ElevatorCar~, Request) ElevatorCar
    -score(ElevatorCar, Request) int
  }
  class ElevatorSystem {
    -List~ElevatorCar~ cars
    -DispatchStrategy dispatchStrategy
    -Object dispatchLock
    +requestElevator(int, Direction) ElevatorCar
    +selectFloor(String, int) void
    +tick() void
  }
  class HallCallPanel {
    -int floor
    +pressUp() void
    +pressDown() void
  }
  class CabinPanel {
    -String carId
    +pressFloor(int) void
  }

  DispatchStrategy <|.. NearestCarDispatchStrategy
  NearestCarDispatchStrategy ..> Request : scores
  NearestCarDispatchStrategy ..> ElevatorCar : scores
  ElevatorSystem o-- ElevatorCar
  ElevatorSystem o-- DispatchStrategy
  ElevatorSystem ..> Request : creates
  HallCallPanel --> ElevatorSystem : requestElevator()
  CabinPanel --> ElevatorSystem : selectFloor()
  ElevatorCar --> ElevatorState
  Request --> Direction`,
  },

  designPatterns: [
    {
      pattern: 'Strategy',
      where: 'DispatchStrategy + NearestCarDispatchStrategy',
      why: 'ElevatorSystem never hard-codes "which car answers a hall call" - it delegates to whatever DispatchStrategy it was built with, so a building can swap in zone-restricted or load-balanced dispatch without touching the facade.',
    },
    {
      pattern: 'State',
      where: 'ElevatorState driving ElevatorCar.step() and ElevatorCar.addStop()',
      why: "A car's behavior when a new stop arrives, or when a tick elapses, depends entirely on whether it's IDLE, mid-trip, or sitting with doors open - modeling that explicitly as a state enum keeps the transition logic in one place instead of scattered booleans (isMoving, doorsOpen, direction) that could contradict each other.",
    },
    {
      pattern: 'Facade',
      where: 'ElevatorSystem.requestElevator() / selectFloor()',
      why: 'Hall panels and cabin panels only ever call two methods. Every bit of multi-car dispatch, locking, and per-car scheduling complexity lives behind that facade and can change freely without touching a single panel.',
    },
  ],

  dataStructures: [
    {
      component: "A car's pending stops",
      structure: 'Two TreeSet<Integer> - stopsAbove and stopsBelow, split relative to the car\'s current floor at insertion time',
      why: "TreeSet.first() on stopsAbove and TreeSet.last() on stopsBelow give the nearest stop in the car's current direction in O(log n), so the car always finishes sweeping one direction before reversing - the same idea as the SCAN disk-scheduling algorithm.",
    },
    {
      component: 'Dispatch candidate scoring',
      structure: 'A plain linear scan (List<ElevatorCar>) scored one at a time',
      why: 'A shaft group is a handful of cars (single digits to low tens), so O(cars) per hall call is effectively O(1) in practice - a priority queue or index here would be solving a problem that does not exist at this scale.',
    },
    {
      component: 'Car lookup for cabin calls',
      structure: "ElevatorSystem.findCar(carId) over the same List<ElevatorCar>",
      why: 'Kept as a list (not a Map<String, ElevatorCar>) deliberately in this write-up because dispatch needs to iterate every car anyway; a real system with dozens of cars would add a Map purely to make selectFloor() O(1).',
    },
  ],

  walkthroughs: [
    {
      title: 'Hall Call Flow (dispatch across cars)',
      steps: [
        'A rider presses UP on floor 8; HallCallPanel.pressUp() calls ElevatorSystem.requestElevator(8, Direction.UP) - the panel knows nothing beyond that.',
        'requestElevator() wraps a Request(8, UP) and enters a synchronized block on the shared dispatchLock so no other hall call can interleave between "pick a car" and "commit to it".',
        'NearestCarDispatchStrategy.selectCar() scores every car: an IDLE car scores its raw floor distance; a car MOVING_UP at or below floor 8 scores the same distance with zero penalty (it can pick the rider up en route); anything moving the wrong way or already past the floor gets a heavy penalty added on top of its distance.',
        'The lowest-scoring car wins ties by iteration order, so among equally good candidates the first one considered is chosen deterministically.',
        'ElevatorSystem calls chosen.addStop(8) while still holding dispatchLock, so the car\'s own synchronized addStop() and the dispatch decision are effectively one atomic operation from the outside.',
        "The car buckets floor 8 into stopsAbove or stopsBelow relative to its own current floor, and flips out of IDLE if it wasn't already moving.",
      ],
    },
    {
      title: "A Car's Own Trip (cabin call + tick-by-tick scheduling)",
      steps: [
        'A rider inside car C presses floor 9; CabinPanel.pressFloor(9) calls ElevatorSystem.selectFloor("C", 9), which goes straight to that car - no dispatch strategy is involved at all.',
        'ElevatorCar.addStop(9) is synchronized on the car itself: since 9 is above the car\'s current floor, it lands in stopsAbove, and if the car was IDLE its state flips to MOVING_UP.',
        "On each simulation tick, ElevatorSystem.tick() calls step() on every car; a MOVING_UP car advances one floor and checks whether it just reached stopsAbove.first().",
        'Reaching that floor pops it from the set and flips state to DOORS_OPEN - the car does not need to know or care whether that stop came from a hall call or a cabin call.',
        'While that car is mid-trip, a new hall call in the same direction and not yet passed can still be folded into the same stopsAbove set - it will simply be visited in floor order alongside the existing stop.',
        "Once a direction's set empties, the car checks the other set: if it has stops, the car reverses; if not, it goes IDLE and waits for the next call.",
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Direction.java',
      rationale: 'A two-value enum shared by Request (what the rider wants) and the dispatch strategy (what the car is currently doing), so the compiler enforces that the two are always compared as the same type.',
      code: `public enum Direction {
    UP,
    DOWN
}`,
    },
    {
      filename: 'ElevatorState.java',
      calloutTitle: '💡 State, kept lightweight',
      callout:
        "A textbook State pattern would give each state its own class implementing a common interface. For four states with tightly related transition logic, that ceremony buys little - an enum plus a switch inside ElevatorCar keeps all four transitions readable in one file, while still giving every other class (dispatch, panels, Demo) a real typed state to branch on instead of ad hoc booleans.",
      rationale: 'Four states cover everything a car can be doing: nothing to do, travelling in one of two directions, or paused with doors open mid-stop.',
      code: `public enum ElevatorState {
    IDLE,
    MOVING_UP,
    MOVING_DOWN,
    DOORS_OPEN
}`,
    },
    {
      filename: 'Request.java',
      rationale: 'An immutable value object for a hall call. Cabin calls skip this entirely and go straight to a specific car\'s addStop() - they never need to be scored against every car.',
      code: `public final class Request {
    private final int floor;
    private final Direction direction;

    public Request(int floor, Direction direction) {
        this.floor = floor;
        this.direction = direction;
    }

    public int getFloor() { return floor; }
    public Direction getDirection() { return direction; }
}`,
    },
    {
      filename: 'ElevatorCar.java',
      calloutTitle: '💡 Split-TreeSet stop scheduling',
      callout:
        "stopsAbove.first() and stopsBelow.last() are always the nearest pending stop in the car's current direction, in O(log n). The car exhausts every stop on one side before ever reversing - exactly the SCAN algorithm disks use to minimize seek time, applied to floors instead of sectors. A new stop is bucketed relative to the car's CURRENT floor at the moment it's added, so a hall call picked up en route lands in the correct set automatically.",
      rationale: "The car owns its entire state machine and stop list, and every mutating method is synchronized on the car itself - concurrent hall/cabin calls can never corrupt one car's schedule.",
      code: `import java.util.NavigableSet;
import java.util.TreeSet;

public final class ElevatorCar {
    private final String id;
    private int currentFloor;
    private ElevatorState state = ElevatorState.IDLE;
    private ElevatorState lastDirection = ElevatorState.MOVING_UP;

    // Stops are bucketed relative to currentFloor at the moment they are added, not at some fixed midpoint.
    private final NavigableSet<Integer> stopsAbove = new TreeSet<>();
    private final NavigableSet<Integer> stopsBelow = new TreeSet<>();

    public ElevatorCar(String id, int startFloor) {
        this.id = id;
        this.currentFloor = startFloor;
    }

    /** Adds a stop this car must visit. Safe to call from any thread - hall calls and cabin calls both land here. */
    public synchronized void addStop(int floor) {
        if (floor == currentFloor) {
            state = ElevatorState.DOORS_OPEN;
            return;
        }
        if (floor > currentFloor) {
            stopsAbove.add(floor);
            if (state == ElevatorState.IDLE) {
                state = ElevatorState.MOVING_UP;
            }
        } else {
            stopsBelow.add(floor);
            if (state == ElevatorState.IDLE) {
                state = ElevatorState.MOVING_DOWN;
            }
        }
    }

    /** Advances the car by one floor, or resolves one tick of door-open dwell time. */
    public synchronized void step() {
        switch (state) {
            case IDLE:
                return;
            case DOORS_OPEN:
                state = nextStateAfterDoors();
                return;
            case MOVING_UP:
                advanceUp();
                return;
            case MOVING_DOWN:
                advanceDown();
                return;
        }
    }

    private void advanceUp() {
        lastDirection = ElevatorState.MOVING_UP;
        if (stopsAbove.isEmpty()) {
            state = stopsBelow.isEmpty() ? ElevatorState.IDLE : ElevatorState.MOVING_DOWN;
            return;
        }
        currentFloor++;
        if (currentFloor == stopsAbove.first()) {
            stopsAbove.pollFirst();
            state = ElevatorState.DOORS_OPEN;
        }
    }

    private void advanceDown() {
        lastDirection = ElevatorState.MOVING_DOWN;
        if (stopsBelow.isEmpty()) {
            state = stopsAbove.isEmpty() ? ElevatorState.IDLE : ElevatorState.MOVING_UP;
            return;
        }
        currentFloor--;
        if (currentFloor == stopsBelow.last()) {
            stopsBelow.pollLast();
            state = ElevatorState.DOORS_OPEN;
        }
    }

    private ElevatorState nextStateAfterDoors() {
        boolean canContinueUp = !stopsAbove.isEmpty();
        boolean canContinueDown = !stopsBelow.isEmpty();
        if (lastDirection == ElevatorState.MOVING_UP) {
            if (canContinueUp) return ElevatorState.MOVING_UP;
            if (canContinueDown) return ElevatorState.MOVING_DOWN;
        } else {
            if (canContinueDown) return ElevatorState.MOVING_DOWN;
            if (canContinueUp) return ElevatorState.MOVING_UP;
        }
        return ElevatorState.IDLE;
    }

    public String getId() { return id; }
    public synchronized int getCurrentFloor() { return currentFloor; }
    public synchronized ElevatorState getState() { return state; }
    public synchronized boolean hasPendingStops() { return !stopsAbove.isEmpty() || !stopsBelow.isEmpty(); }

    @Override
    public synchronized String toString() {
        return String.format("Car %s [floor=%d, state=%s, stopsAbove=%s, stopsBelow=%s]",
                id, currentFloor, state, stopsAbove, stopsBelow);
    }
}`,
    },
    {
      filename: 'DispatchStrategy.java',
      rationale: 'One method, one job: given every car and one hall call, return the car that should answer it. Keeping the interface this narrow is what makes it swappable.',
      code: `import java.util.List;

public interface DispatchStrategy {
    ElevatorCar selectCar(List<ElevatorCar> cars, Request request);
}`,
    },
    {
      filename: 'NearestCarDispatchStrategy.java',
      calloutTitle: '💡 Strategy Pattern - en-route beats naive-nearest',
      callout:
        "A naive dispatcher would just sort cars by |currentFloor - requestFloor|. That fails a real building: a car one floor away but heading DOWN cannot serve an UP call without a wasted round trip, while a car six floors away but already MOVING_UP toward that floor can pick the rider up for free. score() encodes exactly that - compatible en-route cars keep their raw distance, everything incompatible gets a heavy penalty layered on top of its distance so it only wins when nothing better exists.",
      rationale:
        "A building with a dedicated lobby car could instead plug in a ZoneBasedDispatchStrategy that first filters cars down to the ones assigned to floors 1-10 and only then falls back to this same scoring - DispatchStrategy's single method makes that a drop-in replacement, so it isn't implemented here but the seam is exactly this class's public method.",
      code: `import java.util.List;

public final class NearestCarDispatchStrategy implements DispatchStrategy {
    private static final int UNAVAILABLE_PENALTY = 1000;
    private static final int DOOR_DWELL_PENALTY = 1;

    @Override
    public ElevatorCar selectCar(List<ElevatorCar> cars, Request request) {
        ElevatorCar best = null;
        int bestScore = Integer.MAX_VALUE;
        for (ElevatorCar car : cars) {
            int score = score(car, request);
            if (score < bestScore) {
                bestScore = score;
                best = car;
            }
        }
        if (best == null) {
            throw new IllegalStateException("No elevator cars registered with the system");
        }
        return best;
    }

    private int score(ElevatorCar car, Request request) {
        int distance = Math.abs(car.getCurrentFloor() - request.getFloor());
        switch (car.getState()) {
            case IDLE:
                return distance;
            case DOORS_OPEN:
                return distance + DOOR_DWELL_PENALTY;
            case MOVING_UP:
                return isCompatibleEnRoute(car, request, Direction.UP) ? distance : distance + UNAVAILABLE_PENALTY;
            case MOVING_DOWN:
                return isCompatibleEnRoute(car, request, Direction.DOWN) ? distance : distance + UNAVAILABLE_PENALTY;
            default:
                return distance + UNAVAILABLE_PENALTY;
        }
    }

    /** A car heading UP can only be picked up for an UP request, and only if it hasn't passed that floor yet. */
    private boolean isCompatibleEnRoute(ElevatorCar car, Request request, Direction carDirection) {
        if (request.getDirection() != carDirection) {
            return false;
        }
        return carDirection == Direction.UP
                ? car.getCurrentFloor() <= request.getFloor()
                : car.getCurrentFloor() >= request.getFloor();
    }
}`,
    },
    {
      filename: 'ElevatorSystem.java',
      calloutTitle: '💡 Facade Pattern',
      callout:
        'HallCallPanel and CabinPanel never see ElevatorCar, DispatchStrategy, or the dispatchLock - they call two methods and get on with their lives. Everything about how many cars exist, how they are scored, and how their stop lists are locked lives inside this one class, so it can be rewritten (more cars, a smarter strategy, a fairness rule) without a single panel changing.',
      rationale:
        'requestElevator() holds dispatchLock across both the "pick a car" and "commit to it" steps on purpose - splitting them into two separate synchronized calls would let two hall calls interleave and both grab the same "best" car before either commits.',
      code: `import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class ElevatorSystem {
    private final List<ElevatorCar> cars;
    private final DispatchStrategy dispatchStrategy;
    private final Object dispatchLock = new Object();

    public ElevatorSystem(List<ElevatorCar> cars, DispatchStrategy dispatchStrategy) {
        this.cars = new CopyOnWriteArrayList<>(cars);
        this.dispatchStrategy = dispatchStrategy;
    }

    /** Hall call: a rider on floor "floor" wants to go "direction". Dispatch decides which car answers. */
    public ElevatorCar requestElevator(int floor, Direction direction) {
        Request request = new Request(floor, direction);
        synchronized (dispatchLock) {
            ElevatorCar chosen = dispatchStrategy.selectCar(cars, request);
            chosen.addStop(floor);
            return chosen;
        }
    }

    /** Cabin call: a rider already inside car carId presses a floor button. No dispatch needed - the car is fixed. */
    public void selectFloor(String carId, int floor) {
        findCar(carId).addStop(floor);
    }

    /** Advances every car by one simulation tick. A real system would drive this off a motor controller's clock. */
    public void tick() {
        cars.forEach(ElevatorCar::step);
    }

    public List<ElevatorCar> getCars() {
        return cars;
    }

    private ElevatorCar findCar(String carId) {
        return cars.stream()
                .filter(c -> c.getId().equals(carId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown car: " + carId));
    }
}`,
    },
    {
      filename: 'HallCallPanel.java',
      rationale: 'Deliberately thin - a landing panel knows a floor number and two buttons, and nothing whatsoever about dispatch, scoring, or how many cars exist.',
      code: `public final class HallCallPanel {
    private final int floor;
    private final ElevatorSystem system;

    public HallCallPanel(int floor, ElevatorSystem system) {
        this.floor = floor;
        this.system = system;
    }

    public void pressUp() {
        system.requestElevator(floor, Direction.UP);
    }

    public void pressDown() {
        system.requestElevator(floor, Direction.DOWN);
    }
}`,
    },
    {
      filename: 'CabinPanel.java',
      rationale: "Lives inside one specific car and is wired to that car's id at construction time. Riders only ever see floor buttons - they never choose which car answers, because there is no dispatch decision left to make.",
      code: `public final class CabinPanel {
    private final String carId;
    private final ElevatorSystem system;

    public CabinPanel(String carId, ElevatorSystem system) {
        this.carId = carId;
        this.system = system;
    }

    public void pressFloor(int floor) {
        system.selectFloor(carId, floor);
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Walks through dispatch among three idle cars, a cabin call that bypasses dispatch entirely, and - the scenario that proves the strategy is not naive nearest-floor - a hall call that gets picked up en route by a car that is already moving, printing every car\'s state and stop lists at each tick.',
      code: `import java.util.Arrays;
import java.util.List;

public final class Demo {
    public static void main(String[] args) {
        ElevatorCar carA = new ElevatorCar("A", 1);
        ElevatorCar carB = new ElevatorCar("B", 12);
        ElevatorCar carC = new ElevatorCar("C", 6);
        List<ElevatorCar> cars = Arrays.asList(carA, carB, carC);

        ElevatorSystem system = new ElevatorSystem(cars, new NearestCarDispatchStrategy());
        HallCallPanel groundPanel = new HallCallPanel(4, system);
        HallCallPanel midPanel = new HallCallPanel(8, system);
        CabinPanel cCabin = new CabinPanel("C", system);

        // 1) All three cars are idle, so this hall call is pure proximity: A is 3 away, B is 8 away,
        //    C is only 2 away - C wins.
        groundPanel.pressUp();
        System.out.println("After hall call (floor 4, UP):");
        printAll(cars);

        // 2) Run the system forward until car C reaches floor 4, opens its doors, and settles.
        runTicks(system, cars, 3);

        // 3) A rider boards car C and presses floor 9 - a cabin call skips dispatch entirely.
        cCabin.pressFloor(9);
        System.out.println("\\nAfter cabin call inside C for floor 9:");
        printAll(cars);

        // 4) Run two ticks so C is now MOVING_UP, on its way from floor 4 toward floor 9.
        runTicks(system, cars, 2);

        // 5) A hall call arrives at floor 8, UP. Naive nearest-floor dispatch would still be tempted by
        //    A or B, but C is already passing through in the right direction - it wins as a free
        //    en-route pickup even though it is not idle.
        midPanel.pressUp();
        System.out.println("\\nAfter en-route hall call (floor 8, UP) while C is moving:");
        printAll(cars);

        // 6) Run the rest of the way to completion - car C should visit 8, then 9, then go IDLE.
        runTicks(system, cars, 6);
    }

    private static void runTicks(ElevatorSystem system, List<ElevatorCar> cars, int count) {
        for (int i = 0; i < count; i++) {
            system.tick();
            System.out.println("\\n-- tick --");
            printAll(cars);
        }
    }

    private static void printAll(List<ElevatorCar> cars) {
        cars.forEach(System.out::println);
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Elevator Car Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> IDLE
  IDLE --> MOVING_UP: addStop(floor > currentFloor)
  IDLE --> MOVING_DOWN: addStop(floor < currentFloor)
  IDLE --> DOORS_OPEN: addStop(floor == currentFloor)
  MOVING_UP --> DOORS_OPEN: currentFloor == stopsAbove.first()
  MOVING_DOWN --> DOORS_OPEN: currentFloor == stopsBelow.last()
  MOVING_UP --> MOVING_DOWN: stopsAbove empty and stopsBelow non-empty
  MOVING_DOWN --> MOVING_UP: stopsBelow empty and stopsAbove non-empty
  DOORS_OPEN --> MOVING_UP: doors close, stopsAbove non-empty (or preferred direction)
  DOORS_OPEN --> MOVING_DOWN: doors close, stopsBelow non-empty (and preferred)
  DOORS_OPEN --> IDLE: doors close, no pending stops on either side`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Hall Call Picked Up En Route',
    mermaid: `sequenceDiagram
  autonumber
  participant Panel as HallCallPanel
  participant Sys as ElevatorSystem
  participant Strat as NearestCarDispatchStrategy
  participant CarC as ElevatorCar (C, MOVING_UP @6)
  participant CarA as ElevatorCar (A, IDLE @1)

  Panel->>Sys: pressUp() -> requestElevator(8, UP)
  activate Sys
  Sys->>Sys: enter synchronized(dispatchLock)
  Sys->>Strat: selectCar(cars, Request(8, UP))
  Strat->>CarC: getState(), getCurrentFloor()
  CarC-->>Strat: MOVING_UP, floor=6
  Strat->>CarA: getState(), getCurrentFloor()
  CarA-->>Strat: IDLE, floor=1
  Note over Strat: CarC score = |6-8| = 2 (compatible, no penalty)<br/>CarA score = |1-8| = 7
  Strat-->>Sys: CarC
  Sys->>CarC: addStop(8)
  CarC->>CarC: 8 > currentFloor -> stopsAbove.add(8)
  Sys->>Sys: exit synchronized(dispatchLock)
  deactivate Sys
  Sys-->>Panel: CarC`,
  },

  extensions: [
    { extension: 'Zone-restricted lobby elevator', implementation: 'Add a ZoneBasedDispatchStrategy that filters cars to a configured floor range before delegating to NearestCarDispatchStrategy for the final pick - ElevatorSystem code is untouched.' },
    { extension: 'Capacity / weight limits', implementation: "Add a weight sensor reading to ElevatorCar and have score() add UNAVAILABLE_PENALTY for any car already at capacity, so a full car stops attracting new hall calls." },
    { extension: 'Express / skip floors', implementation: 'Give ElevatorCar a Set<Integer> servable floors and have addStop() reject (or DispatchStrategy penalize) requests for floors outside it.' },
    { extension: 'Fire alarm / emergency recall', implementation: 'Add an EMERGENCY ElevatorState that addStop() cannot override; ElevatorSystem.triggerRecall() clears every stop list and sends all cars to the ground floor.' },
    { extension: 'Predictive pre-positioning', implementation: 'Add a scheduled task that calls a new idleTo(floor) on the least-recently-used idle car during known traffic peaks (e.g. pre-stage a car at the lobby every morning), still going through the same DispatchStrategy seam.' },
    { extension: 'Double-deck cabins', implementation: 'Model each deck as its own ElevatorCar sharing a shaft-position constraint with its twin, and extend DispatchStrategy to score the pair together.' },
  ],

  interviewerChecklist: [
    'Does the dispatch strategy account for a car\'s current direction and state, not just naive floor distance?',
    "Is stop-list mutation on each car synchronized, and is that lock scoped to the car (not the whole building)?",
    'Is the "pick a car, then commit it" sequence atomic, so two near-simultaneous hall calls cannot both grab the same car?',
    "Does each car's own scheduling algorithm avoid needless reversals - finishing one direction before switching?",
    'Can a new dispatch strategy be swapped in without changing ElevatorCar or ElevatorSystem\'s public API?',
    'Do hall calls and cabin calls both flow through the same two-method facade rather than reaching into internals?',
    'Is car state explicit (an enum) instead of inferred from a pile of booleans that could contradict each other?',
  ],

  relatedDesigns: ['parking-lot', 'vending-machine', 'multilevel-cache'],
  keyTakeaways: [
    'Real elevator dispatch is dominated by state, not distance alone: a compatible car already en route beats a farther idle car, and either beats a numerically closer car heading the wrong way.',
    'Splitting a car\'s stops into two TreeSets at its current floor gives O(log n) "nearest stop in this direction" for free - the same idea as SCAN disk scheduling, just applied to floors.',
    'A Facade earns its keep the moment two or more client types (hall panels, cabin panels) would otherwise need to know about dispatch, locking, and per-car scheduling just to press a button.',
    'Lock at the granularity the invariant actually needs: a per-car lock for stop-list mutation, a separate dispatch lock only around select-then-assign - not one global lock for everything.',
    'A lightweight enum-driven state machine is a legitimate State pattern implementation when the states are few and their transitions are tightly coupled - it does not always need a class per state.',
  ],
}

export default problem

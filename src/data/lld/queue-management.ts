import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'queue-management',
  title: 'Queue Management System',
  difficulty: 'Intermediate',
  icon: 'pi pi-list-check',
  color: '#78716c',
  readTimeMinutes: 16,
  patterns: ['Strategy', 'Factory Method', 'Observer', 'State'],
  companies: ['Q-less', 'Qminder', 'DMV / RTO offices', 'Hospitals & Clinics', 'Banks'],
  summary:
    'A token-based queue system for a bank, clinic, or government office: customers are issued a sequential token for a specific service category, multiple counters (each licensed for only some categories) pull tokens as they free up under a pluggable assignment policy, priority tokens jump the line without starving everyone else, and a called-but-absent customer gets handled cleanly instead of locking a counter forever.',

  functionalRequirements: [
    'Issue a sequential, category-scoped token (e.g. N-001 for New Account, D-014 for Cash Deposit) to a customer requesting a specific service category; the category determines which counters are even eligible to serve it.',
    'Model a fixed set of counters, each staffed to serve only a configurable subset of service categories, and able to serve exactly one customer at a time.',
    "As a counter frees up, use a pluggable assignment strategy to decide which of its eligible categories to pull its next token from (e.g. whichever eligible queue is currently longest, or a fixed regulatory order).",
    'Support PRIORITY tokens (senior citizens, pre-booked appointments, differently-abled customers) that are served ahead of NORMAL tokens within the same category queue, capped by an explicit anti-starvation rule so normal customers are guaranteed a turn.',
    "Estimate a customer's wait time - at issuance and on demand - from the category's current backlog, its average service time, and the number of counters currently eligible to serve it.",
    'Support cancelling a token while it is still waiting, and handle a called-but-absent customer (no-show) by freeing the counter back to the pool after an explicit grace period.',
  ],
  nonFunctionalRequirements: [
    'Pulling the next token for a category must be race-free: if two counters free up at nearly the same instant and are both eligible for the same category, they must never both receive the same token, and no waiting token may be skipped or duplicated.',
    "The anti-starvation rule must be a real, bounded guarantee (e.g. 'no more than K consecutive priority tokens before one normal token is served'), not just 'priority always wins', otherwise a steady stream of priority tokens can starve the normal line indefinitely.",
    'Adding a new counter-assignment policy or a new called-token notification channel must not require changes to the core issue/assign/complete/no-show flow (open/closed principle).',
    'No-show detection must be based on an explicit, configurable grace period rather than an immediate or arbitrary cutoff, since customers legitimately need time to walk from the waiting area to the counter.',
  ],

  coreEntities: [
    { name: 'ServiceCategory', description: 'Enum of the service types on offer (New Account, Loan, Cash Deposit, Cash Withdrawal), each carrying its own average service time used for wait estimation.' },
    { name: 'Priority', description: 'NORMAL or PRIORITY - the tier a token is issued at, which decides which of the two per-category lines it joins.' },
    { name: 'Token', description: "A single customer's ticket - a sequential per-category number, its category and priority, and a guarded lifecycle (WAITING -> CALLED -> SERVING -> COMPLETED, or CALLED -> NO_SHOW, or WAITING -> CANCELLED)." },
    { name: 'TokenFactory', description: 'Mints tokens - owns per-category sequence numbering (N-001, N-002, ...) and issuance timestamps in one place.' },
    { name: 'CategoryQueue', description: "The per-category priority queue - two FIFO lines (priority, normal) plus a bounded anti-starvation counter, all behind one lock so the compound 'which line, then pop' decision is atomic." },
    { name: 'Counter', description: 'A physical service window - an id, the set of categories it is licensed to serve, its current status (IDLE / BUSY / OFFLINE), and the token it currently holds, if any.' },
    { name: 'CounterAssignmentStrategy', description: "Interface for choosing which of a newly-freed counter's eligible categories it should pull its next token from - the swappable 'which line do I clear first' policy." },
    { name: 'TokenCalledObserver', description: "Interface notified whenever a token is called to a counter - the display-board/SMS notifier is one implementation, decoupled from the core assignment flow." },
    { name: 'WaitTimeEstimator', description: 'Turns a category\'s current backlog, its average service time, and its number of eligible active counters into a single wait-time estimate.' },
    { name: 'QueueManagementService', description: 'The aggregate root - owns all counters, all per-category queues, the assignment strategy, and the observers; orchestrates issue/assign/complete/no-show/cancel.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class ServiceCategory {
    <<enumeration>>
    NEW_ACCOUNT
    LOAN
    CASH_DEPOSIT
    CASH_WITHDRAWAL
    +getAvgServiceTimeSeconds() int
  }
  class Priority {
    <<enumeration>>
    NORMAL
    PRIORITY
  }
  class TokenStatus {
    <<enumeration>>
    WAITING
    CALLED
    SERVING
    COMPLETED
    NO_SHOW
    CANCELLED
  }
  class Token {
    -String tokenNumber
    -ServiceCategory category
    -Priority priority
    -long sequence
    -Instant issuedAt
    -TokenStatus status
    -Instant calledAt
    +markCalled(String, Instant) void
    +markServing() void
    +markCompleted() void
    +markNoShow() void
    +cancel() void
    +isCallTimedOut(Instant, Duration) boolean
  }
  class TokenFactory {
    -Map~ServiceCategory, AtomicLong~ sequenceByCategory
    +issue(ServiceCategory, Priority) Token
  }
  class CategoryQueue {
    -ServiceCategory category
    -Deque~Token~ priorityQueue
    -Deque~Token~ normalQueue
    -ReentrantLock lock
    -int consecutivePriorityServed
    +enqueue(Token) void
    +pollNext() Token
    +removeIfWaiting(Token) boolean
    +peopleAheadFor(Priority) int
    +size() int
  }
  class CounterStatus {
    <<enumeration>>
    IDLE
    BUSY
    OFFLINE
  }
  class Counter {
    -String counterId
    -Set~ServiceCategory~ eligibleCategories
    -CounterStatus status
    -Token currentToken
    +canServe(ServiceCategory) boolean
    +assign(Token) void
    +free() void
  }
  class CounterAssignmentStrategy {
    <<interface>>
    +selectCategory(Counter, Map~ServiceCategory, CategoryQueue~) Optional~ServiceCategory~
  }
  class LongestQueueFirstStrategy {
    +selectCategory(Counter, Map~ServiceCategory, CategoryQueue~) Optional~ServiceCategory~
  }
  class FixedPriorityCategoryStrategy {
    -List~ServiceCategory~ categoryPriorityOrder
    +selectCategory(Counter, Map~ServiceCategory, CategoryQueue~) Optional~ServiceCategory~
  }
  class TokenCalledObserver {
    <<interface>>
    +onTokenCalled(Token, Counter) void
  }
  class DisplayBoardObserver {
    +onTokenCalled(Token, Counter) void
  }
  class WaitTimeEstimator {
    +estimateWaitSeconds(ServiceCategory, Priority, Map, Map) int
  }
  class QueueManagementService {
    -TokenFactory tokenFactory
    -Map~ServiceCategory, CategoryQueue~ queuesByCategory
    -Map~String, Counter~ countersById
    -Map~String, Token~ tokensById
    -List~TokenCalledObserver~ observers
    -CounterAssignmentStrategy assignmentStrategy
    -WaitTimeEstimator waitTimeEstimator
    -Duration noShowGrace
    +issueToken(ServiceCategory, Priority) Token
    +assignIdleCounters() void
    +startService(String) void
    +completeService(String) void
    +markNoShow(String) void
    +cancelToken(String) void
    +estimateWaitSeconds(ServiceCategory, Priority) int
  }

  Token --> TokenStatus
  Token --> Priority
  Token --> ServiceCategory
  Token ..> TokenFactory : created by
  Counter --> CounterStatus
  Counter o-- ServiceCategory
  Counter o-- Token : currentToken
  CategoryQueue --> ServiceCategory
  CategoryQueue o-- Token
  CounterAssignmentStrategy <|.. LongestQueueFirstStrategy
  CounterAssignmentStrategy <|.. FixedPriorityCategoryStrategy
  TokenCalledObserver <|.. DisplayBoardObserver
  QueueManagementService o-- Counter
  QueueManagementService o-- CategoryQueue
  QueueManagementService o-- CounterAssignmentStrategy
  QueueManagementService o-- TokenCalledObserver
  QueueManagementService ..> TokenFactory
  QueueManagementService ..> WaitTimeEstimator`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'CounterAssignmentStrategy + LongestQueueFirstStrategy / FixedPriorityCategoryStrategy', why: "A counter licensed for both New Account and Loan needs a policy for 'which line do I clear first' the instant it frees up - swapping longest-queue-first for a fixed regulatory order (always drain Loan before New Account) never touches assignIdleCounters(), the same way NearestCarDispatchStrategy is swappable in elevator-system without touching the facade." },
    { pattern: 'Factory Method', where: 'TokenFactory.issue()', why: 'Centralizes per-category sequence numbering (N-001, N-002, ...) and issuance timestamping in one place - a branch wanting a different numbering scheme, or to stamp a branchId onto every token, is a one-class change instead of a hunt through every call site that builds a Token.' },
    { pattern: 'Observer', where: 'TokenCalledObserver / DisplayBoardObserver', why: "QueueManagementService fires 'this token was just called to this counter' without knowing whether a physical LED board, an SMS gateway, or an ops dashboard is listening - swapping the console line for a real notification channel means writing a new observer, not editing assignIdleCounters()." },
    { pattern: 'State', where: 'Token.TokenStatus + guarded markCalled()/markServing()/markCompleted()/markNoShow()/cancel() transitions', why: 'Encodes the legal lifecycle directly on the entity, so calling markNoShow() on a token that is already SERVING (or starting service on one that was never called) fails loudly instead of silently corrupting a counter\'s state.' },
  ],
  dataStructures: [
    { component: 'Per-category priority queue', structure: 'Two plain Deque<Token> (priorityQueue, normalQueue) behind one ReentrantLock, rather than a single java.util.PriorityQueue<Token>', why: "Encoding 'no more than 3 consecutive priority pulls' as a Comparator would require mutable, globally-visible state leaking into every comparison - a violation of Comparator's stateless contract. Two FIFO lines plus one fairness counter make the anti-starvation rule an explicit, auditable branch in pollNext() instead of comparator trickery nobody can reason about under load." },
    { component: 'Assignment race guard', structure: 'A ReentrantLock scoped to each CategoryQueue, guarding pollNext()', why: "The concurrency-critical step here isn't a single map write - it's the compound 'which line wins, then pop, then update the fairness counter' decision, which spans two data structures at once. No single atomic map operation (compute, CAS) can express that, so an explicit lock is the right tool, same as dispatchLock in elevator-system guards 'score every car, then commit one' as a unit." },
    { component: 'Token & counter lookup', structure: 'ConcurrentHashMap<String, Token> and ConcurrentHashMap<String, Counter> keyed by generated id', why: "O(1) lookup for a status check from a customer's phone or a clerk's screen (startService(tokenNumber), markNoShow(tokenNumber)) without scanning every CategoryQueue for a matching entry." },
    { component: 'Counter roster scanned per free-up event', structure: 'A small List/Map<String, Counter> walked linearly in assignIdleCounters()', why: 'A branch has single digits to low tens of counters, so O(counters) per free-up event is effectively O(1) in practice - the same justification elevator-system gives for scoring every car on every hall call rather than indexing them.' },
  ],

  walkthroughs: [
    {
      title: 'Token Issuance -> Counter Assignment, with a PRIORITY Token Jumping the Queue',
      steps: [
        'A customer requests New Account service and is issued token N-001; issueToken() enqueues it into the NEW_ACCOUNT CategoryQueue and immediately calls assignIdleCounters(), which finds counter C-2 (licensed for NEW_ACCOUNT and LOAN) sitting IDLE, asks the configured LongestQueueFirstStrategy which eligible category to serve, and - since NEW_ACCOUNT is the only one with anyone waiting - pulls N-001 straight off the queue and calls it: WAITING flips to CALLED in the very same request that created the token.',
        'The clerk at C-2 starts serving N-001 (startService()), which keeps the counter BUSY - so the next two New Account requests, N-002 and N-003 (both NORMAL), simply enqueue behind each other in that CategoryQueue\'s normalQueue and stay WAITING, since C-2 is the only counter licensed for that category and it is occupied.',
        'A senior citizen requests New Account service and is issued N-004 with Priority.PRIORITY; enqueue() routes it into the same CategoryQueue\'s separate priorityQueue rather than the back of the normal line.',
        "A wait-time check for a hypothetical fifth NORMAL customer calls estimateWaitSeconds(NEW_ACCOUNT, NORMAL): with 3 people effectively ahead (1 priority + 2 normal) and exactly 1 eligible counter, WaitTimeEstimator rounds up to 4 service rounds and multiplies by NEW_ACCOUNT's 240s average, quoting roughly 16 minutes - a number that would shrink to 4 minutes if this branch had 4 tellers instead of 1.",
        'The clerk finishes with N-001 and calls completeService(); the counter frees, and freeCounterFor() immediately re-runs assignIdleCounters() for that now-idle counter.',
        "CategoryQueue.pollNext() for NEW_ACCOUNT checks the fairness counter first (0 consecutive priority tokens served so far, well under the cap of 3), sees the priorityQueue is non-empty, and hands back N-004 ahead of N-002 and N-003 even though they were issued earlier - the senior citizen's token jumps the line by design, not by accident.",
        'N-004 is called to C-2 and DisplayBoardObserver announces it; N-002 and N-003 remain WAITING, untouched, ready to be pulled the moment C-2 (or another eligible counter) frees up again.',
      ],
    },
    {
      title: 'Called-But-Absent Customer -> No-Show Timeout Frees the Counter',
      steps: [
        'N-004 (the senior citizen from the previous flow) has just been called to counter C-2 and sits in CALLED state with a calledAt timestamp; per the configured grace period, the customer has a fixed window to walk up before being treated as absent.',
        'The clerk calls markNoShow(N-004) almost immediately after the call - but Token.isCallTimedOut() reports the grace period has not elapsed yet, so QueueManagementService throws InvalidTokenStateException rather than silently discarding a customer who might just be a few seconds from the counter.',
        'Time passes beyond the configured grace period with no startService() call ever recorded for N-004 - the clerk calls markNoShow(N-004) again; this time isCallTimedOut() returns true, the token\'s guarded state transition moves CALLED -> NO_SHOW (it would reject the call outright had the token already moved to SERVING), and freeCounterFor() releases C-2 back to IDLE.',
        'Releasing the counter re-triggers assignIdleCounters() exactly as a normal completion would - C-2 asks LongestQueueFirstStrategy again, finds NEW_ACCOUNT still has N-002 and N-003 waiting (no priority tokens left after N-004\'s exit), and pollNext() falls through to the normalQueue and calls N-002 next in strict FIFO order.',
        'N-004 stays permanently in NO_SHOW - it is never silently requeued - so its terminal state is auditable in tokensById for reporting on no-show rates per category, and the customer would need to pull a fresh token if they still want service.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'ServiceCategory.java',
      rationale: "Each category carries its own code (used for token numbering) and average service time (used for wait estimation) right on the enum constant, so both TokenFactory and WaitTimeEstimator read from one source of truth instead of a parallel lookup table that could drift out of sync.",
      code: `public enum ServiceCategory {
    NEW_ACCOUNT("N", "New Account", 240),
    LOAN("L", "Loan", 480),
    CASH_DEPOSIT("D", "Cash Deposit", 90),
    CASH_WITHDRAWAL("W", "Cash Withdrawal", 90);

    private final String code;
    private final String displayName;
    private final int avgServiceTimeSeconds;

    ServiceCategory(String code, String displayName, int avgServiceTimeSeconds) {
        this.code = code;
        this.displayName = displayName;
        this.avgServiceTimeSeconds = avgServiceTimeSeconds;
    }

    public String getCode() { return code; }
    public String getDisplayName() { return displayName; }
    public int getAvgServiceTimeSeconds() { return avgServiceTimeSeconds; }
}`,
    },
    {
      filename: 'Priority.java',
      rationale: 'Deliberately just two tiers, not an open-ended integer priority - a token either competes in the fast (priority) line or the normal one; the anti-starvation cap in CategoryQueue is what keeps this simple two-tier model fair.',
      code: `public enum Priority {
    NORMAL,
    PRIORITY
}`,
    },
    {
      filename: 'Token.java',
      calloutTitle: '💡 State Pattern',
      callout:
        "Every transition is a guarded method, not a public setter - markNoShow() only succeeds from CALLED, cancel() refuses once a token is SERVING or COMPLETED. That is what makes an illegal transition (double-completing a token, no-showing one that already walked up) fail loudly at the exact call site instead of quietly corrupting a counter's state three methods later.",
      rationale: "TokenStatus is nested since nothing outside a Token's own lifecycle ever needs to reference it independently. calledAt is set once, by markCalled(), so isCallTimedOut() is a pure function of two timestamps rather than something a background job has to keep flipping.",
      code: `import java.time.Duration;
import java.time.Instant;

public final class Token {

    public enum TokenStatus { WAITING, CALLED, SERVING, COMPLETED, NO_SHOW, CANCELLED }

    private final String tokenNumber;
    private final ServiceCategory category;
    private final Priority priority;
    private final long sequence;
    private final Instant issuedAt;
    private TokenStatus status;
    private String assignedCounterId;
    private Instant calledAt;

    Token(String tokenNumber, ServiceCategory category, Priority priority, long sequence, Instant issuedAt) {
        this.tokenNumber = tokenNumber;
        this.category = category;
        this.priority = priority;
        this.sequence = sequence;
        this.issuedAt = issuedAt;
        this.status = TokenStatus.WAITING;
    }

    public void markCalled(String counterId, Instant calledAt) {
        if (status != TokenStatus.WAITING) {
            throw new IllegalStateException("Cannot call token " + tokenNumber + " from state " + status);
        }
        this.status = TokenStatus.CALLED;
        this.assignedCounterId = counterId;
        this.calledAt = calledAt;
    }

    public void markServing() {
        if (status != TokenStatus.CALLED) {
            throw new IllegalStateException("Cannot start serving token " + tokenNumber + " from state " + status);
        }
        this.status = TokenStatus.SERVING;
    }

    public void markCompleted() {
        if (status != TokenStatus.SERVING) {
            throw new IllegalStateException("Cannot complete token " + tokenNumber + " from state " + status);
        }
        this.status = TokenStatus.COMPLETED;
    }

    public void markNoShow() {
        if (status != TokenStatus.CALLED) {
            throw new IllegalStateException("Cannot mark no-show for token " + tokenNumber + " from state " + status);
        }
        this.status = TokenStatus.NO_SHOW;
    }

    public void cancel() {
        if (status == TokenStatus.SERVING || status == TokenStatus.COMPLETED) {
            throw new IllegalStateException("Cannot cancel token " + tokenNumber + " from state " + status);
        }
        this.status = TokenStatus.CANCELLED;
    }

    public boolean isCallTimedOut(Instant now, Duration noShowGrace) {
        return status == TokenStatus.CALLED && calledAt != null && now.isAfter(calledAt.plus(noShowGrace));
    }

    public String getTokenNumber() { return tokenNumber; }
    public ServiceCategory getCategory() { return category; }
    public Priority getPriority() { return priority; }
    public long getSequence() { return sequence; }
    public Instant getIssuedAt() { return issuedAt; }
    public TokenStatus getStatus() { return status; }
    public String getAssignedCounterId() { return assignedCounterId; }
}`,
    },
    {
      filename: 'TokenFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        "The per-category numbering scheme (code + zero-padded sequence, e.g. N-001) lives in exactly one place. A branch that wants to prefix every token with a branch code, or reset sequences daily instead of running forever, changes this one class - QueueManagementService never touches a counter or a String.format call directly.",
      rationale: 'AtomicLong per category (not a single shared counter) means New Account numbering and Loan numbering advance completely independently, with no lock contention between unrelated categories.',
      code: `import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public final class TokenFactory {
    private final Map<ServiceCategory, AtomicLong> sequenceByCategory = new ConcurrentHashMap<>();

    public Token issue(ServiceCategory category, Priority priority) {
        long sequence = sequenceByCategory.computeIfAbsent(category, c -> new AtomicLong()).incrementAndGet();
        String tokenNumber = category.getCode() + "-" + String.format("%03d", sequence);
        return new Token(tokenNumber, category, priority, sequence, Instant.now());
    }
}`,
    },
    {
      filename: 'CategoryQueue.java',
      calloutTitle: '💡 Bounded Priority Queue + Atomic Pull',
      callout:
        "Two things happen together here that make this the concurrency-critical file in the whole design. First, fairness: MAX_CONSECUTIVE_PRIORITY caps how many priority tokens can be served back-to-back before a normal token is guaranteed a turn - a real, statable anti-starvation bound, not just 'priority always wins'. Second, atomicity: pollNext() decides which line to pop from AND mutates the fairness counter as one indivisible step under a single lock, so two counters freeing up at the same instant can never both walk away with the same token, and neither can skip past the fairness rule mid-decision.",
      rationale: "Plain ConcurrentLinkedDeques would be safe individually, but choosing between two of them based on mutable fairness state is a compound operation no lock-free structure expresses cleanly - hence the explicit ReentrantLock scoped to just this one category, not the whole branch.",
      code: `import java.util.Deque;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.locks.ReentrantLock;

public final class CategoryQueue {
    // Serve at most this many PRIORITY tokens back-to-back before guaranteeing one NORMAL token a turn,
    // so a steady stream of senior-citizen/appointment tokens can never fully starve the regular line.
    private static final int MAX_CONSECUTIVE_PRIORITY = 3;

    private final ServiceCategory category;
    private final Deque<Token> priorityQueue = new ConcurrentLinkedDeque<>();
    private final Deque<Token> normalQueue = new ConcurrentLinkedDeque<>();
    private final ReentrantLock lock = new ReentrantLock();
    private int consecutivePriorityServed = 0;

    public CategoryQueue(ServiceCategory category) {
        this.category = category;
    }

    public void enqueue(Token token) {
        if (token.getPriority() == Priority.PRIORITY) {
            priorityQueue.addLast(token);
        } else {
            normalQueue.addLast(token);
        }
    }

    /** Atomically removes and returns the next token this category should serve, or null if both lines are empty. */
    public Token pollNext() {
        lock.lock();
        try {
            boolean fairnessCapHit = consecutivePriorityServed >= MAX_CONSECUTIVE_PRIORITY && !normalQueue.isEmpty();
            if (!fairnessCapHit && !priorityQueue.isEmpty()) {
                consecutivePriorityServed++;
                return priorityQueue.pollFirst();
            }
            if (!normalQueue.isEmpty()) {
                consecutivePriorityServed = 0;
                return normalQueue.pollFirst();
            }
            if (!priorityQueue.isEmpty()) {
                // Normal line is empty, so the fairness cap is moot - fall back to priority rather than idle a counter.
                consecutivePriorityServed++;
                return priorityQueue.pollFirst();
            }
            return null;
        } finally {
            lock.unlock();
        }
    }

    public boolean removeIfWaiting(Token token) {
        lock.lock();
        try {
            return priorityQueue.remove(token) || normalQueue.remove(token);
        } finally {
            lock.unlock();
        }
    }

    /** How many people are effectively ahead of a hypothetical new token of this priority - used for wait estimates. */
    public int peopleAheadFor(Priority priority) {
        lock.lock();
        try {
            return priority == Priority.PRIORITY ? priorityQueue.size() : priorityQueue.size() + normalQueue.size();
        } finally {
            lock.unlock();
        }
    }

    public ServiceCategory getCategory() { return category; }

    public int size() {
        return priorityQueue.size() + normalQueue.size();
    }
}`,
    },
    {
      filename: 'Counter.java',
      rationale: "CounterStatus is nested since no other class needs it independently of a Counter. OFFLINE is deliberately separate from IDLE so a counter on a lunch break is excluded from assignment without pretending it has gone out of existence.",
      code: `import java.util.EnumSet;
import java.util.Set;

public final class Counter {

    public enum CounterStatus { IDLE, BUSY, OFFLINE }

    private final String counterId;
    private final Set<ServiceCategory> eligibleCategories;
    private CounterStatus status;
    private Token currentToken;

    public Counter(String counterId, Set<ServiceCategory> eligibleCategories) {
        this.counterId = counterId;
        this.eligibleCategories = EnumSet.copyOf(eligibleCategories);
        this.status = CounterStatus.IDLE;
    }

    public boolean canServe(ServiceCategory category) {
        return status != CounterStatus.OFFLINE && eligibleCategories.contains(category);
    }

    public void assign(Token token) {
        if (status != CounterStatus.IDLE) {
            throw new IllegalStateException("Counter " + counterId + " is not idle (state=" + status + ")");
        }
        this.currentToken = token;
        this.status = CounterStatus.BUSY;
    }

    public void free() {
        this.currentToken = null;
        this.status = CounterStatus.IDLE;
    }

    public void goOffline() {
        if (status == CounterStatus.BUSY) {
            throw new IllegalStateException("Cannot take counter " + counterId + " offline mid-service");
        }
        this.status = CounterStatus.OFFLINE;
    }

    public void goOnline() {
        if (status == CounterStatus.OFFLINE) {
            this.status = CounterStatus.IDLE;
        }
    }

    public String getCounterId() { return counterId; }
    public Set<ServiceCategory> getEligibleCategories() { return eligibleCategories; }
    public CounterStatus getStatus() { return status; }
    public Token getCurrentToken() { return currentToken; }
}`,
    },
    {
      filename: 'CounterAssignmentStrategy.java',
      rationale: 'Kept to a single method that only ever sees a Counter and the map of live CategoryQueues - implementations never need direct access to locks, token internals, or the aggregate root.',
      code: `import java.util.Map;
import java.util.Optional;

public interface CounterAssignmentStrategy {
    /** Chooses which of this idle counter's eligible categories it should pull its next token from, if any. */
    Optional<ServiceCategory> selectCategory(Counter counter, Map<ServiceCategory, CategoryQueue> queuesByCategory);
}`,
    },
    {
      filename: 'LongestQueueFirstStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        "This is why assignIdleCounters() never contains an if/else on 'which policy is active'. A multi-skilled counter always drains whichever of its eligible lines is currently longest - maximizing overall throughput - and swapping in FixedPriorityCategoryStrategy for a branch with a regulatory serving order is a one-line constructor change, not a rewrite of the assignment flow.",
      rationale: "Reads size() straight off each eligible CategoryQueue rather than maintaining a separate length cache, trading a tiny bit of lock contention for the guarantee that it can never see a stale count.",
      code: `import java.util.Comparator;
import java.util.Map;
import java.util.Optional;

public final class LongestQueueFirstStrategy implements CounterAssignmentStrategy {
    @Override
    public Optional<ServiceCategory> selectCategory(Counter counter, Map<ServiceCategory, CategoryQueue> queuesByCategory) {
        return counter.getEligibleCategories().stream()
                .map(queuesByCategory::get)
                .filter(queue -> queue != null && queue.size() > 0)
                .max(Comparator.comparingInt(CategoryQueue::size))
                .map(CategoryQueue::getCategory);
    }
}`,
    },
    {
      filename: 'FixedPriorityCategoryStrategy.java',
      rationale: "Useful where policy - not queue length - decides serving order: a branch might always want to clear Loan applications before New Account walk-ins regardless of which line is longer at the moment.",
      code: `import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class FixedPriorityCategoryStrategy implements CounterAssignmentStrategy {
    private final List<ServiceCategory> categoryPriorityOrder;

    public FixedPriorityCategoryStrategy(List<ServiceCategory> categoryPriorityOrder) {
        this.categoryPriorityOrder = categoryPriorityOrder;
    }

    @Override
    public Optional<ServiceCategory> selectCategory(Counter counter, Map<ServiceCategory, CategoryQueue> queuesByCategory) {
        for (ServiceCategory category : categoryPriorityOrder) {
            if (!counter.canServe(category)) {
                continue;
            }
            CategoryQueue queue = queuesByCategory.get(category);
            if (queue != null && queue.size() > 0) {
                return Optional.of(category);
            }
        }
        return Optional.empty();
    }
}`,
    },
    {
      filename: 'TokenCalledObserver.java',
      rationale: 'One-method interface, deliberately unaware of how a "token called" event gets broadcast - a metrics collector counting calls-per-hour could implement this tomorrow without QueueManagementService knowing.',
      code: `public interface TokenCalledObserver {
    void onTokenCalled(Token token, Counter counter);
}`,
    },
    {
      filename: 'DisplayBoardObserver.java',
      calloutTitle: '💡 Observer Pattern',
      callout:
        "QueueManagementService has zero knowledge of how a called token gets announced - it just calls onTokenCalled() on whatever observers were registered. Swapping this console line for a real SMS gateway or a physical LED board driver is a new class, not a change to assignIdleCounters().",
      rationale: 'Deliberately prints to the console instead of driving real hardware - production code would swap that one line, the decoupling is the point of this file.',
      code: `public final class DisplayBoardObserver implements TokenCalledObserver {
    @Override
    public void onTokenCalled(Token token, Counter counter) {
        System.out.println("[Display Board] Token " + token.getTokenNumber()
                + " -> please proceed to Counter " + counter.getCounterId());
    }
}`,
    },
    {
      filename: 'WaitTimeEstimator.java',
      rationale: "Deliberately a first-order approximation, not a queuing-theory model: position-in-line divided by parallel servers, times average service time. It is honest about being a display-friendly estimate, not a guarantee - exactly the bar a wait-time feature actually needs to clear.",
      code: `import java.util.Map;

public final class WaitTimeEstimator {

    public int estimateWaitSeconds(ServiceCategory category, Priority priority,
                                    Map<ServiceCategory, CategoryQueue> queuesByCategory,
                                    Map<String, Counter> countersById) {
        CategoryQueue queue = queuesByCategory.get(category);
        int peopleAhead = queue == null ? 0 : queue.peopleAheadFor(priority);

        long eligibleActiveCounters = countersById.values().stream()
                .filter(counter -> counter.getEligibleCategories().contains(category))
                .filter(counter -> counter.getStatus() != Counter.CounterStatus.OFFLINE)
                .count();
        if (eligibleActiveCounters == 0) {
            eligibleActiveCounters = 1; // avoid divide-by-zero; a fully offline category has no honest estimate anyway
        }

        int position = peopleAhead + 1;
        int parallelSlots = (int) eligibleActiveCounters;
        int roundsAhead = (position + parallelSlots - 1) / parallelSlots; // ceil(position / servers)
        return roundsAhead * category.getAvgServiceTimeSeconds();
    }
}`,
    },
    {
      filename: 'QueueManagementService.java',
      calloutTitle: '💡 Free-Up Reassignment Loop',
      callout:
        "assignIdleCounters() is called after every issueToken(), completeService(), and markNoShow() - the exact three moments the world could have changed - rather than relying on a background poller. Because the actual atomicity lives inside CategoryQueue.pollNext(), two counters freeing up in the same millisecond and both racing into this method is completely safe: the lock inside the shared queue serializes them, so the second caller simply gets the next token in line (or null), never a duplicate.",
      rationale: 'The aggregate root. It delegates "which category" to the strategy and "who to tell" to the observers, keeping its own methods focused on orchestration plus the one place a counter and a token change state together.',
      code: `import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public final class QueueManagementService {

    public static final class NoTokenAvailableException extends Exception {
        public NoTokenAvailableException(String message) { super(message); }
    }

    public static final class InvalidTokenStateException extends RuntimeException {
        public InvalidTokenStateException(String message) { super(message); }
    }

    private final TokenFactory tokenFactory = new TokenFactory();
    private final Map<ServiceCategory, CategoryQueue> queuesByCategory = new ConcurrentHashMap<>();
    private final Map<String, Counter> countersById = new ConcurrentHashMap<>();
    private final Map<String, Token> tokensById = new ConcurrentHashMap<>();
    private final List<TokenCalledObserver> observers = new CopyOnWriteArrayList<>();
    private final CounterAssignmentStrategy assignmentStrategy;
    private final WaitTimeEstimator waitTimeEstimator = new WaitTimeEstimator();
    private final Duration noShowGrace;

    public QueueManagementService(List<Counter> counters, CounterAssignmentStrategy assignmentStrategy) {
        this(counters, assignmentStrategy, Duration.ofSeconds(60));
    }

    public QueueManagementService(List<Counter> counters, CounterAssignmentStrategy assignmentStrategy, Duration noShowGrace) {
        this.assignmentStrategy = assignmentStrategy;
        this.noShowGrace = noShowGrace;
        for (ServiceCategory category : ServiceCategory.values()) {
            queuesByCategory.put(category, new CategoryQueue(category));
        }
        for (Counter counter : counters) {
            countersById.put(counter.getCounterId(), counter);
        }
    }

    public void registerObserver(TokenCalledObserver observer) {
        observers.add(observer);
    }

    public Token issueToken(ServiceCategory category, Priority priority) {
        Token token = tokenFactory.issue(category, priority);
        tokensById.put(token.getTokenNumber(), token);
        queuesByCategory.get(category).enqueue(token);
        assignIdleCounters();
        return token;
    }

    public int estimateWaitSeconds(ServiceCategory category, Priority priority) {
        return waitTimeEstimator.estimateWaitSeconds(category, priority, queuesByCategory, countersById);
    }

    /** Called whenever a counter might have new work available: issuance, completion, or a no-show. */
    public void assignIdleCounters() {
        for (Counter counter : countersById.values()) {
            if (counter.getStatus() != Counter.CounterStatus.IDLE) {
                continue;
            }
            assignmentStrategy.selectCategory(counter, queuesByCategory).ifPresent(category -> {
                Token token = queuesByCategory.get(category).pollNext();
                if (token != null) {
                    counter.assign(token);
                    token.markCalled(counter.getCounterId(), Instant.now());
                    observers.forEach(observer -> observer.onTokenCalled(token, counter));
                }
            });
        }
    }

    public void startService(String tokenNumber) {
        requireToken(tokenNumber).markServing();
    }

    public void completeService(String tokenNumber) {
        Token token = requireToken(tokenNumber);
        token.markCompleted();
        freeCounterFor(token);
    }

    public void markNoShow(String tokenNumber) {
        Token token = requireToken(tokenNumber);
        if (!token.isCallTimedOut(Instant.now(), noShowGrace)) {
            throw new InvalidTokenStateException(
                    "Token " + tokenNumber + " has not exceeded the " + noShowGrace.getSeconds() + "s no-show grace period yet");
        }
        token.markNoShow();
        freeCounterFor(token);
    }

    public void cancelToken(String tokenNumber) {
        Token token = requireToken(tokenNumber);
        queuesByCategory.get(token.getCategory()).removeIfWaiting(token);
        token.cancel();
    }

    private void freeCounterFor(Token token) {
        countersById.values().stream()
                .filter(counter -> counter.getCurrentToken() == token)
                .findFirst()
                .ifPresent(counter -> {
                    counter.free();
                    assignIdleCounters();
                });
    }

    private Token requireToken(String tokenNumber) {
        Token token = tokensById.get(tokenNumber);
        if (token == null) {
            throw new InvalidTokenStateException("Unknown token: " + tokenNumber);
        }
        return token;
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy path with a priority token jumping a real backlog, the no-show grace-period rejection followed by a successful timeout, and - since race-free pulling from a shared category queue is a stated non-functional requirement - a concurrency stress test proving many counters racing on one CategoryQueue never double-serve or drop a token.',
      code: `import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

public final class Demo {
    public static void main(String[] args) throws Exception {
        List<Counter> counters = List.of(
                new Counter("C-1", EnumSet.of(ServiceCategory.CASH_DEPOSIT, ServiceCategory.CASH_WITHDRAWAL)),
                new Counter("C-2", EnumSet.of(ServiceCategory.NEW_ACCOUNT, ServiceCategory.LOAN)));

        QueueManagementService service = new QueueManagementService(
                counters, new LongestQueueFirstStrategy(), Duration.ofMillis(100));
        service.registerObserver(new DisplayBoardObserver());

        // --- Happy path: build a backlog, then prove a PRIORITY token jumps ahead of NORMAL tokens ---
        Token first = service.issueToken(ServiceCategory.NEW_ACCOUNT, Priority.NORMAL);
        System.out.println(first.getTokenNumber() + " called immediately -> " + first.getStatus());
        service.startService(first.getTokenNumber()); // C-2 now busy; NEW_ACCOUNT backs up behind it

        Token normalA = service.issueToken(ServiceCategory.NEW_ACCOUNT, Priority.NORMAL);
        Token normalB = service.issueToken(ServiceCategory.NEW_ACCOUNT, Priority.NORMAL);
        Token seniorCitizen = service.issueToken(ServiceCategory.NEW_ACCOUNT, Priority.PRIORITY);
        System.out.println(normalA.getTokenNumber() + ", " + normalB.getTokenNumber()
                + " waiting normally; " + seniorCitizen.getTokenNumber() + " waiting as PRIORITY");
        System.out.println("Estimated wait for a brand-new NORMAL New-Account token: "
                + service.estimateWaitSeconds(ServiceCategory.NEW_ACCOUNT, Priority.NORMAL) + "s");

        service.completeService(first.getTokenNumber()); // frees C-2 -> assignIdleCounters() runs
        System.out.println("After C-2 frees up, seniorCitizen status: " + seniorCitizen.getStatus()
                + " (expected CALLED - priority jumped ahead of normalA/normalB)");
        System.out.println("normalA still waiting? " + (normalA.getStatus() == Token.TokenStatus.WAITING));

        // --- No-show flow: seniorCitizen was called but never shows up at the counter ---
        try {
            service.markNoShow(seniorCitizen.getTokenNumber());
            System.out.println("Unexpected: no-show accepted before grace period elapsed");
        } catch (QueueManagementService.InvalidTokenStateException e) {
            System.out.println("Expected: " + e.getMessage());
        }
        Thread.sleep(150); // grace period configured above is 100ms for this demo
        service.markNoShow(seniorCitizen.getTokenNumber());
        System.out.println("seniorCitizen final status: " + seniorCitizen.getStatus());
        System.out.println("normalA called after no-show freed the counter? "
                + (normalA.getStatus() == Token.TokenStatus.CALLED));

        // --- Concurrency stress test: many callers racing to pull from one shared CategoryQueue ---
        CategoryQueue stressQueue = new CategoryQueue(ServiceCategory.CASH_DEPOSIT);
        TokenFactory stressFactory = new TokenFactory();
        int tokenCount = 40;
        for (int i = 0; i < tokenCount; i++) {
            Priority priority = (i % 5 == 0) ? Priority.PRIORITY : Priority.NORMAL;
            stressQueue.enqueue(stressFactory.issue(ServiceCategory.CASH_DEPOSIT, priority));
        }

        ExecutorService pool = Executors.newFixedThreadPool(20);
        ConcurrentLinkedQueue<Token> polledTokens = new ConcurrentLinkedQueue<>();
        CountDownLatch done = new CountDownLatch(tokenCount);
        for (int i = 0; i < tokenCount; i++) {
            pool.submit(() -> {
                try {
                    Token token = stressQueue.pollNext();
                    if (token != null) {
                        polledTokens.add(token);
                    }
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();

        Set<String> distinctPolled = new HashSet<>();
        for (Token token : polledTokens) {
            distinctPolled.add(token.getTokenNumber());
        }
        System.out.println("Tokens enqueued: " + tokenCount + ", tokens polled: " + polledTokens.size()
                + ", distinct tokens polled: " + distinctPolled.size() + " (expected all three equal - no drops, no duplicates)");
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Token Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> WAITING: issueToken()
  WAITING --> CALLED: assignIdleCounters() pulls this token
  WAITING --> CANCELLED: cancelToken()
  CALLED --> SERVING: startService()
  CALLED --> NO_SHOW: markNoShow() after grace elapses
  SERVING --> COMPLETED: completeService()
  COMPLETED --> [*]
  NO_SHOW --> [*]
  CANCELLED --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Counter Frees Up and Pulls Its Next Token',
    mermaid: `sequenceDiagram
  autonumber
  participant Counter
  participant Service as QueueManagementService
  participant Strategy as CounterAssignmentStrategy
  participant Queue as CategoryQueue
  participant Board as DisplayBoardObserver

  Counter->>Service: completeService(tokenNumber)
  Service->>Counter: free()
  Service->>Service: assignIdleCounters()
  Service->>Strategy: selectCategory(counter, queuesByCategory)
  Strategy-->>Service: Optional<ServiceCategory>
  Service->>Queue: pollNext() - lock-protected
  Queue-->>Service: next Token (priority-aware, fairness-capped)
  Service->>Counter: assign(token)
  Service->>Service: token.markCalled(counterId, now)
  Service->>Board: onTokenCalled(token, counter)`,
  },

  extensions: [
    { extension: 'Background no-show sweeper', implementation: 'Add a ScheduledExecutorService that periodically scans CALLED tokens across all counters for isCallTimedOut() and proactively fires markNoShow(), instead of relying on a clerk or kiosk to notice and poll manually.' },
    { extension: 'Weighted/aging anti-starvation instead of a hard cap', implementation: 'Replace the fixed "max 3 consecutive priority tokens" rule in CategoryQueue with an aging score - every normal token accrues a virtual priority boost the longer it waits, and pollNext() compares boosted normal tokens against raw priority ones - so fairness degrades gracefully under load instead of hitting a hard wall.' },
    { extension: 'Skill-based routing beyond category', implementation: 'Extend Counter.eligibleCategories to a richer Skill set (e.g. "Hindi-speaking", "Loans over $1M require a senior officer") and add a SkillBasedAssignmentStrategy that matches a token\'s declared needs, not just its raw category.' },
    { extension: 'SMS / mobile push instead of a physical display board', implementation: "Add an SmsNotificationObserver implementing TokenCalledObserver that looks up the customer's phone number and sends 'You are being called to Counter 3' - the core service requires zero changes, exactly the payoff the Observer pattern is meant to deliver." },
    { extension: 'Multi-branch federation', implementation: 'Run one QueueManagementService per branch and add a BranchDirectory that lets a customer compare estimateWaitSeconds() across nearby branches before choosing where to pull a token.' },
    { extension: 'Pre-booked appointment tokens with a guaranteed slot', implementation: 'Model an appointment as a token pre-issued for a specific time window that, like a restaurant Hold, gets injected at the front of its CategoryQueue a few minutes before its slot instead of competing on arrival order at all.' },
  ],

  interviewerChecklist: [
    'Is the resource genuinely modeled as (category, counter-eligibility) rather than one global queue - can two categories with disjoint counters never block each other?',
    'Is pulling the next token for a category a real atomic operation (a lock or CAS-style primitive) rather than a check-then-act race that two simultaneously-freed counters could both win?',
    "Does the anti-starvation mechanism have a concrete, statable guarantee (e.g. 'at most K consecutive priority pulls') instead of a hand-wave that 'priority tokens always go first' with no bound on normal-token wait?",
    'Is the wait-time estimate justified from real inputs (queue depth, average service time, number of eligible active servers) rather than a made-up constant, with the candidate acknowledging it is an approximation, not a guarantee?',
    'Is no-show handled with an explicit grace period and a terminal state, rather than either an instant no-show or an infinite wait that permanently locks a counter?',
    'Can a new assignment strategy or a new notification channel be added without touching the core issue/assign/complete/no-show methods?',
  ],

  relatedDesigns: ['elevator-system', 'restaurant-booking'],
  keyTakeaways: [
    'A priority queue in an interview setting rarely means "reach for java.util.PriorityQueue" - here two plain FIFO deques plus one fairness counter model the real requirement (a bounded priority advantage) more transparently than a single stateful comparator ever could.',
    "The concurrency-critical operation is never the map lookup - it's the compound 'decide which line, then pop, then update a fairness counter' step, which is exactly why it needs a real lock even in a design that is otherwise all lock-free ConcurrentHashMap reads.",
    "Assignment strategy at the counter level (which eligible category to pull from) is the same Strategy shape as elevator-system's DispatchStrategy (which car answers a hall call) - both are 'pick a queue for a caller with multiple eligible options' problems wearing different domain clothes.",
    'Wait-time estimation only needs to be defensible, not exact - queue depth divided by parallel servers, times average service time, is the same first-order approximation used to explain M/M/c-style queues to a non-technical audience.',
  ],
}

export default problem

import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'rate-limiter',
  title: 'Rate Limiter',
  difficulty: 'Intermediate',
  icon: 'pi pi-bolt',
  color: '#eab308',
  readTimeMinutes: 17,
  patterns: ['Strategy', 'Factory Method'],
  companies: ['Stripe', 'Cloudflare', 'Google', 'Amazon API Gateway', 'Kong'],
  summary:
    'A per-client rate limiter that decides allow/deny for every incoming request in O(1) time, backed by three interchangeable limiting algorithms (token bucket, sliding window log, fixed window counter) selected by client tier, where the central engineering problem is making the decision race-free under heavy concurrent traffic for the same client without ever letting through more requests than the configured limit.',

  functionalRequirements: [
    'Given a client/API-key identifier, decide allow or deny for the current request against that client\'s configured limit, in roughly constant time regardless of how many other clients exist.',
    'Support at least three interchangeable limiting algorithms behind one interface: Token Bucket (burst-friendly, refills continuously over time), Sliding Window Log (exact, recomputes the window from real request timestamps), and Fixed Window Counter (cheap, but has a known boundary-burst weakness).',
    'Support different limits per client tier (e.g. FREE, BASIC, PREMIUM, ENTERPRISE) - a FREE client and an ENTERPRISE client can be limited by entirely different algorithms and thresholds without either strategy implementation knowing the word "tier" exists.',
    'Let an operator move a specific client to a different tier at runtime (e.g. after a plan upgrade) and have the new limit apply to their very next request.',
    'Track enough per-client state (tokens remaining, window timestamps, or window counts, depending on algorithm) to make the allow/deny decision self-contained - no shared global counter across clients.',
  ],
  nonFunctionalRequirements: [
    'The decision must be race-free: many threads calling allow() for the SAME client at the same instant must never collectively let through more requests than that client\'s configured limit - this is the central concurrency problem, not an edge case.',
    'Adding a fourth algorithm (e.g. sliding window counter, GCRA) must require writing one new class and registering it with a factory - it must never require touching the facade or any existing strategy.',
    'Per-client bookkeeping should stay close to O(1) space for token bucket and fixed window; sliding window log is explicitly allowed to trade O(limit) memory per client for exactness - that tradeoff must be visible and documented, not accidental.',
    'A client that stops sending requests should not pin its per-client state in memory forever - the design must at least name an eviction/TTL strategy for stale entries, even if a full LRU sweep is left as an extension.',
  ],

  coreEntities: [
    { name: 'RateLimitAlgorithm', description: 'Enum naming the three limiting algorithms (TOKEN_BUCKET, SLIDING_WINDOW_LOG, FIXED_WINDOW_COUNTER) - the value a RateLimitPolicy uses to pick its strategy, without either side referencing a class name directly.' },
    { name: 'ClientTier', description: 'Enum of subscription tiers (FREE, BASIC, PREMIUM, ENTERPRISE) - purely a lookup key into tier-to-policy configuration; no strategy or entity downstream ever branches on tier itself.' },
    { name: 'RateLimitPolicy', description: 'Immutable value object bundling one algorithm with its numeric parameters (limit, window size, burst capacity, refill rate) - the "how many, how fast" contract a strategy is handed on every call.' },
    { name: 'RateLimitingStrategy', description: 'The interchangeable-algorithm interface - one method, tryAcquire(clientId, policy), that every limiting algorithm implements identically from the caller\'s point of view.' },
    { name: 'TokenBucketStrategy', description: 'Burst-friendly algorithm: each client owns a bucket that refills continuously at a fixed rate up to a capacity; a request costs one token. Internally a lock-free CAS retry loop over an immutable snapshot.' },
    { name: 'SlidingWindowLogStrategy', description: 'Exact algorithm: keeps a per-client deque of real request timestamps, prunes anything older than the trailing window, and admits the request only if what remains is under the limit.' },
    { name: 'FixedWindowCounterStrategy', description: 'Cheap algorithm: buckets time into fixed-size, non-overlapping windows and keeps a single counter per client per window - O(1) memory, but allows a burst of up to 2x the limit across a window boundary.' },
    { name: 'RateLimitingStrategyFactory', description: 'Maps a RateLimitAlgorithm to its singleton strategy instance - the one place that knows all three concrete classes exist.' },
    { name: 'TierPolicyFactory', description: 'Maps a ClientTier to the RateLimitPolicy (algorithm + parameters) that tier is entitled to - the one place tier-to-limit business rules live.' },
    { name: 'ClientPolicyRegistry', description: 'Tracks which tier each clientId currently belongs to (defaulting unknown clients to FREE); the seam where a plan upgrade takes effect immediately on the next request.' },
    { name: 'RateLimiter', description: 'The facade - the only class calling code touches. allow(clientId) resolves tier -> policy -> strategy and delegates the actual decision, so nothing outside this file ever needs to know three algorithms exist.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class RateLimitAlgorithm {
    <<enumeration>>
    TOKEN_BUCKET
    SLIDING_WINDOW_LOG
    FIXED_WINDOW_COUNTER
  }
  class ClientTier {
    <<enumeration>>
    FREE
    BASIC
    PREMIUM
    ENTERPRISE
  }
  class RateLimitPolicy {
    -RateLimitAlgorithm algorithm
    -int limit
    -long windowMillis
    -double burstCapacity
    -double refillTokensPerSecond
    +tokenBucket(double, double) RateLimitPolicy
    +slidingWindowLog(int, long) RateLimitPolicy
    +fixedWindowCounter(int, long) RateLimitPolicy
  }
  class RateLimitingStrategy {
    <<interface>>
    +tryAcquire(String, RateLimitPolicy) boolean
  }
  class TokenBucketStrategy {
    -ConcurrentHashMap~String, AtomicReference~BucketState~~ bucketsByClient
    +tryAcquire(String, RateLimitPolicy) boolean
  }
  class SlidingWindowLogStrategy {
    -ConcurrentHashMap~String, RequestLog~ logsByClient
    +tryAcquire(String, RateLimitPolicy) boolean
  }
  class FixedWindowCounterStrategy {
    -ConcurrentHashMap~String, AtomicReference~WindowState~~ windowsByClient
    +tryAcquire(String, RateLimitPolicy) boolean
  }
  class RateLimitingStrategyFactory {
    -Map~RateLimitAlgorithm, RateLimitingStrategy~ STRATEGIES
    +getStrategy(RateLimitAlgorithm) RateLimitingStrategy
  }
  class TierPolicyFactory {
    -Map~ClientTier, RateLimitPolicy~ POLICIES
    +policyFor(ClientTier) RateLimitPolicy
  }
  class ClientPolicyRegistry {
    -ConcurrentHashMap~String, ClientTier~ tierByClient
    -ClientTier defaultTier
    +assignTier(String, ClientTier) void
    +tierFor(String) ClientTier
  }
  class RateLimiter {
    -ClientPolicyRegistry policyRegistry
    +allow(String) boolean
    +upgradeTier(String, ClientTier) void
  }

  RateLimitingStrategy <|.. TokenBucketStrategy
  RateLimitingStrategy <|.. SlidingWindowLogStrategy
  RateLimitingStrategy <|.. FixedWindowCounterStrategy
  RateLimitPolicy --> RateLimitAlgorithm
  ClientPolicyRegistry --> ClientTier
  RateLimitingStrategyFactory ..> RateLimitingStrategy : builds/looks up
  TierPolicyFactory ..> RateLimitPolicy : builds
  RateLimiter o-- ClientPolicyRegistry
  RateLimiter ..> TierPolicyFactory : resolves policy
  RateLimiter ..> RateLimitingStrategyFactory : resolves strategy
  RateLimiter ..> RateLimitingStrategy : delegates decision to`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'RateLimitingStrategy + TokenBucketStrategy / SlidingWindowLogStrategy / FixedWindowCounterStrategy', why: 'The limiting algorithm is a swappable policy behind one method, tryAcquire(). RateLimiter.allow() never branches on "which algorithm is this" - it just calls the interface, exactly like TableAllocationStrategy lets holdTable() stay ignorant of best-fit vs first-available.' },
    { pattern: 'Factory Method', where: 'RateLimitingStrategyFactory.getStrategy(RateLimitAlgorithm)', why: 'Centralizes the enum-to-implementation wiring in one EnumMap. Adding a fourth algorithm means writing the class and adding one line here - RateLimiter and every existing strategy stay untouched.' },
    { pattern: 'Factory Method', where: 'TierPolicyFactory.policyFor(ClientTier)', why: 'Centralizes the business rule "what does each tier get" in one place, decoupled from the algorithm classes themselves - a strategy never knows tiers exist, it only ever sees the numeric RateLimitPolicy it was handed. Moving FREE from fixed-window to sliding-window-log is a one-line change here.' },
  ],

  dataStructures: [
    { component: 'Token bucket per-client state', structure: 'ConcurrentHashMap<String, AtomicReference<BucketState>> where BucketState is an immutable record(tokens, lastRefillNanos), updated via a compareAndSet retry loop', why: 'Refilling and consuming are a compound read-then-write over two fields that must move together - a plain AtomicLong CAS cannot express that. Recomputing the whole snapshot from scratch on every retry (instead of patching a stale one) is what makes the loop correct under contention, not just fast.' },
    { component: 'Sliding window log per-client state', structure: 'ConcurrentHashMap<String, RequestLog> where RequestLog wraps an ArrayDeque<Long> behind synchronized methods', why: 'Pruning expired timestamps, checking the remaining count, and appending a new one is a three-step compound operation that a lock-free structure cannot do atomically without extra bookkeeping - a per-client intrinsic lock (not a global lock) keeps that section correct while still letting different clients run fully in parallel.' },
    { component: 'Fixed window counter per-client state', structure: 'ConcurrentHashMap<String, AtomicReference<WindowState>> where WindowState is an immutable record(windowStart, count)', why: 'O(1) memory per client no matter how large the limit is - the entire tradeoff of this algorithm is trading that memory win for the boundary-burst inaccuracy, so the data structure itself is the cheapest of the three by design.' },
    { component: 'Algorithm dispatch table', structure: 'EnumMap<RateLimitAlgorithm, RateLimitingStrategy> inside RateLimitingStrategyFactory', why: 'EnumMap is backed by a plain array indexed by enum ordinal - O(1) lookup with no hashing, and every strategy instance is a stateless-shaped singleton shared across all clients (the per-client data lives inside each strategy\'s own map, not in the dispatch table).' },
    { component: 'Client tier lookup', structure: 'ConcurrentHashMap<String, ClientTier> inside ClientPolicyRegistry', why: 'Many request-handling threads read tiers concurrently while upgrades happen relatively rarely - ConcurrentHashMap gives lock-free reads and fine-grained write locking, matching that read-heavy access pattern.' },
  ],

  walkthroughs: [
    {
      title: 'Token Bucket - Refill and Consume Math (single client, no contention)',
      steps: [
        'PREMIUM tier is configured as RateLimitPolicy.tokenBucket(burstCapacity = 10, refillTokensPerSecond = 5) - a client can burst up to 10 requests instantly, then sustain 5 requests/sec indefinitely.',
        "First request ever: TokenBucketStrategy.tryAcquire() has no bucket for this clientId yet, so computeIfAbsent() seeds one at BucketState(tokens=10.0, lastRefillNanos=now) - the bucket starts full, exactly the burst allowance.",
        'Client immediately fires 10 requests back-to-back (elapsed time ~0, so refill adds ~0 tokens each time): each call sees tokens >= 1.0, consumes one, and the 10th call leaves the bucket at BucketState(tokens=0.0, lastRefillNanos=t0).',
        'An 11th request arrives at t0 (still no elapsed time): refilled = min(10.0, 0.0 + 0*5) = 0.0, which is < 1.0, so tryAcquire() returns false - the burst is fully spent.',
        'The client waits 400ms and tries again at t0+400ms: elapsedSeconds = 0.4, refilled = min(10.0, 0.0 + 0.4*5) = 2.0 tokens. That is >= 1.0, so the request is allowed and the bucket becomes BucketState(tokens=1.0, lastRefillNanos=t0+400ms).',
        'Another request arrives 100ms later, at t0+500ms: elapsedSeconds = 0.1, refilled = min(10.0, 1.0 + 0.1*5) = 1.5 tokens - allowed, leaving BucketState(tokens=0.5, ...). A third request right after that (elapsed ~0) sees refilled ~= 0.5, which is < 1.0, so it is denied - the math is enforcing exactly "5 tokens/sec sustained" even though every call recomputes from a stored snapshot instead of running a background refill thread.',
      ],
    },
    {
      title: 'Concurrency Race on a Nearly-Empty Bucket (the failure mode being designed around)',
      steps: [
        'Setup: a client\'s bucket currently holds exactly BucketState(tokens=1.0, lastRefillNanos=t0), and refillTokensPerSecond is low enough that two threads racing microseconds apart see essentially zero additional refill.',
        'The naive, wrong implementation: read tokens (sees 1.0), check tokens >= 1 (true), then separately decrement and write tokens = 0.0. If two threads both execute the "read" step before either executes the "write" step, both see 1.0, both pass the check, and both decrement - two requests are let through for a single available token. That read-check-write gap is the entire bug this design exists to close.',
        'The actual implementation: Thread A calls bucket.get(), capturing snapshot S1 = BucketState(1.0, t0). Thread B calls bucket.get() at nearly the same instant and captures the same snapshot S1 (AtomicReference reads are safe to share; nothing has changed yet).',
        'Thread A computes refilled = 1.0 (negligible elapsed time), builds updated = BucketState(0.0, now), and calls bucket.compareAndSet(S1, updated) - this succeeds because the reference in the AtomicReference is still exactly S1. Thread A returns true (allowed).',
        'Thread B, holding the same stale snapshot S1, computes its own updated2 = BucketState(0.0, now2) and calls bucket.compareAndSet(S1, updated2) - this FAILS, because the AtomicReference now holds Thread A\'s updated object, not S1. The CAS failing is the entire safety mechanism: it detects that the world moved since Thread B looked at it.',
        'Thread B\'s loop does not give up on failure - it retries by re-reading the bucket, now getting Thread A\'s updated = BucketState(0.0, now). It recomputes refilled from that fresh snapshot (still ~0.0, since almost no time passed), sees refilled < 1.0, and returns false. Net result: exactly one of the two threads is allowed, matching the single available token - the same optimistic-retry guarantee AtomicInteger.incrementAndGet() gives for a single counter, extended here to a compound (tokens, timestamp) pair.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'RateLimitAlgorithm.java',
      rationale: 'A closed set of algorithm identifiers - deliberately just an enum, never a string, so RateLimitingStrategyFactory\'s dispatch map can be an EnumMap and an unrecognized algorithm is a compile error, not a runtime typo.',
      code: `public enum RateLimitAlgorithm {
    TOKEN_BUCKET,
    SLIDING_WINDOW_LOG,
    FIXED_WINDOW_COUNTER
}`,
    },
    {
      filename: 'ClientTier.java',
      rationale: 'Business-facing subscription tiers - kept completely separate from RateLimitAlgorithm so that "which plan is this client on" and "which algorithm enforces their limit" can be changed independently of one another.',
      code: `public enum ClientTier {
    FREE,
    BASIC,
    PREMIUM,
    ENTERPRISE
}`,
    },
    {
      filename: 'RateLimitPolicy.java',
      rationale: 'One immutable value object carries every numeric knob any of the three algorithms could need - a token-bucket policy simply leaves limit/windowMillis at zero, and a window-based policy leaves burstCapacity/refillTokensPerSecond at zero. Static factory methods keep call sites self-documenting instead of a five-argument constructor call.',
      code: `public final class RateLimitPolicy {
    private final RateLimitAlgorithm algorithm;
    private final int limit;
    private final long windowMillis;
    private final double burstCapacity;
    private final double refillTokensPerSecond;

    public RateLimitPolicy(RateLimitAlgorithm algorithm, int limit, long windowMillis,
                            double burstCapacity, double refillTokensPerSecond) {
        this.algorithm = algorithm;
        this.limit = limit;
        this.windowMillis = windowMillis;
        this.burstCapacity = burstCapacity;
        this.refillTokensPerSecond = refillTokensPerSecond;
    }

    public static RateLimitPolicy tokenBucket(double burstCapacity, double refillTokensPerSecond) {
        return new RateLimitPolicy(RateLimitAlgorithm.TOKEN_BUCKET, 0, 0L, burstCapacity, refillTokensPerSecond);
    }

    public static RateLimitPolicy slidingWindowLog(int limit, long windowMillis) {
        return new RateLimitPolicy(RateLimitAlgorithm.SLIDING_WINDOW_LOG, limit, windowMillis, 0.0, 0.0);
    }

    public static RateLimitPolicy fixedWindowCounter(int limit, long windowMillis) {
        return new RateLimitPolicy(RateLimitAlgorithm.FIXED_WINDOW_COUNTER, limit, windowMillis, 0.0, 0.0);
    }

    public RateLimitAlgorithm getAlgorithm() { return algorithm; }
    public int getLimit() { return limit; }
    public long getWindowMillis() { return windowMillis; }
    public double getBurstCapacity() { return burstCapacity; }
    public double getRefillTokensPerSecond() { return refillTokensPerSecond; }
}`,
    },
    {
      filename: 'RateLimitingStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This single method is the entire contract RateLimiter depends on. Every one of the three algorithms below satisfies it identically, which is why RateLimiter.allow() can pick whichever one a client\'s tier maps to and call tryAcquire() without an if/else chain on algorithm type anywhere in the codebase.',
      rationale: 'Kept to exactly one method taking the raw clientId and the resolved RateLimitPolicy - implementations own their own per-client state maps entirely internally, so no shared state object needs to be threaded through the interface.',
      code: `public interface RateLimitingStrategy {
    /** Returns true if the request for this client is allowed under the given policy right now. */
    boolean tryAcquire(String clientId, RateLimitPolicy policy);
}`,
    },
    {
      filename: 'TokenBucketStrategy.java',
      calloutTitle: '💡 Lock-free CAS retry loop (the race this design exists to close)',
      callout:
        'A naive version reads "tokens available", checks it, then separately writes the decrement - two threads racing on a bucket with exactly one token left can both read 1, both pass the check, and both decrement, letting one extra request through. The fix here is to never mutate in place: every attempt recomputes a brand-new immutable BucketState from scratch (current tokens + elapsed-time refill), then tries to install it with compareAndSet. If another thread already moved the reference, the CAS fails and the loop retries against the fresh snapshot instead of blindly applying a stale delta - the same optimistic-retry idea as AtomicInteger.incrementAndGet(), generalized to a compound (tokens, timestamp) pair.',
      rationale: 'Uses a record for BucketState so "tokens" and "lastRefillNanos" are always read and replaced together - there is no way to update one field without the other, which is exactly what prevents the two fields from drifting out of sync under concurrent access.',
      code: `import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public final class TokenBucketStrategy implements RateLimitingStrategy {

    private record BucketState(double tokens, long lastRefillNanos) {}

    private final ConcurrentHashMap<String, AtomicReference<BucketState>> bucketsByClient = new ConcurrentHashMap<>();

    @Override
    public boolean tryAcquire(String clientId, RateLimitPolicy policy) {
        AtomicReference<BucketState> bucket = bucketsByClient.computeIfAbsent(
                clientId,
                id -> new AtomicReference<>(new BucketState(policy.getBurstCapacity(), System.nanoTime())));

        while (true) {
            BucketState current = bucket.get();
            long now = System.nanoTime();
            double elapsedSeconds = Math.max(0L, now - current.lastRefillNanos()) / 1_000_000_000.0;
            double refilled = Math.min(
                    policy.getBurstCapacity(),
                    current.tokens() + elapsedSeconds * policy.getRefillTokensPerSecond());

            if (refilled < 1.0) {
                // Not enough to serve this request. Still publish the refreshed snapshot so the *next*
                // attempt - by this thread or a competing one - starts refilling from an up-to-date clock
                // instead of the old lastRefillNanos, or elapsed time would silently double-count.
                BucketState drained = new BucketState(refilled, now);
                if (bucket.compareAndSet(current, drained)) {
                    return false;
                }
                continue; // lost the race publishing the drained snapshot - retry from the fresh state
            }

            BucketState updated = new BucketState(refilled - 1.0, now);
            if (bucket.compareAndSet(current, updated)) {
                return true;
            }
            // Someone else refilled/consumed first - retry the whole computation against their result,
            // never just "subtract one more" from a value we already know is stale.
        }
    }
}`,
    },
    {
      filename: 'SlidingWindowLogStrategy.java',
      rationale:
        'Exact by construction: it never approximates "how many requests happened in the last windowMillis" the way a fixed window does - it recomputes it from real timestamps every call. The per-client RequestLog\'s prune-check-append sequence is a single compound step, so it is guarded by an ordinary intrinsic lock scoped to just that client, not a global lock across all clients.',
      code: `import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

public final class SlidingWindowLogStrategy implements RateLimitingStrategy {

    private static final class RequestLog {
        private final Deque<Long> timestamps = new ArrayDeque<>();

        synchronized boolean tryAcquire(int limit, long windowMillis) {
            long now = System.currentTimeMillis();
            long windowStart = now - windowMillis;
            while (!timestamps.isEmpty() && timestamps.peekFirst() <= windowStart) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= limit) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }

    private final ConcurrentHashMap<String, RequestLog> logsByClient = new ConcurrentHashMap<>();

    @Override
    public boolean tryAcquire(String clientId, RateLimitPolicy policy) {
        RequestLog log = logsByClient.computeIfAbsent(clientId, id -> new RequestLog());
        return log.tryAcquire(policy.getLimit(), policy.getWindowMillis());
    }
}`,
    },
    {
      filename: 'FixedWindowCounterStrategy.java',
      rationale:
        'The cheapest of the three algorithms - O(1) memory per client regardless of how large the limit is - at the cost of the well-known boundary-burst weakness: a client can send `limit` requests in the last millisecond of one window and another `limit` in the first millisecond of the next, achieving nearly 2x the nominal rate in a tiny real-time span. That tradeoff is called out explicitly rather than discovered by surprise in production; sliding window log is the fix when exactness matters more than memory.',
      code: `import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public final class FixedWindowCounterStrategy implements RateLimitingStrategy {

    private record WindowState(long windowStart, int count) {}

    private final ConcurrentHashMap<String, AtomicReference<WindowState>> windowsByClient = new ConcurrentHashMap<>();

    @Override
    public boolean tryAcquire(String clientId, RateLimitPolicy policy) {
        AtomicReference<WindowState> window = windowsByClient.computeIfAbsent(
                clientId, id -> new AtomicReference<>(new WindowState(-1L, 0)));

        long windowMillis = policy.getWindowMillis();
        while (true) {
            WindowState current = window.get();
            long currentWindowStart = (System.currentTimeMillis() / windowMillis) * windowMillis;

            if (current.windowStart() != currentWindowStart) {
                // Window rolled over - the counter resets to zero at a hard boundary regardless of how
                // recently a request landed in the previous window. This full reset is exactly the source
                // of the boundary-burst problem described above.
                if (window.compareAndSet(current, new WindowState(currentWindowStart, 1))) {
                    return true;
                }
                continue; // another thread rolled the window first - retry against their fresh window
            }

            if (current.count() >= policy.getLimit()) {
                return false;
            }

            WindowState incremented = new WindowState(current.windowStart(), current.count() + 1);
            if (window.compareAndSet(current, incremented)) {
                return true;
            }
            // Lost the race to another concurrent request in the same window - retry with the fresh count.
        }
    }
}`,
    },
    {
      filename: 'RateLimitingStrategyFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'Every concrete strategy class name appears exactly once in the whole codebase: right here. RateLimiter never imports TokenBucketStrategy or its siblings - it only asks this factory for "the strategy for this algorithm". Adding a fourth algorithm (say, GCRA) means writing one new class and adding one line to the static block; nothing that already compiles needs to change.',
      rationale: 'Strategies are stateless-shaped singletons - each one\'s per-client state lives in its own internal map, so one shared instance per algorithm, looked up in an EnumMap, is both correct and allocation-free per request.',
      code: `import java.util.EnumMap;
import java.util.Map;

public final class RateLimitingStrategyFactory {
    private static final Map<RateLimitAlgorithm, RateLimitingStrategy> STRATEGIES =
            new EnumMap<>(RateLimitAlgorithm.class);

    static {
        STRATEGIES.put(RateLimitAlgorithm.TOKEN_BUCKET, new TokenBucketStrategy());
        STRATEGIES.put(RateLimitAlgorithm.SLIDING_WINDOW_LOG, new SlidingWindowLogStrategy());
        STRATEGIES.put(RateLimitAlgorithm.FIXED_WINDOW_COUNTER, new FixedWindowCounterStrategy());
    }

    private RateLimitingStrategyFactory() {}

    public static RateLimitingStrategy getStrategy(RateLimitAlgorithm algorithm) {
        RateLimitingStrategy strategy = STRATEGIES.get(algorithm);
        if (strategy == null) {
            throw new IllegalArgumentException("No strategy registered for algorithm " + algorithm);
        }
        return strategy;
    }
}`,
    },
    {
      filename: 'TierPolicyFactory.java',
      rationale:
        'The one place "what does a FREE client get vs. an ENTERPRISE client" is decided. Notice FREE and BASIC intentionally use different algorithms (fixed window vs. sliding window log) from PREMIUM/ENTERPRISE (token bucket) - cheap tiers get the cheap algorithm, paying tiers get the burst-friendly one - and no strategy class anywhere had to be written with tiers in mind to make that possible.',
      code: `import java.util.EnumMap;
import java.util.Map;

public final class TierPolicyFactory {
    private static final Map<ClientTier, RateLimitPolicy> POLICIES = new EnumMap<>(ClientTier.class);

    static {
        POLICIES.put(ClientTier.FREE, RateLimitPolicy.fixedWindowCounter(20, 60_000L));
        POLICIES.put(ClientTier.BASIC, RateLimitPolicy.slidingWindowLog(120, 60_000L));
        POLICIES.put(ClientTier.PREMIUM, RateLimitPolicy.tokenBucket(50, 20.0));
        POLICIES.put(ClientTier.ENTERPRISE, RateLimitPolicy.tokenBucket(500, 200.0));
    }

    private TierPolicyFactory() {}

    public static RateLimitPolicy policyFor(ClientTier tier) {
        RateLimitPolicy policy = POLICIES.get(tier);
        if (policy == null) {
            throw new IllegalArgumentException("No policy configured for tier " + tier);
        }
        return policy;
    }
}`,
    },
    {
      filename: 'ClientPolicyRegistry.java',
      rationale:
        'Deliberately just an id-to-tier map, not an id-to-policy map - the policy is always re-derived from the current tier via TierPolicyFactory on every call, so a tier upgrade takes effect on the very next request with no cache to invalidate. Unknown clients default to FREE rather than throwing, so a brand-new API key is safe by default.',
      code: `import java.util.concurrent.ConcurrentHashMap;

public final class ClientPolicyRegistry {
    private final ConcurrentHashMap<String, ClientTier> tierByClient = new ConcurrentHashMap<>();
    private final ClientTier defaultTier;

    public ClientPolicyRegistry(ClientTier defaultTier) {
        this.defaultTier = defaultTier;
    }

    public void assignTier(String clientId, ClientTier tier) {
        tierByClient.put(clientId, tier);
    }

    public ClientTier tierFor(String clientId) {
        return tierByClient.getOrDefault(clientId, defaultTier);
    }
}`,
    },
    {
      filename: 'RateLimiter.java',
      rationale:
        'The facade - the only class any caller (a servlet filter, an API gateway middleware, a gRPC interceptor) ever imports. allow() is three lookups and one delegated call; all of the actual limiting logic, including every concurrency concern, lives one layer down in the strategies, keeping this class trivially easy to read and test.',
      code: `public final class RateLimiter {
    private final ClientPolicyRegistry policyRegistry;

    public RateLimiter(ClientPolicyRegistry policyRegistry) {
        this.policyRegistry = policyRegistry;
    }

    public boolean allow(String clientId) {
        ClientTier tier = policyRegistry.tierFor(clientId);
        RateLimitPolicy policy = TierPolicyFactory.policyFor(tier);
        RateLimitingStrategy strategy = RateLimitingStrategyFactory.getStrategy(policy.getAlgorithm());
        return strategy.tryAcquire(clientId, policy);
    }

    public void upgradeTier(String clientId, ClientTier tier) {
        policyRegistry.assignTier(clientId, tier);
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy path (a PREMIUM client\'s burst capacity via the facade), the fixed-window boundary-burst edge case called out as a known tradeoff, and - since race-free limiting under concurrency is the stated non-functional requirement - a stress test proving a single-token bucket lets exactly one of many racing threads through.',
      code: `import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public final class Demo {
    public static void main(String[] args) throws Exception {
        ClientPolicyRegistry registry = new ClientPolicyRegistry(ClientTier.FREE);
        RateLimiter rateLimiter = new RateLimiter(registry);

        // --- Happy path: PREMIUM gets a 50-token bucket refilling at 20 tokens/sec ---
        registry.assignTier("acme-corp", ClientTier.PREMIUM);
        int allowed = 0;
        for (int i = 0; i < 55; i++) {
            if (rateLimiter.allow("acme-corp")) {
                allowed++;
            }
        }
        System.out.println("acme-corp burst of 55 requests -> allowed " + allowed + " (expected 50, the burst capacity)");

        // --- Edge case: fixed-window boundary burst ---
        RateLimitPolicy tinyFixedWindow = RateLimitPolicy.fixedWindowCounter(5, 200L);
        RateLimitingStrategy fixedWindow = new FixedWindowCounterStrategy();
        int firstWindowAllowed = 0;
        for (int i = 0; i < 5; i++) {
            if (fixedWindow.tryAcquire("boundary-client", tinyFixedWindow)) {
                firstWindowAllowed++;
            }
        }
        Thread.sleep(210); // cross into the next 200ms window
        int secondWindowAllowed = 0;
        for (int i = 0; i < 5; i++) {
            if (fixedWindow.tryAcquire("boundary-client", tinyFixedWindow)) {
                secondWindowAllowed++;
            }
        }
        System.out.println("Fixed window: " + firstWindowAllowed + " allowed just before the boundary, "
                + secondWindowAllowed + " more allowed right after it - "
                + (firstWindowAllowed + secondWindowAllowed)
                + " total within ~210ms against a nominal 5-per-200ms limit (the boundary-burst tradeoff).");

        // --- Concurrency stress test: 50 threads race for a single-token bucket ---
        RateLimitPolicy singleToken = RateLimitPolicy.tokenBucket(1.0, 0.0); // no refill during the test window
        RateLimitingStrategy tokenBucket = new TokenBucketStrategy();
        ExecutorService pool = Executors.newFixedThreadPool(50);
        AtomicInteger successCount = new AtomicInteger();
        CountDownLatch done = new CountDownLatch(50);
        for (int i = 0; i < 50; i++) {
            pool.submit(() -> {
                try {
                    if (tokenBucket.tryAcquire("shared-client", singleToken)) {
                        successCount.incrementAndGet();
                    }
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();
        System.out.println("Threads that won the single token: " + successCount.get() + " (expected 1)");
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Token Bucket Lifecycle (per client)',
    mermaid: `stateDiagram-v2
  [*] --> Full: first request seeds bucket at burstCapacity
  Full --> Draining: tryAcquire() consumes a token
  Draining --> Draining: tryAcquire() consumes another token
  Draining --> Empty: tokens drop below 1.0
  Empty --> Draining: elapsed time refills >= 1.0 token
  Draining --> Full: elapsed time refills back to burstCapacity
  Empty --> Empty: tryAcquire() denied, refill still < 1.0`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - allow(clientId)',
    mermaid: `sequenceDiagram
  autonumber
  participant Caller
  participant Limiter as RateLimiter
  participant Registry as ClientPolicyRegistry
  participant TierFactory as TierPolicyFactory
  participant StratFactory as RateLimitingStrategyFactory
  participant Strategy as RateLimitingStrategy

  Caller->>Limiter: allow(clientId)
  Limiter->>Registry: tierFor(clientId)
  Registry-->>Limiter: ClientTier
  Limiter->>TierFactory: policyFor(tier)
  TierFactory-->>Limiter: RateLimitPolicy
  Limiter->>StratFactory: getStrategy(policy.algorithm())
  StratFactory-->>Limiter: RateLimitingStrategy instance
  Limiter->>Strategy: tryAcquire(clientId, policy)
  Strategy-->>Limiter: boolean
  Limiter-->>Caller: boolean`,
  },

  extensions: [
    { extension: 'Idle-client state eviction', implementation: 'Wrap each per-client map (bucketsByClient, logsByClient, windowsByClient) with a bounded cache like Caffeine configured with expireAfterAccess(), or run a background ScheduledExecutorService sweep that removes entries whose lastRefillNanos/last-timestamp is older than a TTL - otherwise a limiter that has served millions of now-silent clients holds their state forever.' },
    { extension: 'Distributed rate limiting across multiple app instances', implementation: 'Replace the in-memory ConcurrentHashMap state with a Redis-backed implementation of the same RateLimitingStrategy interface (e.g. a Lua script doing the token-bucket math atomically server-side) - RateLimiter and the factories do not change at all, only which concrete strategy is registered.' },
    { extension: 'Retry-After / X-RateLimit-* response headers', implementation: 'Change tryAcquire() to return a small RateLimitDecision(boolean allowed, long retryAfterMillis, int remaining) instead of a bare boolean, computed from the same snapshot each strategy already builds internally.' },
    { extension: 'Multiple simultaneous limits per client (e.g. per-second AND per-day)', implementation: 'Let RateLimitPolicy carry a List of algorithm+threshold pairs and have RateLimiter.allow() require every configured strategy to return true, short-circuiting on the first denial - similar in spirit to a chain rather than a single strategy pick.' },
    { extension: 'Per-endpoint limits, not just per-client', implementation: 'Key every internal map on a composite (clientId, endpoint) instead of clientId alone, the same way restaurant-booking keys occupancy on (table, slot) instead of table alone - the scarce resource is really the pair, not either half.' },
    { extension: 'Graceful degradation under a Redis/backing-store outage', implementation: 'Fail open (allow) or fail closed (deny) behind a circuit breaker wrapping the distributed strategy, decided per business requirement rather than baked into the strategy itself.' },
    { extension: 'Sliding window counter as a fourth algorithm', implementation: 'Add a SlidingWindowCounterStrategy that blends the current and previous fixed windows with a weighted average based on how far into the current window the request landed - O(1) memory like fixed window, far less boundary error than a naive fixed window, and it slots into RateLimitingStrategyFactory exactly like the other three.' },
  ],

  interviewerChecklist: [
    'Does the candidate name the boundary-burst weakness of fixed window counters unprompted, or only after being pushed - and can they explain why sliding window log fixes it and at what cost (memory)?',
    'Is the concurrency fix a genuine atomic compound operation (CAS-over-immutable-snapshot, or a scoped lock) rather than a read-check-write race dressed up with a comment?',
    'Is tier-to-limit configuration injected/looked up rather than hardcoded inside each strategy - would adding a fifth tier require touching TokenBucketStrategy at all?',
    'Does the candidate proactively raise the "state grows forever for clients who stop sending requests" memory leak, even if they only sketch the eviction fix rather than fully implementing it?',
    'Can a new algorithm be added by writing one class and registering it in one factory, with zero changes to the facade or any existing strategy?',
    'Does the candidate distinguish per-client state (what this design is) from a single global counter (which would serialize all clients behind one lock and defeat the point of rate limiting)?',
    'If pushed toward a multi-instance deployment, does the candidate recognize that purely in-memory per-client maps stop being correct the moment traffic for one client is load-balanced across more than one process, and name a shared store as the fix?',
  ],

  relatedDesigns: ['multilevel-cache', 'restaurant-booking'],
  keyTakeaways: [
    'Token bucket, sliding window log, and fixed window counter all answer "allow or deny" but trade off memory, exactness, and burst tolerance differently - naming that tradeoff explicitly is more valuable in an interview than picking "the right one".',
    'The classic rate-limiter bug is a read-check-write race on shared per-client state; the fix is either a CAS retry loop over an immutable snapshot (lock-free, token bucket/fixed window here) or a lock scoped to exactly one client (sliding window log here) - never a lock spanning all clients.',
    'Configuration (which tier gets which algorithm and threshold) should be injected via a factory/lookup, never hardcoded inside an algorithm - the same separation multilevel-cache uses to keep EvictionPolicy ignorant of which cache level it is running in.',
    'Unbounded per-client state is the silent failure mode of every rate limiter design - it is worth naming an eviction/TTL story even when the interview scope does not require implementing it.',
  ],
}

export default problem

import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'multilevel-cache',
  title: 'Multilevel Cache',
  difficulty: 'Intermediate',
  icon: 'pi pi-database',
  color: '#10b981',
  readTimeMinutes: 18,
  patterns: ['Strategy', 'Facade', 'Chain of Responsibility', 'Builder'],
  companies: ['Amazon', 'Google', 'Akamai', 'Redis Labs'],
  summary:
    'A cache made of an ordered chain of levels (L1 fastest/smallest through Ln slowest/largest), each running its own pluggable eviction policy, where a hit deep in the chain promotes the entry back to L1 and an eviction at L1 demotes the loser down into L2 instead of discarding it.',

  functionalRequirements: [
    'Support an ordered chain of cache levels (L1, L2, ..., Ln) where each level has its own capacity and its own eviction policy.',
    'get(key) checks L1 first, then cascades to L2, L3, ... in order, stopping at the first level that has the key.',
    'A hit at any level N > 1 promotes the entry back into L1 (write-through promotion) so the next read of that key is served from the fastest level.',
    'put(key, value) writes into L1; if L1 is full, whatever its policy evicts must be demoted into L2 (and cascaded further if L2 is also full) - never silently dropped until it truly falls off the last level.',
    'Support pluggable, independent eviction policies per level - at minimum LRU and LFU.',
    'Expose a simple get(key) / put(key, value) API to callers; the multi-level traversal, promotion, and demotion machinery must stay hidden behind that API.',
    'Track basic hit/miss observability - hits per level and total misses - so it is possible to see how much traffic L1 is actually absorbing.',
  ],
  nonFunctionalRequirements: [
    "get() / put() must not degrade to O(n) in total cache size as more levels are added - each level's own eviction bookkeeping stays O(1) (LRU) or O(log n) (LFU), and the number of levels walked is a small constant, never proportional to the number of cached entries.",
    'Adding a new eviction algorithm (ARC, FIFO, 2Q, ...) must not require touching CacheLevel or MultiLevelCache - only a new EvictionPolicy implementation.',
    'Promotion and demotion must be idempotent-safe to call repeatedly without corrupting a level\'s internal bookkeeping - promoting the same key twice in a row must never leave two linked-list nodes for it.',
    'Each CacheLevel must be constructible and testable in isolation, without wiring up the full MultiLevelCache.',
  ],

  coreEntities: [
    { name: 'EvictionPolicy<K>', description: 'The Strategy interface every eviction algorithm implements - tracks only keys (never values), so a level\'s value storage stays fully decoupled from how it decides what to evict.' },
    { name: 'LRUEvictionPolicy<K>', description: 'Hand-rolled HashMap + doubly linked list giving O(1) recordAccess (move-to-front) and O(1) evictionCandidate (read the tail).' },
    { name: 'LFUEvictionPolicy<K>', description: 'HashMap<K, Integer> of access frequencies plus a TreeMap<Integer, LinkedHashSet<K>> of frequency buckets, giving O(log n) worst-case eviction lookup with oldest-first tie-breaking inside a bucket.' },
    { name: 'Node<K>', description: 'The doubly linked list node private to LRUEvictionPolicy - carries the key plus prev/next pointers; sentinel head/tail nodes remove all "empty list" edge cases.' },
    { name: 'CacheLevel<K, V>', description: 'One physical tier: owns its own bounded HashMap value store, its own capacity, and its own EvictionPolicy. Knows nothing about any other level.' },
    { name: 'MultiLevelCache<K, V>', description: 'The Facade - composes an ordered List<CacheLevel<K, V>> and exposes only get()/put(), internally handling the cascade-miss, promote-on-hit, and demote-on-evict logic.' },
    { name: 'MultiLevelCacheBuilder<K, V>', description: 'Fluent builder for assembling the ordered chain of levels (addLevel(name, capacity, policy)...build()) without a telescoping constructor.' },
    { name: 'CacheStats', description: 'Small mutable counter object - hits per level name plus a total miss count - updated by MultiLevelCache on every get().' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class EvictionPolicy~K~ {
    <<interface>>
    +recordAccess(K key) void
    +evictionCandidate() K
    +remove(K key) void
  }
  class LRUEvictionPolicy~K~ {
    -Node~K~ head
    -Node~K~ tail
    -Map~K, Node~K~~ nodesByKey
    +recordAccess(K key) void
    +evictionCandidate() K
    +remove(K key) void
    +mostToLeastRecentlyUsed() List~K~
  }
  class LFUEvictionPolicy~K~ {
    -Map~K, Integer~ frequencyByKey
    -TreeMap~Integer, LinkedHashSet~K~~ keysByFrequency
    +recordAccess(K key) void
    +evictionCandidate() K
    +remove(K key) void
  }
  class Node~K~ {
    ~K key
    ~Node~K~ prev
    ~Node~K~ next
  }
  class CacheLevel~K, V~ {
    -String name
    -int capacity
    -EvictionPolicy~K~ evictionPolicy
    -Map~K, V~ store
    +tryGet(K key) Optional~V~
    +put(K key, V value) Optional~Entry~K, V~~
    +removeKey(K key) void
  }
  class CacheStats {
    -Map~String, Long~ hitsByLevel
    -long misses
    +recordHit(String levelName) void
    +recordMiss() void
  }
  class MultiLevelCache~K, V~ {
    -List~CacheLevel~K, V~~ levels
    -CacheStats stats
    +get(K key) Optional~V~
    +put(K key, V value) void
    +getStats() CacheStats
  }
  class MultiLevelCacheBuilder~K, V~ {
    -List~CacheLevel~K, V~~ levels
    +addLevel(String, int, EvictionPolicy~K~) MultiLevelCacheBuilder~K, V~
    +build() MultiLevelCache~K, V~
  }
  class CacheConfigException {
    <<exception>>
  }

  EvictionPolicy <|.. LRUEvictionPolicy
  EvictionPolicy <|.. LFUEvictionPolicy
  LRUEvictionPolicy *-- Node : maintains
  CacheLevel o-- EvictionPolicy
  MultiLevelCache o-- CacheLevel
  MultiLevelCache o-- CacheStats
  MultiLevelCacheBuilder ..> MultiLevelCache : builds
  MultiLevelCacheBuilder o-- CacheLevel
  CacheLevel ..> CacheConfigException : throws`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'EvictionPolicy<K> + LRUEvictionPolicy / LFUEvictionPolicy', why: 'Each CacheLevel plugs in whichever eviction algorithm it wants (LRU at L1, LFU at L2, or a future ARC policy) without CacheLevel or MultiLevelCache ever branching on "which algorithm am I running".' },
    { pattern: 'Facade', where: 'MultiLevelCache', why: 'Callers see only get(key)/put(key, value). The cascade-on-miss, promote-on-hit, and demote-on-evict logic across N levels is entirely hidden behind those two methods.' },
    { pattern: 'Chain of Responsibility (in spirit)', where: 'CacheLevel.tryGet() walked in order by MultiLevelCache.get()', why: 'Each level either answers the request or reports a miss and lets the facade hand it to the next level - a level never needs a reference to any other level to make that decision.' },
    { pattern: 'Builder', where: 'MultiLevelCacheBuilder', why: 'The number of levels is open-ended and each needs a name, capacity, and policy - fluent addLevel() calls read like the physical hierarchy they describe, instead of a constructor juggling parallel arrays.' },
  ],

  dataStructures: [
    { component: 'LRU level internals', structure: 'HashMap<K, Node<K>> + a hand-rolled doubly linked list with sentinel head/tail nodes', why: 'HashMap gives O(1) node lookup by key; the linked list gives O(1) move-to-front on access and O(1) read-the-tail for the eviction candidate - no scan of the level is ever needed.' },
    { component: 'LFU level internals', structure: 'HashMap<K, Integer> frequency counts + TreeMap<Integer, LinkedHashSet<K>> frequency buckets', why: 'TreeMap.firstEntry() finds the lowest-frequency bucket in O(log n) worst case; the LinkedHashSet inside each bucket preserves insertion order so ties at the same frequency evict the oldest key first, deterministically.' },
    { component: 'Ordered levels inside the facade', structure: 'List<CacheLevel<K, V>> (plain ArrayList), index 0 = L1', why: 'Traversal is always a simple index loop from L1 outward - no need for anything fancier since the level count stays small and fixed after construction.' },
    { component: 'Per-level value storage', structure: 'A private HashMap<K, V> owned by each CacheLevel', why: "Values never leave the level they live at except through an explicit promote/demote call, so each level's O(1) get/put never has to coordinate with any other level's map." },
  ],

  walkthroughs: [
    {
      title: 'Cache Hit at L1 (fast path)',
      steps: [
        'Caller calls MultiLevelCache.get(key).',
        "The facade asks the first (fastest) level, L1, to tryGet(key) via its loop over the levels list.",
        "L1's internal HashMap already has the key, so it returns Optional.of(value) immediately.",
        "Before returning, L1 calls recordAccess(key) on its own EvictionPolicy - for LRU that moves the key's node to the front of the linked list; for LFU it would bump the frequency count.",
        'Because the hit happened at index 0, MultiLevelCache records the hit against L1 in CacheStats and does no promotion work - the value is already at the fastest tier.',
        'The value is returned straight to the caller with no lookups against any other level.',
      ],
    },
    {
      title: 'Cache Miss Cascade + Promotion (hit at a lower level)',
      steps: [
        'get(key) starts at L1; tryGet(key) returns Optional.empty(), so the facade advances to L2 (and would keep advancing to L3...Ln on repeated misses).',
        "L2.tryGet(key) finds the value, calls recordAccess(key) on its own LFU policy (bumping the key's frequency bucket), and returns Optional.of(value).",
        "Because the hit level's index is greater than 0, the facade calls L2.removeKey(key), fully clearing that key's value and its frequency bookkeeping out of L2.",
        'The facade then writes (key, value) into L1 through the exact same cascadePut() path a fresh put() would use.',
        "If L1 was already full, L1's own policy nominates a victim and that victim is demoted into L2 exactly the way a normal put's overflow would be - so promoting one key can push a completely different key down a level.",
        "The originally requested value is returned to the caller, and the very next get() for that key is now served by walkthrough one's L1 fast path.",
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'EvictionPolicy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This interface only ever mentions the key type K, never V - eviction bookkeeping is entirely about "which keys are cold", not about the values themselves. That is what lets one CacheLevel run LRU and another run LFU while sharing zero code with each other.',
      rationale: 'Three tiny methods keep every concrete policy trivially unit-testable in isolation, with no dependency on CacheLevel at all.',
      code: `public interface EvictionPolicy<K> {
    /** Called on every read or write of this key - update whatever recency/frequency bookkeeping this policy needs. */
    void recordAccess(K key);

    /** Peek (do not remove) the key this policy would evict next, or null if it is tracking nothing. */
    K evictionCandidate();

    /** Stop tracking this key entirely - called only after the caller has already removed its value from storage. */
    void remove(K key);
}`,
    },
    {
      filename: 'LRUEvictionPolicy.java',
      rationale:
        'Sentinel head/tail nodes mean every real node always has a non-null prev and next, so move-to-front and evict-from-tail never need special-case branches for "list has 0 or 1 nodes".',
      code: `import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class LRUEvictionPolicy<K> implements EvictionPolicy<K> {
    private final Node<K> head = new Node<>(null);
    private final Node<K> tail = new Node<>(null);
    private final Map<K, Node<K>> nodesByKey = new HashMap<>();

    public LRUEvictionPolicy() {
        head.next = tail;
        tail.prev = head;
    }

    @Override
    public void recordAccess(K key) {
        Node<K> node = nodesByKey.get(key);
        if (node == null) {
            node = new Node<>(key);
            nodesByKey.put(key, node);
        } else {
            unlink(node);
        }
        linkRightAfterHead(node);
    }

    @Override
    public K evictionCandidate() {
        Node<K> leastRecentlyUsed = tail.prev;
        return (leastRecentlyUsed == head) ? null : leastRecentlyUsed.key;
    }

    @Override
    public void remove(K key) {
        Node<K> node = nodesByKey.remove(key);
        if (node != null) {
            unlink(node);
        }
    }

    /** Debug/verification helper only - not part of the EvictionPolicy contract. Most-recently-used first. */
    public List<K> mostToLeastRecentlyUsed() {
        List<K> order = new ArrayList<>();
        for (Node<K> current = head.next; current != tail; current = current.next) {
            order.add(current.key);
        }
        return order;
    }

    private void unlink(Node<K> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void linkRightAfterHead(Node<K> node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    private static final class Node<K> {
        final K key;
        Node<K> prev;
        Node<K> next;

        Node(K key) {
            this.key = key;
        }
    }
}`,
    },
    {
      filename: 'LFUEvictionPolicy.java',
      rationale:
        "recordAccess() always removes the key from its old frequency bucket before adding it to the new one, so a key is never present in two buckets at once - evictionCandidate() can trust that the lowest key in keysByFrequency is genuinely tracked nowhere else.",
      code: `import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.TreeMap;

public final class LFUEvictionPolicy<K> implements EvictionPolicy<K> {
    private final Map<K, Integer> frequencyByKey = new HashMap<>();
    // frequency -> keys currently at that frequency, oldest-inserted-at-this-frequency first.
    private final TreeMap<Integer, LinkedHashSet<K>> keysByFrequency = new TreeMap<>();

    @Override
    public void recordAccess(K key) {
        Integer previousFrequency = frequencyByKey.get(key);
        int newFrequency = (previousFrequency == null) ? 1 : previousFrequency + 1;
        frequencyByKey.put(key, newFrequency);

        if (previousFrequency != null) {
            removeFromBucket(previousFrequency, key);
        }
        keysByFrequency.computeIfAbsent(newFrequency, freq -> new LinkedHashSet<>()).add(key);
    }

    @Override
    public K evictionCandidate() {
        Map.Entry<Integer, LinkedHashSet<K>> lowestFrequencyBucket = keysByFrequency.firstEntry();
        if (lowestFrequencyBucket == null) {
            return null;
        }
        // LinkedHashSet keeps insertion order, so the first element is the oldest key at this frequency - the tie-break rule.
        return lowestFrequencyBucket.getValue().iterator().next();
    }

    @Override
    public void remove(K key) {
        Integer frequency = frequencyByKey.remove(key);
        if (frequency != null) {
            removeFromBucket(frequency, key);
        }
    }

    private void removeFromBucket(int frequency, K key) {
        LinkedHashSet<K> bucket = keysByFrequency.get(frequency);
        if (bucket == null) {
            return;
        }
        bucket.remove(key);
        if (bucket.isEmpty()) {
            keysByFrequency.remove(frequency);
        }
    }
}`,
    },
    {
      filename: 'CacheConfigException.java',
      rationale: 'A dedicated unchecked exception so a bad capacity or an empty builder fails loudly at construction time instead of surfacing later as a confusing NullPointerException deep inside get()/put().',
      code: `public final class CacheConfigException extends RuntimeException {
    public CacheConfigException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'CacheLevel.java',
      calloutTitle: '💡 Chain of Responsibility (in spirit)',
      callout:
        "CacheLevel never imports MultiLevelCache and has no idea a 'next level' exists. tryGet() either answers the request or returns empty - precisely the Chain-of-Responsibility contract of 'handle it, or say you can't and let the caller decide what happens next'. The chain itself is just the for-loop in MultiLevelCache.get().",
      rationale: "put() returns Optional<Map.Entry<K, V>> instead of void so the facade can learn exactly what got evicted and demote it - a level's storage never just throws data away silently.",
      code: `import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public final class CacheLevel<K, V> {
    private final String name;
    private final int capacity;
    private final EvictionPolicy<K> evictionPolicy;
    private final Map<K, V> store = new HashMap<>();

    public CacheLevel(String name, int capacity, EvictionPolicy<K> evictionPolicy) {
        if (capacity <= 0) {
            throw new CacheConfigException("Level " + name + " needs a positive capacity, got " + capacity);
        }
        this.name = name;
        this.capacity = capacity;
        this.evictionPolicy = evictionPolicy;
    }

    /** Try to satisfy the read at this level only. A miss here just means "ask the next level" - this level never knows what "the next level" even is. */
    public Optional<V> tryGet(K key) {
        V value = store.get(key);
        if (value == null) {
            return Optional.empty();
        }
        evictionPolicy.recordAccess(key);
        return Optional.of(value);
    }

    /** Insert or overwrite key at this level. Returns the entry this level had to evict to make room, if any, so the caller can demote it down a level. */
    public Optional<Map.Entry<K, V>> put(K key, V value) {
        if (store.containsKey(key)) {
            store.put(key, value);
            evictionPolicy.recordAccess(key);
            return Optional.empty();
        }

        Map.Entry<K, V> evicted = (store.size() >= capacity) ? evictOne() : null;
        store.put(key, value);
        evictionPolicy.recordAccess(key);
        return Optional.ofNullable(evicted);
    }

    /** Fully remove a key from this level - used when a lower-level hit is being promoted away to L1. */
    public void removeKey(K key) {
        if (store.remove(key) != null) {
            evictionPolicy.remove(key);
        }
    }

    public String getName() {
        return name;
    }

    public int size() {
        return store.size();
    }

    private Map.Entry<K, V> evictOne() {
        K victimKey = evictionPolicy.evictionCandidate();
        if (victimKey == null) {
            return null;
        }
        V victimValue = store.remove(victimKey);
        evictionPolicy.remove(victimKey);
        return Map.entry(victimKey, victimValue);
    }
}`,
    },
    {
      filename: 'CacheStats.java',
      rationale: 'A LinkedHashMap keyed by level name gives insertion-ordered, human-readable reporting (L1 before L2) without maintaining a separate list of level names just for display.',
      code: `import java.util.LinkedHashMap;
import java.util.Map;

public final class CacheStats {
    private final Map<String, Long> hitsByLevel = new LinkedHashMap<>();
    private long misses = 0;

    public void recordHit(String levelName) {
        hitsByLevel.merge(levelName, 1L, Long::sum);
    }

    public void recordMiss() {
        misses++;
    }

    public long hitsAt(String levelName) {
        return hitsByLevel.getOrDefault(levelName, 0L);
    }

    public long getMisses() {
        return misses;
    }

    @Override
    public String toString() {
        return "CacheStats{hitsByLevel=" + hitsByLevel + ", misses=" + misses + "}";
    }
}`,
    },
    {
      filename: 'MultiLevelCache.java',
      calloutTitle: '💡 Facade Pattern',
      callout:
        "Callers only ever see get(key) and put(key, value). Every bit of multi-level traversal, promotion-on-hit, and cascading demotion-on-eviction lives inside this one class - swap LRU for LFU on L1, or add an L3, and not a single call site outside this file changes.",
      rationale: "cascadePut() is the one method that implements both 'write a brand-new key' and 'promote a key that was found lower down' - a fresh put and a promotion are the same operation once you already have the (key, value) pair in hand.",
      code: `import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class MultiLevelCache<K, V> {
    private final List<CacheLevel<K, V>> levels; // index 0 = L1 (fastest/smallest) ... last index = Ln (slowest/largest)
    private final CacheStats stats = new CacheStats();

    MultiLevelCache(List<CacheLevel<K, V>> levels) {
        this.levels = levels;
    }

    public Optional<V> get(K key) {
        for (int i = 0; i < levels.size(); i++) {
            Optional<V> found = levels.get(i).tryGet(key);
            if (found.isPresent()) {
                stats.recordHit(levels.get(i).getName());
                if (i > 0) {
                    promoteToFrontLevel(key, found.get(), i);
                }
                return found;
            }
        }
        stats.recordMiss();
        return Optional.empty();
    }

    public void put(K key, V value) {
        cascadePut(key, value, 0);
    }

    public CacheStats getStats() {
        return stats;
    }

    /** A hit at level i > 0 means the value should live at L1 from now on - remove it downstream, then write it in at the top. */
    private void promoteToFrontLevel(K key, V value, int foundAtLevelIndex) {
        levels.get(foundAtLevelIndex).removeKey(key);
        cascadePut(key, value, 0);
    }

    /** Insert (key, value) starting at levels.get(startIndex); whatever that level evicts to make room gets written into the next level down, and so on. */
    private void cascadePut(K key, V value, int startIndex) {
        K currentKey = key;
        V currentValue = value;
        for (int i = startIndex; i < levels.size(); i++) {
            Optional<Map.Entry<K, V>> evicted = levels.get(i).put(currentKey, currentValue);
            if (evicted.isEmpty()) {
                return;
            }
            currentKey = evicted.get().getKey();
            currentValue = evicted.get().getValue();
        }
        // Fell off the coldest level with nowhere left to demote to - that entry is simply gone from the cache.
    }
}`,
    },
    {
      filename: 'MultiLevelCacheBuilder.java',
      calloutTitle: '💡 Builder Pattern',
      callout:
        'The number of levels is open-ended and each one needs a name, a capacity, and its own EvictionPolicy - a constructor would need a List<Object[]> or three parallel arrays to express that. Fluent addLevel() calls read top-to-bottom exactly like the physical cache hierarchy they describe.',
      rationale: "Package-private MultiLevelCache constructor forces every caller through this builder, so 'build a cache with zero levels' is caught here rather than deep inside get().",
      code: `import java.util.ArrayList;
import java.util.List;

public final class MultiLevelCacheBuilder<K, V> {
    private final List<CacheLevel<K, V>> levels = new ArrayList<>();

    /** Levels are wired in the order they're added - the first addLevel() call becomes L1. */
    public MultiLevelCacheBuilder<K, V> addLevel(String name, int capacity, EvictionPolicy<K> evictionPolicy) {
        levels.add(new CacheLevel<>(name, capacity, evictionPolicy));
        return this;
    }

    public MultiLevelCache<K, V> build() {
        if (levels.isEmpty()) {
            throw new CacheConfigException("MultiLevelCache needs at least one level - call addLevel() first");
        }
        return new MultiLevelCache<>(levels);
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        "Narrates each step in comments because the whole point of this design is state you can't see from get()/put() signatures alone - eviction, demotion, and promotion are only provable by walking through an actual sequence of calls and printing L1's LRU order at each step.",
      code: `public final class Demo {
    public static void main(String[] args) {
        LRUEvictionPolicy<String> l1Policy = new LRUEvictionPolicy<>();
        LFUEvictionPolicy<String> l2Policy = new LFUEvictionPolicy<>();

        MultiLevelCache<String, String> cache = new MultiLevelCacheBuilder<String, String>()
                .addLevel("L1", 2, l1Policy)
                .addLevel("L2", 4, l2Policy)
                .build();

        cache.put("user:1", "Alice");
        cache.put("user:2", "Bob");
        System.out.println("L1 after 2 puts (MRU first): " + l1Policy.mostToLeastRecentlyUsed());

        // L1's capacity is 2. This third put evicts user:1 (the LRU entry) out of L1 and demotes it straight into L2.
        cache.put("user:3", "Charlie");
        System.out.println("L1 after 3rd put (MRU first): " + l1Policy.mostToLeastRecentlyUsed());

        // user:1 now lives only in L2. get() walks L1 (miss) -> L2 (hit), then promotes user:1 back to L1,
        // which in turn evicts L1's current LRU entry (user:2) down into L2.
        System.out.println("get(user:1) = " + cache.get("user:1"));
        System.out.println("L1 after promoting user:1 (MRU first): " + l1Policy.mostToLeastRecentlyUsed());

        // A couple more writes to spread some frequency counts across L2's LFU policy.
        cache.put("user:4", "Dana");
        cache.put("user:5", "Eve");

        // user:2 is resident in L2 by now - reading it twice bumps its frequency and (on the first read) promotes it to L1.
        cache.get("user:2");
        cache.get("user:2");

        System.out.println("Final stats: " + cache.getStats());
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Cache Entry Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> Absent
  Absent --> ResidentAtL1: put() with room at L1, or a promotion writes it in
  ResidentAtL1 --> ResidentAtL1: get() hit (recordAccess refreshes L1's own policy)
  ResidentAtL1 --> DemotedToNextLevel: L1 over capacity, its policy names a victim
  DemotedToNextLevel --> DemotedToNextLevel: get() hit at this level, or evicted again and cascaded one level further down
  DemotedToNextLevel --> ResidentAtL1: get() hit here triggers promotion back to L1
  DemotedToNextLevel --> Absent: evicted off the coldest (last) level with nowhere left to go
  ResidentAtL1 --> Absent: evicted off L1 when L1 is also the last level`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - get() with Miss, Hit, and Promotion',
    mermaid: `sequenceDiagram
  autonumber
  participant Caller
  participant Cache as MultiLevelCache
  participant L1 as CacheLevel (L1)
  participant L2 as CacheLevel (L2)
  participant Pol1 as EvictionPolicy (L1)

  Caller->>Cache: get(key)
  Cache->>L1: tryGet(key)
  L1-->>Cache: Optional.empty() (miss)
  Cache->>L2: tryGet(key)
  L2->>L2: evictionPolicy.recordAccess(key)
  L2-->>Cache: Optional.of(value) (hit)
  Cache->>L2: removeKey(key)
  Cache->>L1: put(key, value)
  alt L1 was at capacity
    L1->>Pol1: evictionCandidate()
    Pol1-->>L1: demotedKey
    L1-->>Cache: Optional.of(demotedKey, demotedValue)
    Cache->>L2: put(demotedKey, demotedValue)
  else L1 had room
    L1-->>Cache: Optional.empty()
  end
  Cache-->>Caller: value`,
  },

  extensions: [
    { extension: 'A new eviction algorithm (ARC, FIFO, 2Q)', implementation: 'Implement EvictionPolicy<K> and pass it to addLevel() - CacheLevel and MultiLevelCache need zero changes.' },
    { extension: 'A third (or fourth) level, e.g. a disk- or Redis-backed L3', implementation: 'Call addLevel() one more time on the builder; get()/put()\'s cascade loops are already level-count-agnostic.' },
    { extension: 'Per-entry TTL expiry', implementation: 'Wrap each stored value in a small ExpiringValue<V> holder carrying an expiresAt timestamp, checked (and treated as a miss plus a proactive removeKey) inside CacheLevel.tryGet().' },
    { extension: 'Inclusive caching (write to every level at once)', implementation: "Change cascadePut() to fan the write out to all levels instead of stopping the first time a level absorbs it without an eviction - exclusive vs. inclusive residency becomes a one-method decision." },
    { extension: 'Thread-safe concurrent access', implementation: 'Swap each CacheLevel\'s HashMap for a ConcurrentHashMap and wrap the check-capacity-then-evict-then-insert sequence in put() with a per-level lock, since that sequence must be atomic.' },
    { extension: 'Size-aware capacity instead of entry-count capacity', implementation: 'Track cumulative byte size per level alongside entry count, and have evictOne() run in a loop ("keep evicting while over the byte budget") instead of evicting exactly one entry.' },
  ],

  interviewerChecklist: [
    'Does eviction-candidate lookup use a real structure (linked list for LRU, TreeMap of buckets for LFU) instead of hand-waving "just use LinkedHashMap.removeEldestEntry()"?',
    'Does a hit at level N actually mutate state to promote the key into L1, or is promotion only described in prose?',
    "When L1 evicts to make room, is the evicted entry written into L2 (demotion), or does the candidate let it vanish?",
    'Can a new eviction policy be dropped in without editing CacheLevel or MultiLevelCache (Strategy / Open-Closed)?',
    "Does get()/put() complexity stay independent of total cache size as levels are added, or does the candidate loop over every key somewhere?",
    'Are ties within the same LFU frequency broken deterministically (oldest first), not left to HashMap iteration order?',
    "Is the facade's public surface limited to get()/put() (plus maybe stats), or does it leak CacheLevel internals to callers?",
  ],

  relatedDesigns: ['lru-cache', 'rate-limiter', 'key-value-store'],
  keyTakeaways: [
    "Strategy makes the eviction algorithm a pluggable detail of a single level, not a property of the whole cache - L1 can run LRU while L2 runs LFU without either policy knowing the other exists.",
    'A Facade over get()/put() is what makes "add another level" or "change the promotion rule" a one-file change instead of a refactor across every call site.',
    'Real O(1)/O(log n) eviction needs the actual data structure - a hand-rolled doubly linked list for LRU, a TreeMap of frequency buckets for LFU - not a library shortcut that hides the mechanics interviewers are testing for.',
    'Promotion and demotion are the same underlying operation (write into a level, possibly get back an evicted entry to push further down) - reusing one cascadePut() for both keeps the facade small.',
    'Exclusive residency (a key lives at exactly one level at a time) is a deliberate, nameable design choice, not the only way to build a multilevel cache - say so out loud in the interview.',
  ],
}

export default problem

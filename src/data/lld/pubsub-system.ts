import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'pubsub-system',
  title: 'Pub/Sub System (Mini-Kafka)',
  difficulty: 'Advanced',
  icon: 'pi pi-sitemap',
  color: '#d946ef',
  readTimeMinutes: 22,
  patterns: ['Strategy', 'Observer', 'Iterator'],
  companies: ['Apache Kafka', 'Confluent', 'Amazon Kinesis', 'LinkedIn', 'Segment'],
  summary:
    'A simplified Kafka-style broker that splits every topic into a fixed set of strictly-ordered, append-only partitions, lets a pluggable partitioning strategy decide where a keyed or keyless message lands, and lets any number of independent consumer groups each walk the entire topic at their own pace - while guaranteeing that inside any single group, exactly one consumer owns a given partition at a time. Committing an offset is a deliberate step kept separate from polling, which is exactly what makes the delivery guarantee at-least-once rather than exactly-once.',

  functionalRequirements: [
    'Support multiple named Topics, each split into a fixed number of partitions at creation time; each partition is an independent, strictly-ordered, append-only log addressed by a monotonically increasing offset (0, 1, 2, ...).',
    'Producers publish a (key, value) pair to a topic; a pluggable partitioning strategy decides which partition the message lands in - hashing the key sends every message for that key to the same partition (guaranteeing per-key order), while a missing key spreads load round-robin across all partitions.',
    'Consumers belong to a named consumer group and subscribe to a topic; the broker assigns each partition of that topic to exactly one consumer within the group, so the group collectively covers the whole topic with no partition ever double-owned inside the same group.',
    'Multiple independent consumer groups can each consume the same topic from their own progress - one group being slow, replaying, or crashed must never block or affect another group.',
    'A consumer poll()s the next batch of messages starting after its own fetch position, processes them, and then explicitly commit()s progress; polling alone never advances the durable checkpoint.',
    'If a consumer crashes (or is simply killed) after processing a batch but before committing, that exact batch must be redelivered the next time that partition is consumed - this is the explicit at-least-once contract, not an accidental bug.',
    'Support a rebalance step when a consumer joins or leaves a group, redistributing partitions among the remaining members using a deterministic assignment algorithm.',
  ],
  nonFunctionalRequirements: [
    'Appending to a single partition must be race-free and strictly ordered under concurrent producers: two producer threads publishing to the same partition at the same instant must be assigned distinct, gapless, increasing offsets, with no lost or duplicated slot.',
    'Reads must never require scanning the log from the beginning: fetching from a given offset is an O(1) index lookup, and every consumer\'s read position is independent of every other consumer\'s.',
    'Within one consumer group, "exactly one consumer per partition" must hold by construction, not by convention - the assignment data structure itself must make it impossible to represent two owners for the same partition.',
    'Delivery semantics are exactly at-least-once, called out explicitly rather than glossed over: no message is ever silently dropped, but a message may be delivered more than once, and consumers are expected to process idempotently downstream.',
    'Adding a new partitioning strategy or a new partition-assignment strategy must not require touching Partition, Consumer, or the offset-commit code path (open/closed).',
    'The partition-assignment data structure must be designed so that a future join/leave-triggered rebalance only swaps in a smarter PartitionAssignor, not a restructuring of how a ConsumerGroup stores its ownership map.',
  ],

  coreEntities: [
    { name: 'Message', description: 'An immutable record on a partition\'s log - topic, partitionId, offset, key, value, timestamp. Once appended, a Message never changes or moves.' },
    { name: 'TopicPartition', description: 'Composite key (topic name + partition id) used everywhere a specific log is addressed - offset commits, cursors, and observer registration all key on this pair, never on the topic alone.' },
    { name: 'Partition', description: 'One strictly-ordered, append-only log. Owns the single concurrency-critical operation in the whole system: assigning the next offset and appending the message must happen as one atomic step.' },
    { name: 'Topic', description: 'A fixed-size collection of Partitions created together at topic-creation time - just a routing table from partition id to Partition, nothing more.' },
    { name: 'PartitioningStrategy', description: 'Interface for "which partition does this message land in" - KeyHashPartitioningStrategy and RoundRobinPartitioningStrategy are the two interchangeable policies a Producer can plug in.' },
    { name: 'Producer', description: 'Publishes (key, value) pairs to a topic via the broker, delegating the partition decision entirely to its configured PartitioningStrategy.' },
    { name: 'PartitionCursor', description: 'A consumer\'s private, mutable walk over one assigned Partition - tracks an in-memory fetch position that advances on every poll, completely independent of the durable committed offset.' },
    { name: 'Consumer', description: 'One member of a consumer group - holds a PartitionCursor per assigned partition, exposes poll() (advances fetch position, not durable) and commitSync() (the only thing that is durable).' },
    { name: 'ConsumerGroup', description: 'Tracks group membership and the partition-ownership map (TopicPartition -> consumerId) that enforces "exactly one owner per partition" by construction; recomputes that map via a PartitionAssignor on every join/leave.' },
    { name: 'PartitionAssignor', description: 'Interface for "how to split N partitions across M group members" - RoundRobinPartitionAssignor is the one implementation here, deliberately swappable for a smarter/stickier one later.' },
    { name: 'OffsetManager', description: 'The single source of truth for durable progress - a (groupId, TopicPartition) -> committed offset table. This is the only state that survives a consumer crash.' },
    { name: 'PartitionAppendObserver', description: 'Interface fired by a Partition immediately after every successful append - lets a blocked Consumer.poll() wake up the instant new data lands instead of sleeping through its whole timeout.' },
    { name: 'Broker', description: 'The aggregate root - owns every Topic, every ConsumerGroup, and the OffsetManager; the only object Producers and Consumers ever talk to directly.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Message {
    -String topic
    -int partitionId
    -long offset
    -String key
    -String value
    -long timestampMs
  }
  class TopicPartition {
    -String topic
    -int partitionId
    +equals(Object) boolean
    +hashCode() int
  }
  class PartitionAppendObserver {
    <<interface>>
    +onAppend(TopicPartition, long) void
  }
  class Partition {
    -TopicPartition id
    -List~Message~ log
    -CopyOnWriteArrayList~PartitionAppendObserver~ observers
    +append(String, String) Message
    +readFrom(long, int) List~Message~
    +highWaterMark() long
    +registerObserver(PartitionAppendObserver) void
    +removeObserver(PartitionAppendObserver) void
  }
  class Topic {
    -String name
    -List~Partition~ partitions
    +getPartition(int) Partition
    +numPartitions() int
  }
  class PartitioningStrategy {
    <<interface>>
    +choosePartition(String, int) int
  }
  class KeyHashPartitioningStrategy {
    +choosePartition(String, int) int
  }
  class RoundRobinPartitioningStrategy {
    -AtomicInteger cursor
    +choosePartition(String, int) int
  }
  class Producer {
    -Broker broker
    -PartitioningStrategy partitioningStrategy
    +publish(String, String, String) Message
  }
  class PartitionCursor {
    -TopicPartition topicPartition
    -Partition partition
    -long position
    +hasNext() boolean
    +fetch(int) List~Message~
    +position() long
    +seek(long) void
  }
  class Consumer {
    -String consumerId
    -String groupId
    -Map~TopicPartition, PartitionCursor~ assignedCursors
    +poll(long) List~Message~
    +commitSync() void
    +onAppend(TopicPartition, long) void
  }
  class ConsumerGroup {
    -String groupId
    -Set~String~ memberIds
    -Map~String, List~TopicPartition~~ assignment
    -PartitionAssignor assignor
    +addMember(String, List~TopicPartition~) Map~String, List~TopicPartition~~
    +removeMember(String, List~TopicPartition~) Map~String, List~TopicPartition~~
    +assignedTo(String) List~TopicPartition~
  }
  class PartitionAssignor {
    <<interface>>
    +assign(List~TopicPartition~, List~String~) Map~String, List~TopicPartition~~
  }
  class RoundRobinPartitionAssignor {
    +assign(List~TopicPartition~, List~String~) Map~String, List~TopicPartition~~
  }
  class OffsetManager {
    -Map~String, Map~TopicPartition, AtomicLong~~ committedOffsets
    +commit(String, TopicPartition, long) void
    +committedOffset(String, TopicPartition) long
  }
  class UnknownTopicException
  class Broker {
    -Map~String, Topic~ topics
    -Map~String, ConsumerGroup~ groups
    -OffsetManager offsetManager
    -PartitionAssignor assignor
    +createTopic(String, int) Topic
    +publish(String, String, String, PartitioningStrategy) Message
    +joinGroup(String, String, String) Consumer
    +leaveGroup(String, String, String) void
    +commitOffset(String, TopicPartition, long) void
    +readPartition(String, int, long, int) List~Message~
  }

  PartitionAppendObserver <|.. Consumer
  Partition o-- Message
  Partition o-- PartitionAppendObserver
  Topic o-- Partition
  PartitioningStrategy <|.. KeyHashPartitioningStrategy
  PartitioningStrategy <|.. RoundRobinPartitioningStrategy
  Producer o-- PartitioningStrategy
  Producer ..> Broker
  PartitionAssignor <|.. RoundRobinPartitionAssignor
  ConsumerGroup o-- PartitionAssignor
  Consumer o-- PartitionCursor
  PartitionCursor o-- Partition
  Broker o-- Topic
  Broker o-- ConsumerGroup
  Broker o-- OffsetManager
  Broker ..> Consumer : creates
  Broker ..> UnknownTopicException : throws`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'PartitioningStrategy + KeyHashPartitioningStrategy / RoundRobinPartitioningStrategy', why: 'Which partition a message lands in is a swappable policy - key-hash buys per-key ordering, round-robin buys even load with no ordering promise - and Producer.publish() never branches on which one is active; it just calls choosePartition().' },
    { pattern: 'Observer', where: 'PartitionAppendObserver, implemented by Consumer inside poll()', why: 'Partition.append() has zero knowledge that anything is waiting on it - it just notifies whoever registered. Consumer uses this to wake a blocked poll() the instant a message lands on any assigned partition, instead of busy-sleeping through the full timeout on every partition it owns.' },
    { pattern: 'Iterator', where: 'PartitionCursor, one per (consumer, assigned partition)', why: 'Each consumer needs its own independent walk over a shared, append-only log without mutating the log itself. Encapsulating "next offset to fetch" behind hasNext()/fetch() keeps the in-memory fetch-position bookkeeping - which is exactly what drives redelivery semantics - out of both Partition and Consumer.' },
  ],

  dataStructures: [
    { component: 'Partition log', structure: 'plain ArrayList<Message>, mutated only inside a single synchronized(log) block', why: 'The offset assigned to a new message is simply the log\'s current size at the moment it is appended - computing that size and adding the element must be one indivisible step, or two racing producer threads could read the same size and hand out the same offset twice.' },
    { component: 'Committed offsets', structure: 'ConcurrentHashMap<groupId, ConcurrentHashMap<TopicPartition, AtomicLong>>, updated via updateAndGet(Math::max)', why: 'Nested concurrent maps give lock-free-ish O(1) commit/read per group without a global lock across unrelated groups or partitions; taking the max instead of a plain set makes a duplicate or out-of-order retry of the same commit() call safe - it can never move the checkpoint backwards.' },
    { component: 'Partition ownership within a group', structure: 'Map<String consumerId, List<TopicPartition>>, rebuilt wholesale by the PartitionAssignor on every join/leave', why: 'Because the map is rebuilt from scratch rather than patched incrementally, "exactly one owner per partition" holds automatically - there is no code path that could leave two entries pointing at the same TopicPartition.' },
    { component: 'Append notification', structure: 'CopyOnWriteArrayList<PartitionAppendObserver> per partition', why: 'Registrations/removals (a consumer starting or finishing a blocking poll) are rare compared to appends and notifications, so CopyOnWriteArrayList optimizes for a cheap, lock-free iteration on the hot notify-after-append path instead of contending with producers over a lock.' },
    { component: 'Round-robin cursor for keyless messages', structure: 'a single AtomicInteger per RoundRobinPartitioningStrategy instance, advanced with getAndIncrement()', why: 'Multiple producer threads sharing one strategy instance need a coordination-free way to keep spreading load evenly - getAndIncrement() gives that without a lock, at the cost of only a probabilistic (not exact) round-robin under heavy contention.' },
  ],

  walkthroughs: [
    {
      title: 'Producer Publish - Partition Selection - Atomic Append',
      steps: [
        'A Producer configured with KeyHashPartitioningStrategy calls publish("orders", "user-42", "order-created"); it delegates entirely to Broker.publish(), passing its strategy along.',
        'Broker looks up the "orders" Topic (throwing UnknownTopicException if it does not exist) and calls strategy.choosePartition("user-42", topic.numPartitions()) - the strategy hashes the key and mods by partition count, so every message for "user-42" will always resolve to the same partition, say partition 2.',
        'Broker forwards to Partition[2].append("user-42", "order-created"). Inside a single synchronized(log) block, the partition reads its own current size (say 40) as the new offset, constructs the Message, and adds it to the log - offset assignment and the actual write happen as one atomic unit, so a second producer thread racing to append to the same partition at the same instant cannot observe the same size and be handed the same offset.',
        'Once outside the lock, the partition iterates its registered PartitionAppendObservers and fires onAppend(partition, newHighWaterMark=41) - this is what lets any consumer currently blocked in poll() on partition 2 wake up immediately instead of waiting out its timeout.',
        'The appended Message (offset 40) is returned all the way back up to the caller, who now has a durable, ordered receipt: this message is permanently the 41st message ever written to partition 2, and it will never move or be renumbered.',
        'A second call with a different key, "user-7", hashes to a different partition entirely - its ordering guarantee is independent of "user-42"\'s: within a key, order is guaranteed; across keys, no ordering is promised or needed.',
      ],
    },
    {
      title: 'Consumer Poll - Process - Commit, and What a Crash Does',
      steps: [
        'Consumer "payments-1" in group "payments-service" already has a PartitionCursor over partition 2, seeded when it joined the group at position 40 (the last value OffsetManager had committed for this group+partition).',
        'poll(timeoutMs) calls cursor.hasNext() (position 40 < highWaterMark 45 - true), then cursor.fetch(100), which calls partition.readFrom(40, 100): an O(1) index read into the log returning messages at offsets 40-44, and immediately advances the cursor\'s in-memory position to 45.',
        'The five messages are handed back to the consumer\'s application code, which starts processing them (e.g. charging payment methods) - crucially, the cursor\'s position field is already at 45, in memory, before a single message has actually finished processing.',
        'The consumer process crashes midway through processing message 43. Because commitSync() was never called, OffsetManager\'s committed offset for (payments-service, partition 2) is still 40 - the in-memory jump to 45 died with the crashed process and left no trace anywhere durable.',
        'The consumer group notices the member is gone (or the same consumerId simply restarts) and rebalances; a fresh Consumer is created for "payments-1" and Broker seeds its new PartitionCursor from OffsetManager.committedOffset("payments-service", partition2), which returns 40 - not 45.',
        'The very next poll() therefore re-reads messages 40-44 from the log and hands them to the application again - messages 40, 41, and 42 (already fully processed and, say, already charged once) are delivered a second time. This is at-least-once delivery working exactly as designed, not a bug: nothing was lost, but something was duplicated.',
        'Only after processing succeeds and commitSync() actually runs does OffsetManager advance to 45 - closing the gap for good, until the next batch reopens it. Any consumer relying on this system must therefore make its processing idempotent (e.g. dedupe on a payment intent id) rather than assume poll-once-process-once.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Message.java',
      rationale: 'A plain immutable value object - once a message is appended to a partition, nothing about it (including its offset) is ever allowed to change.',
      code: `public final class Message {
    private final String topic;
    private final int partitionId;
    private final long offset;
    private final String key;
    private final String value;
    private final long timestampMs;

    public Message(String topic, int partitionId, long offset, String key, String value, long timestampMs) {
        this.topic = topic;
        this.partitionId = partitionId;
        this.offset = offset;
        this.key = key;
        this.value = value;
        this.timestampMs = timestampMs;
    }

    public String getTopic() { return topic; }
    public int getPartitionId() { return partitionId; }
    public long getOffset() { return offset; }
    public String getKey() { return key; }
    public String getValue() { return value; }
    public long getTimestampMs() { return timestampMs; }

    @Override
    public String toString() {
        return topic + "-" + partitionId + "@" + offset + " [" + key + "=" + value + "]";
    }
}`,
    },
    {
      filename: 'TopicPartition.java',
      rationale: 'The true unit of addressing in this system is not "the topic" but "this exact partition of this exact topic" - every map that tracks ownership, cursors, or committed offsets keys on this composite, never on the topic name alone.',
      code: `import java.util.Objects;

public final class TopicPartition {
    private final String topic;
    private final int partitionId;

    public TopicPartition(String topic, int partitionId) {
        this.topic = topic;
        this.partitionId = partitionId;
    }

    public String getTopic() { return topic; }
    public int getPartitionId() { return partitionId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TopicPartition)) return false;
        TopicPartition other = (TopicPartition) o;
        return partitionId == other.partitionId && topic.equals(other.topic);
    }

    @Override
    public int hashCode() {
        return Objects.hash(topic, partitionId);
    }

    @Override
    public String toString() {
        return topic + "-" + partitionId;
    }
}`,
    },
    {
      filename: 'PartitionAppendObserver.java',
      rationale: 'Deliberately unaware of who implements it - a blocking Consumer.poll() is one subscriber, a lag-monitoring dashboard could be another, and Partition never has to know either exists.',
      code: `public interface PartitionAppendObserver {
    /** Fired after a message is durably appended. newHighWaterMark is one past the offset of the last written message. */
    void onAppend(TopicPartition partition, long newHighWaterMark);
}`,
    },
    {
      filename: 'Partition.java',
      calloutTitle: '💡 The one concurrency-critical operation in the whole system',
      callout:
        'append() assigns the new offset as "the log\'s current size" and adds the message inside a single synchronized(log) block. That is the entire correctness argument: if offset assignment and the write were two separate steps, two producer threads could both read size=40, both decide their message is offset 40, and both write - a silent, undetectable data-loss bug. Folding them into one atomic step is what makes "gapless, unique, increasing offsets under concurrent producers" true by construction instead of by luck.',
      rationale: 'readFrom() and highWaterMark() also synchronize on the same lock object as append() - using a different lock for reads than for writes would reintroduce exactly the race this class exists to prevent.',
      code: `import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class Partition {
    private final TopicPartition id;
    private final List<Message> log = new ArrayList<>();
    private final CopyOnWriteArrayList<PartitionAppendObserver> observers = new CopyOnWriteArrayList<>();

    public Partition(TopicPartition id) {
        this.id = id;
    }

    public TopicPartition getId() { return id; }

    public Message append(String key, String value) {
        Message message;
        long highWaterMark;
        synchronized (log) {
            long assignedOffset = log.size();
            message = new Message(id.getTopic(), id.getPartitionId(), assignedOffset, key, value, System.currentTimeMillis());
            log.add(message);
            highWaterMark = log.size();
        }
        // Notify outside the lock - observers must never be able to block the next append.
        for (PartitionAppendObserver observer : observers) {
            observer.onAppend(id, highWaterMark);
        }
        return message;
    }

    /** O(1) index read starting at fromOffset - never a scan from the beginning of the log. */
    public List<Message> readFrom(long fromOffset, int maxMessages) {
        synchronized (log) {
            if (fromOffset < 0 || fromOffset >= log.size()) {
                return Collections.emptyList();
            }
            int from = (int) fromOffset;
            int to = Math.min(log.size(), from + maxMessages);
            return new ArrayList<>(log.subList(from, to));
        }
    }

    public long highWaterMark() {
        synchronized (log) {
            return log.size();
        }
    }

    public void registerObserver(PartitionAppendObserver observer) {
        observers.add(observer);
    }

    public void removeObserver(PartitionAppendObserver observer) {
        observers.remove(observer);
    }
}`,
    },
    {
      filename: 'Topic.java',
      rationale: 'Just a fixed-size routing table from partition id to Partition, built once at topic-creation time - the partition count intentionally never changes afterwards, since changing it would break every existing key\'s hash-to-partition mapping.',
      code: `import java.util.ArrayList;
import java.util.List;

public final class Topic {
    private final String name;
    private final List<Partition> partitions;

    public Topic(String name, int numPartitions) {
        this.name = name;
        this.partitions = new ArrayList<>(numPartitions);
        for (int i = 0; i < numPartitions; i++) {
            partitions.add(new Partition(new TopicPartition(name, i)));
        }
    }

    public String getName() { return name; }
    public int numPartitions() { return partitions.size(); }
    public Partition getPartition(int partitionId) { return partitions.get(partitionId); }
    public List<Partition> getPartitions() { return partitions; }
}`,
    },
    {
      filename: 'PartitioningStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This one interface is the entire difference between "every event for the same key lands in the same partition, strictly ordered" and "spread evenly, no ordering promise". Producer and Broker never inspect which implementation is wired in - they just call choosePartition(). Swapping the policy for a whole class of messages is a one-line change at Producer construction time, not a fork in append().',
      rationale: 'Kept to a single method taking only a key and a partition count, so implementations never need direct access to a Partition, a Topic, or any locking concern.',
      code: `public interface PartitioningStrategy {
    /** Returns which partition (0..numPartitions-1) a message with this key should land in. A null key means "no ordering requirement". */
    int choosePartition(String key, int numPartitions);
}`,
    },
    {
      filename: 'KeyHashPartitioningStrategy.java',
      rationale: 'Requires a non-null key on purpose rather than silently falling back to something else - mixing "guaranteed per-key order" and "unordered fallback" inside one class is exactly the kind of surprising behavior a Strategy split is meant to avoid. Callers that sometimes have no key should compose with RoundRobinPartitioningStrategy explicitly instead.',
      code: `public final class KeyHashPartitioningStrategy implements PartitioningStrategy {
    @Override
    public int choosePartition(String key, int numPartitions) {
        if (key == null) {
            throw new IllegalArgumentException(
                    "KeyHashPartitioningStrategy requires a non-null key - use RoundRobinPartitioningStrategy for keyless messages");
        }
        int hash = key.hashCode();
        int mod = hash % numPartitions;
        return mod < 0 ? mod + numPartitions : mod; // String.hashCode() can be negative; partition ids never are.
    }
}`,
    },
    {
      filename: 'RoundRobinPartitioningStrategy.java',
      rationale: 'Ignores the key entirely by design - this strategy is for the case where the caller has explicitly decided ordering does not matter and wants load spread as evenly as possible instead.',
      code: `import java.util.concurrent.atomic.AtomicInteger;

public final class RoundRobinPartitioningStrategy implements PartitioningStrategy {
    private final AtomicInteger cursor = new AtomicInteger(0);

    @Override
    public int choosePartition(String key, int numPartitions) {
        int next = cursor.getAndIncrement();
        int mod = next % numPartitions;
        return mod < 0 ? mod + numPartitions : mod; // guards the rare case where the counter has wrapped past Integer.MAX_VALUE
    }
}`,
    },
    {
      filename: 'Producer.java',
      rationale: 'Intentionally thin - all it owns is a reference to the broker and its chosen strategy. Any retry/backoff/batching policy would wrap this class rather than live inside it.',
      code: `public final class Producer {
    private final Broker broker;
    private final PartitioningStrategy partitioningStrategy;

    public Producer(Broker broker, PartitioningStrategy partitioningStrategy) {
        this.broker = broker;
        this.partitioningStrategy = partitioningStrategy;
    }

    public Message publish(String topic, String key, String value) {
        return broker.publish(topic, key, value, partitioningStrategy);
    }
}`,
    },
    {
      filename: 'PartitionCursor.java',
      calloutTitle: '💡 Iterator Pattern - and the exact mechanics of at-least-once',
      callout:
        'position() is the boundary this whole design pivots on. fetch() advances position the moment messages are handed to the consumer - before a single one has been processed, and long before anything durable has happened. Because position lives only on this in-memory object, a crash between fetch() and the eventual commitSync() erases it completely; the next PartitionCursor for this (group, partition) gets re-seeded from OffsetManager, which only ever advances on commitSync(). That gap between "fetched" and "committed" is not a bug to be fixed - it is the entire mechanism by which this system is at-least-once instead of at-most-once (drop on crash) or exactly-once (which would require fetch and commit to be one atomic transaction, which this design deliberately does not attempt).',
      rationale: 'One cursor per (consumer, assigned partition) - each consumer gets its own private walk over a log it never mutates, so two consumers in different groups reading the same partition never interfere with each other\'s position.',
      code: `import java.util.List;

public final class PartitionCursor {
    private final TopicPartition topicPartition;
    private final Partition partition;
    private long position;

    public PartitionCursor(TopicPartition topicPartition, Partition partition, long startPosition) {
        this.topicPartition = topicPartition;
        this.partition = partition;
        this.position = startPosition;
    }

    public TopicPartition getTopicPartition() { return topicPartition; }

    public boolean hasNext() {
        return position < partition.highWaterMark();
    }

    /** Advances the in-memory fetch position immediately - this is NOT a durable commit. */
    public List<Message> fetch(int maxMessages) {
        List<Message> batch = partition.readFrom(position, maxMessages);
        position += batch.size();
        return batch;
    }

    public long position() { return position; }

    /** Rewinds/fast-forwards - used when a consumer (re)joins and must resume from its last durably committed offset. */
    public void seek(long offset) { this.position = offset; }
}`,
    },
    {
      filename: 'PartitionAssignor.java',
      rationale: 'Kept separate from ConsumerGroup so a future StickyPartitionAssignor (minimizing partition movement across rebalances) or RangeAssignor can be dropped in without touching membership tracking at all.',
      code: `import java.util.List;
import java.util.Map;

public interface PartitionAssignor {
    /** Deterministically splits partitions across the given consumer ids - identical inputs must always produce the identical assignment. */
    Map<String, List<TopicPartition>> assign(List<TopicPartition> partitions, List<String> consumerIds);
}`,
    },
    {
      filename: 'RoundRobinPartitionAssignor.java',
      rationale: 'Sorts both partitions and consumer ids before assigning so the algorithm is deterministic - the same membership always yields the same ownership map, which matters for reasoning about and testing rebalances.',
      code: `import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class RoundRobinPartitionAssignor implements PartitionAssignor {
    @Override
    public Map<String, List<TopicPartition>> assign(List<TopicPartition> partitions, List<String> consumerIds) {
        Map<String, List<TopicPartition>> assignment = new LinkedHashMap<>();
        if (consumerIds.isEmpty()) {
            return assignment;
        }
        List<String> sortedIds = new ArrayList<>(consumerIds);
        Collections.sort(sortedIds);
        for (String id : sortedIds) {
            assignment.put(id, new ArrayList<>());
        }
        List<TopicPartition> sortedPartitions = new ArrayList<>(partitions);
        sortedPartitions.sort(Comparator.comparing(TopicPartition::getTopic).thenComparingInt(TopicPartition::getPartitionId));
        for (int i = 0; i < sortedPartitions.size(); i++) {
            String owner = sortedIds.get(i % sortedIds.size());
            assignment.get(owner).add(sortedPartitions.get(i));
        }
        return assignment;
    }
}`,
    },
    {
      filename: 'OffsetManager.java',
      rationale: 'The only piece of state in this whole design that is treated as durable - everything else (cursors, in-flight batches) is explicitly allowed to vanish on a crash because this table is what gets consulted on the way back up.',
      code: `import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public final class OffsetManager {
    private final Map<String, Map<TopicPartition, AtomicLong>> committedOffsets = new ConcurrentHashMap<>();

    /** Persists progress for (groupId, partition). Takes the max so a stale or duplicate commit can never move the checkpoint backwards. */
    public void commit(String groupId, TopicPartition partition, long offset) {
        committedOffsets
                .computeIfAbsent(groupId, g -> new ConcurrentHashMap<>())
                .computeIfAbsent(partition, p -> new AtomicLong(0))
                .updateAndGet(current -> Math.max(current, offset));
    }

    /** The durable resume point for a consumer that just (re)joined - 0 if this group has never consumed this partition before. */
    public long committedOffset(String groupId, TopicPartition partition) {
        Map<TopicPartition, AtomicLong> byPartition = committedOffsets.get(groupId);
        if (byPartition == null) {
            return 0L;
        }
        AtomicLong offset = byPartition.get(partition);
        return offset == null ? 0L : offset.get();
    }
}`,
    },
    {
      filename: 'ConsumerGroup.java',
      rationale: 'Owns membership and the ownership map only - it delegates the actual splitting logic to a PartitionAssignor entirely, so this class never has to change when the assignment algorithm does.',
      code: `import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class ConsumerGroup {
    private final String groupId;
    private final PartitionAssignor assignor;
    private final Set<String> memberIds = ConcurrentHashMap.newKeySet();
    private volatile Map<String, List<TopicPartition>> assignment = Collections.emptyMap();

    public ConsumerGroup(String groupId, PartitionAssignor assignor) {
        this.groupId = groupId;
        this.assignor = assignor;
    }

    public String getGroupId() { return groupId; }

    public synchronized Map<String, List<TopicPartition>> addMember(String consumerId, List<TopicPartition> allPartitions) {
        memberIds.add(consumerId);
        return rebalance(allPartitions);
    }

    public synchronized Map<String, List<TopicPartition>> removeMember(String consumerId, List<TopicPartition> allPartitions) {
        memberIds.remove(consumerId);
        return rebalance(allPartitions);
    }

    private Map<String, List<TopicPartition>> rebalance(List<TopicPartition> allPartitions) {
        this.assignment = assignor.assign(allPartitions, new ArrayList<>(memberIds));
        return this.assignment;
    }

    public List<TopicPartition> assignedTo(String consumerId) {
        return assignment.getOrDefault(consumerId, Collections.emptyList());
    }

    public Set<String> getMemberIds() {
        return Collections.unmodifiableSet(memberIds);
    }
}`,
    },
    {
      filename: 'Consumer.java',
      calloutTitle: '💡 Observer Pattern - a wake-up, not a busy-loop',
      callout:
        'A naive poll() would just sleep for a fixed slice and re-check every assigned partition in a loop until the timeout expires, wasting latency on every call that had no data waiting. Instead, poll() registers itself as a PartitionAppendObserver on every assigned partition before blocking on a CountDownLatch, and any one of those partitions\' append() calls can release that latch via onAppend(). The moment new data lands on any assigned partition, poll() wakes up almost immediately; if nothing arrives, it still returns (possibly empty) once the timeout elapses - matching how a real Kafka consumer\'s poll(Duration) behaves.',
      rationale: 'assignCursors() is package-visible on purpose - only Broker (which owns rebalancing) is allowed to hand a Consumer a fresh set of cursors.',
      code: `import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public final class Consumer implements PartitionAppendObserver {
    private final String consumerId;
    private final String groupId;
    private final Broker broker;
    private final Map<TopicPartition, PartitionCursor> assignedCursors = new LinkedHashMap<>();
    private volatile CountDownLatch wakeSignal;

    public Consumer(String consumerId, String groupId, Broker broker) {
        this.consumerId = consumerId;
        this.groupId = groupId;
        this.broker = broker;
    }

    public String getConsumerId() { return consumerId; }

    void assignCursors(Map<TopicPartition, PartitionCursor> cursors) {
        this.assignedCursors.clear();
        this.assignedCursors.putAll(cursors);
    }

    /** Fired by whichever Partition just accepted a new message - wakes a blocked poll() instantly instead of sleeping through its timeout. */
    @Override
    public void onAppend(TopicPartition partition, long newHighWaterMark) {
        CountDownLatch latch = wakeSignal;
        if (latch != null && assignedCursors.containsKey(partition)) {
            latch.countDown();
        }
    }

    /** Advances each assigned cursor's in-memory fetch position. Never touches the durable committed offset. */
    public List<Message> poll(long timeoutMs) throws InterruptedException {
        List<Message> batch = fetchAvailable();
        if (!batch.isEmpty() || timeoutMs <= 0) {
            return batch;
        }
        CountDownLatch latch = new CountDownLatch(1);
        wakeSignal = latch;
        for (TopicPartition tp : assignedCursors.keySet()) {
            broker.registerAppendObserver(tp, this);
        }
        try {
            latch.await(timeoutMs, TimeUnit.MILLISECONDS);
            return fetchAvailable();
        } finally {
            wakeSignal = null;
            for (TopicPartition tp : assignedCursors.keySet()) {
                broker.removeAppendObserver(tp, this);
            }
        }
    }

    private List<Message> fetchAvailable() {
        List<Message> batch = new ArrayList<>();
        for (PartitionCursor cursor : assignedCursors.values()) {
            if (cursor.hasNext()) {
                batch.addAll(cursor.fetch(100));
            }
        }
        return batch;
    }

    /** The only durable checkpoint in the system: persists every assigned cursor's current fetch position via the broker. */
    public void commitSync() {
        for (PartitionCursor cursor : assignedCursors.values()) {
            broker.commitOffset(groupId, cursor.getTopicPartition(), cursor.position());
        }
    }
}`,
    },
    {
      filename: 'UnknownTopicException.java',
      rationale: 'An unchecked business exception - publishing to or subscribing to a topic that was never created is a caller error, not a recoverable condition the broker itself can do anything about.',
      code: `public final class UnknownTopicException extends RuntimeException {
    public UnknownTopicException(String topic) {
        super("Unknown topic: " + topic);
    }
}`,
    },
    {
      filename: 'Broker.java',
      rationale:
        'The aggregate root and the only object Producers and Consumers ever talk to. It deliberately knows nothing about hashing or round-robin (that is the strategy\'s job) and nothing about how partitions get split across a group (that is the assignor\'s job) - it only wires those pieces together. Note the documented simplification in joinGroup(): only the newly-joining consumer\'s cursors are freshly seeded here; a production system would also push updated cursors to every already-running member whose ownership changed (see Extensions).',
      code: `import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class Broker {
    private final Map<String, Topic> topics = new ConcurrentHashMap<>();
    private final Map<String, ConsumerGroup> groups = new ConcurrentHashMap<>();
    private final OffsetManager offsetManager = new OffsetManager();
    private final PartitionAssignor assignor = new RoundRobinPartitionAssignor();

    public Topic createTopic(String name, int numPartitions) {
        Topic topic = new Topic(name, numPartitions);
        topics.put(name, topic);
        return topic;
    }

    public Message publish(String topicName, String key, String value, PartitioningStrategy strategy) {
        Topic topic = requireTopic(topicName);
        int partitionId = strategy.choosePartition(key, topic.numPartitions());
        return topic.getPartition(partitionId).append(key, value);
    }

    /** A consumer joins a group and subscribes to a topic - triggers a rebalance and seeds cursors at each owned partition's last committed offset. */
    public synchronized Consumer joinGroup(String groupId, String consumerId, String topicName) {
        Topic topic = requireTopic(topicName);
        ConsumerGroup group = groups.computeIfAbsent(groupId, g -> new ConsumerGroup(g, assignor));
        List<TopicPartition> allPartitions = allPartitionIds(topic);
        Map<String, List<TopicPartition>> assignment = group.addMember(consumerId, allPartitions);
        Consumer consumer = new Consumer(consumerId, groupId, this);
        consumer.assignCursors(cursorsFor(groupId, topic, assignment.getOrDefault(consumerId, Collections.emptyList())));
        return consumer;
    }

    public synchronized void leaveGroup(String groupId, String topicName, String consumerId) {
        Topic topic = requireTopic(topicName);
        ConsumerGroup group = groups.get(groupId);
        if (group == null) {
            return;
        }
        group.removeMember(consumerId, allPartitionIds(topic));
    }

    public void commitOffset(String groupId, TopicPartition partition, long offset) {
        offsetManager.commit(groupId, partition, offset);
    }

    public long committedOffset(String groupId, TopicPartition partition) {
        return offsetManager.committedOffset(groupId, partition);
    }

    public void registerAppendObserver(TopicPartition tp, PartitionAppendObserver observer) {
        requireTopic(tp.getTopic()).getPartition(tp.getPartitionId()).registerObserver(observer);
    }

    public void removeAppendObserver(TopicPartition tp, PartitionAppendObserver observer) {
        requireTopic(tp.getTopic()).getPartition(tp.getPartitionId()).removeObserver(observer);
    }

    public List<Message> readPartition(String topicName, int partitionId, long fromOffset, int maxMessages) {
        return requireTopic(topicName).getPartition(partitionId).readFrom(fromOffset, maxMessages);
    }

    private List<TopicPartition> allPartitionIds(Topic topic) {
        List<TopicPartition> ids = new ArrayList<>();
        for (Partition p : topic.getPartitions()) {
            ids.add(p.getId());
        }
        return ids;
    }

    private Map<TopicPartition, PartitionCursor> cursorsFor(String groupId, Topic topic, List<TopicPartition> owned) {
        Map<TopicPartition, PartitionCursor> cursors = new LinkedHashMap<>();
        for (TopicPartition tp : owned) {
            long startPosition = offsetManager.committedOffset(groupId, tp);
            cursors.put(tp, new PartitionCursor(tp, topic.getPartition(tp.getPartitionId()), startPosition));
        }
        return cursors;
    }

    private Topic requireTopic(String name) {
        Topic topic = topics.get(name);
        if (topic == null) {
            throw new UnknownTopicException(name);
        }
        return topic;
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy path (keyed ordering plus two independent consumer groups reading the same topic from their own offsets), the central partition-assignment problem (a second consumer joining a group and the partitions splitting across both members), the crash-before-commit edge case that proves at-least-once redelivery, and - since race-free appends are a stated non-functional requirement - a concurrency stress test with many producer threads hammering a single partition, verifying every offset is unique and gapless afterwards.',
      code: `import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class Demo {
    public static void main(String[] args) throws Exception {
        Broker broker = new Broker();
        broker.createTopic("orders", 4);

        Producer keyedProducer = new Producer(broker, new KeyHashPartitioningStrategy());
        Producer keylessProducer = new Producer(broker, new RoundRobinPartitioningStrategy());

        // --- Happy path: same key always lands on the same partition, in order ---
        Message m1 = keyedProducer.publish("orders", "user-42", "order-created");
        Message m2 = keyedProducer.publish("orders", "user-42", "order-paid");
        Message m3 = keyedProducer.publish("orders", "user-7", "order-created");
        System.out.println("user-42's two events landed on partitions " + m1.getPartitionId() + " and " + m2.getPartitionId()
                + " (same key -> same partition, strictly ordered)");
        System.out.println("user-7 landed on a different partition: " + m3.getPartitionId());

        for (int i = 0; i < 6; i++) {
            keylessProducer.publish("orders", null, "keyless-event-" + i);
        }

        // --- Two independent consumer groups each read the whole topic from their own offsets ---
        Consumer billingConsumer = broker.joinGroup("billing-service", "billing-1", "orders");
        Consumer analyticsConsumer = broker.joinGroup("analytics-service", "analytics-1", "orders");
        List<Message> billingBatch = billingConsumer.poll(100);
        List<Message> analyticsBatch = analyticsConsumer.poll(100);
        System.out.println("billing-service saw " + billingBatch.size() + " messages, analytics-service saw "
                + analyticsBatch.size() + " - both starting from offset 0, completely independently");
        billingConsumer.commitSync();
        analyticsConsumer.commitSync();

        // --- The central problem: partition assignment within a single group ---
        broker.joinGroup("billing-service", "billing-2", "orders");
        System.out.println("billing-2 joined billing-service - the group's 4 partitions now split across 2 members "
                + "(each partition still owned by exactly one consumer)");

        // --- Edge case: crash after processing but before commitSync() -> at-least-once redelivery ---
        Consumer flakyConsumer = broker.joinGroup("payments-service", "payments-1", "orders");
        List<Message> firstPoll = flakyConsumer.poll(100);
        System.out.println("payments-service processed " + firstPoll.size() + " messages... then crashes before commitSync()");
        // flakyConsumer is simply discarded here, without ever calling commitSync() - simulating a crash mid-processing.

        Consumer replacementConsumer = broker.joinGroup("payments-service", "payments-1", "orders");
        List<Message> redelivered = replacementConsumer.poll(100);
        boolean sameFirstMessage = !firstPoll.isEmpty() && !redelivered.isEmpty()
                && firstPoll.get(0).getOffset() == redelivered.get(0).getOffset()
                && firstPoll.get(0).getPartitionId() == redelivered.get(0).getPartitionId();
        System.out.println("payments-service restarted and was redelivered " + redelivered.size() + " messages; "
                + "first redelivered message matches the first one originally polled: " + sameFirstMessage
                + " (at-least-once, not exactly-once)");
        replacementConsumer.commitSync(); // only now does the committed offset actually move forward

        // --- Concurrency stress test: many producer threads hammering a single partition ---
        Broker stressBroker = new Broker();
        stressBroker.createTopic("stress-topic", 1); // force every publish onto partition 0
        Producer stressProducer = new Producer(stressBroker, new RoundRobinPartitioningStrategy());
        int threadCount = 40;
        int messagesPerThread = 50;
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);
        CountDownLatch done = new CountDownLatch(threadCount);
        for (int t = 0; t < threadCount; t++) {
            final int threadId = t;
            pool.submit(() -> {
                try {
                    for (int i = 0; i < messagesPerThread; i++) {
                        stressProducer.publish("stress-topic", null, "thread-" + threadId + "-msg-" + i);
                    }
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();

        int expected = threadCount * messagesPerThread;
        List<Message> allMessages = stressBroker.readPartition("stress-topic", 0, 0, expected);
        Set<Long> offsets = new HashSet<>();
        boolean gaplessAndUnique = allMessages.size() == expected;
        for (Message m : allMessages) {
            gaplessAndUnique &= offsets.add(m.getOffset());
        }
        for (long expectedOffset = 0; expectedOffset < expected; expectedOffset++) {
            gaplessAndUnique &= offsets.contains(expectedOffset);
        }
        System.out.println("Stress test: " + allMessages.size() + "/" + expected + " messages appended by "
                + threadCount + " concurrent producer threads, offsets 0.." + (expected - 1)
                + " all unique and gapless: " + gaplessAndUnique);
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Consumer Group Membership & Partition Ownership',
    mermaid: `stateDiagram-v2
  [*] --> Joining: joinGroup()
  Joining --> Assigned: PartitionAssignor.assign() computes ownership
  Assigned --> Polling: poll()
  Polling --> Processing: batch returned, cursor position advanced (in-memory only)
  Processing --> Committed: commitSync() succeeds
  Committed --> Polling: next poll()
  Processing --> Crashed: consumer dies before commitSync()
  Crashed --> Rejoining: same consumerId restarts, or group detects departure
  Rejoining --> Assigned: cursor reseeded from OffsetManager's last committed offset
  Assigned --> [*]: leaveGroup()`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Poll, Crash Before Commit, Redelivery',
    mermaid: `sequenceDiagram
  autonumber
  participant App as Consumer App (payments-1)
  participant C as Consumer
  participant Cur as PartitionCursor
  participant P as Partition
  participant OM as OffsetManager

  App->>C: poll(timeoutMs)
  C->>Cur: hasNext() then fetch(maxMessages)
  Cur->>P: readFrom(position=40, maxMessages)
  P-->>Cur: messages[40..44]
  Cur->>Cur: position = 45 (in-memory only)
  Cur-->>C: messages[40..44]
  C-->>App: batch
  App->>App: process messages (e.g. charge payment methods)
  Note over App: process crashes here - commitSync() never runs
  Note over OM: committed offset for (payments-service, partition) still = 40
  App->>C: (restart) joinGroup() creates a fresh Consumer
  C->>OM: committedOffset(groupId, partition) = 40
  C->>Cur: new cursor seeded at position 40
  App->>C: poll(timeoutMs)
  C->>Cur: fetch(maxMessages)
  Cur->>P: readFrom(position=40, maxMessages)
  P-->>Cur: messages[40..44] again
  Cur-->>C: same batch, redelivered
  C-->>App: batch (duplicate of the earlier one)
  App->>App: process again - must be idempotent
  App->>C: commitSync()
  C->>OM: commit(groupId, partition, 45)`,
  },

  extensions: [
    { extension: 'Exactly-once semantics', implementation: 'Make offset commits and side effects transactional (mirroring Kafka\'s idempotent producer + transactional consumer): tag each batch with a producer/consumer epoch and commit the processing result and the offset advance as a single atomic transaction, instead of two independent steps.' },
    { extension: 'Push rebalances to already-running consumers', implementation: 'Today only the newly-joining Consumer in Broker.joinGroup() gets fresh cursors. A real implementation would have ConsumerGroup notify every affected member (via the same Observer-style callback used for append notifications) so a consumer that just lost a partition stops polling it, and one that gained a partition seeds a cursor for it immediately.' },
    { extension: 'Sticky / incremental rebalancing', implementation: 'Swap RoundRobinPartitionAssignor for a StickyPartitionAssignor that only moves the minimum number of partitions needed on a membership change, instead of recomputing the whole assignment from scratch every time - all behind the same PartitionAssignor interface.' },
    { extension: 'Replication for durability', implementation: 'Give each Partition a leader and N follower replicas that mirror the log; append() only returns success once a quorum of replicas has the message, so a single broker crash cannot lose committed data.' },
    { extension: 'Consumer lag monitoring', implementation: 'Add a LagMonitorObserver that implements PartitionAppendObserver purely to track (highWaterMark - committedOffset) per group/partition and expose it on a dashboard - reusing the exact same extension point Consumer uses for wake-ups, without touching Partition at all.' },
    { extension: 'Dead-letter topic', implementation: 'Wrap Consumer.poll()/processing in a retry-count tracker; after N failed processing attempts for the same offset, publish that message to a "topic-DLQ" topic via a Producer and commit past it, so one poisoned message cannot stall a partition forever.' },
  ],

  interviewerChecklist: [
    'Is offset assignment and the actual log write one atomic operation, or did the candidate compute "next offset" and append() as two separate steps that could race under concurrent producers?',
    'Does the candidate explicitly say the system is at-least-once and explain why - the gap between an in-memory fetch position and a durably committed offset - rather than hand-waving "no data is lost" and stopping there?',
    'Is "exactly one consumer per partition per group" enforced by the data structure itself (a rebuilt ownership map) rather than by a convention that a buggy client could violate?',
    'Does the candidate distinguish poll() (advances an in-memory position) from commit() (advances the durable checkpoint), and can they say what happens to each on a crash between the two?',
    'Is partitioning (which partition does a message go to) kept as a separate, swappable concern from partition assignment (which consumer owns a partition)? Conflating the two is a common shortcut that breaks extensibility.',
    'Does the candidate discuss what a rebalance actually requires - reseeding cursors from committed offsets, not from wherever the previous owner happened to leave off in memory?',
  ],

  relatedDesigns: ['inventory-management', 'order-management', 'multilevel-cache'],
  keyTakeaways: [
    'At-least-once is not "we tried our best not to lose or duplicate messages" - it is a precise consequence of one specific design choice: the fetch position that drives what a consumer reads advances in memory before processing finishes, while the durable checkpoint only advances after commit(). Removing that gap is what exactly-once would require, and it is expensive.',
    'The scarce, race-sensitive resource in a pub/sub system is not "the topic" - it is "the next offset of this one partition." Every concurrency guarantee in this design collapses to one synchronized block around one ArrayList, the same way parking-lot collapses to one atomic claim per spot and restaurant-booking collapses to one atomic claim per (table, slot).',
    'Partitioning (Strategy - where does a message go) and partition assignment (a separate algorithm - which consumer owns a partition) look similar but solve unrelated problems; keeping them as two swappable, independent policies is what lets each evolve (better hashing, stickier rebalancing) without touching the other.',
    'Observer is what turns "poll" from a wasteful sleep-and-recheck loop into a near-instant wake-up - the producer-side append() and the consumer-side poll() never call each other directly, they are connected only through the observer registration, exactly like Partition never imports Waitlist in the restaurant-booking design.',
  ],
}

export default problem

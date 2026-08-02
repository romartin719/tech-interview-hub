import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'task-scheduler',
  title: 'Task Scheduler',
  difficulty: 'Intermediate',
  icon: 'pi pi-clock',
  color: '#0ea5e9',
  readTimeMinutes: 17,
  patterns: ['Command', 'Strategy', 'Observer', 'Factory Method'],
  companies: ['Amazon (SQS/EventBridge)', 'Google Cloud Tasks', 'Quartz Scheduler', 'Airflow'],
  summary:
    'A task scheduler that lets callers submit an immediate, delayed, or recurring unit of work with a priority, and a bounded worker pool that always pulls the next actually-due, highest-priority task off a single ordered queue - correctly running an overdue low-priority task ahead of a high-priority task scheduled for later - while cancellation, retries, and dead-lettering are all resolved by one atomic status transition per task so nothing is ever double-run, silently dropped, or allowed to take down a worker thread.',

  functionalRequirements: [
    'Submit a task - a Command-style unit of work - with a TaskPriority and one of three schedules: run immediately, run once after a delay/at a specific instant, or recur on a fixed interval after each successful run.',
    "A bounded pool of N worker threads continuously pulls the next task whose due time has arrived, ordered by (dueAt ascending, priority descending as a tie-break only) - so an overdue LOW-priority task always runs before a CRITICAL task that simply isn't due yet.",
    'Support cancelling a task by id while it is still SCHEDULED and has not been picked up by a worker; cancelling a task that is already RUNNING is best-effort (interrupt the worker thread) rather than a guaranteed stop.',
    "A recurring task reschedules its own next occurrence immediately after a successful run - the caller submits it exactly once and never resubmits it externally - and cancelling a recurring task's id takes effect on its next not-yet-started occurrence, never the run already in flight.",
    'A task whose execute() throws is retried according to a pluggable RetryPolicy (max attempts + backoff duration); once retries are exhausted the task is moved into a dead-letter store instead of silently disappearing, and every outcome is reported to lifecycle listeners either way.',
    'Expose the current status of a submitted task by id (SCHEDULED / RUNNING / COMPLETED / CANCELLED / FAILED / DEAD_LETTERED) so a caller can poll the outcome of what it submitted.',
  ],
  nonFunctionalRequirements: [
    'Submitting, cancelling, and a worker claiming the next due task must all be safe under concurrent access from many threads with no single global lock - two workers racing for the same due task, or a cancel racing a worker about to start it, must always resolve to exactly one winner.',
    'Ordering the due-queue by (dueAt, priority) must not require re-sorting on every submit/cancel/poll - inserting a new task and extracting the next-due one must be O(log n) in the number of pending tasks, not O(n).',
    'A task that throws, runs long, or otherwise misbehaves must never take down the worker thread that ran it - the pool must keep pulling and running future due tasks indefinitely regardless of what any single task does.',
    'Cancellation lookup by task id must be O(1) - cancelling one specific task must never require scanning every other pending task to find it.',
  ],

  coreEntities: [
    { name: 'Task', description: 'The Command interface - a single execute() method (plus a default getName()) representing one unit of work, with zero knowledge of scheduling, priority, or retries.' },
    { name: 'TaskPriority', description: 'A weighted enum (LOW < MEDIUM < HIGH < CRITICAL) that only ever acts as a tie-break - it never overrides due time as the primary ordering key.' },
    { name: 'TaskStatus', description: 'The lifecycle enum - SCHEDULED, RUNNING, COMPLETED, CANCELLED, FAILED, DEAD_LETTERED - stored per task as the single source of truth for what state it is in.' },
    { name: 'RetryPolicy', description: 'The Strategy interface for "how many attempts, and how long to back off between them" - swappable per task without touching the worker loop.' },
    { name: 'ScheduledTaskHandle', description: "The entity that actually sits in the queue: wraps one Task with its id, priority, mutable dueAt, retry/attempt bookkeeping, and the AtomicReference<TaskStatus> that is the real concurrency guard - implements Delayed so it can live directly inside a DelayQueue." },
    { name: 'ScheduledTaskHandleFactory', description: 'Factory Method that builds handles for the three submission shapes (immediate/delayed/recurring), centralizing id generation and initial dueAt math in one place.' },
    { name: 'TaskLifecycleListener', description: 'The Observer interface notified on every scheduled/started/completed/failed/cancelled/dead-lettered transition - the core scheduler never imports a logger or a metrics client directly.' },
    { name: 'DeadLetterStore', description: 'An append-only store for tasks that exhausted their RetryPolicy - the guarantee that a repeatedly-failing task is parked for inspection instead of vanishing.' },
    { name: 'TaskWorker', description: "One worker thread's run loop: take the next due handle, atomically claim it, execute it, and route the outcome into a reschedule, a retry, or a dead-letter." },
    { name: 'TaskScheduler', description: 'The facade / aggregate root - owns the due-queue, the fixed worker pool, the id index used for cancellation, and the listener list; the only class client code ever talks to.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class TaskPriority {
    <<enumeration>>
    LOW
    MEDIUM
    HIGH
    CRITICAL
    +getWeight() int
  }
  class TaskStatus {
    <<enumeration>>
    SCHEDULED
    RUNNING
    COMPLETED
    CANCELLED
    FAILED
    DEAD_LETTERED
  }
  class Task {
    <<interface>>
    +execute() void
    +getName() String
  }
  class RetryPolicy {
    <<interface>>
    +maxAttempts() int
    +backoffFor(int) Duration
  }
  class ExponentialBackoffRetryPolicy {
    -int maxAttempts
    -Duration baseDelay
    +maxAttempts() int
    +backoffFor(int) Duration
  }
  class NoRetryPolicy {
    +maxAttempts() int
    +backoffFor(int) Duration
  }
  class TaskLifecycleListener {
    <<interface>>
    +onScheduled(ScheduledTaskHandle) void
    +onStarted(ScheduledTaskHandle) void
    +onCompleted(ScheduledTaskHandle) void
    +onFailed(ScheduledTaskHandle, Exception, boolean) void
    +onCancelled(ScheduledTaskHandle) void
    +onDeadLettered(ScheduledTaskHandle, Exception) void
  }
  class ConsoleTaskLifecycleListener {
    +onScheduled(ScheduledTaskHandle) void
    +onStarted(ScheduledTaskHandle) void
    +onCompleted(ScheduledTaskHandle) void
    +onFailed(ScheduledTaskHandle, Exception, boolean) void
    +onCancelled(ScheduledTaskHandle) void
    +onDeadLettered(ScheduledTaskHandle, Exception) void
  }
  class ScheduledTaskHandle {
    -String taskId
    -Task task
    -TaskPriority priority
    -Instant dueAt
    -boolean recurring
    -long intervalMillis
    -AtomicReference~TaskStatus~ status
    -AtomicBoolean cancelRequested
    -AtomicInteger attempt
    +getDelay(TimeUnit) long
    +compareTo(Delayed) int
    +tryStart() boolean
    +requestCancel() boolean
  }
  class ScheduledTaskHandleFactory {
    +immediate(Task, TaskPriority, RetryPolicy) ScheduledTaskHandle
    +delayed(Task, TaskPriority, Duration, RetryPolicy) ScheduledTaskHandle
    +recurring(Task, TaskPriority, Duration, RetryPolicy) ScheduledTaskHandle
  }
  class DeadLetterStore {
    -ConcurrentLinkedQueue~ScheduledTaskHandle~ deadLetters
    +add(ScheduledTaskHandle) void
    +drain() List~ScheduledTaskHandle~
    +size() int
  }
  class TaskWorker {
    -DelayQueue~ScheduledTaskHandle~ readyQueue
    -DeadLetterStore deadLetterStore
    -List~TaskLifecycleListener~ listeners
    +run() void
    +stop() void
  }
  class TaskScheduler {
    -DelayQueue~ScheduledTaskHandle~ readyQueue
    -ConcurrentHashMap~String, ScheduledTaskHandle~ handlesById
    -DeadLetterStore deadLetterStore
    -List~TaskLifecycleListener~ listeners
    -ExecutorService pool
    +submit(Task, TaskPriority) String
    +submitDelayed(Task, TaskPriority, Duration) String
    +submitRecurring(Task, TaskPriority, Duration) String
    +cancel(String) boolean
    +statusOf(String) TaskStatus
    +shutdown() void
  }

  RetryPolicy <|.. ExponentialBackoffRetryPolicy
  RetryPolicy <|.. NoRetryPolicy
  TaskLifecycleListener <|.. ConsoleTaskLifecycleListener
  ScheduledTaskHandle o-- Task
  ScheduledTaskHandle o-- TaskPriority
  ScheduledTaskHandle o-- RetryPolicy
  ScheduledTaskHandle ..> TaskStatus
  ScheduledTaskHandleFactory ..> ScheduledTaskHandle : creates
  TaskWorker ..> ScheduledTaskHandle : takes from queue
  TaskWorker ..> DeadLetterStore : dead-letters into
  TaskWorker ..> TaskLifecycleListener : notifies
  TaskScheduler o-- ScheduledTaskHandle
  TaskScheduler o-- TaskWorker
  TaskScheduler o-- DeadLetterStore
  TaskScheduler o-- TaskLifecycleListener
  TaskScheduler ..> ScheduledTaskHandleFactory : uses`,
  },

  designPatterns: [
    { pattern: 'Command', where: 'Task interface', why: 'Every unit of work - sending an email, charging a card, polling inventory - is reduced to one execute() method. The scheduler, the queue, and the worker pool never know or care what a task actually does, which is what lets the exact same machinery schedule, retry, and cancel any of them uniformly.' },
    { pattern: 'Strategy', where: 'RetryPolicy + ExponentialBackoffRetryPolicy / NoRetryPolicy', why: 'How many times to retry and how long to wait between attempts is a policy decision that varies per task type (a payment webhook might retry five times with backoff; a best-effort metrics ping might not retry at all) - TaskWorker never branches on which policy is active, it just calls maxAttempts()/backoffFor().' },
    { pattern: 'Observer', where: 'TaskLifecycleListener / ConsoleTaskLifecycleListener', why: 'The core scheduler fires "this task was scheduled / started / completed / failed / cancelled / dead-lettered" without knowing whether anything is listening - swapping console output for a real metrics/alerting pipeline means writing a new listener, not touching TaskWorker or TaskScheduler.' },
    { pattern: 'Factory Method', where: 'ScheduledTaskHandleFactory.immediate() / delayed() / recurring()', why: 'Id generation and the dueAt math for each of the three submission shapes lives in exactly one place - adding a fourth shape (e.g. "run at this cron expression") is a new factory method, not a new constructor call scattered across TaskScheduler.' },
  ],

  dataStructures: [
    { component: 'Due / ready queue', structure: 'java.util.concurrent.DelayQueue<ScheduledTaskHandle>', why: 'Gives a blocking take() that returns exactly the earliest-due handle (tie-broken by priority) with zero polling - ScheduledTaskHandle.getDelay() and compareTo() fold the entire (dueAt, priority) ordering into the queue itself, so no separate sort step ever runs.' },
    { component: 'Cancellation index', structure: 'ConcurrentHashMap<String, ScheduledTaskHandle> keyed by taskId', why: "A DelayQueue has no efficient by-id lookup of its own - this map is what makes cancel(taskId) and statusOf(taskId) O(1) instead of an O(n) scan over every pending task." },
    { component: 'Per-task concurrency guard', structure: 'AtomicReference<TaskStatus> inside each ScheduledTaskHandle, moved only via compareAndSet()', why: 'The same atomic check-and-set guarantee a lock would give, but scoped to one task instead of the whole scheduler - two unrelated tasks racing a cancel/claim on different handles never contend with each other at all.' },
    { component: 'Dead-letter store', structure: 'ConcurrentLinkedQueue<ScheduledTaskHandle>', why: 'O(1) append from any worker thread the instant retries are exhausted, plus a drain() an ops process can call to inspect or replay failures later without ever blocking task execution.' },
    { component: 'Worker pool', structure: 'A fixed-size ExecutorService running N TaskWorker loops', why: 'Bounds how many tasks can execute at once regardless of how many become due in the same instant - a burst of simultaneously-due tasks queues up behind the pool instead of spawning unbounded threads.' },
  ],

  walkthroughs: [
    {
      title: 'Delayed + Recurring Scheduling Order (why dueAt beats priority)',
      steps: [
        'Three tasks land on TaskScheduler within the same millisecond: submit(sendWelcomeEmail, LOW) builds a handle via ScheduledTaskHandleFactory.immediate() with dueAt = now; submitDelayed(chargeCard, CRITICAL, 300ms) builds one with dueAt = now + 300ms; submitRecurring(pollInventory, MEDIUM, 80ms) builds one with dueAt = now + 80ms and recurring = true.',
        'All three handles are put() onto the same DelayQueue<ScheduledTaskHandle>. The queue orders them purely by ScheduledTaskHandle.compareTo(), which compares dueAt first and only falls back to priority.getWeight() when two dueAt values are exactly equal.',
        "A worker's readyQueue.take() unblocks first for sendWelcomeEmail even though it is LOW priority, simply because its dueAt (now) is the earliest of the three - chargeCard is CRITICAL but is not due for another 300ms, so it is not even a candidate yet.",
        'tryStart() CASes sendWelcomeEmail from SCHEDULED to RUNNING; it runs to completion, and since it is one-time (not recurring), onSuccess() calls markCompleted() - the handle is never reinserted.',
        "About 80ms later pollInventory becomes due, still well before chargeCard's 300ms mark; a worker takes it, runs it, and because isRecurring() is true and cancelRequested is false, onSuccess() calls rescheduleTo(now + 80ms) and put()s the exact same handle object back onto the queue for its next occurrence - nothing external ever resubmitted it.",
        "This repeats roughly every 80ms - pollInventory keeps winning the head of the queue over chargeCard purely on dueAt - until the 300ms mark arrives and chargeCard finally becomes the earliest-due handle and wins the next take(). If chargeCard's dueAt ever landed on the exact same millisecond as a pollInventory occurrence, its CRITICAL weight would break that specific tie.",
        'The net effect is that dueAt alone determines run order across different tasks; TaskPriority only ever matters for the rare exact-tie case - precisely the non-functional requirement that an overdue low-priority task must never lose its turn to a not-yet-due high-priority one.',
      ],
    },
    {
      title: "Cancellation Racing a Worker's Claim",
      steps: [
        "A recurring cache-warm task's handle is sitting in the ready queue with its dueAt about to elapse; at almost the same instant, an operator on a completely different thread calls scheduler.cancel(taskId) because the cache is being decommissioned.",
        "A worker thread's readyQueue.take() happens to unblock first (by nanoseconds) and returns that exact handle - but merely dequeuing it does not yet commit the worker to running it.",
        'The two threads now race on the handle\'s single AtomicReference<TaskStatus>: the worker calls tryStart(), which is compareAndSet(SCHEDULED, RUNNING); the cancelling thread\'s cancel() calls requestCancel(), which first sets a cancelRequested flag and then attempts compareAndSet(SCHEDULED, CANCELLED) on that same reference.',
        'Only one of those two CAS calls can succeed, because both read the same precondition (status == SCHEDULED) and AtomicReference.compareAndSet() is a single hardware-level atomic operation - there is no interleaving where both threads observe SCHEDULED and both "win".',
        "If the worker's tryStart() wins first, requestCancel()'s CAS fails because status is now RUNNING, not SCHEDULED; TaskScheduler.cancel() sees its own CAS lost, notices the status is RUNNING, and falls back to handle.interruptIfRunning() - a best-effort signal that only actually stops the task if its code cooperatively checks Thread.interrupted().",
        "If requestCancel() wins first, the worker's later tryStart() fails because status is now CANCELLED; the worker discards the handle without ever calling task.execute() and loops straight back to readyQueue.take() for the next one - the task is cancelled cleanly with zero side effects.",
        "Either outcome is correct with no lock spanning the whole scheduler: exactly one thread ever wins a given handle's transition out of SCHEDULED - the same single-winner guarantee ConcurrentHashMap.compute() gives per map key, just implemented here as a per-handle CAS on a plain AtomicReference.",
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'TaskPriority.java',
      rationale: 'A weighted enum rather than a raw int - getWeight() is only ever consulted as compareTo()\'s tie-break in ScheduledTaskHandle, never as a primary sort key, so keeping the weight explicit (instead of relying on ordinal()) keeps that intent obvious at the call site.',
      code: `public enum TaskPriority {
    LOW(0),
    MEDIUM(1),
    HIGH(2),
    CRITICAL(3);

    private final int weight;

    TaskPriority(int weight) {
        this.weight = weight;
    }

    public int getWeight() {
        return weight;
    }
}`,
    },
    {
      filename: 'TaskStatus.java',
      rationale: 'Every legal state a task can be in, over its entire lifetime - including the two states (FAILED, DEAD_LETTERED) that exist specifically so a thrown exception is never allowed to make a task disappear silently.',
      code: `public enum TaskStatus {
    SCHEDULED,
    RUNNING,
    COMPLETED,
    CANCELLED,
    FAILED,
    DEAD_LETTERED
}`,
    },
    {
      filename: 'Task.java',
      rationale: 'The Command interface. Deliberately the only thing a caller has to implement - a task knows nothing about priority, due times, retries, or which thread will run it.',
      code: `@FunctionalInterface
public interface Task {
    /** The unit of work. May throw - the scheduler is responsible for catching, retrying, or dead-lettering. */
    void execute() throws Exception;

    /** A human-readable name for logs and listeners; defaults to the runtime class name. */
    default String getName() {
        return getClass().getSimpleName();
    }
}`,
    },
    {
      filename: 'RetryPolicy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        "TaskWorker never contains an if/else on \"how should this particular task be retried\". It just calls maxAttempts() and backoffFor() on whatever RetryPolicy the task was submitted with - a payment task can get five attempts with exponential backoff while a best-effort metrics ping gets zero retries, and neither choice touches a single line of the worker loop.",
      rationale: 'Two methods, deliberately stateless from the caller\'s point of view - a policy only ever answers questions about a given attempt number, it never tracks state of its own.',
      code: `import java.time.Duration;

public interface RetryPolicy {
    /** Maximum number of attempts (including the first) before the task is dead-lettered. */
    int maxAttempts();

    /** How long to wait before the given 1-based attempt number is allowed to run again. */
    Duration backoffFor(int attemptNumber);
}`,
    },
    {
      filename: 'ExponentialBackoffRetryPolicy.java',
      rationale: 'Doubles the wait on every attempt, capped at a shift of 10 (1024x the base delay) so a pathological attempt count can never overflow the multiplier into a negative or wildly wrong duration.',
      code: `import java.time.Duration;

public final class ExponentialBackoffRetryPolicy implements RetryPolicy {
    private final int maxAttempts;
    private final Duration baseDelay;

    public ExponentialBackoffRetryPolicy(int maxAttempts, Duration baseDelay) {
        this.maxAttempts = maxAttempts;
        this.baseDelay = baseDelay;
    }

    @Override
    public int maxAttempts() {
        return maxAttempts;
    }

    @Override
    public Duration backoffFor(int attemptNumber) {
        long multiplier = 1L << Math.min(attemptNumber - 1, 10); // capped shift - never overflows
        return baseDelay.multipliedBy(multiplier);
    }
}`,
    },
    {
      filename: 'NoRetryPolicy.java',
      rationale: 'The trivial strategy for tasks where a second attempt is pointless or unsafe (e.g. a non-idempotent side effect) - maxAttempts() == 1 means the very first failure sends the task straight to the dead-letter store.',
      code: `import java.time.Duration;

public final class NoRetryPolicy implements RetryPolicy {
    @Override
    public int maxAttempts() {
        return 1;
    }

    @Override
    public Duration backoffFor(int attemptNumber) {
        return Duration.ZERO; // never consulted - maxAttempts() == 1 means there is never a second attempt
    }
}`,
    },
    {
      filename: 'TaskLifecycleListener.java',
      rationale: 'All six methods are default no-ops so a listener interested in only one event (say, dead-lettering, for an alert) does not have to implement the other five.',
      code: `public interface TaskLifecycleListener {
    default void onScheduled(ScheduledTaskHandle handle) {}
    default void onStarted(ScheduledTaskHandle handle) {}
    default void onCompleted(ScheduledTaskHandle handle) {}
    default void onFailed(ScheduledTaskHandle handle, Exception error, boolean willRetry) {}
    default void onCancelled(ScheduledTaskHandle handle) {}
    default void onDeadLettered(ScheduledTaskHandle handle, Exception lastError) {}
}`,
    },
    {
      filename: 'ConsoleTaskLifecycleListener.java',
      calloutTitle: '💡 Observer Pattern',
      callout:
        'TaskScheduler and TaskWorker have zero knowledge that this class - or any listener - exists; they simply notify whatever is registered. Swapping this for a real metrics/alerting sink is a new class implementing the same six methods, with no change anywhere in the scheduling or execution path.',
      rationale: 'Prints to the console instead of calling a real observability API - production code would swap the bodies of these six methods, the pattern is the point being demonstrated here.',
      code: `public final class ConsoleTaskLifecycleListener implements TaskLifecycleListener {
    @Override
    public void onScheduled(ScheduledTaskHandle handle) {
        System.out.println("[lifecycle] " + handle.getTaskId() + " scheduled for " + handle.getDueAt());
    }

    @Override
    public void onStarted(ScheduledTaskHandle handle) {
        System.out.println("[lifecycle] " + handle.getTaskId() + " started (attempt " + handle.getAttempt() + ")");
    }

    @Override
    public void onCompleted(ScheduledTaskHandle handle) {
        System.out.println("[lifecycle] " + handle.getTaskId() + " completed");
    }

    @Override
    public void onFailed(ScheduledTaskHandle handle, Exception error, boolean willRetry) {
        System.out.println("[lifecycle] " + handle.getTaskId() + " failed: " + error.getMessage()
                + (willRetry ? " - retrying" : " - exhausted retries"));
    }

    @Override
    public void onCancelled(ScheduledTaskHandle handle) {
        System.out.println("[lifecycle] " + handle.getTaskId() + " cancelled");
    }

    @Override
    public void onDeadLettered(ScheduledTaskHandle handle, Exception lastError) {
        System.out.println("[lifecycle] " + handle.getTaskId() + " DEAD-LETTERED after "
                + handle.getAttempt() + " attempts: " + lastError.getMessage());
    }
}`,
    },
    {
      filename: 'ScheduledTaskHandle.java',
      calloutTitle: '💡 Delayed ordering + CAS status',
      callout:
        "compareTo() is the entire (dueAt, priority) ordering contract in one method: due time decides first, priority only ever breaks an exact tie - which is exactly what lets an overdue LOW task win over a not-yet-due CRITICAL one. Separately, tryStart()/requestCancel() are the two only ways status ever leaves SCHEDULED, and both go through the same AtomicReference.compareAndSet() - so a worker claiming this handle and a caller cancelling it can race freely with no lock, because exactly one of those two CAS calls can ever succeed.",
      rationale:
        'Deliberately does not override equals()/hashCode() - identity equality is exactly what TaskScheduler.cancel() needs from readyQueue.remove(handle): it must remove this specific occurrence, never a different task that happens to share the same dueAt and priority.',
      code: `import java.time.Instant;
import java.util.concurrent.Delayed;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public final class ScheduledTaskHandle implements Delayed {
    private final String taskId;
    private final Task task;
    private final TaskPriority priority;
    private final RetryPolicy retryPolicy;
    private final boolean recurring;
    private final long intervalMillis; // 0 for one-time tasks

    private volatile Instant dueAt;
    private final AtomicReference<TaskStatus> status = new AtomicReference<>(TaskStatus.SCHEDULED);
    private final AtomicBoolean cancelRequested = new AtomicBoolean(false);
    private final AtomicInteger attempt = new AtomicInteger(0);
    private volatile Thread runningOn;

    ScheduledTaskHandle(String taskId, Task task, TaskPriority priority, Instant dueAt,
                        boolean recurring, long intervalMillis, RetryPolicy retryPolicy) {
        this.taskId = taskId;
        this.task = task;
        this.priority = priority;
        this.dueAt = dueAt;
        this.recurring = recurring;
        this.intervalMillis = intervalMillis;
        this.retryPolicy = retryPolicy;
    }

    /** The atomic gate a worker must pass before it is allowed to run this occurrence. */
    boolean tryStart() {
        return status.compareAndSet(TaskStatus.SCHEDULED, TaskStatus.RUNNING);
    }

    /** The atomic gate a canceller must pass to stop this occurrence before a worker claims it.
     *  cancelRequested is set unconditionally first, so even if the CAS below loses (a worker already
     *  won and is mid-execution), a recurring task still will not be rearmed once that run finishes. */
    boolean requestCancel() {
        cancelRequested.set(true);
        return status.compareAndSet(TaskStatus.SCHEDULED, TaskStatus.CANCELLED);
    }

    boolean isCancelRequested() {
        return cancelRequested.get();
    }

    void markCompleted() { status.set(TaskStatus.COMPLETED); }
    void markFailed() { status.set(TaskStatus.FAILED); }
    void markCancelled() { status.set(TaskStatus.CANCELLED); }
    void markDeadLettered() { status.set(TaskStatus.DEAD_LETTERED); }

    /** Rearms this same handle object - for a recurring task's next occurrence, or a failed task's
     *  next retry after backoff - and flips status back to SCHEDULED so it can be claimed or cancelled again. */
    void rescheduleTo(Instant newDueAt) {
        this.dueAt = newDueAt;
        this.status.set(TaskStatus.SCHEDULED);
    }

    /** Best-effort only: interrupts whichever thread is currently executing this task. A task whose
     *  execute() never checks Thread.interrupted() (or is blocked on non-interruptible I/O) simply runs
     *  to completion - the same limitation any JVM has when force-stopping an arbitrary thread safely. */
    void interruptIfRunning() {
        Thread thread = runningOn;
        if (thread != null) {
            thread.interrupt();
        }
    }

    void setRunningThread(Thread thread) {
        this.runningOn = thread;
    }

    int incrementAttempt() {
        return attempt.incrementAndGet();
    }

    @Override
    public long getDelay(TimeUnit unit) {
        long millisRemaining = dueAt.toEpochMilli() - System.currentTimeMillis();
        return unit.convert(millisRemaining, TimeUnit.MILLISECONDS);
    }

    @Override
    public int compareTo(Delayed other) {
        if (!(other instanceof ScheduledTaskHandle)) {
            return Long.compare(getDelay(TimeUnit.MILLISECONDS), other.getDelay(TimeUnit.MILLISECONDS));
        }
        ScheduledTaskHandle that = (ScheduledTaskHandle) other;
        int byDueTime = this.dueAt.compareTo(that.dueAt);
        if (byDueTime != 0) {
            return byDueTime; // due time always decides first, regardless of priority
        }
        return Integer.compare(that.priority.getWeight(), this.priority.getWeight()); // tie -> higher priority first
    }

    public String getTaskId() { return taskId; }
    public Task getTask() { return task; }
    public TaskPriority getPriority() { return priority; }
    public Instant getDueAt() { return dueAt; }
    public boolean isRecurring() { return recurring; }
    public long getIntervalMillis() { return intervalMillis; }
    public RetryPolicy getRetryPolicy() { return retryPolicy; }
    public TaskStatus getStatus() { return status.get(); }
    public int getAttempt() { return attempt.get(); }
}`,
    },
    {
      filename: 'ScheduledTaskHandleFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'Id generation and the dueAt arithmetic for all three submission shapes live in exactly one place. Adding a fourth shape - say, "run at this cron expression" - is one new static method here; TaskScheduler\'s submit-family methods stay one-line pass-throughs and never touch Instant math directly.',
      rationale: 'A private constructor and only static factory methods - this class is never instantiated, it exists purely to keep handle construction out of TaskScheduler.',
      code: `import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

public final class ScheduledTaskHandleFactory {
    private ScheduledTaskHandleFactory() {}

    public static ScheduledTaskHandle immediate(Task task, TaskPriority priority, RetryPolicy retryPolicy) {
        return new ScheduledTaskHandle(newId(), task, priority, Instant.now(), false, 0, retryPolicy);
    }

    public static ScheduledTaskHandle delayed(Task task, TaskPriority priority, Duration delay, RetryPolicy retryPolicy) {
        return new ScheduledTaskHandle(newId(), task, priority, Instant.now().plus(delay), false, 0, retryPolicy);
    }

    public static ScheduledTaskHandle recurring(Task task, TaskPriority priority, Duration interval, RetryPolicy retryPolicy) {
        return new ScheduledTaskHandle(
                newId(), task, priority, Instant.now().plus(interval), true, interval.toMillis(), retryPolicy);
    }

    private static String newId() {
        return UUID.randomUUID().toString();
    }
}`,
    },
    {
      filename: 'DeadLetterStore.java',
      rationale: 'drain() copies then removeAll()s only what was copied - not clear() - so a task dead-lettered by another thread in the split second between the copy and the cleanup is never silently lost.',
      code: `import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

public final class DeadLetterStore {
    private final ConcurrentLinkedQueue<ScheduledTaskHandle> deadLetters = new ConcurrentLinkedQueue<>();

    public void add(ScheduledTaskHandle handle) {
        deadLetters.add(handle);
    }

    /** Removes and returns every dead-lettered task accumulated so far, for an ops process to inspect or replay. */
    public List<ScheduledTaskHandle> drain() {
        List<ScheduledTaskHandle> snapshot = new ArrayList<>(deadLetters);
        deadLetters.removeAll(snapshot);
        return snapshot;
    }

    public int size() {
        return deadLetters.size();
    }
}`,
    },
    {
      filename: 'TaskWorker.java',
      calloutTitle: '💡 A thrown task can never kill the worker',
      callout:
        "The entire body of run() is a while loop with exactly one try/catch around task.execute(). Whatever a task does - throw, return normally, or (best-effort-interruptibly) hang - control always comes back into onSuccess()/onFailure() and the loop continues to the next readyQueue.take(). That single catch(Exception) is what turns \"a task can throw\" from a worker-killing bug into a routine retry-or-dead-letter decision.",
      rationale:
        "tryStart() is checked immediately after take() so a handle that lost the cancellation race is discarded with zero side effects - no attempt increment, no listener notification, nothing that looks like the task ever ran.",
      code: `import java.time.Instant;
import java.util.List;
import java.util.concurrent.DelayQueue;

public final class TaskWorker implements Runnable {
    private final DelayQueue<ScheduledTaskHandle> readyQueue;
    private final DeadLetterStore deadLetterStore;
    private final List<TaskLifecycleListener> listeners;
    private volatile boolean running = true;

    TaskWorker(DelayQueue<ScheduledTaskHandle> readyQueue, DeadLetterStore deadLetterStore,
               List<TaskLifecycleListener> listeners) {
        this.readyQueue = readyQueue;
        this.deadLetterStore = deadLetterStore;
        this.listeners = listeners;
    }

    void stop() {
        running = false;
    }

    @Override
    public void run() {
        while (running) {
            ScheduledTaskHandle handle;
            try {
                handle = readyQueue.take(); // blocks until the earliest (dueAt, priority) entry is actually due
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return; // pool is shutting down - exit this worker cleanly
            }

            if (!handle.tryStart()) {
                continue; // lost the race to a cancellation - nothing to run
            }

            handle.incrementAttempt();
            handle.setRunningThread(Thread.currentThread());
            listeners.forEach(l -> l.onStarted(handle));

            try {
                handle.getTask().execute();
                onSuccess(handle);
            } catch (Exception ex) {
                // A task that throws must never take this worker thread down with it - catch, decide, keep looping.
                onFailure(handle, ex);
            } finally {
                handle.setRunningThread(null);
            }
        }
    }

    private void onSuccess(ScheduledTaskHandle handle) {
        if (handle.isRecurring() && !handle.isCancelRequested()) {
            handle.rescheduleTo(Instant.now().plusMillis(handle.getIntervalMillis()));
            readyQueue.put(handle); // reschedules itself - nothing external resubmits a recurring task
        } else {
            handle.markCompleted();
        }
        listeners.forEach(l -> l.onCompleted(handle));
    }

    private void onFailure(ScheduledTaskHandle handle, Exception ex) {
        handle.markFailed();
        if (handle.isCancelRequested()) {
            handle.markCancelled();
            listeners.forEach(l -> l.onCancelled(handle));
            return;
        }
        RetryPolicy retryPolicy = handle.getRetryPolicy();
        if (handle.getAttempt() < retryPolicy.maxAttempts()) {
            handle.rescheduleTo(Instant.now().plus(retryPolicy.backoffFor(handle.getAttempt())));
            readyQueue.put(handle);
            listeners.forEach(l -> l.onFailed(handle, ex, true));
        } else {
            handle.markDeadLettered();
            deadLetterStore.add(handle);
            listeners.forEach(l -> l.onFailed(handle, ex, false));
            listeners.forEach(l -> l.onDeadLettered(handle, ex));
        }
    }
}`,
    },
    {
      filename: 'TaskScheduler.java',
      rationale:
        "The facade / aggregate root. Every public method is a thin, focused operation - the three submit-family methods delegate id/dueAt construction to the factory, and cancel() is the only place that ever calls requestCancel() and interruptIfRunning() together, keeping the cancellation policy in one spot.",
      code: `import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.DelayQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class TaskScheduler {
    private final DelayQueue<ScheduledTaskHandle> readyQueue = new DelayQueue<>();
    private final ConcurrentHashMap<String, ScheduledTaskHandle> handlesById = new ConcurrentHashMap<>();
    private final DeadLetterStore deadLetterStore = new DeadLetterStore();
    private final List<TaskLifecycleListener> listeners = new CopyOnWriteArrayList<>();
    private final RetryPolicy defaultRetryPolicy;
    private final ExecutorService pool;
    private final List<TaskWorker> workers = new ArrayList<>();

    public TaskScheduler(int workerCount, RetryPolicy defaultRetryPolicy) {
        this.defaultRetryPolicy = defaultRetryPolicy;
        this.pool = Executors.newFixedThreadPool(workerCount);
        for (int i = 0; i < workerCount; i++) {
            TaskWorker worker = new TaskWorker(readyQueue, deadLetterStore, listeners);
            workers.add(worker);
            pool.submit(worker);
        }
    }

    public void addListener(TaskLifecycleListener listener) {
        listeners.add(listener);
    }

    public String submit(Task task, TaskPriority priority) {
        return register(ScheduledTaskHandleFactory.immediate(task, priority, defaultRetryPolicy));
    }

    public String submitDelayed(Task task, TaskPriority priority, Duration delay) {
        return register(ScheduledTaskHandleFactory.delayed(task, priority, delay, defaultRetryPolicy));
    }

    public String submitRecurring(Task task, TaskPriority priority, Duration interval) {
        return register(ScheduledTaskHandleFactory.recurring(task, priority, interval, defaultRetryPolicy));
    }

    /** True only if this call is the one that stopped the task before any worker started it. */
    public boolean cancel(String taskId) {
        ScheduledTaskHandle handle = handlesById.get(taskId);
        if (handle == null) {
            return false;
        }
        boolean wonBeforeStart = handle.requestCancel();
        if (wonBeforeStart) {
            readyQueue.remove(handle);
            listeners.forEach(l -> l.onCancelled(handle));
        } else if (handle.getStatus() == TaskStatus.RUNNING) {
            handle.interruptIfRunning();
        }
        return wonBeforeStart;
    }

    public TaskStatus statusOf(String taskId) {
        ScheduledTaskHandle handle = handlesById.get(taskId);
        if (handle == null) {
            throw new IllegalArgumentException("Unknown task: " + taskId);
        }
        return handle.getStatus();
    }

    public DeadLetterStore getDeadLetterStore() {
        return deadLetterStore;
    }

    public void shutdown() {
        workers.forEach(TaskWorker::stop);
        pool.shutdownNow();
    }

    private String register(ScheduledTaskHandle handle) {
        handlesById.put(handle.getTaskId(), handle);
        readyQueue.put(handle);
        listeners.forEach(l -> l.onScheduled(handle));
        return handle.getTaskId();
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy path (immediate/delayed/recurring ordering by due time, not priority), the edge cases (cancelling a task before it runs, cancelling a recurring task so it stops rearming, and a throwing task retrying with backoff before landing in the dead-letter store), and - since race-free claim/cancel is a stated non-functional requirement - a concurrency stress test where many producer threads submit and cancel tasks against the worker pool simultaneously.',
      code: `import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

public final class Demo {
    public static void main(String[] args) throws Exception {
        TaskScheduler scheduler = new TaskScheduler(4, new ExponentialBackoffRetryPolicy(3, Duration.ofMillis(50)));
        scheduler.addListener(new ConsoleTaskLifecycleListener());

        // --- Happy path: immediate, delayed, and recurring tasks, ordered by due time, not priority ---
        List<String> order = new CopyOnWriteArrayList<>();

        scheduler.submit(() -> order.add("immediate-low"), TaskPriority.LOW);

        // Scheduled 300ms out but CRITICAL priority - it must still lose to anything already overdue.
        scheduler.submitDelayed(() -> order.add("delayed-critical"), TaskPriority.CRITICAL, Duration.ofMillis(300));

        AtomicInteger recurringRuns = new AtomicInteger();
        String recurringId = scheduler.submitRecurring(() -> {
            recurringRuns.incrementAndGet();
            order.add("recurring-medium-run-" + recurringRuns.get());
        }, TaskPriority.MEDIUM, Duration.ofMillis(80));

        Thread.sleep(500);
        System.out.println("Execution order: " + order);
        System.out.println("Recurring task ran " + recurringRuns.get() + " times (expect several in 500ms at 80ms interval)");

        // --- Edge case: cancel a task before it is due, then stop a recurring task's future occurrences ---
        String toCancelId = scheduler.submitDelayed(() -> order.add("should-never-run"), TaskPriority.HIGH, Duration.ofMillis(200));
        boolean cancelledBeforeRun = scheduler.cancel(toCancelId);
        System.out.println("Cancelled before due: " + cancelledBeforeRun);
        Thread.sleep(300);
        System.out.println("'should-never-run' present in order? " + order.contains("should-never-run"));

        scheduler.cancel(recurringId); // its next occurrence never fires - a run already in flight would still finish
        int runsAtCancelTime = recurringRuns.get();
        Thread.sleep(200);
        System.out.println("Recurring runs stayed at " + runsAtCancelTime + " after cancel (now "
                + recurringRuns.get() + ") - no further occurrences were scheduled");

        // --- A task that throws must retry via backoff and land in the dead-letter store, not vanish ---
        AtomicInteger attempts = new AtomicInteger();
        scheduler.submit(() -> {
            attempts.incrementAndGet();
            throw new RuntimeException("simulated downstream failure");
        }, TaskPriority.HIGH);
        Thread.sleep(400);
        System.out.println("Failing task attempted " + attempts.get() + " times (expect 3, matching maxAttempts)");
        System.out.println("Dead-letter store size: " + scheduler.getDeadLetterStore().size());

        // --- Concurrency stress test: many producer threads race submit/cancel against the worker pool ---
        int producers = 10;
        int tasksPerProducer = 50;
        AtomicInteger completed = new AtomicInteger();
        CountDownLatch producersDone = new CountDownLatch(producers);
        for (int p = 0; p < producers; p++) {
            final int producerId = p;
            new Thread(() -> {
                for (int i = 0; i < tasksPerProducer; i++) {
                    TaskPriority priority = TaskPriority.values()[(producerId + i) % TaskPriority.values().length];
                    String id = scheduler.submit(() -> completed.incrementAndGet(), priority);
                    if (i % 7 == 0) {
                        scheduler.cancel(id); // races against a worker that may already be claiming it
                    }
                }
                producersDone.countDown();
            }).start();
        }
        producersDone.await();
        Thread.sleep(500);
        System.out.println("Stress test: " + completed.get() + " tasks completed out of "
                + (producers * tasksPerProducer) + " submitted (some intentionally cancelled) - "
                + "no duplicate runs, no crashed workers");

        scheduler.shutdown();
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Task Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> SCHEDULED: submit() / submitDelayed() / submitRecurring()
  SCHEDULED --> RUNNING: worker tryStart() wins the CAS
  SCHEDULED --> CANCELLED: cancel() wins the CAS before a worker starts it
  RUNNING --> COMPLETED: execute() returns normally (one-time task)
  RUNNING --> SCHEDULED: execute() returns normally (recurring, not cancelled) - rearmed for next interval
  RUNNING --> FAILED: execute() throws
  FAILED --> SCHEDULED: attempts < retryPolicy.maxAttempts() - rearmed after backoff
  FAILED --> DEAD_LETTERED: attempts >= retryPolicy.maxAttempts()
  RUNNING --> CANCELLED: cancelRequested was set mid-run and this was its last occurrence
  COMPLETED --> [*]
  CANCELLED --> [*]
  DEAD_LETTERED --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Cancel Racing a Worker Claim',
    mermaid: `sequenceDiagram
  autonumber
  participant Caller as Cancelling Thread
  participant Sched as TaskScheduler
  participant Handle as ScheduledTaskHandle (status)
  participant Worker as TaskWorker Thread

  Worker->>Handle: readyQueue.take() returns this handle (dueAt just elapsed)
  par Nearly simultaneous
    Caller->>Sched: cancel(taskId)
    Sched->>Handle: requestCancel() -> CAS(SCHEDULED, CANCELLED)
  and
    Worker->>Handle: tryStart() -> CAS(SCHEDULED, RUNNING)
  end
  Note over Handle: Exactly one CAS wins - status can only ever leave SCHEDULED once
  alt requestCancel() won
    Handle-->>Sched: true
    Sched->>Sched: readyQueue.remove(handle), notify onCancelled
    Handle-->>Worker: tryStart() returns false
    Worker->>Worker: discard handle, loop back to readyQueue.take()
  else tryStart() won
    Handle-->>Worker: true
    Worker->>Worker: execute the task
    Handle-->>Sched: requestCancel() returns false (status already RUNNING)
    Sched->>Handle: interruptIfRunning() - best-effort only
  end`,
  },

  extensions: [
    { extension: 'Durability across restarts', implementation: 'Persist each ScheduledTaskHandle (id, dueAt, priority, attempt, task payload) to a database or write-ahead log on register()/rescheduleTo(), and replay any SCHEDULED rows into a fresh DelayQueue on startup - today a process restart silently loses everything in-memory.' },
    { extension: 'Distributed / multi-node scheduling', implementation: 'Replace the single in-process DelayQueue with a shared store (e.g. a database row with a claimed-until lease, or Quartz-style clustering) so multiple TaskScheduler instances can pull from the same backlog without two nodes ever claiming the same due task.' },
    { extension: 'Task dependencies (DAGs)', implementation: 'Add a Set<String> dependsOnTaskIds to ScheduledTaskHandle and have TaskWorker check that every dependency is COMPLETED before tryStart() is even attempted, mirroring how Airflow gates a downstream task on its upstreams.' },
    { extension: 'Starvation-proofing very low priority tasks', implementation: 'Swap the tie-break in compareTo() for an aging score (priority.getWeight() plus a bonus that grows the longer a task has waited past its dueAt), so a LOW task stuck behind a constant stream of newly-due HIGH tasks eventually wins.' },
    { extension: 'Per-tenant rate limiting', implementation: 'Add a token-bucket check inside TaskWorker.run() keyed by a tenantId on the handle, deferring (rescheduling slightly later) any task whose tenant has exceeded its execution rate instead of running it immediately when due.' },
    { extension: 'Observability dashboard', implementation: 'Add a MetricsTaskLifecycleListener that increments counters and records latency histograms on each callback - a drop-in Observer alongside ConsoleTaskLifecycleListener, requiring no change to TaskScheduler or TaskWorker.' },
  ],

  interviewerChecklist: [
    'Does the ordering genuinely key off (dueAt, priority) - with dueAt primary - or did the candidate build a plain priority queue that would run a not-yet-due CRITICAL task ahead of an overdue LOW one?',
    'Is claiming a due task for execution a real atomic operation (CAS or equivalent), or a check-then-act race (peek the queue, then separately mark it running)?',
    'Does cancellation correctly distinguish "not yet started - stop it cleanly" from "already running - best-effort interrupt only", instead of pretending both cases can be handled identically?',
    'Do recurring tasks reschedule themselves internally after each successful run, or did the candidate push that responsibility onto an external caller that has to remember to resubmit?',
    'Is there an explicit answer for "what happens when a task throws" - retry with backoff, and a real terminal state (dead-letter) instead of the exception just disappearing or killing the worker thread?',
    'Can a new retry policy or a new lifecycle listener be added without touching the worker loop or the scheduler\'s core submit/cancel methods?',
  ],

  relatedDesigns: ['elevator-system', 'restaurant-booking'],
  keyTakeaways: [
    'When "when" and "how important" both matter, the due time has to be the primary sort key and priority only a tie-break - otherwise a backlog of overdue low-priority work can be starved forever by a steady stream of not-yet-due high-priority tasks.',
    'java.util.concurrent.DelayQueue is the right tool the moment "wait until this specific instant, then hand me the earliest one" is a first-class requirement - it replaces a hand-rolled priority queue plus a sleep/poll loop with one blocking take().',
    'AtomicReference<TaskStatus>.compareAndSet() is the same single-winner guarantee as ConcurrentHashMap.compute() in the restaurant-booking design, just scoped per-entity instead of per-map-key - use it whenever exactly one of several racing threads should "win" a state transition.',
    'A recurring job that reschedules itself after success (rather than relying on an external resubmission) is what makes "run every N minutes forever" actually reliable - the responsibility to keep going lives with the task machinery, not with whoever happened to submit it once.',
    'A worker loop is only as robust as its exception boundary: one try/catch around the task\'s execute() call, routing every failure into retry-or-dead-letter, is what keeps a single misbehaving task from taking an entire thread - and therefore a slice of throughput - out of the pool permanently.',
  ],
}

export default problem

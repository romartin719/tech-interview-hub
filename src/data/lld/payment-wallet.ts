import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'payment-wallet',
  title: 'Payment Wallet',
  difficulty: 'Intermediate',
  icon: 'pi pi-wallet',
  color: '#059669',
  readTimeMinutes: 17,
  patterns: ['Command', 'State', 'Idempotency Key'],
  companies: ['PayPal', 'Stripe', 'Venmo', 'PhonePe', 'Paytm'],
  summary:
    "A digital wallet system that moves money between users via deposits, withdrawals, and P2P transfers - guaranteeing every mutating request executes at most once even when a client retries it, and that a wallet's balance can never be pushed negative by two operations racing at the same instant.",

  functionalRequirements: [
    'Create a wallet per user with an opening balance, and support deposit, withdraw, and peer-to-peer transfer operations against it.',
    'Every deposit, withdrawal, and transfer must produce one or more immutable, append-only ledger entries recording exactly what changed, which transaction it belongs to, and the resulting balance.',
    'A client may resend the exact same mutating request (deposit, withdraw, or transfer) any number of times using a client-supplied idempotency key - e.g. after a request timeout where the client cannot tell if the first attempt actually landed - and the underlying operation must run at most once no matter how many times or how concurrently the key is presented.',
    "A withdrawal, or the debit side of a transfer, that would take a wallet's balance below zero must be rejected atomically with no partial effect on either wallet involved.",
    'A P2P transfer must debit the source wallet and credit the destination wallet as a single atomic unit - if any part of the operation is rejected, neither wallet is touched, so there is never a state where money has left one wallet without yet arriving at the other.',
    "Support querying a wallet's current balance and its full, ordered ledger history at any time.",
  ],
  nonFunctionalRequirements: [
    'Two concurrent debits against the same wallet (two withdrawals, or a withdrawal racing the debit side of a transfer) must never both succeed if the balance can only cover one of them - the classic double-spend race must be structurally impossible, not merely unlikely under load.',
    'A transfer between two wallets must never deadlock, even when many transfers are moving money in both directions between the same pair of wallets at the same time.',
    'Idempotency-key handling must itself be race-free: N concurrent callers presenting the identical key must trigger exactly one execution of the underlying operation and receive N identical results, never N executions and never a corrupted half-claimed key.',
    "The ledger must never silently disagree with a wallet's live balance - either both are updated as one atomic unit, or the design states plainly which one is authoritative and how drift would be detected.",
    'Adding a new mutating operation later (e.g. a "freeze wallet" command) should compose with the existing locking and idempotency machinery for free, without special-casing either.',
  ],

  coreEntities: [
    { name: 'Money', description: 'An immutable value type over a long count of minor units (cents) - every debit, credit, and balance comparison is exact integer arithmetic, so rounding can never manufacture or erase a fraction of a cent.' },
    { name: 'Wallet', description: "One user's spendable balance plus the single ReentrantLock every mutation to it must go through - the true unit of mutual exclusion in this design, not the WalletService that orchestrates around it." },
    { name: 'LedgerEntry', description: 'One immutable, append-only fact: this wallet was debited or credited this amount as part of this transaction, leaving this resulting balance - the audit trail that nothing downstream can rewrite.' },
    { name: 'Ledger', description: "The append-only store of every LedgerEntry ever produced, indexed by wallet id for O(1) history lookups, and able to replay a wallet's entries to independently reconstruct its balance for reconciliation." },
    { name: 'Transaction', description: 'The state-carrying record of one command attempt - created PENDING, and guarded to resolve exactly once into COMPLETED or FAILED, carrying the idempotency key that originated it.' },
    { name: 'TransactionResult', description: 'The terminal, client-facing outcome of a Transaction (id, status, message, resulting balance) - this exact object is what gets cached against an idempotency key and replayed verbatim to a retrying client.' },
    { name: 'TransactionCommand (+ Deposit / Withdraw / Transfer)', description: 'The interchangeable, self-contained unit of work for one mutating operation - each concrete command owns the wallet(s), amount, and locking it needs, and exposes a single execute() that any wrapper can call identically regardless of which operation it is.' },
    { name: 'IdempotencyStore', description: 'Maps a client-supplied idempotency key to the in-flight or completed TransactionResult for that key, guaranteeing a command executes at most once no matter how many callers present the same key or how concurrently they arrive.' },
    { name: 'WalletService', description: 'The aggregate root and facade - owns every Wallet and the single shared Ledger and IdempotencyStore, resolves wallet ids to Wallet objects, and is the only entry point client code calls.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Money {
    -long cents
    +add(Money) Money
    +subtract(Money) Money
    +isLessThan(Money) boolean
    +toCents() long
  }
  class Wallet {
    -String id
    -String userId
    -Money balance
    -ReentrantLock lock
    +getBalance() Money
    +getLock() ReentrantLock
    ~credit(Money) void
    ~debit(Money) void
  }
  class LedgerEntryType {
    <<enumeration>>
    DEBIT
    CREDIT
  }
  class LedgerEntry {
    -String entryId
    -String walletId
    -LedgerEntryType type
    -Money amount
    -Money balanceAfter
    -String transactionId
    -Instant createdAt
  }
  class Ledger {
    -Map~String, List~LedgerEntry~~ entriesByWallet
    +append(String, LedgerEntryType, Money, Money, String) LedgerEntry
    +entriesFor(String) List~LedgerEntry~
    +reconstructBalance(String, Money) Money
  }
  class TransactionType {
    <<enumeration>>
    DEPOSIT
    WITHDRAWAL
    TRANSFER
  }
  class TransactionStatus {
    <<enumeration>>
    PENDING
    COMPLETED
    FAILED
  }
  class Transaction {
    -String transactionId
    -TransactionType type
    -String idempotencyKey
    -TransactionStatus status
    -String failureReason
    +markCompleted() void
    +markFailed(String) void
  }
  class TransactionResult {
    -String transactionId
    -TransactionStatus status
    -String message
    -Money resultingBalance
    +completed(String, Money) TransactionResult
    +failed(String, String) TransactionResult
  }
  class TransactionCommand {
    <<interface>>
    +execute() TransactionResult
    +getTransactionId() String
  }
  class DepositCommand {
    -Transaction transaction
    -Wallet wallet
    -Money amount
    -Ledger ledger
    +execute() TransactionResult
  }
  class WithdrawCommand {
    -Transaction transaction
    -Wallet wallet
    -Money amount
    -Ledger ledger
    +execute() TransactionResult
  }
  class TransferCommand {
    -Transaction transaction
    -Wallet from
    -Wallet to
    -Money amount
    -Ledger ledger
    +execute() TransactionResult
  }
  class IdempotencyStore {
    -ConcurrentHashMap~String, CompletableFuture~TransactionResult~~ resultsByKey
    +executeIdempotently(String, Supplier~TransactionResult~) TransactionResult
  }
  class WalletNotFoundException
  class WalletService {
    -Map~String, Wallet~ walletsById
    -Ledger ledger
    -IdempotencyStore idempotencyStore
    +createWallet(String, Money) Wallet
    +deposit(String, Money, String) TransactionResult
    +withdraw(String, Money, String) TransactionResult
    +transfer(String, String, Money, String) TransactionResult
    +balanceOf(String) Money
  }

  TransactionCommand <|.. DepositCommand
  TransactionCommand <|.. WithdrawCommand
  TransactionCommand <|.. TransferCommand
  LedgerEntry o-- LedgerEntryType
  Ledger o-- LedgerEntry
  Transaction o-- TransactionType
  Transaction o-- TransactionStatus
  TransactionResult o-- TransactionStatus
  DepositCommand o-- Wallet
  DepositCommand o-- Transaction
  DepositCommand o-- Ledger
  WithdrawCommand o-- Wallet
  WithdrawCommand o-- Transaction
  WithdrawCommand o-- Ledger
  TransferCommand o-- Wallet
  TransferCommand o-- Transaction
  TransferCommand o-- Ledger
  WalletService o-- Wallet
  WalletService o-- Ledger
  WalletService o-- IdempotencyStore
  WalletService ..> TransactionCommand : builds & executes
  WalletService ..> WalletNotFoundException : throws
  IdempotencyStore ..> TransactionResult : caches`,
  },

  designPatterns: [
    {
      pattern: 'Command',
      where: 'TransactionCommand interface + DepositCommand / WithdrawCommand / TransferCommand',
      why: "Every mutating operation is captured as a self-contained object with a single execute() entry point, so WalletService never branches on operation type, and IdempotencyStore can wrap ANY command's execute() call identically - a command also carries everything needed to log, retry, or (in a fuller system) serialize and replay it.",
    },
    {
      pattern: 'State',
      where: 'Transaction + nested Status enum, guarded by markCompleted()/markFailed()',
      why: 'Encodes the one-way PENDING -> terminal lifecycle directly on the entity, so a bug that tries to resolve the same transaction twice fails loudly with IllegalStateException instead of silently overwriting a COMPLETED outcome with a FAILED one or vice versa.',
    },
    {
      pattern: 'Idempotency Key',
      where: 'IdempotencyStore.executeIdempotently(), wrapping every WalletService mutating call',
      why: 'Not a GoF pattern, but the single non-functional requirement this whole design centers on: a client-supplied key claims a slot atomically via putIfAbsent, so retries - sequential or concurrent - converge on one execution and one cached TransactionResult instead of re-running business logic against balances that may have since moved.',
    },
  ],

  dataStructures: [
    { component: 'Wallet balance + mutual exclusion', structure: 'A single Money field guarded by a per-wallet ReentrantLock (never a global lock)', why: "Serializes every mutation to one wallet without blocking unrelated wallets, and turns the check-then-act sequence \"verify sufficient funds, then debit\" into one atomic step just by holding the lock across both - no CAS retry loop is needed because the whole operation runs inside the critical section." },
    { component: 'Ledger storage', structure: 'ConcurrentHashMap<String, CopyOnWriteArrayList<LedgerEntry>> keyed by walletId', why: "Appends for a given wallet only ever happen while that wallet's lock is already held, so writers are naturally serialized per key; CopyOnWriteArrayList then gives lock-free, snapshot-consistent iteration for balance-reconciliation reads that run concurrently with new appends to other wallets." },
    { component: 'Idempotency result cache', structure: 'ConcurrentHashMap<String, CompletableFuture<TransactionResult>>', why: "putIfAbsent gives an atomic \"claim this key or discover someone already claimed it\" check, and storing a Future (not a raw result) lets every other caller block on join() until the winner's execution actually finishes, instead of racing ahead against a still-empty placeholder." },
    { component: 'Wallet registry', structure: 'ConcurrentHashMap<String, Wallet> keyed by walletId', why: 'O(1) lookup for every operation; since each Wallet is mutated in place under its own lock, the registry map itself only ever needs plain concurrent get/put, never a compute()-style atomic update.' },
  ],

  walkthroughs: [
    {
      title: 'P2P Transfer: Lock Ordering and the Atomic Debit+Credit',
      steps: [
        'Alice (wallet W-1, balance $500.00) wants to send Bob (wallet W-2, balance $100.00) $150.00. The client calls WalletService.transfer("W-1", "W-2", Money.ofCents(15000), "idem-key-1").',
        'WalletService resolves both wallets via requireWallet() up front, failing fast with WalletNotFoundException before the idempotency store is ever touched - a typo\'d wallet id can never occupy a valid idempotency-key slot.',
        'It builds a fresh Transaction (id TXN-1, type TRANSFER, status PENDING) and a TransferCommand wrapping (transaction, from=Alice, to=Bob, amount=$150.00, ledger), then passes command::execute into idempotencyStore.executeIdempotently("idem-key-1", ...).',
        'IdempotencyStore.putIfAbsent("idem-key-1", ownFuture) finds no existing entry, so this call becomes the sole executor and invokes TransferCommand.execute().',
        'TransferCommand computes a fixed lock order by wallet id: "W-1" sorts before "W-2", so it locks Alice\'s wallet first and Bob\'s second - the rule is always "lower id first", never "debtor first", so a simultaneous Bob-to-Alice transfer would request the same two locks in the same order and can never deadlock against this one.',
        "With both locks held, it checks Alice's balance ($500.00) against the $150.00 amount - sufficient - then performs from.debit($150.00) and to.credit($150.00) back to back while still holding both locks, so no other thread can ever observe a moment where Alice's balance has dropped but Bob's has not yet risen.",
        'It appends two LedgerEntry rows tagged with transactionId TXN-1 - DEBIT $150.00 on W-1 (balanceAfter $350.00) and CREDIT $150.00 on W-2 (balanceAfter $250.00) - and only once both the balance mutations and both ledger appends are done does transaction.markCompleted() flip the guarded state to COMPLETED.',
        'Both locks release in reverse acquisition order, TransferCommand returns TransactionResult.completed("TXN-1", $350.00), the future for "idem-key-1" is completed with that result, and the client sees Alice at $350.00 and Bob at $250.00.',
      ],
    },
    {
      title: 'Idempotent Retry Storm vs. the Uncovered Double-Spend Race',
      steps: [
        "The response to Alice's $150.00 transfer above is lost to a network blip. The client, unable to tell whether the request landed, resends the identical call: transfer(\"W-1\", \"W-2\", Money.ofCents(15000), \"idem-key-1\").",
        'WalletService resolves the same two wallets again (a cheap, side-effect-free lookup) and calls idempotencyStore.executeIdempotently("idem-key-1", ...) again - but this time putIfAbsent finds the already-completed future still keyed under "idem-key-1" and returns it via existing.join(), never constructing a new Transaction or invoking TransferCommand at all.',
        "The retry receives the exact same TransactionResult (transactionId TXN-1, COMPLETED, balance $350.00) that the original call produced. Alice is not debited a second time and no second pair of ledger entries appears, even though from the client's perspective this looked like a brand-new request.",
        'Now scale that up: 20 threads fire that identical retry within the same millisecond (an overly aggressive client-side retry loop). The first thread to win the putIfAbsent race installs its own CompletableFuture and becomes the sole executor; the other 19 see a non-null existing future and block on join() - exactly one TransferCommand.execute() runs, and all 20 threads converge on the identical TXN-1 result.',
        'Contrast that with a wallet the idempotency key cannot protect: a fresh "racer" wallet seeded with exactly $50.00, hit by 40 threads each withdrawing $50.00 using 40 DIFFERENT idempotency keys - a genuine concurrent race for the same money, not a retry of the same request.',
        'Every WithdrawCommand.execute() call locks that SAME racer wallet before checking its balance, so the 40 threads serialize on one ReentrantLock: the first to acquire it sees $50.00 >= $50.00, debits down to $0.00, and completes; every later thread now runs strictly after that debit (never concurrently with it), sees $0.00 < $50.00, and returns a FAILED TransactionResult instead of a stack trace or a negative balance.',
        "Exactly one of the 40 threads succeeds and the wallet's final balance is $0.00, never negative - proving overdraft prevention holds purely from the per-wallet lock serializing check-then-act, with no help from (and no need for) request deduplication.",
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Money.java',
      rationale: 'An immutable value type wrapping a single long of minor units (cents) - every other class does currency math and comparison by calling Money, never by touching a raw number or a double.',
      code: `import java.util.Objects;

public final class Money {
    public static final Money ZERO = new Money(0L);

    private final long cents;

    private Money(long cents) {
        this.cents = cents;
    }

    public static Money ofCents(long cents) {
        return new Money(cents);
    }

    public Money add(Money other) {
        return new Money(this.cents + other.cents);
    }

    public Money subtract(Money other) {
        return new Money(this.cents - other.cents);
    }

    public boolean isLessThan(Money other) {
        return this.cents < other.cents;
    }

    public long toCents() {
        return cents;
    }

    @Override
    public String toString() {
        long dollars = Math.abs(cents) / 100;
        long remainder = Math.abs(cents) % 100;
        String sign = cents < 0 ? "-" : "";
        return String.format("%s$%d.%02d", sign, dollars, remainder);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money)) return false;
        return cents == ((Money) o).cents;
    }

    @Override
    public int hashCode() {
        return Objects.hash(cents);
    }
}`,
    },
    {
      filename: 'Wallet.java',
      rationale: "Owns both the balance AND the lock that guards it, so every command that touches this wallet's money goes through the same ReentrantLock - there is no way to mutate the balance without holding it, since credit()/debit() are package-private and only called by commands that already hold the lock.",
      code: `import java.util.concurrent.locks.ReentrantLock;

public final class Wallet {
    private final String id;
    private final String userId;
    private final ReentrantLock lock = new ReentrantLock();
    private Money balance;

    public Wallet(String id, String userId, Money openingBalance) {
        this.id = id;
        this.userId = userId;
        this.balance = openingBalance;
    }

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public Money getBalance() { return balance; }
    public ReentrantLock getLock() { return lock; }

    /** Caller MUST already hold this wallet's lock - there is no internal locking here. */
    void credit(Money amount) {
        this.balance = this.balance.add(amount);
    }

    /** Caller MUST already hold this wallet's lock and have verified sufficient funds. */
    void debit(Money amount) {
        this.balance = this.balance.subtract(amount);
    }

    @Override
    public String toString() {
        return "Wallet{" + id + ", user=" + userId + ", balance=" + balance + "}";
    }
}`,
    },
    {
      filename: 'LedgerEntry.java',
      rationale: 'EntryType is nested since nothing outside the ledger machinery needs it independently. Every field is final - an entry is written once by Ledger.append() and never touched again, which is what "append-only" means in code, not just in a comment.',
      code: `import java.time.Instant;

public final class LedgerEntry {

    public enum EntryType { DEBIT, CREDIT }

    private final String entryId;
    private final String walletId;
    private final EntryType type;
    private final Money amount;
    private final Money balanceAfter;
    private final String transactionId;
    private final Instant createdAt;

    public LedgerEntry(String entryId, String walletId, EntryType type, Money amount,
                        Money balanceAfter, String transactionId, Instant createdAt) {
        this.entryId = entryId;
        this.walletId = walletId;
        this.type = type;
        this.amount = amount;
        this.balanceAfter = balanceAfter;
        this.transactionId = transactionId;
        this.createdAt = createdAt;
    }

    public String getEntryId() { return entryId; }
    public String getWalletId() { return walletId; }
    public EntryType getType() { return type; }
    public Money getAmount() { return amount; }
    public Money getBalanceAfter() { return balanceAfter; }
    public String getTransactionId() { return transactionId; }
    public Instant getCreatedAt() { return createdAt; }

    @Override
    public String toString() {
        return type + " " + amount + " on wallet " + walletId + " (txn=" + transactionId + ", balanceAfter=" + balanceAfter + ")";
    }
}`,
    },
    {
      filename: 'Ledger.java',
      rationale: "The single append-only store for every wallet's history. reconstructBalance() is deliberately NOT on the hot path - it exists so an offline reconciliation job can prove the denormalized Wallet.balance never drifted from what the ledger actually recorded, which is the tradeoff this design makes: fast O(1) balance reads day-to-day, with an independent, if slower, way to audit that number.",
      code: `import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

public final class Ledger {
    private final Map<String, List<LedgerEntry>> entriesByWallet = new ConcurrentHashMap<>();
    private final AtomicLong entrySequence = new AtomicLong();

    /** Appends one immutable entry for a wallet - never mutates or removes an existing one. */
    public LedgerEntry append(String walletId, LedgerEntry.EntryType type, Money amount, Money balanceAfter, String transactionId) {
        LedgerEntry entry = new LedgerEntry(
                "LE-" + entrySequence.incrementAndGet(), walletId, type, amount, balanceAfter, transactionId, Instant.now());
        entriesByWallet.computeIfAbsent(walletId, k -> new CopyOnWriteArrayList<>()).add(entry);
        return entry;
    }

    public List<LedgerEntry> entriesFor(String walletId) {
        return entriesByWallet.getOrDefault(walletId, List.of());
    }

    /**
     * Reconstructs a wallet's balance purely by replaying its ledger entries in order - used
     * for offline reconciliation/audit, NOT on the hot path. If this ever disagrees with
     * Wallet.getBalance(), the live balance drifted from the ledger, which should be
     * structurally impossible since both are only ever mutated together inside the same
     * wallet-lock critical section.
     */
    public Money reconstructBalance(String walletId, Money openingBalance) {
        Money balance = openingBalance;
        for (LedgerEntry entry : entriesFor(walletId)) {
            balance = entry.getType() == LedgerEntry.EntryType.CREDIT
                    ? balance.add(entry.getAmount())
                    : balance.subtract(entry.getAmount());
        }
        return balance;
    }
}`,
    },
    {
      filename: 'Transaction.java',
      calloutTitle: '💡 State Pattern - a resolution can only happen once',
      callout:
        'markCompleted() and markFailed() both call requirePending() first, so a Transaction can only ever leave PENDING exactly one time. This is not decorative: it is the guard that would catch a bug where a retried or duplicated call path tried to resolve the same transaction object twice - it fails loudly with IllegalStateException instead of silently flipping a COMPLETED outcome to FAILED (or the reverse) and corrupting the audit trail.',
      rationale: 'Type and Status are nested enums - nothing outside the transaction machinery needs them independently, mirroring how Reservation nests its own status in the restaurant-booking design.',
      code: `import java.time.Instant;

public final class Transaction {

    public enum Type { DEPOSIT, WITHDRAWAL, TRANSFER }
    public enum Status { PENDING, COMPLETED, FAILED }

    private final String transactionId;
    private final Type type;
    private final String idempotencyKey;
    private final Instant createdAt;
    private Status status;
    private String failureReason;
    private Instant completedAt;

    public Transaction(String transactionId, Type type, String idempotencyKey) {
        this.transactionId = transactionId;
        this.type = type;
        this.idempotencyKey = idempotencyKey;
        this.createdAt = Instant.now();
        this.status = Status.PENDING;
    }

    public void markCompleted() {
        requirePending();
        this.status = Status.COMPLETED;
        this.completedAt = Instant.now();
    }

    public void markFailed(String reason) {
        requirePending();
        this.status = Status.FAILED;
        this.failureReason = reason;
        this.completedAt = Instant.now();
    }

    private void requirePending() {
        if (status != Status.PENDING) {
            throw new IllegalStateException("Transaction " + transactionId + " already resolved as " + status);
        }
    }

    public String getTransactionId() { return transactionId; }
    public Type getType() { return type; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public Status getStatus() { return status; }
    public String getFailureReason() { return failureReason; }
    public Instant getCreatedAt() { return createdAt; }
}`,
    },
    {
      filename: 'TransactionResult.java',
      rationale: 'The one object that ever leaves WalletService for a mutating call, and the one object IdempotencyStore caches - static factories keep FAILED results (like insufficient funds) from ever accidentally carrying a stale resultingBalance.',
      code: `public final class TransactionResult {
    private final String transactionId;
    private final Transaction.Status status;
    private final String message;
    private final Money resultingBalance;

    private TransactionResult(String transactionId, Transaction.Status status, String message, Money resultingBalance) {
        this.transactionId = transactionId;
        this.status = status;
        this.message = message;
        this.resultingBalance = resultingBalance;
    }

    public static TransactionResult completed(String transactionId, Money resultingBalance) {
        return new TransactionResult(transactionId, Transaction.Status.COMPLETED, "OK", resultingBalance);
    }

    public static TransactionResult failed(String transactionId, String message) {
        return new TransactionResult(transactionId, Transaction.Status.FAILED, message, null);
    }

    public String getTransactionId() { return transactionId; }
    public Transaction.Status getStatus() { return status; }
    public String getMessage() { return message; }
    public Money getResultingBalance() { return resultingBalance; }

    @Override
    public String toString() {
        String balancePart = resultingBalance != null ? " balance=" + resultingBalance : "";
        return status + " txn=" + transactionId + balancePart + " (" + message + ")";
    }
}`,
    },
    {
      filename: 'TransactionCommand.java',
      calloutTitle: '💡 Command Pattern',
      callout:
        'This one-method interface is why IdempotencyStore never needs to know whether it is protecting a deposit, a withdrawal, or a transfer - it only ever calls command::execute. Each concrete command is a self-contained unit of work that already knows every wallet, amount, and lock it needs, which is exactly what lets the exact same wrapping logic (executeIdempotently) apply uniformly to all three operations.',
      rationale: 'Deliberately minimal - a real system could add serialize()/replay() to this interface for a durable command log without touching any implementation that does not need it yet.',
      code: `public interface TransactionCommand {
    /** Performs the operation exactly once per call - callers needing at-most-once semantics across retries wrap this in IdempotencyStore. */
    TransactionResult execute();

    String getTransactionId();
}`,
    },
    {
      filename: 'DepositCommand.java',
      rationale: "The simplest command - a deposit can never overdraw anything, so it only needs to hold one wallet's lock, credit it, append a single ledger entry, and resolve the transaction.",
      code: `public final class DepositCommand implements TransactionCommand {
    private final Transaction transaction;
    private final Wallet wallet;
    private final Money amount;
    private final Ledger ledger;

    public DepositCommand(Transaction transaction, Wallet wallet, Money amount, Ledger ledger) {
        this.transaction = transaction;
        this.wallet = wallet;
        this.amount = amount;
        this.ledger = ledger;
    }

    @Override
    public TransactionResult execute() {
        wallet.getLock().lock();
        try {
            wallet.credit(amount);
            ledger.append(wallet.getId(), LedgerEntry.EntryType.CREDIT, amount, wallet.getBalance(), transaction.getTransactionId());
            transaction.markCompleted();
            return TransactionResult.completed(transaction.getTransactionId(), wallet.getBalance());
        } finally {
            wallet.getLock().unlock();
        }
    }

    @Override
    public String getTransactionId() { return transaction.getTransactionId(); }
}`,
    },
    {
      filename: 'WithdrawCommand.java',
      rationale: 'The balance check and the debit happen while the SAME lock acquisition is held, which is what makes "verify funds, then subtract" atomic - two WithdrawCommands racing on this wallet are forced to run this whole block one at a time, never interleaved.',
      code: `public final class WithdrawCommand implements TransactionCommand {
    private final Transaction transaction;
    private final Wallet wallet;
    private final Money amount;
    private final Ledger ledger;

    public WithdrawCommand(Transaction transaction, Wallet wallet, Money amount, Ledger ledger) {
        this.transaction = transaction;
        this.wallet = wallet;
        this.amount = amount;
        this.ledger = ledger;
    }

    @Override
    public TransactionResult execute() {
        wallet.getLock().lock();
        try {
            if (wallet.getBalance().isLessThan(amount)) {
                transaction.markFailed("Insufficient funds: balance " + wallet.getBalance() + " < requested " + amount);
                return TransactionResult.failed(transaction.getTransactionId(), transaction.getFailureReason());
            }
            wallet.debit(amount);
            ledger.append(wallet.getId(), LedgerEntry.EntryType.DEBIT, amount, wallet.getBalance(), transaction.getTransactionId());
            transaction.markCompleted();
            return TransactionResult.completed(transaction.getTransactionId(), wallet.getBalance());
        } finally {
            wallet.getLock().unlock();
        }
    }

    @Override
    public String getTransactionId() { return transaction.getTransactionId(); }
}`,
    },
    {
      filename: 'TransferCommand.java',
      calloutTitle: '💡 Lock ordering: atomic two-wallet transfer without deadlock',
      callout:
        "Locks are acquired in a fixed order derived from wallet id - never \"from first, to second\" - so no matter which of two wallets is the payer, every transfer between that same pair requests the locks in the identical order and can never form a cycle of threads each waiting on the other's lock. Debit and credit then happen while BOTH locks are held, so a failure (insufficient funds) is caught before either wallet is touched, and a success updates both wallets and both ledger entries as one indivisible unit - there is no intermediate state to compensate for, because nothing partial is ever visible.",
      rationale: 'The most concurrency-critical file in the design - it is the only command that must coordinate two independent locks correctly.',
      code: `public final class TransferCommand implements TransactionCommand {
    private final Transaction transaction;
    private final Wallet from;
    private final Wallet to;
    private final Money amount;
    private final Ledger ledger;

    public TransferCommand(Transaction transaction, Wallet from, Wallet to, Money amount, Ledger ledger) {
        this.transaction = transaction;
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.ledger = ledger;
    }

    @Override
    public TransactionResult execute() {
        // Always lock in a total order based on wallet id - regardless of which side of the
        // transfer a wallet is on - so two transfers moving money in opposite directions
        // between the same pair of wallets can never deadlock waiting on each other.
        Wallet first = from.getId().compareTo(to.getId()) <= 0 ? from : to;
        Wallet second = (first == from) ? to : from;

        first.getLock().lock();
        try {
            second.getLock().lock();
            try {
                if (from.getBalance().isLessThan(amount)) {
                    transaction.markFailed("Insufficient funds in " + from.getId() + ": balance " + from.getBalance() + " < " + amount);
                    return TransactionResult.failed(transaction.getTransactionId(), transaction.getFailureReason());
                }
                // Both locks are held for the entire debit+credit+ledger sequence, so no other
                // thread can ever observe money that has left "from" but not yet reached "to".
                from.debit(amount);
                to.credit(amount);
                ledger.append(from.getId(), LedgerEntry.EntryType.DEBIT, amount, from.getBalance(), transaction.getTransactionId());
                ledger.append(to.getId(), LedgerEntry.EntryType.CREDIT, amount, to.getBalance(), transaction.getTransactionId());
                transaction.markCompleted();
                return TransactionResult.completed(transaction.getTransactionId(), from.getBalance());
            } finally {
                second.getLock().unlock();
            }
        } finally {
            first.getLock().unlock();
        }
    }

    @Override
    public String getTransactionId() { return transaction.getTransactionId(); }
}`,
    },
    {
      filename: 'IdempotencyStore.java',
      calloutTitle: '💡 Idempotency-Key Pattern: claim-or-join',
      callout:
        "putIfAbsent is the entire trick: exactly one caller ever installs a fresh CompletableFuture for a given key and becomes the executor, while every other caller - whether it arrives mid-flight a millisecond later or as a full retry after the original response was lost - gets the SAME future back and blocks on join() until it resolves. Crucially, a normal business failure like insufficient funds is returned as a FAILED TransactionResult (not thrown), so it gets cached and replayed just like a success - a retry must see the identical decision the first attempt made, not a fresh re-evaluation against a balance that has since changed. Only a genuinely unexpected exception removes the key, so a real retry is still possible after a crash.",
      rationale: 'Kept generic over Supplier<TransactionResult> so it can wrap a deposit, a withdrawal, or a transfer identically - it has no idea which TransactionCommand it is protecting.',
      code: `import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

public final class IdempotencyStore {
    private final ConcurrentHashMap<String, CompletableFuture<TransactionResult>> resultsByKey = new ConcurrentHashMap<>();

    /**
     * Runs {@code operation} at most once per idempotencyKey, no matter how many times or
     * how concurrently callers retry with the same key. The first caller to claim the key
     * runs the real operation; every other caller blocks on and then receives the exact same
     * TransactionResult instead of re-executing.
     */
    public TransactionResult executeIdempotently(String idempotencyKey, Supplier<TransactionResult> operation) {
        CompletableFuture<TransactionResult> ownFuture = new CompletableFuture<>();
        CompletableFuture<TransactionResult> existing = resultsByKey.putIfAbsent(idempotencyKey, ownFuture);
        if (existing != null) {
            return existing.join();
        }
        try {
            TransactionResult result = operation.get();
            ownFuture.complete(result);
            return result;
        } catch (RuntimeException e) {
            // An unexpected crash mid-execution (not a normal business failure like insufficient
            // funds, which is returned as a FAILED TransactionResult, not thrown) must not
            // permanently poison this key - remove it so a legitimate retry can run.
            resultsByKey.remove(idempotencyKey, ownFuture);
            ownFuture.completeExceptionally(e);
            throw e;
        }
    }
}`,
    },
    {
      filename: 'WalletNotFoundException.java',
      rationale: 'An unchecked business exception raised while resolving wallet ids, deliberately BEFORE the idempotency store is touched - an unknown wallet id never claims an idempotency-key slot.',
      code: `public final class WalletNotFoundException extends RuntimeException {
    public WalletNotFoundException(String walletId) {
        super("No wallet with id " + walletId);
    }
}`,
    },
    {
      filename: 'WalletService.java',
      rationale: 'The aggregate root and facade. It resolves ids to Wallet objects and builds the right TransactionCommand for the operation, then hands execution to IdempotencyStore - it never locks anything itself, and it never contains an if/else on "which operation is this" beyond picking which Command subclass to construct.',
      code: `import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public final class WalletService {
    private final Map<String, Wallet> walletsById = new ConcurrentHashMap<>();
    private final Ledger ledger = new Ledger();
    private final IdempotencyStore idempotencyStore = new IdempotencyStore();
    private final AtomicLong walletSequence = new AtomicLong();
    private final AtomicLong transactionSequence = new AtomicLong();

    public Wallet createWallet(String userId, Money openingBalance) {
        Wallet wallet = new Wallet("W-" + walletSequence.incrementAndGet(), userId, openingBalance);
        walletsById.put(wallet.getId(), wallet);
        return wallet;
    }

    public TransactionResult deposit(String walletId, Money amount, String idempotencyKey) {
        Wallet wallet = requireWallet(walletId);
        return idempotencyStore.executeIdempotently(idempotencyKey, () -> {
            Transaction transaction = new Transaction(nextTransactionId(), Transaction.Type.DEPOSIT, idempotencyKey);
            return new DepositCommand(transaction, wallet, amount, ledger).execute();
        });
    }

    public TransactionResult withdraw(String walletId, Money amount, String idempotencyKey) {
        Wallet wallet = requireWallet(walletId);
        return idempotencyStore.executeIdempotently(idempotencyKey, () -> {
            Transaction transaction = new Transaction(nextTransactionId(), Transaction.Type.WITHDRAWAL, idempotencyKey);
            return new WithdrawCommand(transaction, wallet, amount, ledger).execute();
        });
    }

    public TransactionResult transfer(String fromWalletId, String toWalletId, Money amount, String idempotencyKey) {
        if (fromWalletId.equals(toWalletId)) {
            throw new IllegalArgumentException("Cannot transfer a wallet to itself");
        }
        Wallet from = requireWallet(fromWalletId);
        Wallet to = requireWallet(toWalletId);
        return idempotencyStore.executeIdempotently(idempotencyKey, () -> {
            Transaction transaction = new Transaction(nextTransactionId(), Transaction.Type.TRANSFER, idempotencyKey);
            return new TransferCommand(transaction, from, to, amount, ledger).execute();
        });
    }

    public Money balanceOf(String walletId) {
        return requireWallet(walletId).getBalance();
    }

    public Ledger getLedger() { return ledger; }

    private Wallet requireWallet(String walletId) {
        Wallet wallet = walletsById.get(walletId);
        if (wallet == null) {
            throw new WalletNotFoundException(walletId);
        }
        return wallet;
    }

    private String nextTransactionId() {
        return "TXN-" + transactionSequence.incrementAndGet();
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy-path P2P transfer with real numbers, an idempotent retry that must not double-debit, an overdraft rejection, and - since both idempotent-retry safety and overdraft safety are stated non-functional requirements - two concurrency stress tests: a 20-thread retry storm proving exactly one execution per idempotency key, and a 40-thread race with 40 DIFFERENT keys proving the per-wallet lock alone prevents a negative balance.',
      code: `import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public final class Demo {
    public static void main(String[] args) throws Exception {
        WalletService service = new WalletService();
        Wallet alice = service.createWallet("alice", Money.ofCents(50_000)); // $500.00
        Wallet bob = service.createWallet("bob", Money.ofCents(10_000));     // $100.00

        // --- Happy path: P2P transfer ---
        TransactionResult t1 = service.transfer(alice.getId(), bob.getId(), Money.ofCents(15_000), "idem-key-1");
        System.out.println("Transfer 1: " + t1);
        System.out.println("Alice: " + service.balanceOf(alice.getId()) + ", Bob: " + service.balanceOf(bob.getId()));

        // --- Idempotent retry: client resends the SAME request (e.g. after a lost response) ---
        TransactionResult retry = service.transfer(alice.getId(), bob.getId(), Money.ofCents(15_000), "idem-key-1");
        System.out.println("Retry returns identical transaction id: " + retry.getTransactionId().equals(t1.getTransactionId()));
        System.out.println("Alice balance after retry (must be unchanged): " + service.balanceOf(alice.getId()));

        // --- Overdraft prevention ---
        TransactionResult overdraft = service.transfer(bob.getId(), alice.getId(), Money.ofCents(1_000_000), "idem-key-2");
        System.out.println("Overdraft attempt: " + overdraft);

        // --- Concurrency stress test #1: idempotency under a concurrent retry storm ---
        // 20 threads all submit the SAME transfer + SAME idempotency key at once, simulating
        // a client that fires several retries in parallel after a slow or ambiguous response.
        ExecutorService pool = Executors.newFixedThreadPool(20);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch doneGate = new CountDownLatch(20);
        ConcurrentHashMap<String, Boolean> distinctTransactionIds = new ConcurrentHashMap<>();
        for (int i = 0; i < 20; i++) {
            pool.submit(() -> {
                try {
                    startGate.await();
                    TransactionResult r = service.transfer(alice.getId(), bob.getId(), Money.ofCents(500), "idem-key-storm");
                    distinctTransactionIds.put(r.getTransactionId(), true);
                } catch (InterruptedException ignored) {
                } finally {
                    doneGate.countDown();
                }
            });
        }
        startGate.countDown();
        doneGate.await();
        System.out.println("Distinct transaction ids from 20 concurrent retries: " + distinctTransactionIds.size() + " (expected 1)");

        // --- Concurrency stress test #2: the classic double-spend race, with NO idempotency help ---
        // A fresh wallet holds exactly enough for ONE withdrawal of $50.00; 40 threads race to
        // withdraw $50.00 at once using DIFFERENT idempotency keys, isolating whether overdraft
        // prevention itself (not idempotency) is race-free.
        Wallet racer = service.createWallet("racer", Money.ofCents(5_000));
        ExecutorService pool2 = Executors.newFixedThreadPool(40);
        AtomicInteger successCount = new AtomicInteger();
        CountDownLatch doneGate2 = new CountDownLatch(40);
        for (int i = 0; i < 40; i++) {
            final String key = "racer-withdraw-" + i;
            pool2.submit(() -> {
                try {
                    TransactionResult r = service.withdraw(racer.getId(), Money.ofCents(5_000), key);
                    if (r.getStatus() == Transaction.Status.COMPLETED) {
                        successCount.incrementAndGet();
                    }
                } finally {
                    doneGate2.countDown();
                }
            });
        }
        doneGate2.await();
        pool.shutdown();
        pool2.shutdown();
        System.out.println("Threads that won the $50.00 withdrawal: " + successCount.get() + " (expected 1)");
        System.out.println("Racer wallet final balance: " + service.balanceOf(racer.getId()) + " (must never go negative)");
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Transaction Resolution Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> PENDING: Command constructed with a fresh Transaction
  PENDING --> COMPLETED: execute() succeeds (funds sufficient, mutation + ledger append applied)
  PENDING --> FAILED: execute() rejects (insufficient funds) - no mutation was applied
  COMPLETED --> [*]
  FAILED --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Idempotent P2P Transfer',
    mermaid: `sequenceDiagram
  autonumber
  participant Client
  participant Service as WalletService
  participant Idem as IdempotencyStore
  participant Cmd as TransferCommand
  participant From as Wallet(from)
  participant To as Wallet(to)
  participant Ledger

  Client->>Service: transfer(fromId, toId, amount, idempotencyKey)
  Service->>Service: requireWallet(fromId), requireWallet(toId)
  Service->>Idem: executeIdempotently(idempotencyKey, command::execute)
  alt key already claimed by an earlier or in-flight call
    Idem-->>Service: cached / joined TransactionResult
  else first execution for this key
    Idem->>Cmd: execute()
    Cmd->>From: lock() - lower wallet id first
    Cmd->>To: lock() - higher wallet id second
    Cmd->>From: getBalance() >= amount ?
    Cmd->>From: debit(amount)
    Cmd->>To: credit(amount)
    Cmd->>Ledger: append(DEBIT, from, txnId)
    Cmd->>Ledger: append(CREDIT, to, txnId)
    Cmd->>Cmd: transaction.markCompleted()
    Cmd->>To: unlock()
    Cmd->>From: unlock()
    Cmd-->>Idem: TransactionResult
    Idem-->>Service: TransactionResult
  end
  Service-->>Client: TransactionResult`,
  },

  extensions: [
    { extension: 'Durable, restart-safe idempotency store', implementation: 'Back IdempotencyStore with a database table (idempotency_key UNIQUE, transaction_id, result_json, expires_at) instead of an in-memory ConcurrentHashMap, using a unique-constraint INSERT as the equivalent of putIfAbsent, so a service restart mid-retry-window still enforces at-most-once.' },
    { extension: 'Reserve-then-commit for marketplace escrow', implementation: 'For a checkout flow that needs to hold funds before a seller ships, add a two-phase Hold (debit into a pending/escrow bucket) followed by a separate confirm/release step - the same hold-then-confirm shape used for tables in restaurant-booking, applied to money instead of seats.' },
    { extension: 'Multi-currency wallets', implementation: 'Add a currency code to Money, reject arithmetic between mismatched currencies, and require TransferCommand to convert via a pluggable ExchangeRateProvider before debiting/crediting - conceptually the same Strategy seam splitwise uses for split calculation.' },
    { extension: 'Sharded / distributed wallet service', implementation: 'Partition wallets by id hash across nodes; a transfer whose two wallets land on different shards can no longer use in-process lock ordering and instead needs a saga or transactional-outbox pattern (reserve on shard A, confirm on shard B, compensate A on failure).' },
    { extension: 'Fraud and velocity limits', implementation: 'Wrap TransactionCommand.execute() with a decorator that consults a rolling per-wallet transaction-count/amount window (backed by the same Ledger) before delegating to the real command - adding a limit never touches DepositCommand, WithdrawCommand, or TransferCommand.' },
    { extension: 'Idempotency-key expiry', implementation: "Attach a TTL to each IdempotencyStore entry (e.g. 24 hours) so a client that legitimately wants to run the identical operation again next week is not permanently blocked by an old key it happens to reuse." },
  ],

  interviewerChecklist: [
    'Does the candidate treat idempotency as a first-class requirement with its own data structure, rather than a comment like "TODO: dedupe requests"?',
    'Is the idempotency claim itself atomic (putIfAbsent / unique-constraint-style), and do concurrent callers with the same key block on the same in-flight result instead of racing to execute twice?',
    'Is overdraft prevention analyzed as a genuine multi-threaded race (two debits at once), not just a single-threaded "if balance >= amount" check?',
    'Does a P2P transfer touch both wallets as one atomic unit - lock ordering or a two-phase reserve/commit - and can the candidate explain WHY a fixed lock order (not "debtor first") prevents deadlock?',
    'Is the ledger append tied to the same atomic unit (same lock, same critical section) as the balance mutation, or could the two ever legitimately disagree?',
    'Does the candidate distinguish a business failure (insufficient funds - expected, and safe to cache under an idempotency key) from an unexpected exception (should not permanently poison that key)?',
  ],

  relatedDesigns: ['splitwise', 'restaurant-booking'],
  keyTakeaways: [
    'Idempotency is not "check whether this already happened" bolted on afterward - it must own the whole request lifecycle: claim-or-join on the key BEFORE running business logic, and cache the terminal result (including expected failures like insufficient funds) so a retry can never be re-evaluated against a balance that has since moved.',
    'Overdraft prevention is a mutual-exclusion problem scoped to one wallet, not a validation problem - a ReentrantLock per wallet turns "check balance, then debit" into a single atomic step, the same guarantee ConcurrentHashMap.compute() gives per-key in a map-based design like restaurant-booking.',
    'A transfer touches two locks; deadlock-freedom comes from every transfer agreeing on one deterministic order (by wallet id) to acquire them in, not from avoiding locks altogether.',
    'Keeping a denormalized balance alongside an append-only ledger is a real tradeoff: O(1) balance reads plus a full audit trail, at the cost of a strict discipline that the balance may only ever change inside the same locked critical section as its matching ledger append - reconstructBalance() exists specifically to catch a violation of that rule.',
    'Command decouples "what operation is this" from "how do we guarantee it only happens once" - IdempotencyStore.executeIdempotently() wraps a deposit, a withdrawal, or a transfer identically, because each is just a TransactionCommand with one execute() method.',
  ],
}

export default problem

import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'splitwise',
  title: 'Splitwise',
  difficulty: 'Intermediate',
  icon: 'pi pi-users',
  color: '#8b5cf6',
  readTimeMinutes: 15,
  patterns: ['Strategy', 'Facade', 'Value Object'],
  companies: ['Splitwise', 'PhonePe', 'CRED', 'Google'],
  summary:
    'An expense-splitting ledger that divides a bill equally, by exact amounts, or by percentage - always summing to the cent - and nets every pairwise debt down to a single "who owes whom" balance.',

  functionalRequirements: [
    'Add users to a group and record an expense: a payer, a total amount, and a set of participants who share it.',
    'Support at least three split strategies selectable per expense: equal split, exact-amount split, and percentage split.',
    'Equal splits must divide the total exactly, deterministically allocating any leftover cent(s) instead of losing them to rounding.',
    'Exact splits must be rejected up front if the provided per-participant amounts do not sum to the expense total.',
    'Percentage splits must be rejected up front if the provided percentages do not sum to exactly 100%, and must use exact remainder handling like equal splits.',
    'Maintain a running balance between every pair of users that reflects all recorded expenses, netting opposing debts into one number.',
    'Report a simplified "who owes whom" summary for one user or for the whole group at any time.',
  ],
  nonFunctionalRequirements: [
    'All money must be represented in integer minor units (cents) behind an immutable Money type - never a double/float - so thousands of splits never drift from the true total.',
    'Recording a split must update the ledger in O(1) - a balance query must never replay the full expense history.',
    'Adding a new split strategy must not require changes to Expense, BalanceSheet, or any existing SplitStrategy implementation (open/closed principle).',
    'Ledger updates must be safe under concurrent expense creation - two expenses recorded at once must never corrupt or lose a balance.',
  ],

  coreEntities: [
    { name: 'User', description: 'A person in the group - just an id and a display name; every other entity references it by identity.' },
    { name: 'Money', description: 'An immutable value type wrapping a long count of minor units (cents) - the only object allowed to do arithmetic on currency.' },
    { name: 'Split', description: "One participant's computed share of an expense - who owes it, and how much, expressed as Money." },
    { name: 'SplitStrategy (+ Equal / Exact / Percent)', description: "The interchangeable algorithm that turns an expense's total and participants into a List<Split> that sums exactly to the total." },
    { name: 'Expense', description: 'One bill: payer, total amount, participants, the strategy to apply, and any per-participant inputs that strategy needs (exact cents or basis points).' },
    { name: 'BalanceSheet (Ledger)', description: 'Nets every recorded debt into a single signed balance per (debtor, creditor) pair and answers "who owes whom".' },
    { name: 'ExpenseGroup', description: "The aggregate root and facade - owns the group's users, its expenses, and its BalanceSheet, and is the only entry point callers use." },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Money {
    -long cents
    +add(Money) Money
    +subtract(Money) Money
    +negate() Money
    +toCents() long
  }
  class User {
    -String id
    -String name
  }
  class Split {
    -User participant
    -Money amount
  }
  class SplitStrategy {
    <<interface>>
    +computeSplits(Expense) List~Split~
  }
  class EqualSplitStrategy {
    +computeSplits(Expense) List~Split~
  }
  class ExactSplitStrategy {
    +computeSplits(Expense) List~Split~
  }
  class PercentSplitStrategy {
    +computeSplits(Expense) List~Split~
  }
  class Expense {
    -String id
    -User payer
    -Money totalAmount
    -List~User~ participants
    -SplitStrategy splitStrategy
    -Map~User, Long~ splitInputs
    +getSplits() List~Split~
  }
  class BalanceSheet {
    -Map~String, Map~String, BigDecimal~~ balances
    +recordDebt(User, User, Money) void
    +balanceOf(User, User) Money
    +debtsOwedBy(User) Map~String, BigDecimal~
  }
  class ExpenseGroup {
    -Map~String, User~ users
    -List~Expense~ expenses
    -BalanceSheet balanceSheet
    +addUser(User) void
    +addExpense(User, Money, List~User~, SplitStrategy, Map~User, Long~) Expense
  }

  SplitStrategy <|.. EqualSplitStrategy
  SplitStrategy <|.. ExactSplitStrategy
  SplitStrategy <|.. PercentSplitStrategy
  Expense o-- SplitStrategy
  Expense o-- User
  Expense o-- Money
  Expense ..> Split : produces
  Split o-- User
  Split o-- Money
  ExpenseGroup o-- Expense
  ExpenseGroup o-- User
  ExpenseGroup o-- BalanceSheet
  BalanceSheet ..> User : keyed by id`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'SplitStrategy + EqualSplitStrategy / ExactSplitStrategy / PercentSplitStrategy', why: 'Expense.getSplits() delegates the actual split math to whichever strategy was attached at creation - adding a new rule (e.g. "by shares") never touches Expense or BalanceSheet.' },
    { pattern: 'Value Object', where: 'Money', why: 'Wrapping cents in an immutable, self-arithmetic type makes "never use double for money" a compiler-enforced rule instead of a code-review reminder.' },
    { pattern: 'Facade', where: 'ExpenseGroup', why: 'Callers only ever talk to ExpenseGroup (add a user, add an expense, read the balance sheet) - it hides the Expense / SplitStrategy / BalanceSheet wiring behind three methods.' },
  ],

  dataStructures: [
    { component: 'Pairwise net balances', structure: 'Map<String, Map<String, BigDecimal>> keyed by debtor id then creditor id, values in whole cents', why: 'O(1) lookup and update for exactly the (debtor, creditor) pair touched by a new split - no scan of a transaction log, and BigDecimal here holds an exact integer cent value rather than a rounded decimal.' },
    { component: 'Money amounts', structure: 'An immutable value type wrapping a single long of cents', why: 'Long arithmetic on cents is exact; a double would silently accumulate rounding error over thousands of expenses.' },
    { component: "An expense's computed shares", structure: 'A cached List<Split>, computed once by the SplitStrategy and memoized on the Expense', why: 'Keeps a per-expense audit trail so any balance can be explained (or recomputed) from its source splits.' },
  ],

  walkthroughs: [
    {
      title: "Equal Split That Doesn't Divide Evenly",
      steps: [
        'ExpenseGroup.addExpense() is called with a $100.00 (10000-cent) dinner, payer Alice, and participants [Alice, Bob, Charlie], strategy EqualSplitStrategy.',
        'Expense.getSplits() calls EqualSplitStrategy.computeSplits(expense), which computes baseShare = 10000 / 3 = 3333 (integer division) and remainder = 10000 % 3 = 1.',
        'It walks participants in order, giving the first `remainder` participants one extra cent: Alice -> 3334, Bob -> 3333, Charlie -> 3333 - the three splits sum to exactly 10000, never 9999 or 10001.',
        'Expense caches the resulting List<Split> and returns it to ExpenseGroup.',
        'ExpenseGroup skips the split belonging to the payer (Alice) and calls balanceSheet.recordDebt() once for each other participant: Bob owes Alice 3333, Charlie owes Alice 3333.',
        'BalanceSheet stores each debt as a fresh entry since no reverse debt exists yet for either pair.',
      ],
    },
    {
      title: 'Percent Split, Validation, and Netting',
      steps: [
        'A later taxi expense: Charlie pays $50.00 (5000 cents), participants [Charlie, Diana, Alice], with basis points 3334/3333/3333 (33.34% + 33.33% + 33.33% = 100.00% exactly).',
        'PercentSplitStrategy.computeSplits() first sums the basis points; if the sum is not exactly 10000 it throws IllegalArgumentException immediately - the ledger is never touched by an invalid split.',
        'Each share is computed as (totalCents * bp) / 10000 with integer truncation, then any cents lost to truncation are handed to the first N participants in order - the same remainder rule as EqualSplitStrategy.',
        'ExpenseGroup records Diana -> Charlie and Alice -> Charlie debts. But Alice already had a *reverse* debt on the books: Charlie owed Alice 3333 cents from the earlier dinner.',
        'BalanceSheet.recordDebt(Alice, Charlie, 1666) reads both directions for that pair, nets 3333 (Charlie owes Alice) against the new 1666 (Alice owes Charlie), and collapses them into one entry: Charlie owes Alice 1667.',
        'A balance query for that pair now returns a single signed number instead of two contradictory entries - the ledger never has to add two directions together at read time.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Money.java',
      calloutTitle: '💡 Never use double for money',
      callout:
        'Money stores a single long of minor units (cents). add/subtract are exact integer operations - there is no IEEE-754 rounding hazard, and no caller can accidentally multiply a currency value by a floating-point percentage.',
      rationale: 'Immutable and self-contained: every other class does currency math by calling Money, never by touching a raw number.',
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

    public Money negate() {
        return new Money(-this.cents);
    }

    public boolean isZero() {
        return cents == 0;
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
      filename: 'User.java',
      rationale: 'A plain identity-based value - equality is by id so the same user can be looked up consistently across Expense participant lists and the BalanceSheet.',
      code: `import java.util.Objects;

public final class User {
    private final String id;
    private final String name;

    public User(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public String getId() { return id; }
    public String getName() { return name; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof User)) return false;
        return id.equals(((User) o).id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() { return name; }
}`,
    },
    {
      filename: 'Split.java',
      rationale: 'The output of a SplitStrategy - deliberately dumb, it just pairs a participant with the Money they owe for one expense.',
      code: `public final class Split {
    private final User participant;
    private final Money amount;

    public Split(User participant, Money amount) {
        this.participant = participant;
        this.amount = amount;
    }

    public User getParticipant() { return participant; }
    public Money getAmount() { return amount; }
}`,
    },
    {
      filename: 'SplitStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This one-method interface is the entire reason Expense never needs an if/else on "which kind of split is this". Any class that can turn an Expense into a List<Split> can be swapped in - including a future SharesSplitStrategy - without Expense or BalanceSheet changing at all.',
      rationale: 'Takes the whole Expense (not just a total) so implementations have access to participants, the payer, and any strategy-specific inputs attached to the expense.',
      code: `import java.util.List;

public interface SplitStrategy {
    List<Split> computeSplits(Expense expense);
}`,
    },
    {
      filename: 'EqualSplitStrategy.java',
      calloutTitle: '💡 Exact remainder handling',
      callout:
        'total / n loses cents to integer truncation whenever the total is not evenly divisible. Instead of ignoring that, the strategy computes the remainder explicitly and hands one extra cent to each of the first `remainder` participants (in expense order) - the splits always sum EXACTLY to the total, never a cent short or over.',
      rationale: 'No strategy-specific inputs needed - every participant just gets an equal share of whatever is left after remainder distribution.',
      code: `import java.util.ArrayList;
import java.util.List;

public final class EqualSplitStrategy implements SplitStrategy {

    @Override
    public List<Split> computeSplits(Expense expense) {
        List<User> participants = expense.getParticipants();
        int n = participants.size();
        if (n == 0) {
            throw new IllegalArgumentException("An expense needs at least one participant");
        }

        long totalCents = expense.getTotalAmount().toCents();
        long baseShare = totalCents / n;
        long remainder = totalCents % n;

        List<Split> splits = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            // The first \`remainder\` participants absorb one extra cent each so the
            // splits sum EXACTLY to totalCents - nobody's cent silently vanishes to rounding.
            long share = baseShare + (i < remainder ? 1 : 0);
            splits.add(new Split(participants.get(i), Money.ofCents(share)));
        }
        return splits;
    }
}`,
    },
    {
      filename: 'ExactSplitStrategy.java',
      rationale: 'Reads caller-supplied exact cents per participant from Expense.getSplitInputs() and validates before ever constructing a Split - a bad input fails loudly instead of silently under- or over-billing someone.',
      code: `import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class ExactSplitStrategy implements SplitStrategy {

    @Override
    public List<Split> computeSplits(Expense expense) {
        Map<User, Long> exactCentsByUser = expense.getSplitInputs();
        List<User> participants = expense.getParticipants();
        long totalCents = expense.getTotalAmount().toCents();

        long sum = 0L;
        List<Split> splits = new ArrayList<>(participants.size());
        for (User participant : participants) {
            Long amount = exactCentsByUser.get(participant);
            if (amount == null) {
                throw new IllegalArgumentException("Missing exact amount for participant " + participant);
            }
            sum += amount;
            splits.add(new Split(participant, Money.ofCents(amount)));
        }

        if (sum != totalCents) {
            throw new IllegalArgumentException(
                    "Exact splits must sum to the expense total: provided " + sum + " cents, expected " + totalCents + " cents");
        }
        return splits;
    }
}`,
    },
    {
      filename: 'PercentSplitStrategy.java',
      calloutTitle: '💡 Integer basis points, not doubles',
      callout:
        'Percentages are supplied as basis points (1/100th of a percent, so 100% = 10000) and validated as longs. 33.34% is exactly the integer 3334 - there is no 33.33333333333333 tail that keeps three "equal thirds" from ever summing to precisely 100%.',
      rationale: 'Reuses the exact same remainder-distribution trick as EqualSplitStrategy after computing each share by integer division, so percent splits are just as exact as equal splits.',
      code: `import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class PercentSplitStrategy implements SplitStrategy {
    private static final long TOTAL_BASIS_POINTS = 10_000L; // 100.00% expressed as integer basis points

    @Override
    public List<Split> computeSplits(Expense expense) {
        Map<User, Long> basisPointsByUser = expense.getSplitInputs();
        List<User> participants = expense.getParticipants();
        long totalCents = expense.getTotalAmount().toCents();
        int n = participants.size();

        long bpSum = 0L;
        for (User participant : participants) {
            Long bp = basisPointsByUser.get(participant);
            if (bp == null) {
                throw new IllegalArgumentException("Missing percentage for participant " + participant);
            }
            bpSum += bp;
        }
        if (bpSum != TOTAL_BASIS_POINTS) {
            throw new IllegalArgumentException(
                    "Percentages must sum to 100.00%: provided " + (bpSum / 100.0) + "%");
        }

        long[] baseShares = new long[n];
        long allocated = 0L;
        for (int i = 0; i < n; i++) {
            long bp = basisPointsByUser.get(participants.get(i));
            baseShares[i] = (totalCents * bp) / TOTAL_BASIS_POINTS;
            allocated += baseShares[i];
        }
        long remainder = totalCents - allocated;

        List<Split> splits = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            // Same remainder rule as EqualSplitStrategy: the first \`remainder\` participants
            // (in expense order) absorb the leftover cent(s) truncated by integer division.
            long share = baseShares[i] + (i < remainder ? 1 : 0);
            splits.add(new Split(participants.get(i), Money.ofCents(share)));
        }
        return splits;
    }
}`,
    },
    {
      filename: 'Expense.java',
      rationale: 'Holds everything a SplitStrategy needs (total, participants, and generic per-participant inputs) but stays strategy-agnostic - it has no idea whether it is an equal, exact, or percent split. getSplits() computes once and memoizes the result.',
      code: `import java.util.Collections;
import java.util.List;
import java.util.Map;

public final class Expense {
    private final String id;
    private final User payer;
    private final Money totalAmount;
    private final List<User> participants;
    private final SplitStrategy splitStrategy;
    private final Map<User, Long> splitInputs;
    private List<Split> cachedSplits;

    public Expense(String id, User payer, Money totalAmount, List<User> participants,
                    SplitStrategy splitStrategy, Map<User, Long> splitInputs) {
        this.id = id;
        this.payer = payer;
        this.totalAmount = totalAmount;
        this.participants = Collections.unmodifiableList(participants);
        this.splitStrategy = splitStrategy;
        this.splitInputs = splitInputs == null ? Collections.emptyMap() : Collections.unmodifiableMap(splitInputs);
    }

    public List<Split> getSplits() {
        if (cachedSplits == null) {
            cachedSplits = splitStrategy.computeSplits(this);
        }
        return cachedSplits;
    }

    public String getId() { return id; }
    public User getPayer() { return payer; }
    public Money getTotalAmount() { return totalAmount; }
    public List<User> getParticipants() { return participants; }
    public Map<User, Long> getSplitInputs() { return splitInputs; }
}`,
    },
    {
      filename: 'BalanceSheet.java',
      calloutTitle: '💡 Net at write time, not read time',
      callout:
        'balances only ever stores ONE direction per pair - if A owes B and a later expense makes B owe A, recordDebt() nets them into a single signed entry immediately. A balance query is therefore a single map lookup, never a sum over every historical transaction between the pair.',
      rationale: 'BigDecimal here is used purely as an exact, arbitrary-precision container for a whole number of cents (scale 0) - it is never asked to represent a fraction, so it carries none of the rounding risk a double would.',
      code: `import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class BalanceSheet {
    // balances.get(debtorId).get(creditorId) = cents that debtor owes creditor.
    // Only one of (A owes B) / (B owes A) is ever non-zero for a given pair - recordDebt()
    // nets the pair down before storing, so a lookup never has to add two directions together.
    private final Map<String, Map<String, BigDecimal>> balances = new ConcurrentHashMap<>();

    public void recordDebt(User debtor, User creditor, Money amount) {
        if (debtor.equals(creditor) || amount.isZero()) {
            return;
        }
        BigDecimal owedForward = getRaw(debtor.getId(), creditor.getId());
        BigDecimal owedBackward = getRaw(creditor.getId(), debtor.getId());
        BigDecimal net = owedForward.subtract(owedBackward).add(BigDecimal.valueOf(amount.toCents()));

        clear(debtor.getId(), creditor.getId());
        clear(creditor.getId(), debtor.getId());

        if (net.signum() > 0) {
            set(debtor.getId(), creditor.getId(), net);
        } else if (net.signum() < 0) {
            set(creditor.getId(), debtor.getId(), net.negate());
        }
        // net == 0 means the pair is now exactly even - both entries stay cleared.
    }

    public Money balanceOf(User debtor, User creditor) {
        return Money.ofCents(getRaw(debtor.getId(), creditor.getId()).longValueExact());
    }

    public Map<String, BigDecimal> debtsOwedBy(User user) {
        return balances.getOrDefault(user.getId(), Map.of());
    }

    private BigDecimal getRaw(String debtorId, String creditorId) {
        return balances.getOrDefault(debtorId, Map.of()).getOrDefault(creditorId, BigDecimal.ZERO);
    }

    private void set(String debtorId, String creditorId, BigDecimal cents) {
        balances.computeIfAbsent(debtorId, k -> new ConcurrentHashMap<>()).put(creditorId, cents);
    }

    private void clear(String debtorId, String creditorId) {
        Map<String, BigDecimal> row = balances.get(debtorId);
        if (row != null) {
            row.remove(creditorId);
        }
    }
}`,
    },
    {
      filename: 'ExpenseGroup.java',
      calloutTitle: '💡 Facade',
      callout:
        'Callers never touch Expense, SplitStrategy, or BalanceSheet directly - they call addUser() and addExpense() on ExpenseGroup, and it wires the split computation into the ledger update. This keeps the "record a split as a debt" rule (skip the payer, everyone else owes them) in exactly one place.',
      rationale: "The aggregate root: owns the group's users, its expense history, and its single BalanceSheet instance.",
      code: `import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

public final class ExpenseGroup {
    private final String name;
    private final Map<String, User> users = new LinkedHashMap<>();
    private final List<Expense> expenses = new ArrayList<>();
    private final BalanceSheet balanceSheet = new BalanceSheet();
    private final AtomicLong expenseSequence = new AtomicLong();

    public ExpenseGroup(String name) {
        this.name = name;
    }

    public void addUser(User user) {
        users.put(user.getId(), user);
    }

    public Expense addExpense(User payer, Money totalAmount, List<User> participants,
                               SplitStrategy strategy, Map<User, Long> splitInputs) {
        String expenseId = "E-" + expenseSequence.incrementAndGet();
        Expense expense = new Expense(expenseId, payer, totalAmount, participants, strategy, splitInputs);

        for (Split split : expense.getSplits()) {
            if (!split.getParticipant().equals(payer)) {
                // Everyone except the payer now owes the payer their share.
                balanceSheet.recordDebt(split.getParticipant(), payer, split.getAmount());
            }
        }

        expenses.add(expense);
        return expense;
    }

    public BalanceSheet getBalanceSheet() { return balanceSheet; }
    public String getName() { return name; }
}`,
    },
    {
      filename: 'Demo.java',
      rationale: 'Exercises the remainder-correct equal split, a validated exact split (including a rejected mismatched one), a validated percent split with integer basis points, and the netted final balance sheet across all three expenses.',
      code: `import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public final class Demo {
    public static void main(String[] args) {
        User alice = new User("u1", "Alice");
        User bob = new User("u2", "Bob");
        User charlie = new User("u3", "Charlie");
        User diana = new User("u4", "Diana");
        Map<String, User> byId = Map.of(
                alice.getId(), alice, bob.getId(), bob, charlie.getId(), charlie, diana.getId(), diana);

        ExpenseGroup trip = new ExpenseGroup("Goa Trip");
        trip.addUser(alice);
        trip.addUser(bob);
        trip.addUser(charlie);
        trip.addUser(diana);

        // --- Expense 1: Equal split that does NOT divide evenly ---
        // $100.00 among Alice, Bob, Charlie -> 10000 / 3 = 3333 with 1 cent left over.
        Expense dinner = trip.addExpense(
                alice, Money.ofCents(10_000), List.of(alice, bob, charlie),
                new EqualSplitStrategy(), Map.of());
        long dinnerSum = dinner.getSplits().stream().mapToLong(s -> s.getAmount().toCents()).sum();
        System.out.println("Dinner splits sum to " + dinnerSum + " cents (expected 10000)");
        dinner.getSplits().forEach(s -> System.out.println("  " + s.getParticipant() + " share: " + s.getAmount()));

        // --- Expense 2: Exact split ---
        Expense groceries = trip.addExpense(
                bob, Money.ofCents(6_000), List.of(bob, charlie, diana),
                new ExactSplitStrategy(),
                Map.of(bob, 2_000L, charlie, 2_500L, diana, 1_500L));
        System.out.println("Groceries splits recorded: " + groceries.getSplits().size());

        // Exact splits that do NOT sum to the total are rejected before touching the ledger.
        try {
            trip.addExpense(bob, Money.ofCents(6_000), List.of(bob, charlie, diana),
                    new ExactSplitStrategy(),
                    Map.of(bob, 2_000L, charlie, 2_000L, diana, 1_500L)); // sums to 5500, not 6000
        } catch (IllegalArgumentException e) {
            System.out.println("Rejected bad exact split: " + e.getMessage());
        }

        // --- Expense 3: Percent split (integer basis points, not doubles) ---
        Expense taxi = trip.addExpense(
                charlie, Money.ofCents(5_000), List.of(charlie, diana, alice),
                new PercentSplitStrategy(),
                Map.of(charlie, 3_334L, diana, 3_333L, alice, 3_333L)); // 33.34 + 33.33 + 33.33 = 100.00
        System.out.println("Taxi splits recorded: " + taxi.getSplits().size());

        // Percentages that do NOT sum to 100.00% are rejected the same way.
        try {
            trip.addExpense(charlie, Money.ofCents(5_000), List.of(charlie, diana, alice),
                    new PercentSplitStrategy(),
                    Map.of(charlie, 3_000L, diana, 3_000L, alice, 3_000L)); // only 90.00%
        } catch (IllegalArgumentException e) {
            System.out.println("Rejected bad percent split: " + e.getMessage());
        }

        // --- Final netted balance sheet ---
        // Dinner made Charlie owe Alice 3333c; the taxi made Alice owe Charlie 1666c.
        // recordDebt() nets those into a single entry (Charlie owes Alice 1667c) instead
        // of keeping two contradictory rows for the same pair.
        BalanceSheet ledger = trip.getBalanceSheet();
        System.out.println("\\nFinal balances:");
        for (User user : List.of(alice, bob, charlie, diana)) {
            for (Map.Entry<String, BigDecimal> entry : ledger.debtsOwedBy(user).entrySet()) {
                User creditor = byId.get(entry.getKey());
                Money amount = Money.ofCents(entry.getValue().longValueExact());
                System.out.println("  " + user.getName() + " owes " + creditor.getName() + ": " + amount);
            }
        }
    }
}`,
    },
  ],

  sequenceDiagram: {
    title: 'Sequence Diagram - Record an Expense',
    mermaid: `sequenceDiagram
  autonumber
  participant Client
  participant Group as ExpenseGroup
  participant Exp as Expense
  participant Strategy as SplitStrategy
  participant Ledger as BalanceSheet

  Client->>Group: addExpense(payer, total, participants, strategy, inputs)
  Group->>Exp: new Expense(...)
  Group->>Exp: getSplits()
  Exp->>Strategy: computeSplits(expense)
  Strategy-->>Exp: List~Split~
  Exp-->>Group: List~Split~
  loop each split where participant != payer
    Group->>Ledger: recordDebt(participant, payer, amount)
    Ledger->>Ledger: net against any reverse debt for this pair
  end
  Group-->>Client: expense`,
  },

  extensions: [
    { extension: 'Group-wide settlement suggestions', implementation: "Run a greedy max-debtor/max-creditor match over BalanceSheet's rows to compute the fewest payments that zero out every balance, instead of only showing pairwise debts." },
    { extension: 'Multi-currency expenses', implementation: 'Add a currency code to Money, reject arithmetic between mismatched currencies, and store one BalanceSheet per currency pair.' },
    { extension: '"By shares" splitting (e.g. 2:1:1)', implementation: "Add a SharesSplitStrategy that treats the provided longs as relative weights and reuses EqualSplitStrategy's remainder-distribution logic scaled by weight instead of by equal fractions." },
    { extension: 'Settling up (repayments)', implementation: 'Model a repayment as a call to recordDebt() in the reverse direction (payer -> original debtor) rather than as a new Expense, since no SplitStrategy is involved.' },
    { extension: 'Editing or deleting an expense', implementation: 'Store the exact debts an Expense originally recorded so an edit/delete can first reverse them (recordDebt with negated Money) before applying the new split.' },
    { extension: 'Spending reports by category', implementation: "Add a category field to Expense and aggregate totalAmount by payer and category across the group's expense list." },
  ],

  interviewerChecklist: [
    'Does the candidate reach for long cents or scale-0 BigDecimal instead of double for any money field?',
    'Do EqualSplitStrategy and PercentSplitStrategy provably sum to the exact total via explicit remainder distribution, not "close enough" rounding?',
    'Is validation (exact-sum, percent-sums-to-100) performed before any ledger mutation, so a bad expense never partially applies?',
    'Can a new split type be added without changing Expense, BalanceSheet, or any existing SplitStrategy implementation?',
    'Does the ledger net opposing debts between the same pair into one number instead of keeping every transaction in a list?',
    'Is a balance update O(1) per split rather than replaying the whole expense history on every query?',
    "Can the candidate explain why SplitStrategy.computeSplits() takes the whole Expense rather than just a number - so it can see participants, the payer, and any per-participant inputs?",
  ],

  relatedDesigns: ['parking-lot', 'multilevel-cache'],
  keyTakeaways: [
    'Never use double or float for money - integer minor units (or a scale-0 BigDecimal) make sums exact and remainder distribution deterministic.',
    'Strategy lets "how do we split this expense" vary independently of "how do we record the resulting debt" - Expense and BalanceSheet never know which strategy ran.',
    'A pairwise ledger only needs one signed number per (debtor, creditor) pair - net the debt at write time so reads are O(1), never a replayed transaction log.',
    'Rounding remainders should be distributed deterministically (e.g. the first N participants in order) and validated before any state mutation, not silently dropped or rejected after the fact.',
  ],
}

export default problem

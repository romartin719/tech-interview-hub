import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'library-management',
  title: 'Library Management',
  difficulty: 'Beginner',
  icon: 'pi pi-book',
  color: '#a855f7',
  readTimeMinutes: 15,
  patterns: ['Strategy', 'State', 'Observer', 'Factory Method'],
  companies: ['Amazon', 'Google', 'OverDrive', 'Goodreads'],
  summary:
    'A library system that tracks a catalog of book titles backed by multiple independently-checkoutable physical copies, enforces per-tier borrowing limits and loan periods through a pluggable membership policy, runs a pluggable fine strategy against overdue returns, and maintains a per-title FIFO reservation queue that automatically notifies the next waiting member the instant a copy comes back - all without ever letting two members walk away thinking they hold the same physical copy.',

  functionalRequirements: [
    'Maintain a catalog of Books identified by a unique id, each backed by one or more independently-tracked physical BookCopy instances - a title with 3 copies is 3 separately checkoutable/loseable units, not one shared counter.',
    'Members belong to a tier (Regular / Premium) that is a pluggable policy determining how many books they may have checked out simultaneously, how long their loan period is, and their fine-rate multiplier.',
    'checkoutBook(memberId, bookId) claims one specific available copy of that title, enforces the member\'s tier-specific max-books limit, and opens a Loan with a due date derived from the tier\'s loan period.',
    'returnBook(loanId, returnDate) closes the Loan, releases the copy back to the pool, and - if returned after its due date - runs a pluggable fine-calculation strategy (flat-rate vs escalating-rate) scaled by the member\'s tier multiplier.',
    'When every copy of a title is checked out, a member can join a per-title reservation queue and is automatically notified, in FIFO order, the moment any copy of that title is returned.',
    'Support marking a copy LOST (permanently removing it from the available pool) without corrupting in-flight loan or reservation bookkeeping for that title.',
  ],
  nonFunctionalRequirements: [
    'Checking out a specific physical copy must be race-free: two members racing for the last available copy of a title must never both walk away thinking they hold it.',
    'The unit of scarcity is the individual BookCopy, not the Book title - two copies of the same title must be checkoutable and returnable fully independently of each other.',
    'Adding a new fine strategy, a new membership tier, or a new reservation-notification channel must never require touching the core checkout/return code path (open/closed principle).',
  ],

  coreEntities: [
    { name: 'Book', description: 'A title-level catalog entry (id, title, author) that owns the list of its physical BookCopy instances - nothing about availability lives here.' },
    { name: 'BookCopy', description: 'One physical, checkoutable unit - an id and a CAS-guarded status (AVAILABLE / CHECKED_OUT / LOST) that is the true unit of scarcity in this system.' },
    { name: 'Member', description: 'An id, a name, and a MembershipPolicy - checkout/return code asks the policy questions, it never hardcodes a tier check.' },
    { name: 'MembershipPolicy', description: 'The Strategy for "how many books, how long, how big a fine multiplier" per tier - RegularMembershipPolicy and PremiumMembershipPolicy are two interchangeable implementations of the same three questions.' },
    { name: 'Loan', description: 'A checkout record tying one Member to one BookCopy - tracks its own status (ACTIVE / RETURNED) and guards illegal transitions like returning an already-returned loan.' },
    { name: 'LoanFactory', description: 'Mints a Loan with the due date computed from the member\'s MembershipPolicy, keeping that computation out of LibraryService.' },
    { name: 'FineCalculationStrategy', description: 'The Strategy for how an overdue fine grows with days late - FlatRateFineStrategy vs EscalatingRateFineStrategy - independent of which membership tier is involved.' },
    { name: 'ReservationQueue', description: 'A per-title FIFO queue of members waiting for a copy of that exact title to free up.' },
    { name: 'CopyAvailableObserver / ReservationNotifier', description: 'The Observer pair notified whenever a copy of a title becomes available again - the notifier is the one that actually reaches into the reservation queue and re-runs checkoutBook() on the waiting member\'s behalf.' },
    { name: 'LibraryService', description: 'The aggregate root - owns the catalog, active loans, membership records, and orchestrates checkout / return / reserve.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Book {
    -String bookId
    -String title
    -String author
    -List~BookCopy~ copies
    +addCopy(BookCopy) void
    +getCopies() List~BookCopy~
  }
  class CopyStatus {
    <<enumeration>>
    AVAILABLE
    CHECKED_OUT
    LOST
  }
  class BookCopy {
    -String copyId
    -String bookId
    -AtomicReference~CopyStatus~ status
    +tryCheckOut() boolean
    +tryReturn() boolean
    +tryMarkLost() boolean
    +getStatus() CopyStatus
  }
  class MembershipPolicy {
    <<interface>>
    +maxBooksAllowed() int
    +loanPeriodDays() int
    +fineRateMultiplier() double
  }
  class RegularMembershipPolicy {
    +maxBooksAllowed() int
    +loanPeriodDays() int
    +fineRateMultiplier() double
  }
  class PremiumMembershipPolicy {
    +maxBooksAllowed() int
    +loanPeriodDays() int
    +fineRateMultiplier() double
  }
  class Member {
    -String memberId
    -String name
    -MembershipPolicy membershipPolicy
    +getMembershipPolicy() MembershipPolicy
  }
  class LoanStatus {
    <<enumeration>>
    ACTIVE
    RETURNED
  }
  class Loan {
    -String loanId
    -BookCopy copy
    -Member member
    -LocalDate checkoutDate
    -LocalDate dueDate
    -LocalDate returnDate
    -LoanStatus status
    +markReturned(LocalDate) void
    +daysOverdue(LocalDate) long
  }
  class LoanFactory {
    +checkout(BookCopy, Member, LocalDate) Loan
  }
  class FineCalculationStrategy {
    <<interface>>
    +calculateFine(long, double) double
  }
  class FlatRateFineStrategy {
    +calculateFine(long, double) double
  }
  class EscalatingRateFineStrategy {
    +calculateFine(long, double) double
  }
  class ReservationEntry {
    -String entryId
    -String bookId
    -String memberId
    -Instant joinedAt
  }
  class ReservationQueue {
    -Map~String, Queue~ReservationEntry~~ queuesByBookId
    +join(String, String) ReservationEntry
    +peekHead(String) ReservationEntry
    +removeHead(String) void
  }
  class CopyAvailableObserver {
    <<interface>>
    +onCopyAvailable(String) void
  }
  class ReservationNotifier {
    +onCopyAvailable(String) void
  }
  class NoCopyAvailableException
  class LibraryService {
    -Map~String, Book~ catalogByBookId
    -Map~String, Member~ membersById
    -ConcurrentHashMap~String, Loan~ activeLoansById
    -ConcurrentHashMap~String, AtomicInteger~ activeLoanCountByMember
    -FineCalculationStrategy fineStrategy
    -ReservationQueue reservationQueue
    -List~CopyAvailableObserver~ observers
    +checkoutBook(String, String) Loan
    +returnBook(String, LocalDate) double
    +reserveBook(String, String) ReservationEntry
  }

  BookCopy --> CopyStatus
  Book o-- BookCopy
  MembershipPolicy <|.. RegularMembershipPolicy
  MembershipPolicy <|.. PremiumMembershipPolicy
  Member o-- MembershipPolicy
  Loan --> LoanStatus
  Loan o-- BookCopy
  Loan o-- Member
  Loan ..> LoanFactory : created by
  FineCalculationStrategy <|.. FlatRateFineStrategy
  FineCalculationStrategy <|.. EscalatingRateFineStrategy
  ReservationQueue o-- ReservationEntry
  CopyAvailableObserver <|.. ReservationNotifier
  LibraryService o-- Book
  LibraryService o-- Member
  LibraryService o-- FineCalculationStrategy
  LibraryService o-- ReservationQueue
  LibraryService o-- CopyAvailableObserver
  LibraryService ..> NoCopyAvailableException : throws
  LibraryService ..> LoanFactory : uses`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'MembershipPolicy + RegularMembershipPolicy / PremiumMembershipPolicy', why: 'How many books a member may hold, how long their loan period is, and their fine-rate multiplier are three knobs that live behind one interface - checkoutBook() never branches on tier, and adding a Student or Corporate tier is a new class, not a new if-branch scattered through the service.' },
    { pattern: 'Strategy', where: 'FineCalculationStrategy + FlatRateFineStrategy / EscalatingRateFineStrategy', why: 'How a fine grows with days-late is orthogonal to which tier the member is in - returnBook() just calls calculateFine(daysOverdue, multiplier) and never encodes the actual math itself, so switching the whole library to a new fine scheme touches one class.' },
    { pattern: 'State', where: 'BookCopy.CopyStatus (CAS-guarded) and Loan.LoanStatus (guarded markReturned())', why: 'Encodes each entity\'s legal lifecycle directly on the entity itself, so double-checking-out a copy or returning an already-returned loan fails loudly instead of silently corrupting the catalog.' },
    { pattern: 'Observer', where: 'CopyAvailableObserver / ReservationNotifier', why: 'The core checkout/return flow fires "a copy of this title just became available" without knowing a reservation queue exists - swapping the console notification for a real push/email service means writing a new observer, not touching LibraryService.' },
    { pattern: 'Factory Method', where: 'LoanFactory.checkout()', why: 'Centralizes the one computation that turns a member\'s tier into an actual due date - a holiday grace extension or a promo "extra week" is a one-line change here, not a hunt through every place a Loan gets constructed.' },
  ],

  dataStructures: [
    { component: 'Per-copy checkout state', structure: 'AtomicReference<CopyStatus> per BookCopy, claimed via compareAndSet()', why: 'compareAndSet(AVAILABLE, CHECKED_OUT) is the lock-free equivalent of a ParkingSpot.tryOccupy()-style claim - exactly one of two threads racing for the same copy ever flips it to CHECKED_OUT, with no explicit lock over the whole catalog.' },
    { component: 'Active loans by id', structure: 'ConcurrentHashMap<String, Loan>', why: 'O(1) lookup for returnBook(loanId) without scanning every outstanding loan in the library.' },
    { component: 'A member\'s active loan count', structure: 'ConcurrentHashMap<String, AtomicInteger> keyed by memberId', why: 'checkoutBook() needs to check a single counter against maxBooksAllowed() and increment it - an AtomicInteger gives that without locking the whole member record or recomputing the count by scanning every active loan.' },
    { component: 'Per-title reservation queue', structure: 'ConcurrentHashMap<String, ConcurrentLinkedQueue<ReservationEntry>> keyed by bookId', why: 'Each title gets its own FIFO queue - a run on a bestseller never blocks or reorders the queue for an unrelated title, and enqueue/dequeue are both O(1).' },
    { component: 'Copies belonging to a title', structure: 'CopyOnWriteArrayList<BookCopy> inside Book', why: 'New copies are added rarely (a fresh shipment) but the list is iterated on every checkout attempt from many threads - CopyOnWriteArrayList makes those reads lock-free and safe without wrapping the whole Book in a read-write lock.' },
  ],

  walkthroughs: [
    {
      title: 'Checkout -> Overdue Return -> Fine Flow',
      steps: [
        'A Regular member (max 5 books, 14-day loan period, fine multiplier 1.0) currently holding 2 active loans requests checkoutBook() for "Clean Code"; LibraryService checks their active-loan AtomicInteger (2) against maxBooksAllowed() (5) - within the limit, so it proceeds.',
        'LibraryService iterates the book\'s CopyOnWriteArrayList<BookCopy> looking for one where tryCheckOut() (an AtomicReference.compareAndSet(AVAILABLE, CHECKED_OUT)) succeeds; copy C-014 wins on the first attempt since no other thread has touched it.',
        'LoanFactory.checkout() computes dueDate = today + loanPeriodDays() (14 days for Regular) and mints a fresh Loan; LibraryService indexes it in activeLoansById and increments that member\'s active-loan counter.',
        'Twenty days later the member returns the book; returnBook() removes the Loan, calls loan.markReturned(today) - a guarded State transition that throws if the loan was already RETURNED - and computes daysOverdue = 6.',
        'Six overdue days and the member\'s fineRateMultiplier (1.0) are handed to the configured EscalatingRateFineStrategy, which charges the gentle base rate for the days inside its grace window and a steeper rate for anything beyond it, producing the final fine amount.',
        'loan.getCopy().tryReturn() flips C-014 back to AVAILABLE via CAS, and LibraryService fires onCopyAvailable("clean-code") to every registered observer - whether or not anyone is actually waiting on that title.',
      ],
    },
    {
      title: 'All Copies Checked Out -> Reservation -> Auto-Notified Flow',
      steps: [
        'Every copy of "Clean Code" is CHECKED_OUT; a second member\'s checkoutBook() call finds tryCheckOut() fail on every copy in the list and LibraryService throws NoCopyAvailableException.',
        'The caller catches that and calls reserveBook(); ReservationQueue.join() enqueues a ReservationEntry onto the ConcurrentLinkedQueue kept specifically for "clean-code" - FIFO, and fully independent of every other title\'s queue.',
        'Later, the member holding the sole copy returns it on time; returnBook() flips that copy back to AVAILABLE via CAS and invokes onCopyAvailable("clean-code") on every registered observer.',
        'ReservationNotifier.onCopyAvailable() peeks the head of the "clean-code" queue and calls the exact same checkoutBook() path a walk-in member would use, on the waitlisted member\'s behalf - including their own tier\'s max-books check.',
        'Because checkoutBook() re-runs the full tryCheckOut() race rather than blindly assigning the copy, the reservation is only "claimed" if it actually wins; only then does the observer call removeHead(), so a losing race (e.g. the waitlisted member is already at their limit) leaves the entry at the head for the next return to retry.',
        'The resulting Loan is indexed in activeLoansById exactly like any walk-in checkout - reservation fulfillment never bypasses the loan-limit check or the atomic copy claim.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Book.java',
      rationale: 'A title-level catalog entry that owns its copies but knows nothing about availability - that state lives one level down, on each BookCopy, so a Book never needs synchronization of its own just to answer "how many copies do you have?"',
      code: `import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class Book {
    private final String bookId;
    private final String title;
    private final String author;
    private final List<BookCopy> copies = new CopyOnWriteArrayList<>();

    public Book(String bookId, String title, String author) {
        this.bookId = bookId;
        this.title = title;
        this.author = author;
    }

    public void addCopy(BookCopy copy) {
        copies.add(copy);
    }

    public String getBookId() { return bookId; }
    public String getTitle() { return title; }
    public String getAuthor() { return author; }
    public List<BookCopy> getCopies() { return copies; }

    @Override
    public String toString() {
        return "\\"" + title + "\\" by " + author + " (" + copies.size() + " copies)";
    }
}`,
    },
    {
      filename: 'BookCopy.java',
      calloutTitle: '💡 Lock-free State transition via CAS',
      callout:
        'tryCheckOut() is a compareAndSet(AVAILABLE, CHECKED_OUT). Two members racing for the last copy of a bestseller both call it from different threads; exactly one CAS wins, the loser simply gets false back and LibraryService moves on to the next copy (or the reservation queue) instead of ever believing it holds a copy it does not. No lock is taken over the Book or the catalog - the atomicity is scoped to exactly the one copy in contention.',
      rationale: 'CopyStatus is nested here since no other class ever needs it independently of a BookCopy. LOST is deliberately terminal - tryMarkLost() never gets reversed by a later tryReturn().',
      code: `import java.util.concurrent.atomic.AtomicReference;

public final class BookCopy {

    public enum CopyStatus { AVAILABLE, CHECKED_OUT, LOST }

    private final String copyId;
    private final String bookId;
    private final AtomicReference<CopyStatus> status = new AtomicReference<>(CopyStatus.AVAILABLE);

    public BookCopy(String copyId, String bookId) {
        this.copyId = copyId;
        this.bookId = bookId;
    }

    /** Atomically claims this copy iff it is currently AVAILABLE. */
    public boolean tryCheckOut() {
        return status.compareAndSet(CopyStatus.AVAILABLE, CopyStatus.CHECKED_OUT);
    }

    /** Atomically releases this copy iff it is currently CHECKED_OUT. */
    public boolean tryReturn() {
        return status.compareAndSet(CopyStatus.CHECKED_OUT, CopyStatus.AVAILABLE);
    }

    /** LOST is terminal - once set, it can never transition back to AVAILABLE. */
    public boolean tryMarkLost() {
        CopyStatus previous = status.getAndSet(CopyStatus.LOST);
        return previous != CopyStatus.LOST;
    }

    public String getCopyId() { return copyId; }
    public String getBookId() { return bookId; }
    public CopyStatus getStatus() { return status.get(); }

    @Override
    public String toString() {
        return "BookCopy{" + copyId + ", " + status.get() + "}";
    }
}`,
    },
    {
      filename: 'Member.java',
      rationale: 'A thin holder for identity plus whichever MembershipPolicy applies - Member itself never encodes tier-specific numbers, so it never goes stale when a tier\'s rules change.',
      code: `public final class Member {
    private final String memberId;
    private final String name;
    private final MembershipPolicy membershipPolicy;

    public Member(String memberId, String name, MembershipPolicy membershipPolicy) {
        this.memberId = memberId;
        this.name = name;
        this.membershipPolicy = membershipPolicy;
    }

    public String getMemberId() { return memberId; }
    public String getName() { return name; }
    public MembershipPolicy getMembershipPolicy() { return membershipPolicy; }
}`,
    },
    {
      filename: 'MembershipPolicy.java',
      rationale: 'Kept to exactly the three questions checkout/return code actually needs answered - anything more (address, contact info) belongs on Member, not here.',
      code: `public interface MembershipPolicy {
    int maxBooksAllowed();
    int loanPeriodDays();
    double fineRateMultiplier();
}`,
    },
    {
      filename: 'RegularMembershipPolicy.java',
      rationale: 'The baseline tier: a modest borrowing cap, a two-week loan period, and a full-price fine multiplier.',
      code: `public final class RegularMembershipPolicy implements MembershipPolicy {
    @Override public int maxBooksAllowed() { return 5; }
    @Override public int loanPeriodDays() { return 14; }
    @Override public double fineRateMultiplier() { return 1.0; }
}`,
    },
    {
      filename: 'PremiumMembershipPolicy.java',
      rationale: 'Doubles the borrowing limit, extends the loan period by a week, and halves the per-day fine rate - three independent knobs that a hardcoded if (tier == PREMIUM) chain would have to keep in sync by hand across every method that touches them.',
      code: `public final class PremiumMembershipPolicy implements MembershipPolicy {
    @Override public int maxBooksAllowed() { return 10; }
    @Override public int loanPeriodDays() { return 21; }
    @Override public double fineRateMultiplier() { return 0.5; }
}`,
    },
    {
      filename: 'Loan.java',
      rationale: 'LoanStatus is nested since nothing outside a Loan needs it independently. markReturned() guards against double-returning the same loan instead of silently overwriting the returnDate.',
      code: `import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public final class Loan {

    public enum LoanStatus { ACTIVE, RETURNED }

    private final String loanId;
    private final BookCopy copy;
    private final Member member;
    private final LocalDate checkoutDate;
    private final LocalDate dueDate;
    private LocalDate returnDate;
    private LoanStatus status;

    public Loan(String loanId, BookCopy copy, Member member, LocalDate checkoutDate, LocalDate dueDate) {
        this.loanId = loanId;
        this.copy = copy;
        this.member = member;
        this.checkoutDate = checkoutDate;
        this.dueDate = dueDate;
        this.status = LoanStatus.ACTIVE;
    }

    public void markReturned(LocalDate returnDate) {
        if (status != LoanStatus.ACTIVE) {
            throw new IllegalStateException("Loan " + loanId + " is already " + status);
        }
        this.returnDate = returnDate;
        this.status = LoanStatus.RETURNED;
    }

    public long daysOverdue(LocalDate asOf) {
        long overdue = dueDate.until(asOf, ChronoUnit.DAYS);
        return Math.max(0, overdue);
    }

    public String getLoanId() { return loanId; }
    public BookCopy getCopy() { return copy; }
    public Member getMember() { return member; }
    public LocalDate getCheckoutDate() { return checkoutDate; }
    public LocalDate getDueDate() { return dueDate; }
    public LocalDate getReturnDate() { return returnDate; }
    public LoanStatus getStatus() { return status; }
}`,
    },
    {
      filename: 'LoanFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'The only place that turns "a member\'s tier" into "an actual due date" is this one static method. A one-time holiday extension for every loan issued this week, or a promo that grants an extra 7 days, is a one-line change here instead of a search through every place a Loan gets constructed by hand.',
      rationale: 'Also owns UUID generation for loanId, keeping identity-minting out of LibraryService.',
      code: `import java.time.LocalDate;
import java.util.UUID;

public final class LoanFactory {

    private LoanFactory() {}

    public static Loan checkout(BookCopy copy, Member member, LocalDate checkoutDate) {
        int loanPeriodDays = member.getMembershipPolicy().loanPeriodDays();
        LocalDate dueDate = checkoutDate.plusDays(loanPeriodDays);
        return new Loan(UUID.randomUUID().toString(), copy, member, checkoutDate, dueDate);
    }
}`,
    },
    {
      filename: 'FineCalculationStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'returnBook() never computes a fine amount itself - it hands the strategy a days-late count and the member\'s tier multiplier and trusts whatever comes back. Switching the whole library from a flat per-day fee to an escalating one, or capping fines during a promotional period, is a new class behind this interface, not a rewrite of returnBook().',
      rationale: 'A single method taking the tier multiplier as a parameter, so implementations never need to know or care which MembershipPolicy a given member has - that composition happens in LibraryService.',
      code: `public interface FineCalculationStrategy {
    double calculateFine(long daysOverdue, double rateMultiplier);
}`,
    },
    {
      filename: 'FlatRateFineStrategy.java',
      rationale: 'The simplest possible policy - useful as a sane default and as a baseline to compare escalating strategies against.',
      code: `public final class FlatRateFineStrategy implements FineCalculationStrategy {
    private final double dailyRate;

    public FlatRateFineStrategy(double dailyRate) {
        this.dailyRate = dailyRate;
    }

    @Override
    public double calculateFine(long daysOverdue, double rateMultiplier) {
        return daysOverdue * dailyRate * rateMultiplier;
    }
}`,
    },
    {
      filename: 'EscalatingRateFineStrategy.java',
      rationale: 'Charges the gentle base rate for the first graceWindowDays days late, then a steeper rate beyond that - deliberately harsher on a book that has been out for a month than one that is three days late, which a flat rate cannot express.',
      code: `public final class EscalatingRateFineStrategy implements FineCalculationStrategy {
    private final double baseDailyRate;
    private final long graceWindowDays;
    private final double escalatedDailyRate;

    public EscalatingRateFineStrategy(double baseDailyRate, long graceWindowDays, double escalatedDailyRate) {
        this.baseDailyRate = baseDailyRate;
        this.graceWindowDays = graceWindowDays;
        this.escalatedDailyRate = escalatedDailyRate;
    }

    @Override
    public double calculateFine(long daysOverdue, double rateMultiplier) {
        long graceDays = Math.min(daysOverdue, graceWindowDays);
        long escalatedDays = Math.max(0, daysOverdue - graceWindowDays);
        double fine = (graceDays * baseDailyRate) + (escalatedDays * escalatedDailyRate);
        return fine * rateMultiplier;
    }
}`,
    },
    {
      filename: 'ReservationQueue.java',
      rationale: 'ReservationEntry is nested since it never leaves ReservationQueue except as an opaque handle. Per-title queues are created lazily so a catalog with thousands of titles does not pre-allocate empty queues for books nobody has ever waited on.',
      code: `import java.time.Instant;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

public final class ReservationQueue {

    public static final class ReservationEntry {
        private final String entryId;
        private final String bookId;
        private final String memberId;
        private final Instant joinedAt;

        ReservationEntry(String entryId, String bookId, String memberId, Instant joinedAt) {
            this.entryId = entryId;
            this.bookId = bookId;
            this.memberId = memberId;
            this.joinedAt = joinedAt;
        }

        public String getEntryId() { return entryId; }
        public String getBookId() { return bookId; }
        public String getMemberId() { return memberId; }
        public Instant getJoinedAt() { return joinedAt; }
    }

    private final ConcurrentHashMap<String, Queue<ReservationEntry>> queuesByBookId = new ConcurrentHashMap<>();

    public ReservationEntry join(String bookId, String memberId) {
        ReservationEntry entry = new ReservationEntry(UUID.randomUUID().toString(), bookId, memberId, Instant.now());
        queuesByBookId.computeIfAbsent(bookId, id -> new ConcurrentLinkedQueue<>()).add(entry);
        return entry;
    }

    public ReservationEntry peekHead(String bookId) {
        Queue<ReservationEntry> queue = queuesByBookId.get(bookId);
        return queue == null ? null : queue.peek();
    }

    public void removeHead(String bookId) {
        Queue<ReservationEntry> queue = queuesByBookId.get(bookId);
        if (queue != null) {
            queue.poll();
        }
    }
}`,
    },
    {
      filename: 'CopyAvailableObserver.java',
      rationale: 'One-method interface, deliberately unaware of ReservationQueue - a usage-analytics collector could implement this same interface tomorrow without the reservation system knowing.',
      code: `public interface CopyAvailableObserver {
    void onCopyAvailable(String bookId);
}`,
    },
    {
      filename: 'ReservationNotifier.java',
      calloutTitle: '💡 Observer Pattern',
      callout:
        'LibraryService has zero knowledge that a reservation queue exists - returnBook() just calls onCopyAvailable() on whatever observers were registered. This notifier then reuses the exact same checkoutBook() entry point a walk-in member would use, so a waitlisted member gets the identical loan-limit check and atomic copy claim instead of a special-cased "instant checkout" that could bypass either.',
      rationale: 'Deliberately prints to the console instead of calling a real push/email API - production code would swap that one line, the pattern is the point here.',
      code: `public final class ReservationNotifier implements CopyAvailableObserver {
    private final LibraryService libraryService;
    private final ReservationQueue reservationQueue;

    public ReservationNotifier(LibraryService libraryService, ReservationQueue reservationQueue) {
        this.libraryService = libraryService;
        this.reservationQueue = reservationQueue;
    }

    @Override
    public void onCopyAvailable(String bookId) {
        ReservationQueue.ReservationEntry head = reservationQueue.peekHead(bookId);
        if (head == null) {
            return;
        }
        try {
            Loan loan = libraryService.checkoutBook(head.getMemberId(), bookId);
            reservationQueue.removeHead(bookId);
            System.out.println("[Reservation] " + head.getMemberId() + " was notified and issued copy "
                    + loan.getCopy().getCopyId() + " of " + bookId + " (due " + loan.getDueDate() + ")");
        } catch (NoCopyAvailableException e) {
            // Another path claimed the freed copy first - leave the entry at the head for the next return.
        }
    }
}`,
    },
    {
      filename: 'NoCopyAvailableException.java',
      rationale: 'A checked business exception - callers must explicitly decide what to do (surface a "join the waitlist?" prompt) rather than treating "every copy is out" as an unexpected crash.',
      code: `public final class NoCopyAvailableException extends Exception {
    public NoCopyAvailableException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'LibraryService.java',
      calloutTitle: '💡 Atomic claim, one copy at a time',
      callout:
        'checkoutBook() never locks the whole Book or the whole catalog - it calls tryCheckOut() (a CAS) on each copy in turn until one wins, the same way ParkingSpot.tryOccupy() claims a single space in the parking-lot design. Combined with the per-member AtomicInteger loan counter, two members can hammer checkoutBook() for the same title from different threads simultaneously, and each will either walk away with a distinct physical copy or a clean NoCopyAvailableException - never a shared, silently double-issued copy.',
      rationale: 'The aggregate root. It delegates "how many books, how long, what fine multiplier" to MembershipPolicy, "how big is the fine" to FineCalculationStrategy, and "who to tell" to the observers, keeping its own methods focused on orchestration and the one concurrency-critical loop.',
      code: `import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public final class LibraryService {
    private final Map<String, Book> catalogByBookId = new ConcurrentHashMap<>();
    private final Map<String, Member> membersById = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Loan> activeLoansById = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicInteger> activeLoanCountByMember = new ConcurrentHashMap<>();
    private final FineCalculationStrategy fineStrategy;
    private final ReservationQueue reservationQueue;
    private final List<CopyAvailableObserver> observers = new ArrayList<>();

    public LibraryService(FineCalculationStrategy fineStrategy, ReservationQueue reservationQueue) {
        this.fineStrategy = fineStrategy;
        this.reservationQueue = reservationQueue;
    }

    public void registerObserver(CopyAvailableObserver observer) {
        observers.add(observer);
    }

    public void addBook(Book book) {
        catalogByBookId.put(book.getBookId(), book);
    }

    public void registerMember(Member member) {
        membersById.put(member.getMemberId(), member);
        activeLoanCountByMember.put(member.getMemberId(), new AtomicInteger(0));
    }

    public Loan checkoutBook(String memberId, String bookId) throws NoCopyAvailableException {
        Member member = requireMember(memberId);
        Book book = requireBook(bookId);

        AtomicInteger activeCount = activeLoanCountByMember.get(memberId);
        int limit = member.getMembershipPolicy().maxBooksAllowed();
        if (activeCount.get() >= limit) {
            throw new IllegalStateException(memberId + " already has " + activeCount.get()
                    + " active loans, at the limit of " + limit);
        }

        for (BookCopy copy : book.getCopies()) {
            if (copy.tryCheckOut()) {
                Loan loan = LoanFactory.checkout(copy, member, LocalDate.now());
                activeLoansById.put(loan.getLoanId(), loan);
                activeCount.incrementAndGet();
                return loan;
            }
        }
        throw new NoCopyAvailableException("No available copy of " + bookId + " for checkout");
    }

    public double returnBook(String loanId, LocalDate returnDate) {
        Loan loan = activeLoansById.remove(loanId);
        if (loan == null) {
            throw new IllegalArgumentException("Unknown or already-closed loan: " + loanId);
        }
        loan.markReturned(returnDate);
        activeLoanCountByMember.get(loan.getMember().getMemberId()).decrementAndGet();

        long daysOverdue = loan.daysOverdue(returnDate);
        double fine = daysOverdue > 0
                ? fineStrategy.calculateFine(daysOverdue, loan.getMember().getMembershipPolicy().fineRateMultiplier())
                : 0.0;

        loan.getCopy().tryReturn();
        observers.forEach(o -> o.onCopyAvailable(loan.getCopy().getBookId()));
        return fine;
    }

    public ReservationQueue.ReservationEntry reserveBook(String memberId, String bookId) {
        requireMember(memberId);
        requireBook(bookId);
        return reservationQueue.join(bookId, memberId);
    }

    public void reportLost(String bookId, String copyId) {
        Book book = requireBook(bookId);
        book.getCopies().stream()
                .filter(c -> c.getCopyId().equals(copyId))
                .findFirst()
                .ifPresent(BookCopy::tryMarkLost);
    }

    private Member requireMember(String memberId) {
        Member member = membersById.get(memberId);
        if (member == null) {
            throw new IllegalArgumentException("Unknown member: " + memberId);
        }
        return member;
    }

    private Book requireBook(String bookId) {
        Book book = catalogByBookId.get(bookId);
        if (book == null) {
            throw new IllegalArgumentException("Unknown book: " + bookId);
        }
        return book;
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale: 'Exercises the happy path (checkout then an overdue return that triggers an escalating fine), the core edge case this design exists for (last copy checked out -> reservation queue -> automatic notification on return), and - since race-free checkout is a stated non-functional requirement - a concurrency stress test proving only one of many racing threads can ever win the sole copy of a title.',
      code: `import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public final class Demo {
    public static void main(String[] args) throws Exception {
        ReservationQueue reservationQueue = new ReservationQueue();
        FineCalculationStrategy fineStrategy = new EscalatingRateFineStrategy(0.25, 7, 0.75);
        LibraryService library = new LibraryService(fineStrategy, reservationQueue);
        library.registerObserver(new ReservationNotifier(library, reservationQueue));

        Member alice = new Member("m-alice", "Alice", new RegularMembershipPolicy());
        Member bob = new Member("m-bob", "Bob", new PremiumMembershipPolicy());
        Member carol = new Member("m-carol", "Carol", new RegularMembershipPolicy());
        library.registerMember(alice);
        library.registerMember(bob);
        library.registerMember(carol);

        Book cleanCode = new Book("clean-code", "Clean Code", "Robert C. Martin");
        cleanCode.addCopy(new BookCopy("clean-code-c1", "clean-code"));
        library.addBook(cleanCode);

        // --- Happy path: checkout, then an overdue return that charges an escalating fine ---
        Loan aliceLoan = library.checkoutBook("m-alice", "clean-code");
        System.out.println("Alice checked out copy " + aliceLoan.getCopy().getCopyId() + ", due " + aliceLoan.getDueDate());
        double fine = library.returnBook(aliceLoan.getLoanId(), aliceLoan.getDueDate().plusDays(10));
        System.out.println("Alice returned 10 days late, fine = $" + fine);

        // --- Edge case: sole copy checked out again, second member reserves, then gets auto-notified ---
        Loan bobLoan = library.checkoutBook("m-bob", "clean-code");
        System.out.println("Bob checked out the only copy, due " + bobLoan.getDueDate());
        try {
            library.checkoutBook("m-carol", "clean-code");
            System.out.println("Unexpected: Carol should not have found a copy");
        } catch (NoCopyAvailableException e) {
            System.out.println("Expected: " + e.getMessage());
            library.reserveBook("m-carol", "clean-code");
            System.out.println("Carol joined the reservation queue for Clean Code");
        }
        // Bob returns on time; ReservationNotifier should immediately hand the freed copy to Carol.
        library.returnBook(bobLoan.getLoanId(), bobLoan.getDueDate());

        // --- Concurrency stress test: 25 threads race for the single copy of a fresh title ---
        Book pragmatic = new Book("pragmatic-programmer", "The Pragmatic Programmer", "Hunt & Thomas");
        pragmatic.addCopy(new BookCopy("pp-c1", "pragmatic-programmer"));
        library.addBook(pragmatic);
        for (int i = 0; i < 25; i++) {
            library.registerMember(new Member("stress-" + i, "Stress" + i, new RegularMembershipPolicy()));
        }

        ExecutorService pool = Executors.newFixedThreadPool(25);
        AtomicInteger successCount = new AtomicInteger();
        CountDownLatch done = new CountDownLatch(25);
        for (int i = 0; i < 25; i++) {
            final String memberId = "stress-" + i;
            pool.submit(() -> {
                try {
                    library.checkoutBook(memberId, "pragmatic-programmer");
                    successCount.incrementAndGet();
                } catch (NoCopyAvailableException ignored) {
                    // Expected for every thread except the single winner of the CAS race.
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();
        System.out.println("Threads that won the single copy: " + successCount.get() + " (expected 1)");
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Loan Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> ACTIVE: checkoutBook() - copy CAS AVAILABLE to CHECKED_OUT
  ACTIVE --> RETURNED: returnBook() on or before dueDate
  ACTIVE --> RETURNED: returnBook() after dueDate - fine charged via FineCalculationStrategy
  ACTIVE --> LOST: reportLost() - copy CAS'd to LOST, terminal
  RETURNED --> [*]
  LOST --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Checkout then Overdue Return',
    mermaid: `sequenceDiagram
  autonumber
  participant Member
  participant Service as LibraryService
  participant Copy as BookCopy
  participant Factory as LoanFactory
  participant Fine as FineCalculationStrategy

  Member->>Service: checkoutBook(memberId, bookId)
  Service->>Service: check activeLoanCount < maxBooksAllowed()
  loop over book.getCopies()
    Service->>Copy: tryCheckOut() [CAS]
    Copy-->>Service: true (won) / false (try next copy)
  end
  Service->>Factory: checkout(copy, member, today)
  Factory-->>Service: Loan (dueDate)
  Service-->>Member: Loan
  Member->>Service: returnBook(loanId, returnDate)
  Service->>Service: loan.markReturned(returnDate)
  Service->>Fine: calculateFine(daysOverdue, rateMultiplier)
  Fine-->>Service: fineAmount
  Service->>Copy: tryReturn() [CAS]
  Service->>Service: notify observers.onCopyAvailable(bookId)
  Service-->>Member: fineAmount`,
  },

  extensions: [
    { extension: 'Digital / e-book holds with limited concurrent licenses', implementation: 'Model each concurrent license slot as a BookCopy-like unit so the same tryCheckOut()/tryReturn() CAS logic caps how many members can have an e-book "checked out" at once, without a separate concurrency mechanism for digital titles.' },
    { extension: 'Loan renewals', implementation: 'Add Loan.renew(int extraDays) that pushes dueDate out via the member\'s MembershipPolicy, but only if reservationQueue.peekHead(bookId) is null - a title with people waiting should never silently renew out from under them.' },
    { extension: 'Multi-branch libraries', implementation: 'Add a branchId to BookCopy and either run one LibraryService per branch or filter book.getCopies() by branch before the checkout loop, keeping the same CAS claim per copy either way.' },
    { extension: 'Priority reservations for Premium members', implementation: 'Swap the ConcurrentLinkedQueue inside ReservationQueue for a PriorityBlockingQueue ordered by tier then join time, behind the same join()/peekHead()/removeHead() API.' },
    { extension: 'Lost/damaged book billing', implementation: 'Add a ReplacementCostStrategy interface (mirroring FineCalculationStrategy) that LibraryService.reportLost() consults to bill a member, instead of hardcoding a flat replacement fee.' },
    { extension: 'Background overdue sweeper', implementation: 'Add a ScheduledExecutorService that periodically scans activeLoansById for loans past dueDate and proactively emails a reminder, instead of only computing lateness lazily at the moment of return.' },
  ],

  interviewerChecklist: [
    'Does checkout claim one specific physical copy atomically (CAS or equivalent) rather than a check-then-act race - get() a status, then separately set() it?',
    'Is the reservation queue scoped per book title (not one global queue), and does a losing claim leave the entry at the head instead of dropping it?',
    'Is membership tier modeled as a pluggable policy object rather than if (tier == PREMIUM) branches scattered through checkout/return code?',
    'Is the fine-calculation strategy independent of the membership-tier multiplier, so adding a new fine scheme does not require touching checkout/return?',
    'Do Loan and BookCopy use guarded state transitions that fail loudly on illegal moves (returning an already-returned loan, checking out an already-checked-out copy)?',
    'Does the candidate distinguish the abstract Book title from a physical BookCopy - is availability tracked per copy, not per title?',
  ],

  relatedDesigns: ['parking-lot', 'restaurant-booking', 'inventory-management'],
  keyTakeaways: [
    'The unit of scarcity is almost never the thing with the human-readable name (the "book", the "parking lot") - it is the smallest independently-claimable resource underneath it (one physical copy, one spot, one table+slot).',
    'AtomicReference/CAS on a single entity and ConcurrentHashMap.compute() on a keyed map are the same idea at two granularities - both give an atomic "check current state and swap" without a coarse lock over the whole collection.',
    'Composing two independent Strategies (MembershipPolicy for limits/multiplier, FineCalculationStrategy for the fine curve) instead of one big "pricing" interface keeps each free to evolve without the other caring.',
    'Observer decouples "a copy just became available" from "who cares" - the checkout/return core never imports ReservationQueue, exactly as a booking core never imports its waitlist.',
  ],
}

export default problem

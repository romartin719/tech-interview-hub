import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'url-shortener',
  title: 'URL Shortener',
  difficulty: 'Intermediate',
  icon: 'pi pi-link',
  color: '#6366f1',
  readTimeMinutes: 17,
  patterns: ['Strategy', 'Factory', 'Singleton', 'Decorator'],
  companies: ['Google', 'Amazon', 'Microsoft', 'Bitly', 'LinkedIn'],
  summary:
    'A service that turns long URLs into short, shareable codes - minting unique codes under concurrent load, honoring custom aliases and optional expiry, and redirecting traffic without ever serving two different destinations from the same code.',

  functionalRequirements: [
    'Given a long URL, generate a short code and return a full short URL (e.g. https://short.ly/aZ3kT9) that redirects to the original.',
    'Support an optional custom alias supplied by the caller instead of an auto-generated code, rejecting the request if that alias is already taken.',
    'Resolving a short code performs a redirect to the original long URL; an unrecognized code fails with a clear "not found" error.',
    'Support an optional expiry (TTL) per short URL; once expired, the code must stop resolving even though it still exists in storage.',
    'Guarantee that two concurrent creation requests are never assigned the same short code for two different long URLs.',
    'The code-generation algorithm itself must be swappable (counter-based, hash-based, custom alias) without changing the create/redirect API.',
  ],
  nonFunctionalRequirements: [
    'Both code generation and code lookup must be O(1) on average - redirects are the overwhelmingly hot path and must never scan a table of URLs.',
    'Code creation must be thread-safe under high concurrent write load: a collision between two in-flight requests must be detected and retried, never silently overwritten.',
    'Adding a new encoding strategy or a new cross-cutting concern (expiry, rate limiting) must not require editing the core create/redirect flow.',
  ],

  coreEntities: [
    { name: 'UrlRecord', description: 'Immutable snapshot of one mapping: short code, long URL, creation time, optional expiry time, and whether the code was a custom alias.' },
    { name: 'EncodingStrategy', description: 'Interface for producing a candidate short code from a long URL - the swappable brain behind code generation.' },
    { name: 'Base62CounterEncodingStrategy', description: 'The default strategy: base62-encodes the next id from a shared, monotonically increasing counter.' },
    { name: 'HashBasedEncodingStrategy', description: 'Alternative strategy: derives a code from a salted hash of the URL content instead of a sequential id.' },
    { name: 'CustomAliasEncodingStrategy', description: "Wraps a user-supplied alias behind the same interface, validating its shape before storage is ever touched." },
    { name: 'IdGenerator', description: 'Process-wide Singleton owning the single AtomicLong counter that Base62CounterEncodingStrategy draws ids from.' },
    { name: 'UrlRepository', description: 'Storage abstraction: atomic insert-if-absent, lookup by code, and delete - the only thing that knows about the backing store.' },
    { name: 'UrlShortenerService', description: 'Orchestrates create (with collision retry) and redirect; the only class client code talks to.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class UrlRecord {
    -String shortCode
    -String longUrl
    -Instant createdAt
    -Instant expiresAt
    -boolean customAlias
    +isExpired(Instant) boolean
  }
  class EncodingStrategy {
    <<interface>>
    +generateCode(String) String
  }
  class Base62CounterEncodingStrategy {
    +generateCode(String) String
  }
  class HashBasedEncodingStrategy {
    +generateCode(String) String
  }
  class CustomAliasEncodingStrategy {
    -String requestedAlias
    +generateCode(String) String
  }
  class IdGenerator {
    -AtomicLong counter
    +getInstance() IdGenerator
    +nextId() long
  }
  class Base62Encoder {
    +encode(long) String
    +decode(String) long
  }
  class UrlRecordFactory {
    +create(String, String, Duration, boolean) UrlRecord
  }
  class UrlRepository {
    <<interface>>
    +saveIfAbsent(UrlRecord) boolean
    +findByCode(String) Optional~UrlRecord~
    +delete(String) void
  }
  class InMemoryUrlRepository {
    -ConcurrentHashMap~String, UrlRecord~ store
    +saveIfAbsent(UrlRecord) boolean
    +findByCode(String) Optional~UrlRecord~
  }
  class ExpiringUrlRepositoryDecorator {
    -UrlRepository delegate
    +findByCode(String) Optional~UrlRecord~
  }
  class UrlShortenerService {
    -UrlRepository repository
    -EncodingStrategy defaultStrategy
    +shorten(String, String, Duration) UrlRecord
    +redirect(String) String
  }

  EncodingStrategy <|.. Base62CounterEncodingStrategy
  EncodingStrategy <|.. HashBasedEncodingStrategy
  EncodingStrategy <|.. CustomAliasEncodingStrategy
  Base62CounterEncodingStrategy ..> IdGenerator : uses
  Base62CounterEncodingStrategy ..> Base62Encoder : uses
  UrlRepository <|.. InMemoryUrlRepository
  UrlRepository <|.. ExpiringUrlRepositoryDecorator
  ExpiringUrlRepositoryDecorator o-- UrlRepository : wraps
  UrlShortenerService o-- UrlRepository
  UrlShortenerService o-- EncodingStrategy
  UrlShortenerService ..> UrlRecordFactory : uses
  UrlRecordFactory ..> UrlRecord : creates
  UrlRepository ..> UrlRecord : stores`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'EncodingStrategy + Base62CounterEncodingStrategy / HashBasedEncodingStrategy / CustomAliasEncodingStrategy', why: 'UrlShortenerService never branches on "which algorithm" - it calls generateCode() on whatever strategy it was handed, so a new algorithm is a new class, not an edited method.' },
    { pattern: 'Factory Method', where: 'UrlRecordFactory.create()', why: 'One place decides how createdAt/expiresAt/customAlias get stamped onto a UrlRecord, whether the code came from a counter, a hash, or a user alias - the constructor is never called anywhere else.' },
    { pattern: 'Singleton', where: 'IdGenerator.getInstance()', why: 'Exactly one AtomicLong must exist per process - if two counters were ever accidentally constructed (e.g. two service instances wired by mistake), two requests could mint the same numeric id and collide by design instead of by bad luck.' },
    { pattern: 'Decorator', where: 'ExpiringUrlRepositoryDecorator wraps UrlRepository', why: 'Adds TTL-expiry semantics on top of any repository implementation without InMemoryUrlRepository (or a future database-backed one) ever knowing expiry exists.' },
  ],

  dataStructures: [
    { component: 'code -> UrlRecord store', structure: 'ConcurrentHashMap<String, UrlRecord>', why: 'putIfAbsent() is an atomic check-and-insert in O(1) average time - two threads racing to claim the same code can never both win, and the hot redirect-lookup path never scans.' },
    { component: 'Global id counter', structure: 'AtomicLong inside the Singleton IdGenerator', why: 'getAndIncrement() is a lock-free CAS loop, so minting a new id never blocks a thread even under heavy concurrent create traffic.' },
    { component: 'Numeric id <-> short code', structure: 'Fixed 62-character alphabet indexed by repeated divide/modulo in Base62Encoder', why: 'Encoding a 64-bit id is O(log62 N) - at most ~11 characters - so codes stay short while still covering trillions of ids before any reuse.' },
    { component: 'Custom alias validation', structure: 'Precompiled regex Pattern checked once per request', why: 'Rejects a malformed alias in O(length) before a single map operation is attempted, so obviously-bad input never reaches storage.' },
  ],

  walkthroughs: [
    {
      title: 'Create Short URL (auto-generated code or custom alias)',
      steps: [
        'Client calls UrlShortenerService.shorten(longUrl, customAlias, ttl).',
        'If a customAlias was supplied, it is wrapped in a CustomAliasEncodingStrategy, which validates its shape (length, allowed characters) before anything touches storage.',
        'If no alias was supplied, the configured default strategy (Base62CounterEncodingStrategy) is asked for a candidate code: it draws the next id from the IdGenerator singleton and base62-encodes it.',
        'UrlRecordFactory.create() builds the UrlRecord, stamping createdAt and, if a ttl was given, expiresAt = now + ttl.',
        'repository.saveIfAbsent() attempts an atomic ConcurrentHashMap.putIfAbsent(); a false return means the code is already taken.',
        'For a generated code, the service loops and requests a fresh candidate (up to MAX_GENERATION_ATTEMPTS) instead of overwriting the existing mapping. For a custom alias, a collision instead throws AliasAlreadyInUseException immediately - a client error, not something to silently retry.',
      ],
    },
    {
      title: 'Redirect Flow (with lazy expiry check)',
      steps: [
        'Client calls UrlShortenerService.redirect(code).',
        'The service looks the code up through the ExpiringUrlRepositoryDecorator, not the raw in-memory repository directly.',
        'The decorator delegates the lookup, then checks record.isExpired(Instant.now()) itself - the underlying InMemoryUrlRepository has no idea expiry exists.',
        'If the record is expired, the decorator evicts it from the delegate and returns an empty result, exactly as if the code had never been issued.',
        'An empty result - whether the code was never issued or was just evicted for expiry - raises the same ShortUrlNotFoundException, so the HTTP layer returns a flat 404 without leaking which case it was.',
        "On success, the caller issues an HTTP redirect with Location set to record.getLongUrl().",
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'UrlRecord.java',
      rationale: 'A plain immutable value object. Once created, a mapping never mutates - "expired" is a computed fact (isExpired), not a field someone has to remember to flip.',
      code: `import java.time.Instant;

public final class UrlRecord {
    private final String shortCode;
    private final String longUrl;
    private final Instant createdAt;
    private final Instant expiresAt; // nullable - null means "never expires"
    private final boolean customAlias;

    public UrlRecord(String shortCode, String longUrl, Instant createdAt, Instant expiresAt, boolean customAlias) {
        this.shortCode = shortCode;
        this.longUrl = longUrl;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.customAlias = customAlias;
    }

    public boolean isExpired(Instant now) {
        return expiresAt != null && now.isAfter(expiresAt);
    }

    public String getShortCode() { return shortCode; }
    public String getLongUrl() { return longUrl; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isCustomAlias() { return customAlias; }
}`,
    },
    {
      filename: 'EncodingStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This one-method interface is the entire reason UrlShortenerService never has an if/else on "which generation algorithm is active". Counter-based, hash-based, or a validated custom alias all look identical to the service - it just calls generateCode() and checks the result against storage.',
      rationale: 'Deliberately storage-agnostic: a strategy only proposes a code, it never writes anywhere. That keeps every implementation trivially unit-testable in isolation.',
      code: `public interface EncodingStrategy {
    /**
     * Produces a candidate short code for the given long URL. "Candidate" because the
     * caller (UrlShortenerService) is responsible for checking it against the repository
     * and retrying with a fresh candidate on collision - the strategy itself never touches storage.
     */
    String generateCode(String longUrl);
}`,
    },
    {
      filename: 'Base62Encoder.java',
      rationale: 'A pure, stateless utility shared by any strategy that needs to turn a number into a short alphanumeric code - kept separate from the strategies themselves so it can be reused (and tested) independently.',
      code: `public final class Base62Encoder {
    private static final char[] ALPHABET =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".toCharArray();
    private static final int BASE = ALPHABET.length;

    private Base62Encoder() {}

    public static String encode(long value) {
        if (value == 0) return String.valueOf(ALPHABET[0]);
        StringBuilder sb = new StringBuilder();
        long n = value;
        while (n > 0) {
            sb.append(ALPHABET[(int) (n % BASE)]);
            n /= BASE;
        }
        return sb.reverse().toString();
    }

    public static long decode(String code) {
        long result = 0;
        for (char c : code.toCharArray()) {
            int digit = indexOf(c);
            if (digit < 0) {
                throw new IllegalArgumentException("Invalid base62 character: " + c);
            }
            result = result * BASE + digit;
        }
        return result;
    }

    private static int indexOf(char c) {
        for (int i = 0; i < ALPHABET.length; i++) {
            if (ALPHABET[i] == c) return i;
        }
        return -1;
    }
}`,
    },
    {
      filename: 'IdGenerator.java',
      calloutTitle: '💡 Singleton Pattern',
      callout:
        'Uniqueness of generated codes rests entirely on there being exactly one counter in the process. Singleton does not just save a few bytes of memory here - it removes an entire class of bug where a second AtomicLong (created by accident in a DI wiring mistake) would silently start handing out ids that collide with the first one.',
      rationale: 'Private constructor plus a single static final instance means no caller can ever construct a second, independent counter - the compiler enforces the invariant, not a code review comment.',
      code: `import java.util.concurrent.atomic.AtomicLong;

public final class IdGenerator {
    private static final IdGenerator INSTANCE = new IdGenerator();

    // Start well above zero so encode(0) never gets handed out as a "real" code -
    // that value stays reserved for internal/sentinel use.
    private final AtomicLong counter = new AtomicLong(1_000_000L);

    private IdGenerator() {}

    public static IdGenerator getInstance() {
        return INSTANCE;
    }

    public long nextId() {
        return counter.getAndIncrement();
    }
}`,
    },
    {
      filename: 'Base62CounterEncodingStrategy.java',
      rationale: 'The default strategy: short, dense codes with no wasted characters, at the cost of being sequential (and therefore guessable in order) - an acceptable trade for an interview-scope shortener, called out explicitly in the extensions.',
      code: `public final class Base62CounterEncodingStrategy implements EncodingStrategy {
    @Override
    public String generateCode(String longUrl) {
        long id = IdGenerator.getInstance().nextId();
        return Base62Encoder.encode(id);
    }
}`,
    },
    {
      filename: 'HashBasedEncodingStrategy.java',
      rationale: 'An alternative that derives the code from URL content instead of a sequential id, so identical URLs tend to hash toward the same code (useful for de-duplication) and codes are not trivially enumerable in issuance order. The per-call salt keeps a retry after a collision from hashing to the same value twice.',
      code: `import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.concurrent.atomic.AtomicInteger;

public final class HashBasedEncodingStrategy implements EncodingStrategy {
    private static final int CODE_LENGTH = 7;
    private final AtomicInteger attempt = new AtomicInteger(0);

    @Override
    public String generateCode(String longUrl) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String salted = longUrl + "#" + attempt.getAndIncrement();
            byte[] hash = digest.digest(salted.getBytes(StandardCharsets.UTF_8));

            long truncated = 0;
            for (int i = 0; i < 8; i++) {
                truncated = (truncated << 8) | (hash[i] & 0xFF);
            }
            String encoded = Base62Encoder.encode(Math.abs(truncated));
            return encoded.length() > CODE_LENGTH ? encoded.substring(0, CODE_LENGTH) : encoded;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}`,
    },
    {
      filename: 'CustomAliasEncodingStrategy.java',
      rationale: "Not really 'generation' at all - the user supplies the code and this class's only job is validating it before the service ever checks storage. Keeping it behind the same EncodingStrategy interface means the create-flow never has an if (isCustom) branch.",
      code: `import java.util.regex.Pattern;

public final class CustomAliasEncodingStrategy implements EncodingStrategy {
    private static final Pattern VALID_ALIAS = Pattern.compile("^[a-zA-Z0-9_-]{3,20}$");

    private final String requestedAlias;

    public CustomAliasEncodingStrategy(String requestedAlias) {
        if (requestedAlias == null || !VALID_ALIAS.matcher(requestedAlias).matches()) {
            throw new IllegalArgumentException(
                "Alias must be 3-20 characters of letters, digits, '-' or '_': " + requestedAlias);
        }
        this.requestedAlias = requestedAlias;
    }

    @Override
    public String generateCode(String longUrl) {
        return requestedAlias;
    }
}`,
    },
    {
      filename: 'UrlRecordFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'Whether the code came from a counter, a hash, or a validated alias, and whether or not a TTL was requested, every UrlRecord is born in exactly one place. If a "createdBy" audit field or a default TTL policy is added later, this is the only method that changes.',
      rationale: 'A private constructor on the factory would be pointless here (there is no state to hide), so it is kept as static methods on a non-instantiable utility class, matching Base62Encoder.',
      code: `import java.time.Duration;
import java.time.Instant;

public final class UrlRecordFactory {
    private UrlRecordFactory() {}

    public static UrlRecord create(String shortCode, String longUrl, Duration ttl, boolean isCustomAlias) {
        Instant now = Instant.now();
        Instant expiresAt = ttl == null ? null : now.plus(ttl);
        return new UrlRecord(shortCode, longUrl, now, expiresAt, isCustomAlias);
    }
}`,
    },
    {
      filename: 'UrlRepository.java',
      rationale: 'A three-method interface keeps every implementation (in-memory, database-backed, decorated) trivially substitutable behind UrlShortenerService.',
      code: `import java.util.Optional;

public interface UrlRepository {
    /** Atomically inserts the record iff no record exists for its code yet. Returns false on a collision. */
    boolean saveIfAbsent(UrlRecord record);

    Optional<UrlRecord> findByCode(String code);

    void delete(String code);
}`,
    },
    {
      filename: 'InMemoryUrlRepository.java',
      rationale: 'The default, dependency-free backing store. Nothing here knows about expiry, rate limits, or anything else - those are layered on via decorators, keeping this class small and easy to reason about.',
      code: `import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public final class InMemoryUrlRepository implements UrlRepository {
    private final ConcurrentHashMap<String, UrlRecord> store = new ConcurrentHashMap<>();

    @Override
    public boolean saveIfAbsent(UrlRecord record) {
        // putIfAbsent is atomic: two threads racing on the same generated code can never
        // both "win" and overwrite each other's mapping.
        return store.putIfAbsent(record.getShortCode(), record) == null;
    }

    @Override
    public Optional<UrlRecord> findByCode(String code) {
        return Optional.ofNullable(store.get(code));
    }

    @Override
    public void delete(String code) {
        store.remove(code);
    }
}`,
    },
    {
      filename: 'ExpiringUrlRepositoryDecorator.java',
      calloutTitle: '💡 Decorator Pattern',
      callout:
        'InMemoryUrlRepository never learns that expiry exists. This decorator wraps it, intercepts findByCode(), and evicts+hides an expired record as a side effect of the read that discovered it - no background sweeper thread required, and the same trick (wrap, intercept, delegate) works for rate limiting or caching later.',
      rationale: 'Implements the same UrlRepository interface it wraps, so UrlShortenerService cannot tell (and does not need to know) whether it is talking to a plain repository or a decorated one.',
      code: `import java.time.Instant;
import java.util.Optional;

public final class ExpiringUrlRepositoryDecorator implements UrlRepository {
    private final UrlRepository delegate;

    public ExpiringUrlRepositoryDecorator(UrlRepository delegate) {
        this.delegate = delegate;
    }

    @Override
    public boolean saveIfAbsent(UrlRecord record) {
        return delegate.saveIfAbsent(record);
    }

    @Override
    public Optional<UrlRecord> findByCode(String code) {
        Optional<UrlRecord> found = delegate.findByCode(code);
        if (found.isPresent() && found.get().isExpired(Instant.now())) {
            delegate.delete(code);
            return Optional.empty();
        }
        return found;
    }

    @Override
    public void delete(String code) {
        delegate.delete(code);
    }
}`,
    },
    {
      filename: 'AliasAlreadyInUseException.java',
      rationale: 'A distinct exception type from the generated-code collision path on purpose - a taken custom alias is a client-facing 409, not something the service should silently retry around.',
      code: `public final class AliasAlreadyInUseException extends RuntimeException {
    public AliasAlreadyInUseException(String alias) {
        super("Alias '" + alias + "' is already in use");
    }
}`,
    },
    {
      filename: 'ShortUrlNotFoundException.java',
      rationale: "Thrown for both 'this code was never issued' and 'this code expired'. Collapsing the two into one exception at the API boundary is deliberate - a 404 should not tell a client whether a code once existed, which would leak information about issuance volume or timing.",
      code: `public final class ShortUrlNotFoundException extends RuntimeException {
    public ShortUrlNotFoundException(String code) {
        super("No active short URL for code: " + code);
    }
}`,
    },
    {
      filename: 'UrlShortenerService.java',
      rationale: 'The only class client code holds a reference to. It owns exactly two responsibilities - collision-retry on create, and expiry-transparent lookup on redirect - and delegates everything else (encoding, storage, record construction) to collaborators.',
      code: `import java.time.Duration;

public final class UrlShortenerService {
    private static final int MAX_GENERATION_ATTEMPTS = 5;

    private final UrlRepository repository;
    private final EncodingStrategy defaultStrategy;

    public UrlShortenerService(UrlRepository repository, EncodingStrategy defaultStrategy) {
        this.repository = repository;
        this.defaultStrategy = defaultStrategy;
    }

    public UrlRecord shorten(String longUrl, String customAlias, Duration ttl) {
        if (customAlias != null && !customAlias.isBlank()) {
            EncodingStrategy strategy = new CustomAliasEncodingStrategy(customAlias);
            String code = strategy.generateCode(longUrl);
            UrlRecord record = UrlRecordFactory.create(code, longUrl, ttl, true);
            if (!repository.saveIfAbsent(record)) {
                throw new AliasAlreadyInUseException(customAlias);
            }
            return record;
        }
        return shortenWithGeneratedCode(longUrl, ttl);
    }

    private UrlRecord shortenWithGeneratedCode(String longUrl, Duration ttl) {
        for (int attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            String code = defaultStrategy.generateCode(longUrl);
            UrlRecord record = UrlRecordFactory.create(code, longUrl, ttl, false);
            if (repository.saveIfAbsent(record)) {
                return record;
            }
            // Collision: another request already owns this code - loop and try again
            // instead of overwriting an existing mapping.
        }
        throw new IllegalStateException(
            "Failed to generate a unique short code after " + MAX_GENERATION_ATTEMPTS + " attempts");
    }

    public String redirect(String code) {
        UrlRecord record = repository.findByCode(code)
            .orElseThrow(() -> new ShortUrlNotFoundException(code));
        return record.getLongUrl();
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the auto-generated happy path, a custom alias happy path, an alias collision, an expiry edge case, and - since thread-safe code generation is a stated non-functional requirement - a concurrent stress test proving many simultaneous creates never produce a duplicate code.',
      code: `import java.time.Duration;
import java.util.Set;
import java.util.concurrent.*;

public final class Demo {
    public static void main(String[] args) throws Exception {
        UrlRepository baseRepo = new InMemoryUrlRepository();
        UrlRepository repo = new ExpiringUrlRepositoryDecorator(baseRepo);
        UrlShortenerService service = new UrlShortenerService(repo, new Base62CounterEncodingStrategy());

        // Happy path: auto-generated code
        UrlRecord r1 = service.shorten("https://example.com/very/long/path", null, null);
        System.out.println("Shortened to code " + r1.getShortCode() + " -> " + r1.getLongUrl());
        System.out.println("Redirect resolves to: " + service.redirect(r1.getShortCode()));

        // Happy path: custom alias
        UrlRecord r2 = service.shorten("https://example.com/interview-prep", "myalias", null);
        System.out.println("Custom alias registered: " + r2.getShortCode());

        // Collision on the same custom alias
        try {
            service.shorten("https://example.com/different-target", "myalias", null);
        } catch (AliasAlreadyInUseException e) {
            System.out.println("Expected failure: " + e.getMessage());
        }

        // Expiry: a link with a 50ms TTL should stop resolving shortly after creation
        UrlRecord r3 = service.shorten("https://example.com/temporary", null, Duration.ofMillis(50));
        Thread.sleep(100);
        try {
            service.redirect(r3.getShortCode());
        } catch (ShortUrlNotFoundException e) {
            System.out.println("Expected expiry failure: " + e.getMessage());
        }

        // Concurrency check: many threads shortening distinct URLs at once must never be
        // handed the same code, since IdGenerator's AtomicLong is a shared Singleton.
        int threadCount = 50;
        ExecutorService pool = Executors.newFixedThreadPool(16);
        Set<String> codesSeen = ConcurrentHashMap.newKeySet();
        CountDownLatch done = new CountDownLatch(threadCount);
        for (int i = 0; i < threadCount; i++) {
            final int idx = i;
            pool.submit(() -> {
                try {
                    UrlRecord record = service.shorten("https://example.com/page-" + idx, null, null);
                    codesSeen.add(record.getShortCode());
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();
        System.out.println("Unique codes generated by " + threadCount + " concurrent requests: "
            + codesSeen.size() + " (expected " + threadCount + ")");
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Short URL Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> Active: saveIfAbsent() succeeds
  Active --> Active: findByCode() before expiresAt
  Active --> Expired: findByCode() evaluated after expiresAt has passed
  Expired --> Evicted: decorator calls delegate.delete()
  Evicted --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Shorten with Collision Retry',
    mermaid: `sequenceDiagram
  autonumber
  participant Client
  participant Svc as UrlShortenerService
  participant Strat as EncodingStrategy
  participant Gen as IdGenerator
  participant Repo as UrlRepository

  Client->>Svc: shorten(longUrl, alias=null, ttl)
  loop up to MAX_GENERATION_ATTEMPTS
    Svc->>Strat: generateCode(longUrl)
    Strat->>Gen: nextId()
    Gen-->>Strat: id
    Strat-->>Svc: candidateCode
    Svc->>Repo: saveIfAbsent(record)
    alt code already taken
      Repo-->>Svc: false
    else inserted
      Repo-->>Svc: true
    end
  end
  Svc-->>Client: UrlRecord(shortCode, longUrl)`,
  },

  extensions: [
    { extension: 'Click analytics', implementation: 'Add a ClickEvent entity and an AnalyticsRecorder invoked from redirect() - ideally fired at-least-once onto a queue so recording a click never slows the redirect critical path.' },
    { extension: 'Rate limiting per API key / IP', implementation: 'Add a RateLimitingUrlRepositoryDecorator wrapping UrlRepository, mirroring ExpiringUrlRepositoryDecorator - throttling is a cross-cutting concern, not a change to UrlShortenerService.' },
    { extension: 'QR code generation', implementation: 'Add a QrCodeGenerator called after shorten() returns a UrlRecord - purely additive, no core class changes.' },
    { extension: 'Distributed id generation', implementation: "Replace the single-JVM IdGenerator singleton with coordinated ids (Snowflake IDs, pre-allocated id ranges per node, or a DB sequence) so uniqueness holds across a horizontally-scaled fleet, not just one process." },
    { extension: 'Persistent storage backend', implementation: 'Swap InMemoryUrlRepository for a database- or Redis-backed UrlRepository implementation with zero changes to UrlShortenerService or any decorator wrapping it.' },
    { extension: 'Malware / phishing URL scanning', implementation: 'Add a validation step (or another decorator) ahead of UrlRecordFactory.create() that rejects known-bad long URLs before a code is ever minted for them.' },
  ],

  interviewerChecklist: [
    'Does the candidate separate "generate a candidate code" from "commit it to storage", treating a collision as an expected case to retry rather than an error?',
    'Is code lookup O(1) via a hash map, and is the write path (saveIfAbsent / putIfAbsent) actually atomic rather than a check-then-put race?',
    'Can a new encoding algorithm be added without touching UrlShortenerService?',
    "Is expiry checked at read time (not only by a background sweeper), so a record is never served stale between sweeps?",
    'Does a taken custom alias fail distinctly and immediately, versus a generated-code collision which retries?',
    'Does redirect() return the same "not found" response for both a nonexistent and an expired code, avoiding an information leak about which codes were ever issued?',
  ],

  relatedDesigns: ['multilevel-cache'],
  keyTakeaways: [
    'Strategy separates "how do we pick a code" from "how do we store it" - the service loops on saveIfAbsent() the same way regardless of which strategy produced the candidate.',
    'A Singleton for the id counter is not about restricting object creation for its own sake - it is the only way to guarantee every generated id is unique within a process without threading a shared counter reference through every constructor by hand.',
    'Decorator bolts "expires" onto "stores/retrieves" without the base repository ever knowing time exists - the same trick extends cleanly to rate limiting, caching, or auditing.',
    'Collapsing "never existed" and "expired" into one exception at the boundary is a deliberate consistency and security choice, not a shortcut - the two cases should look identical to a client either way.',
  ],
}

export default problem

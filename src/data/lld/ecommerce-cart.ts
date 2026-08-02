import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'ecommerce-cart',
  title: 'E-commerce Cart',
  difficulty: 'Intermediate',
  icon: 'pi pi-shopping-bag',
  color: '#f43f5e',
  readTimeMinutes: 16,
  patterns: ['Strategy', 'Decorator', 'Builder'],
  companies: ['Amazon', 'Flipkart', 'Shopify', 'Myntra'],
  summary:
    'A shopping cart and checkout pipeline that layers coupon discounts and tax on top of a cart subtotal as composable price components, enforces a concrete set of coupon eligibility rules (minimum cart value, one-redemption-per-user, stackable vs non-stackable), and reserves stock atomically at checkout so the very last unit of a product can never be sold to two carts at once.',

  functionalRequirements: [
    'Model a Cart as a collection of line items (product + quantity); support add, remove, and update-quantity operations that keep the cart consistent (quantity must stay >= 1, removing the last unit removes the line item).',
    'Compute a price pipeline: cart subtotal -> apply at most one discount-bearing coupon via a pluggable discount algorithm (percentage-off, flat-off, or buy-X-get-Y) -> apply tax -> final payable total.',
    'Enforce coupon eligibility rules before a coupon is accepted: the cart subtotal must meet the coupon\'s minimum value, the coupon must not have already been redeemed by this user, and a non-stackable coupon cannot be combined with another already-applied non-stackable coupon.',
    'Validate every line item\'s quantity against available stock before checkout can proceed, and reserve that stock (decrement it) as part of checkout rather than merely checking it, so a race between two concurrent checkouts on the same last unit cannot oversell it.',
    'Produce an immutable, checkout-ready order summary (line items, subtotal, discount applied, tax, grand total) once pricing and stock reservation both succeed.',
    'Reject checkout cleanly - leaving the cart and stock ledger untouched - if the cart is empty, the coupon is not eligible, or any line item cannot be fully reserved.',
  ],
  nonFunctionalRequirements: [
    'Price calculation must be a pure, deterministic function of (cart contents, coupon, tax rate) with no hidden global or mutable state, so it is trivially unit-testable in isolation from stock and persistence.',
    'Adding a new discount type (e.g. a "spend $200 get free shipping" rule) must not require touching Cart or CheckoutService - it should be a new class that plugs into the existing pipeline.',
    'Stock reservation for the last unit of a product must be race-free: two carts checking out the exact same last unit at the same instant must never both succeed.',
    'A failed checkout (bad coupon, insufficient stock) must not leave partial side effects behind - either the whole reservation succeeds or none of it does.',
  ],

  coreEntities: [
    { name: 'Product', description: 'Catalog item - id, name, unit price. Immutable; price changes are a new catalog entry, not a mutation of an existing one mid-cart.' },
    { name: 'CartItem', description: 'A (product, quantity) pairing inside a cart - the unit that quantity validation, stock reservation, and line-total math all operate on.' },
    { name: 'Cart', description: 'Owns the line items for one user - add/remove/update-quantity, and exposes a deterministic subtotal used as the seed of the pricing pipeline.' },
    { name: 'DiscountStrategy', description: 'Interface for computing a discount amount from a subtotal and line items - the interchangeable "how much off" algorithm behind a coupon (percentage-off, flat-off, buy-X-get-Y).' },
    { name: 'Coupon', description: 'A named discount offer - wraps a DiscountStrategy plus its eligibility rules (minimum cart value, stackability) that a coupon strategy alone cannot know about.' },
    { name: 'CouponService', description: 'Owns the coupon catalog and per-user redemption history; the sole authority on whether a coupon may be applied to a given cart right now.' },
    { name: 'PriceComponent', description: 'Interface for one stage of the price pipeline (getAmount()) - the Decorator abstraction that subtotal, discount, and tax all implement uniformly.' },
    { name: 'StockReservationService', description: 'Owns the live stock ledger and performs the one concurrency-critical operation in the system: atomically reserving (or rolling back) quantities for every line item in a cart.' },
    { name: 'OrderSummary', description: 'Immutable, fully-priced snapshot produced at the end of a successful checkout - assembled field-by-field through a Builder rather than a sprawling constructor.' },
    { name: 'CheckoutService', description: 'The aggregate root for checkout - orchestrates validation, coupon resolution, price-pipeline construction, and stock reservation in a fixed, side-effect-ordered sequence.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Product {
    -String id
    -String name
    -BigDecimal unitPrice
    +getUnitPrice() BigDecimal
  }
  class CartItem {
    -Product product
    -int quantity
    +setQuantity(int) void
    +lineTotal() BigDecimal
  }
  class Cart {
    -String cartId
    -String userId
    -LinkedHashMap~String, CartItem~ itemsByProductId
    -String appliedCouponCode
    +addItem(Product, int) void
    +removeItem(String) void
    +updateQuantity(String, int) void
    +getSubtotal() BigDecimal
    +getItems() Collection~CartItem~
  }
  class DiscountStrategy {
    <<interface>>
    +computeDiscount(BigDecimal, List~CartItem~) BigDecimal
  }
  class PercentageOffDiscountStrategy {
    -BigDecimal percentage
    +computeDiscount(BigDecimal, List~CartItem~) BigDecimal
  }
  class FlatOffDiscountStrategy {
    -BigDecimal flatAmount
    +computeDiscount(BigDecimal, List~CartItem~) BigDecimal
  }
  class BuyXGetYDiscountStrategy {
    -String targetProductId
    -int buyQty
    -int getFreeQty
    +computeDiscount(BigDecimal, List~CartItem~) BigDecimal
  }
  class Coupon {
    -String code
    -DiscountStrategy strategy
    -BigDecimal minCartValue
    -boolean stackable
    +isEligible(BigDecimal) boolean
  }
  class CouponService {
    -Map~String, Coupon~ catalog
    -ConcurrentHashMap~String, Set~String~~ redemptionsByCode
    +validate(String, Cart, String) Coupon
    +recordRedemption(String, String) void
  }
  class PriceComponent {
    <<interface>>
    +getAmount() BigDecimal
    +getDescription() String
  }
  class CartSubtotalComponent {
    -Cart cart
    +getAmount() BigDecimal
  }
  class CouponDiscountComponent {
    -PriceComponent inner
    -DiscountStrategy strategy
    -List~CartItem~ items
    +getAmount() BigDecimal
  }
  class TaxComponent {
    -PriceComponent inner
    -BigDecimal taxRate
    +getAmount() BigDecimal
  }
  class StockReservationService {
    -ConcurrentHashMap~String, AtomicInteger~ stockByProductId
    +tryReserve(String, int) boolean
    +release(String, int) void
    +reserveAll(List~CartItem~) void
  }
  class OrderSummary {
    -String orderId
    -String cartId
    -List~CartItem~ lineItems
    -BigDecimal subtotal
    -BigDecimal discountAmount
    -BigDecimal taxAmount
    -BigDecimal grandTotal
  }
  class OrderSummaryBuilder {
    +withCart(Cart) OrderSummaryBuilder
    +withDiscount(BigDecimal, String) OrderSummaryBuilder
    +withTax(BigDecimal) OrderSummaryBuilder
    +build() OrderSummary
  }
  class CheckoutService {
    -CouponService couponService
    -StockReservationService stockService
    -BigDecimal taxRate
    +checkout(Cart, String, String) OrderSummary
  }
  class CouponNotApplicableException
  class InsufficientStockException

  DiscountStrategy <|.. PercentageOffDiscountStrategy
  DiscountStrategy <|.. FlatOffDiscountStrategy
  DiscountStrategy <|.. BuyXGetYDiscountStrategy
  Coupon o-- DiscountStrategy
  CouponService o-- Coupon
  PriceComponent <|.. CartSubtotalComponent
  PriceComponent <|.. CouponDiscountComponent
  PriceComponent <|.. TaxComponent
  CouponDiscountComponent o-- PriceComponent : wraps
  CouponDiscountComponent o-- DiscountStrategy
  TaxComponent o-- PriceComponent : wraps
  CartSubtotalComponent o-- Cart
  Cart o-- CartItem
  CartItem o-- Product
  CheckoutService ..> CouponService
  CheckoutService ..> StockReservationService
  CheckoutService ..> PriceComponent : builds chain
  CheckoutService ..> OrderSummaryBuilder
  OrderSummaryBuilder ..> OrderSummary : builds
  CheckoutService ..> CouponNotApplicableException
  CheckoutService ..> InsufficientStockException`,
  },

  designPatterns: [
    {
      pattern: 'Decorator',
      where: 'PriceComponent + CartSubtotalComponent / CouponDiscountComponent / TaxComponent',
      why: 'Tax, coupon discount, and (later) a shipping surcharge or gift-wrap fee are orthogonal adjustments that stack on top of each other in sequence - each stage only needs to know the running amount from the stage it wraps, not the whole pipeline. A pure Strategy pipeline would need CheckoutService to know the fixed list of stages and call each by name; with Decorator, checkout() just calls getAmount() on whichever component is outermost, so inserting a new stage (e.g. ShippingFeeComponent) is "wrap one more layer" and never touches CheckoutService.',
    },
    {
      pattern: 'Strategy',
      where: 'DiscountStrategy + PercentageOffDiscountStrategy / FlatOffDiscountStrategy / BuyXGetYDiscountStrategy',
      why: 'Within a single CouponDiscountComponent stage there is exactly one active discount algorithm per coupon, not a stack of them - that is a swap, not a composition, so Strategy fits better here than nesting more decorators. A new discount type is a new class implementing one method; CouponDiscountComponent never branches on which kind of coupon it was handed.',
    },
    {
      pattern: 'Builder',
      where: 'OrderSummaryBuilder',
      why: 'OrderSummary has several optional-in-isolation but jointly-required fields (discount only present if a coupon applied, tax always present, line items snapshotted at checkout time) - a Builder assembles them incrementally and validates completeness in one build() call instead of a constructor with an error-prone long parameter list or a mutable summary that could be read half-built.',
    },
  ],

  dataStructures: [
    { component: 'Cart line items', structure: 'LinkedHashMap<String productId, CartItem>', why: 'O(1) add/remove/update by productId while preserving the order items were added, so the order summary and receipt show line items in a stable, user-recognizable order instead of hash-bucket order.' },
    { component: 'Coupon redemption history', structure: 'ConcurrentHashMap<String couponCode, Set<String> userIds>', why: 'validate() and recordRedemption() can run from concurrent checkout requests; a thread-safe map avoids a global lock around "has this user used this code before" for every coupon in the catalog.' },
    { component: 'Live stock ledger', structure: 'ConcurrentHashMap<String productId, AtomicInteger>, reserved via a compare-and-swap loop', why: 'AtomicInteger.compareAndSet is the textbook race-free decrement: read the current count, only commit the decrement if nobody else changed it since, retry otherwise - exactly what "never oversell the last unit" requires, with no coarse-grained lock across the whole ledger.' },
    { component: 'Coupon catalog', structure: 'HashMap<String code, Coupon>', why: 'Coupons are configured up front and looked up by code on every checkout attempt - O(1) lookup with no need for ordering or concurrent mutation of the catalog itself.' },
  ],

  walkthroughs: [
    {
      title: 'Full Price Calculation: Base -> Coupon -> Tax -> Total',
      steps: [
        'Cart has two line items: Wireless Mouse ($24.99 x 2 = $49.98) and Mechanical Keyboard ($89.99 x 1 = $89.99). CartSubtotalComponent.getAmount() sums line totals to $139.97 - this is the innermost, undecorated stage of the pipeline.',
        'User applies coupon "WELCOME15" (PercentageOffDiscountStrategy at 15%, minCartValue $50.00, stackable=false). CouponService.validate() checks $139.97 >= $50.00 and that this user has never redeemed WELCOME15 before - both pass, so CheckoutService wraps the subtotal component in a CouponDiscountComponent holding that strategy.',
        'CouponDiscountComponent.getAmount() asks its strategy for the discount on $139.97: 15% = $20.9955, rounded HALF_UP to $21.00, then returns inner.getAmount().subtract(discount) = $139.97 - $21.00 = $118.97.',
        'CheckoutService wraps that in a TaxComponent configured with an 8% tax rate. TaxComponent.getAmount() computes tax on the already-discounted amount: $118.97 x 0.08 = $9.5176, rounded to $9.52, and returns $118.97 + $9.52 = $128.49 - the final payable total.',
        'CheckoutService reads getAmount() only once, from the outermost TaxComponent - it never has to know how many layers are underneath it, which is exactly why a fourth layer (say, a flat $5.99 shipping fee) could be inserted later without changing this call site.',
        'OrderSummaryBuilder is given the subtotal ($139.97), the discount ($21.00, code WELCOME15), the tax ($9.52), and the grand total ($128.49) and assembles the immutable OrderSummary that gets returned to the user and handed to payment.',
      ],
    },
    {
      title: 'Contested Last Unit: Two Carts Race At Checkout',
      steps: [
        'Product "GPU-4090" has exactly 1 unit left in StockReservationService\'s ledger (stockByProductId.get("GPU-4090") == 1). Two different users, A and B, each have one GPU-4090 in their cart and both click "Place Order" within the same millisecond.',
        'Both checkout() calls reach CheckoutService.reserveStock(), which calls StockReservationService.reserveAll() for each cart\'s line items; both threads independently call tryReserve("GPU-4090", 1).',
        'Inside tryReserve(), both threads read current = 1 via AtomicInteger.get(). Both compute current - 1 = 0 and race to call compareAndSet(1, 0) - by definition of CAS, exactly one of them succeeds; the loser\'s compareAndSet returns false because the value it expected (1) is no longer there.',
        'The losing thread\'s compareAndSet failure sends it back to re-read current, which is now 0; since 0 < 1 (the requested quantity), tryReserve returns false for that thread without ever touching the counter again.',
        'reserveAll() for the losing cart sees a false result, immediately calls release() on any other line items it may have already reserved earlier in that same cart (a two-phase reserve-then-rollback, so a five-item cart never ends up holding four reservations for an order that ultimately fails), and CheckoutService surfaces an InsufficientStockException to user B.',
        'User A\'s checkout proceeds to price-pipeline evaluation and OrderSummary construction with the reservation already locked in; user B\'s cart is left untouched (their GPU-4090 line item is still there for them to remove or wait on a restock) - no partial state, no oversell, no lock held across the whole ledger while this played out.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Product.java',
      rationale: 'Immutable catalog value object - a price change is modeled as a new Product/catalog entry, never a mutation of unitPrice on an object cart items already reference.',
      code: `import java.math.BigDecimal;

public final class Product {
    private final String id;
    private final String name;
    private final BigDecimal unitPrice;

    public Product(String id, String name, BigDecimal unitPrice) {
        this.id = id;
        this.name = name;
        this.unitPrice = unitPrice;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public BigDecimal getUnitPrice() { return unitPrice; }
}`,
    },
    {
      filename: 'CartItem.java',
      rationale: 'Quantity is the only mutable field; setQuantity() rejects non-positive values here so an invalid quantity can never even enter the cart, rather than being caught later at checkout.',
      code: `import java.math.BigDecimal;

public final class CartItem {
    private final Product product;
    private int quantity;

    public CartItem(Product product, int quantity) {
        this.product = product;
        setQuantity(quantity);
    }

    public void setQuantity(int quantity) {
        if (quantity < 1) {
            throw new IllegalArgumentException("Quantity must be >= 1, got " + quantity);
        }
        this.quantity = quantity;
    }

    public BigDecimal lineTotal() {
        return product.getUnitPrice().multiply(BigDecimal.valueOf(quantity));
    }

    public Product getProduct() { return product; }
    public int getQuantity() { return quantity; }
}`,
    },
    {
      filename: 'Cart.java',
      rationale: 'LinkedHashMap keyed by productId gives O(1) add/remove/update while keeping line items in the order the user added them - removeItem simply drops the key rather than leaving a zero-quantity ghost row.',
      code: `import java.math.BigDecimal;
import java.util.*;

public final class Cart {
    private final String cartId;
    private final String userId;
    private final LinkedHashMap<String, CartItem> itemsByProductId = new LinkedHashMap<>();

    public Cart(String cartId, String userId) {
        this.cartId = cartId;
        this.userId = userId;
    }

    public void addItem(Product product, int quantity) {
        CartItem existing = itemsByProductId.get(product.getId());
        if (existing != null) {
            existing.setQuantity(existing.getQuantity() + quantity);
        } else {
            itemsByProductId.put(product.getId(), new CartItem(product, quantity));
        }
    }

    public void removeItem(String productId) {
        itemsByProductId.remove(productId);
    }

    public void updateQuantity(String productId, int quantity) {
        CartItem item = itemsByProductId.get(productId);
        if (item == null) {
            throw new NoSuchElementException("No such line item: " + productId);
        }
        item.setQuantity(quantity);
    }

    public BigDecimal getSubtotal() {
        BigDecimal total = BigDecimal.ZERO;
        for (CartItem item : itemsByProductId.values()) {
            total = total.add(item.lineTotal());
        }
        return total;
    }

    public Collection<CartItem> getItems() { return itemsByProductId.values(); }
    public boolean isEmpty() { return itemsByProductId.isEmpty(); }
    public String getCartId() { return cartId; }
    public String getUserId() { return userId; }
}`,
    },
    {
      filename: 'DiscountStrategy.java',
      rationale: 'A single-method interface deliberately given both the subtotal and the raw line items - percentage/flat discounts only need the former, but buy-X-get-Y needs the latter to find the target product\'s unit price.',
      code: `import java.math.BigDecimal;
import java.util.List;

public interface DiscountStrategy {
    BigDecimal computeDiscount(BigDecimal subtotal, List<CartItem> items);
}`,
    },
    {
      filename: 'PercentageOffDiscountStrategy.java',
      rationale: 'Rounds HALF_UP to 2 decimal places at the point the discount is computed, so downstream stages (tax) always operate on already-currency-rounded numbers instead of compounding rounding error.',
      code: `import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

public final class PercentageOffDiscountStrategy implements DiscountStrategy {
    private final BigDecimal percentage; // e.g. 0.15 for 15%

    public PercentageOffDiscountStrategy(BigDecimal percentage) {
        this.percentage = percentage;
    }

    @Override
    public BigDecimal computeDiscount(BigDecimal subtotal, List<CartItem> items) {
        return subtotal.multiply(percentage).setScale(2, RoundingMode.HALF_UP);
    }
}`,
    },
    {
      filename: 'FlatOffDiscountStrategy.java',
      rationale: 'Caps the discount at the subtotal itself - a $50-off coupon on a $30 cart discounts to zero, never a negative total.',
      code: `import java.math.BigDecimal;
import java.util.List;

public final class FlatOffDiscountStrategy implements DiscountStrategy {
    private final BigDecimal flatAmount;

    public FlatOffDiscountStrategy(BigDecimal flatAmount) {
        this.flatAmount = flatAmount;
    }

    @Override
    public BigDecimal computeDiscount(BigDecimal subtotal, List<CartItem> items) {
        return flatAmount.min(subtotal);
    }
}`,
    },
    {
      filename: 'BuyXGetYDiscountStrategy.java',
      rationale: 'The only strategy that needs the raw line items instead of just the subtotal - it has to find the target product\'s quantity and unit price to know how many free units the cart actually earned.',
      code: `import java.math.BigDecimal;
import java.util.List;

public final class BuyXGetYDiscountStrategy implements DiscountStrategy {
    private final String targetProductId;
    private final int buyQty;
    private final int getFreeQty;

    public BuyXGetYDiscountStrategy(String targetProductId, int buyQty, int getFreeQty) {
        this.targetProductId = targetProductId;
        this.buyQty = buyQty;
        this.getFreeQty = getFreeQty;
    }

    @Override
    public BigDecimal computeDiscount(BigDecimal subtotal, List<CartItem> items) {
        for (CartItem item : items) {
            if (item.getProduct().getId().equals(targetProductId)) {
                int eligibleBundles = item.getQuantity() / buyQty;
                int freeUnits = Math.min(eligibleBundles * getFreeQty, item.getQuantity());
                return item.getProduct().getUnitPrice().multiply(BigDecimal.valueOf(freeUnits));
            }
        }
        return BigDecimal.ZERO;
    }
}`,
    },
    {
      filename: 'Coupon.java',
      rationale: 'Eligibility rules (minCartValue, stackable) live on the Coupon, not the DiscountStrategy - a strategy only knows how to compute a number, it should never need to know whether it is allowed to run.',
      code: `import java.math.BigDecimal;

public final class Coupon {
    private final String code;
    private final DiscountStrategy strategy;
    private final BigDecimal minCartValue;
    private final boolean stackable;

    public Coupon(String code, DiscountStrategy strategy, BigDecimal minCartValue, boolean stackable) {
        this.code = code;
        this.strategy = strategy;
        this.minCartValue = minCartValue;
        this.stackable = stackable;
    }

    public boolean meetsMinimum(BigDecimal subtotal) {
        return subtotal.compareTo(minCartValue) >= 0;
    }

    public String getCode() { return code; }
    public DiscountStrategy getStrategy() { return strategy; }
    public boolean isStackable() { return stackable; }
}`,
    },
    {
      filename: 'CouponService.java',
      rationale: 'The sole gatekeeper for "can this coupon apply right now" - minimum-value, one-redemption-per-user, and non-stackable-vs-non-stackable are all enforced in one place instead of scattered checks in CheckoutService.',
      code: `import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class CouponService {
    private final Map<String, Coupon> catalog;
    private final ConcurrentHashMap<String, Set<String>> redemptionsByCode = new ConcurrentHashMap<>();

    public CouponService(Map<String, Coupon> catalog) {
        this.catalog = catalog;
    }

    public Coupon validate(String code, Cart cart, String userId, List<Coupon> alreadyApplied) throws CouponNotApplicableException {
        Coupon coupon = catalog.get(code);
        if (coupon == null) {
            throw new CouponNotApplicableException("Unknown coupon code: " + code);
        }
        if (!coupon.meetsMinimum(cart.getSubtotal())) {
            throw new CouponNotApplicableException(code + " requires a higher cart value");
        }
        Set<String> redeemedBy = redemptionsByCode.getOrDefault(code, Collections.emptySet());
        if (redeemedBy.contains(userId)) {
            throw new CouponNotApplicableException(userId + " has already redeemed " + code);
        }
        boolean nonStackableAlreadyApplied = alreadyApplied.stream().anyMatch(c -> !c.isStackable());
        if (!coupon.isStackable() && nonStackableAlreadyApplied) {
            throw new CouponNotApplicableException(code + " cannot be combined with an already-applied non-stackable coupon");
        }
        return coupon;
    }

    public void recordRedemption(String code, String userId) {
        redemptionsByCode.computeIfAbsent(code, k -> ConcurrentHashMap.newKeySet()).add(userId);
    }
}`,
    },
    {
      filename: 'PriceComponent.java',
      rationale: 'One method, deliberately abstract over "how much" and "what happened" - every pipeline stage, base or decorator, is indistinguishable from the outside once built.',
      code: `import java.math.BigDecimal;

public interface PriceComponent {
    BigDecimal getAmount();
    String getDescription();
}`,
    },
    {
      filename: 'CartSubtotalComponent.java',
      rationale: 'The base of every pipeline - a thin adapter from Cart.getSubtotal() to PriceComponent so decorators never need a special case for "there is nothing underneath me".',
      code: `import java.math.BigDecimal;

public final class CartSubtotalComponent implements PriceComponent {
    private final Cart cart;

    public CartSubtotalComponent(Cart cart) {
        this.cart = cart;
    }

    @Override
    public BigDecimal getAmount() { return cart.getSubtotal(); }

    @Override
    public String getDescription() { return "Subtotal"; }
}`,
    },
    {
      filename: 'CouponDiscountComponent.java',
      calloutTitle: '💡 Decorator wrapping a Strategy',
      callout:
        'This class is the whole design in miniature: it is a Decorator stage in the price pipeline (it wraps another PriceComponent and adjusts the running amount), but the actual discount math is delegated to a Strategy. That split matters because the two axes of change are independent - "how many stages does pricing have" (Decorator\'s job) versus "which discount formula applies" (Strategy\'s job) - and neither one should have to know about the other\'s variation.',
      rationale: 'Clamped at BigDecimal.ZERO so a strategy bug or an edge-case coupon can never push a price component negative.',
      code: `import java.math.BigDecimal;
import java.util.List;

public final class CouponDiscountComponent implements PriceComponent {
    private final PriceComponent inner;
    private final DiscountStrategy strategy;
    private final List<CartItem> items;
    private final String couponCode;

    public CouponDiscountComponent(PriceComponent inner, DiscountStrategy strategy, List<CartItem> items, String couponCode) {
        this.inner = inner;
        this.strategy = strategy;
        this.items = items;
        this.couponCode = couponCode;
    }

    @Override
    public BigDecimal getAmount() {
        BigDecimal innerAmount = inner.getAmount();
        BigDecimal discount = strategy.computeDiscount(innerAmount, items).min(innerAmount);
        return innerAmount.subtract(discount).max(BigDecimal.ZERO);
    }

    public BigDecimal getDiscountAmount() {
        BigDecimal innerAmount = inner.getAmount();
        return strategy.computeDiscount(innerAmount, items).min(innerAmount);
    }

    @Override
    public String getDescription() { return inner.getDescription() + " - Coupon(" + couponCode + ")"; }
}`,
    },
    {
      filename: 'TaxComponent.java',
      rationale: 'Always the outermost stage in this design - tax is computed on the already-discounted amount, which is the standard real-world rule (you are not taxed on money the merchant never charged you).',
      code: `import java.math.BigDecimal;
import java.math.RoundingMode;

public final class TaxComponent implements PriceComponent {
    private final PriceComponent inner;
    private final BigDecimal taxRate;

    public TaxComponent(PriceComponent inner, BigDecimal taxRate) {
        this.inner = inner;
        this.taxRate = taxRate;
    }

    @Override
    public BigDecimal getAmount() {
        BigDecimal innerAmount = inner.getAmount();
        BigDecimal tax = innerAmount.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        return innerAmount.add(tax);
    }

    public BigDecimal getTaxAmount() {
        return inner.getAmount().multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public String getDescription() { return inner.getDescription() + " + Tax"; }
}`,
    },
    {
      filename: 'StockReservationService.java',
      calloutTitle: '💡 Race-free reservation via CAS',
      callout:
        'tryReserve() never does "read the count, then separately write the decremented count" - that check-then-act gap is exactly where two threads could both see 1 unit free and both decide they are allowed to take it. compareAndSet only commits the decrement if the value has not changed since it was read, so exactly one of two racing threads wins the last unit, and reserveAll() rolls back any partial reservations the moment one line item fails, so a rejected checkout never leaves stock silently locked away.',
      rationale: 'Deliberately synchronous and exception-free at the tryReserve level - callers decide what "insufficient stock" means for their flow instead of this class throwing mid-loop.',
      code: `import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public final class StockReservationService {
    private final ConcurrentHashMap<String, AtomicInteger> stockByProductId;

    public StockReservationService(Map<String, Integer> initialStock) {
        this.stockByProductId = new ConcurrentHashMap<>();
        initialStock.forEach((productId, qty) -> stockByProductId.put(productId, new AtomicInteger(qty)));
    }

    public boolean tryReserve(String productId, int quantity) {
        AtomicInteger stock = stockByProductId.get(productId);
        if (stock == null) return false;
        while (true) {
            int current = stock.get();
            if (current < quantity) {
                return false;
            }
            if (stock.compareAndSet(current, current - quantity)) {
                return true;
            }
            // Someone else changed the count between our read and our write - retry with a fresh read.
        }
    }

    public void release(String productId, int quantity) {
        AtomicInteger stock = stockByProductId.get(productId);
        if (stock != null) {
            stock.addAndGet(quantity);
        }
    }

    /** All-or-nothing: reserves every line item or rolls back everything it already reserved. */
    public void reserveAll(List<CartItem> items) throws InsufficientStockException {
        List<CartItem> reservedSoFar = new java.util.ArrayList<>();
        for (CartItem item : items) {
            String productId = item.getProduct().getId();
            if (tryReserve(productId, item.getQuantity())) {
                reservedSoFar.add(item);
            } else {
                for (CartItem toRollback : reservedSoFar) {
                    release(toRollback.getProduct().getId(), toRollback.getQuantity());
                }
                throw new InsufficientStockException("Not enough stock for product " + productId);
            }
        }
    }
}`,
    },
    {
      filename: 'CouponNotApplicableException.java',
      rationale: 'A checked business exception - callers must explicitly branch on "this coupon does not apply" instead of it masquerading as an unexpected crash.',
      code: `public final class CouponNotApplicableException extends Exception {
    public CouponNotApplicableException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'InsufficientStockException.java',
      rationale: 'Kept distinct from CouponNotApplicableException so CheckoutService callers can tell "fix your coupon" apart from "remove this item or wait for restock" and react differently.',
      code: `public final class InsufficientStockException extends Exception {
    public InsufficientStockException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'OrderSummary.java',
      calloutTitle: '💡 Builder for a multi-field immutable snapshot',
      callout:
        'OrderSummary has fields that are only meaningful together (discountAmount and appliedCouponCode either both exist or both do not; taxAmount and grandTotal are derived, not independently supplied) and a raw constructor with 7+ positional parameters would be a bug magnet. The nested Builder lets CheckoutService assemble the summary in the natural order pricing happens (cart -> discount -> tax) and fail fast in build() if something required was never set, instead of ever exposing a half-built OrderSummary to a caller.',
      rationale: 'The Builder is nested because nothing outside CheckoutService should ever construct an OrderSummary piecemeal.',
      code: `import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class OrderSummary {
    private final String orderId;
    private final String cartId;
    private final List<CartItem> lineItems;
    private final BigDecimal subtotal;
    private final BigDecimal discountAmount;
    private final String appliedCouponCode;
    private final BigDecimal taxAmount;
    private final BigDecimal grandTotal;
    private final Instant createdAt;

    private OrderSummary(Builder b) {
        this.orderId = b.orderId;
        this.cartId = b.cartId;
        this.lineItems = List.copyOf(b.lineItems);
        this.subtotal = b.subtotal;
        this.discountAmount = b.discountAmount;
        this.appliedCouponCode = b.appliedCouponCode;
        this.taxAmount = b.taxAmount;
        this.grandTotal = b.grandTotal;
        this.createdAt = Instant.now();
    }

    public BigDecimal getGrandTotal() { return grandTotal; }
    public BigDecimal getSubtotal() { return subtotal; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public BigDecimal getTaxAmount() { return taxAmount; }
    public String getOrderId() { return orderId; }

    public static final class Builder {
        private String orderId;
        private String cartId;
        private List<CartItem> lineItems = List.of();
        private BigDecimal subtotal;
        private BigDecimal discountAmount = BigDecimal.ZERO;
        private String appliedCouponCode;
        private BigDecimal taxAmount;
        private BigDecimal grandTotal;

        public Builder withOrderId(String orderId) { this.orderId = orderId; return this; }

        public Builder withCart(Cart cart) {
            this.cartId = cart.getCartId();
            this.lineItems = List.copyOf(cart.getItems());
            this.subtotal = cart.getSubtotal();
            return this;
        }

        public Builder withDiscount(BigDecimal discountAmount, String couponCode) {
            this.discountAmount = discountAmount;
            this.appliedCouponCode = couponCode;
            return this;
        }

        public Builder withTax(BigDecimal taxAmount) { this.taxAmount = taxAmount; return this; }

        public Builder withGrandTotal(BigDecimal grandTotal) { this.grandTotal = grandTotal; return this; }

        public OrderSummary build() {
            if (orderId == null || cartId == null || subtotal == null || taxAmount == null || grandTotal == null) {
                throw new IllegalStateException("OrderSummary is missing required fields");
            }
            return new OrderSummary(this);
        }
    }
}`,
    },
    {
      filename: 'CheckoutService.java',
      rationale:
        'The aggregate root. Its checkout() method fixes the order of operations deliberately: validate, then price (pure, no side effects), then reserve stock (the one side-effecting step, done last) - so a rejected coupon or an empty cart is discovered before anything is ever decremented from the stock ledger.',
      code: `import java.math.BigDecimal;
import java.util.*;

public final class CheckoutService {
    private final CouponService couponService;
    private final StockReservationService stockService;
    private final BigDecimal taxRate;
    private long orderSequence = 0;

    public CheckoutService(CouponService couponService, StockReservationService stockService, BigDecimal taxRate) {
        this.couponService = couponService;
        this.stockService = stockService;
        this.taxRate = taxRate;
    }

    public OrderSummary checkout(Cart cart, String userId, String couponCode)
            throws CouponNotApplicableException, InsufficientStockException {
        if (cart.isEmpty()) {
            throw new IllegalStateException("Cannot check out an empty cart");
        }

        // 1. Resolve pricing - pure, deterministic, no side effects yet.
        PriceComponent pipeline = new CartSubtotalComponent(cart);
        BigDecimal discountAmount = BigDecimal.ZERO;
        String appliedCode = null;
        if (couponCode != null) {
            Coupon coupon = couponService.validate(couponCode, cart, userId, List.of());
            CouponDiscountComponent discountStage =
                    new CouponDiscountComponent(pipeline, coupon.getStrategy(), List.copyOf(cart.getItems()), couponCode);
            discountAmount = discountStage.getDiscountAmount();
            appliedCode = couponCode;
            pipeline = discountStage;
        }
        TaxComponent taxed = new TaxComponent(pipeline, taxRate);
        BigDecimal taxAmount = taxed.getTaxAmount();
        BigDecimal grandTotal = taxed.getAmount();

        // 2. Reserve stock - the only side effect, and it happens last on purpose.
        stockService.reserveAll(List.copyOf(cart.getItems()));

        if (appliedCode != null) {
            couponService.recordRedemption(appliedCode, userId);
        }

        return new OrderSummary.Builder()
                .withOrderId("ORD-" + (++orderSequence))
                .withCart(cart)
                .withDiscount(discountAmount, appliedCode)
                .withTax(taxAmount)
                .withGrandTotal(grandTotal)
                .build();
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Exercises the happy-path pipeline with the exact numbers from the walkthrough, a coupon-eligibility failure (below minimum cart value), and - since race-free reservation is a stated non-functional requirement - a concurrency stress test where many threads race for a single last unit.',
      code: `import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public final class Demo {
    public static void main(String[] args) throws Exception {
        Product mouse = new Product("P-MOUSE", "Wireless Mouse", new BigDecimal("24.99"));
        Product keyboard = new Product("P-KEYBOARD", "Mechanical Keyboard", new BigDecimal("89.99"));
        Product gpu = new Product("P-GPU", "GPU-4090", new BigDecimal("1599.00"));

        Map<String, Coupon> catalog = new HashMap<>();
        catalog.put("WELCOME15", new Coupon("WELCOME15",
                new PercentageOffDiscountStrategy(new BigDecimal("0.15")), new BigDecimal("50.00"), false));
        CouponService couponService = new CouponService(catalog);

        Map<String, Integer> initialStock = new HashMap<>();
        initialStock.put(gpu.getId(), 1);
        StockReservationService stockService = new StockReservationService(initialStock);

        CheckoutService checkoutService = new CheckoutService(couponService, stockService, new BigDecimal("0.08"));

        // --- Happy path: full price calculation from the walkthrough ---
        Cart cartA = new Cart("cart-A", "alice");
        cartA.addItem(mouse, 2);
        cartA.addItem(keyboard, 1);
        OrderSummary summary = checkoutService.checkout(cartA, "alice", "WELCOME15");
        System.out.println("Subtotal=" + summary.getSubtotal()
                + " discount=" + summary.getDiscountAmount()
                + " tax=" + summary.getTaxAmount()
                + " total=" + summary.getGrandTotal());

        // --- Coupon rejected: cart value below the coupon's minimum ---
        Cart cartB = new Cart("cart-B", "bob");
        cartB.addItem(mouse, 1);
        try {
            checkoutService.checkout(cartB, "bob", "WELCOME15");
        } catch (CouponNotApplicableException e) {
            System.out.println("Expected rejection: " + e.getMessage());
        }

        // --- Contested last unit: 20 carts race to buy the single remaining GPU ---
        ExecutorService pool = Executors.newFixedThreadPool(20);
        AtomicInteger successCount = new AtomicInteger();
        CountDownLatch done = new CountDownLatch(20);
        for (int i = 0; i < 20; i++) {
            final String userId = "stress-user-" + i;
            pool.submit(() -> {
                try {
                    Cart cart = new Cart("cart-" + userId, userId);
                    cart.addItem(gpu, 1);
                    checkoutService.checkout(cart, userId, null);
                    successCount.incrementAndGet();
                } catch (Exception ignored) {
                    // Expected for every thread except the single winner of the last GPU.
                } finally {
                    done.countDown();
                }
            });
        }
        done.await();
        pool.shutdown();
        System.out.println("Threads that won the last GPU: " + successCount.get() + " (expected 1)");
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Checkout Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> CartActive: cart created
  CartActive --> CartActive: addItem / removeItem / updateQuantity
  CartActive --> CouponValidated: applyCoupon() passes eligibility
  CartActive --> PriceComputed: checkout() with no coupon
  CouponValidated --> PriceComputed: pipeline evaluated
  PriceComputed --> StockReserved: reserveAll() succeeds
  PriceComputed --> CheckoutAborted: reserveAll() fails (insufficient stock)
  CartActive --> CheckoutAborted: coupon ineligible
  StockReserved --> OrderPlaced: OrderSummary built
  OrderPlaced --> [*]
  CheckoutAborted --> CartActive: cart left untouched, user retries`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Checkout',
    mermaid: `sequenceDiagram
  autonumber
  participant User
  participant Checkout as CheckoutService
  participant Coupons as CouponService
  participant Pipeline as PriceComponent chain
  participant Stock as StockReservationService

  User->>Checkout: checkout(cart, userId, couponCode)
  Checkout->>Coupons: validate(couponCode, cart, userId, [])
  Coupons-->>Checkout: Coupon (eligible)
  Checkout->>Pipeline: wrap Subtotal -> CouponDiscount -> Tax
  Pipeline-->>Checkout: getAmount() = grand total
  Checkout->>Stock: reserveAll(cart.getItems())
  Stock-->>Checkout: reservation confirmed
  Checkout->>Coupons: recordRedemption(couponCode, userId)
  Checkout-->>User: OrderSummary (subtotal, discount, tax, total)`,
  },

  extensions: [
    { extension: 'Free-shipping stackable coupon', implementation: 'Add a ShippingFeeComponent decorator and a separate "stackable=true" Coupon whose DiscountStrategy zeroes out the shipping stage instead of the subtotal stage - it composes alongside a non-stackable percentage coupon because it decorates a different part of the pipeline.' },
    { extension: 'Per-category or per-product discounts', implementation: 'Add a CategoryPercentageOffDiscountStrategy that filters the List<CartItem> passed into computeDiscount() by category before applying a percentage, reusing the exact same DiscountStrategy interface and CouponDiscountComponent wiring.' },
    { extension: 'Cart-level quantity limits per product', implementation: 'Add a QuantityPolicy check inside Cart.addItem()/updateQuantity() (e.g. max 5 per SKU) - a pure validation concern that never touches pricing or stock.' },
    { extension: 'Abandoned-cart stock release', implementation: 'If stock is soft-reserved earlier than checkout (at add-to-cart time) rather than only at checkout, add a scheduled sweep that calls StockReservationService.release() for carts inactive past a TTL, mirroring the hold-expiry idea from a table-booking system.' },
    { extension: 'Multi-currency pricing', implementation: 'Make PriceComponent.getAmount() currency-aware (Money type instead of raw BigDecimal) and have CartSubtotalComponent convert via an exchange-rate service before any decorator runs.' },
    { extension: 'Idempotent checkout retries', implementation: 'Key OrderSummary creation off a client-supplied idempotency token stored alongside orderSequence, so a network retry of the same checkout call cannot double-reserve stock or double-redeem a coupon.' },
  ],

  interviewerChecklist: [
    'Is stock validated with an atomic reserve operation (CAS or equivalent), or does the candidate check availability and then separately decrement it in two steps that a second thread could interleave with?',
    'Does the pricing pipeline compose cleanly - can the candidate explain how a new discount type or a new fee (shipping, gift wrap) would be added without editing the cart or checkout method?',
    'Are coupon eligibility rules (minimum value, one-per-user, stackability) enforced somewhere other than buried inline inside checkout - i.e. is there a clear owner for "is this coupon allowed right now"?',
    'Is the order of operations in checkout deliberate - does pricing happen before the side-effecting stock reservation, so a bad coupon or empty cart is caught before anything is decremented?',
    'Does a failed reservation roll back any partial reservations from earlier line items in the same cart, or can a rejected checkout still leave some stock silently locked away?',
    'Is price calculation isolated enough to unit test with fixed inputs (a cart, a coupon, a tax rate) and an expected total, with no dependency on stock, time, or persistence?',
  ],

  relatedDesigns: ['inventory-management', 'order-management'],
  keyTakeaways: [
    'Decorator and Strategy are not competing choices here - they solve different axes of the same pipeline: Decorator handles "how many pricing stages, in what order," Strategy handles "which formula inside one stage."',
    'Compare-and-swap (AtomicInteger.compareAndSet) is the same race-free idea as ConcurrentHashMap.compute() in a table-booking or inventory system: never let "check" and "act" be two separate, interruptible steps when a scarce resource is on the line.',
    'Keeping the price pipeline free of side effects (no stock mutation, no coupon redemption recorded mid-calculation) is what makes it both unit-testable in isolation and safe to evaluate speculatively before committing to a checkout.',
    'A Builder for the final output object (OrderSummary) pays off exactly when several fields are conditionally present together (discount + coupon code) rather than independently optional - it turns "did I forget a field" into a build()-time failure instead of a subtle runtime bug.',
  ],
}

export default problem

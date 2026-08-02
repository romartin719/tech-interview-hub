import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'order-management',
  title: 'Order Management',
  difficulty: 'Advanced',
  icon: 'pi pi-shopping-cart',
  color: '#f97316',
  readTimeMinutes: 19,
  patterns: ['State', 'Command', 'Observer'],
  companies: ['Amazon', 'Flipkart', 'Shopify', 'DoorDash', 'Swiggy'],
  summary:
    "An order lifecycle modeled as an explicit state machine - each status owns its own legal-transition rules, coordinates with (mocked) payment and inventory services, and stays correct when a payment webhook or a cancel click arrives twice.",

  functionalRequirements: [
    "Model an order's lifecycle as an explicit state machine: CREATED -> PAYMENT_PENDING -> PAID -> INVENTORY_RESERVED -> SHIPPED -> DELIVERED, with CANCELLED, REFUNDED, and FAILED as terminal branches.",
    "Reject any transition that is not legal from the order's current status (e.g. shipping an order that was never paid for) with a clear error, never a silent status overwrite.",
    'Coordinate with a (mocked) payment service to charge the customer when payment is confirmed, and to issue a refund automatically when an already-paid order is cancelled.',
    'Coordinate with a (mocked) inventory service to reserve stock for every line item before an order can ship, and to release that stock if a reserved order is cancelled.',
    'Deduplicate order-placement requests using a client-supplied idempotency key, so retrying the same "place order" call never creates a second order.',
    'Handle duplicate transition requests idempotently - a repeated payment-webhook delivery or a repeated cancel click must not double-charge, double-ship, or throw where the first attempt already succeeded.',
  ],
  nonFunctionalRequirements: [
    'Every state transition must be recorded in an append-only audit log (List<OrderEvent>) so any order\'s full history can be reconstructed and explained after the fact.',
    'Order lookups and idempotency-key lookups must be O(1) and safe under concurrent access, since webhooks and user actions can arrive on different threads for the same order at nearly the same time.',
    'Adding a new order status or a new legal transition must not require touching existing state classes or a central switch statement (open/closed principle).',
  ],

  coreEntities: [
    { name: 'OrderStatus', description: 'The enum of every lifecycle stage an order can be in - used only for reporting, never for branching logic.' },
    { name: 'OrderState (+ concrete states)', description: 'One class per status (CreatedState, PaymentPendingState, PaidState, ...), each owning exactly the transitions that are legal from that status.' },
    { name: 'Order', description: "The context object: holds the current OrderState, the append-only audit history, and references to the collaborators (PaymentService, InventoryService) its states need." },
    { name: 'OrderEvent', description: 'One immutable entry in the audit log - a (fromStatus, toStatus, description, timestamp) record of a single transition.' },
    { name: 'PaymentService / InventoryService', description: 'Mocked external collaborators that order transitions coordinate with - charging a card, issuing a refund, reserving or releasing stock.' },
    { name: 'OrderObserver (+ ShippingNotifier)', description: 'Reacts when an order reaches a status worth telling someone about, without the state machine knowing who is listening.' },
    { name: 'OrderCommand (+ PlaceOrderCommand / CancelOrderCommand)', description: "Encapsulates one order action and its full input as a single object, so it is trivially retryable, loggable, or replayable." },
    { name: 'OrderManager', description: 'The aggregate root - owns every Order, the idempotency-key lookup, and the shared PaymentService/InventoryService/observer list.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class OrderStatus {
    <<enumeration>>
    CREATED
    PAYMENT_PENDING
    PAID
    INVENTORY_RESERVED
    SHIPPED
    DELIVERED
    CANCELLED
    REFUNDED
    FAILED
  }
  class OrderEvent {
    -Instant timestamp
    -OrderStatus fromStatus
    -OrderStatus toStatus
    -String description
  }
  class OrderState {
    <<interface>>
    +getStatus() OrderStatus
    +requestPayment(Order) void
    +confirmPayment(Order) void
    +reserveInventory(Order) void
    +ship(Order) void
    +deliver(Order) void
    +cancel(Order) void
  }
  class CreatedState
  class PaymentPendingState
  class PaidState
  class InventoryReservedState
  class ShippedState
  class DeliveredState
  class CancelledState
  class RefundedState
  class FailedState
  class Order {
    -String orderId
    -OrderState state
    -List~OrderEvent~ history
    -Map~String, Integer~ skuQuantities
    +requestPayment() void
    +confirmPayment() void
    +reserveInventory() void
    +ship() void
    +deliver() void
    +cancel() void
    ~transitionTo(OrderState, String) void
  }
  class PaymentService {
    +charge(String, BigDecimal) String
    +refund(String, String, BigDecimal) void
  }
  class InventoryService {
    +reserve(String, Map~String, Integer~) boolean
    +release(String) void
  }
  class OrderObserver {
    <<interface>>
    +onOrderShipped(Order) void
  }
  class ShippingNotifier
  class OrderCommand {
    <<interface>>
    +execute() Order
  }
  class PlaceOrderCommand
  class CancelOrderCommand
  class OrderManager {
    -Map~String, Order~ ordersById
    -Map~String, Order~ ordersByIdempotencyKey
    +createOrder(...) Order
    +getOrder(String) Order
    +handlePaymentConfirmedWebhook(String) void
  }

  OrderState <|.. CreatedState
  OrderState <|.. PaymentPendingState
  OrderState <|.. PaidState
  OrderState <|.. InventoryReservedState
  OrderState <|.. ShippedState
  OrderState <|.. DeliveredState
  OrderState <|.. CancelledState
  OrderState <|.. RefundedState
  OrderState <|.. FailedState
  Order o-- OrderState
  Order o-- OrderEvent
  Order ..> PaymentService
  Order ..> InventoryService
  Order o-- OrderObserver
  OrderObserver <|.. ShippingNotifier
  OrderCommand <|.. PlaceOrderCommand
  OrderCommand <|.. CancelOrderCommand
  PlaceOrderCommand ..> OrderManager
  CancelOrderCommand ..> OrderManager
  OrderManager o-- Order
  OrderManager o-- PaymentService
  OrderManager o-- InventoryService`,
  },

  designPatterns: [
    { pattern: 'State', where: 'OrderState + CreatedState / PaymentPendingState / PaidState / .../ FailedState', why: "Each status owns its own legal-transition logic. Order.ship() just calls state.ship(this) - there is no giant switch(status) anywhere, and adding a status means adding one small class, not editing every existing one." },
    { pattern: 'Command', where: 'OrderCommand + PlaceOrderCommand / CancelOrderCommand', why: 'Bundling an action and its full input (customer, items, idempotency key) into one object makes it trivially retryable, queueable, or logged for audit - the caller just calls execute() and never touches OrderManager internals directly.' },
    { pattern: 'Observer', where: 'OrderObserver + ShippingNotifier', why: 'The state machine has zero knowledge of who cares that an order shipped. Adding an EmailNotifier or SmsNotifier later means writing a new observer, not editing ShippedState.' },
  ],

  dataStructures: [
    { component: "An order's transition history", structure: 'ArrayList<OrderEvent> (append-only, exposed as an unmodifiable List)', why: 'append() is O(1) amortized and the list is only ever grown, never mutated in place - the audit trail can be trusted to reflect every transition that ever happened, in order.' },
    { component: 'Idempotency-key lookup for order placement', structure: 'ConcurrentHashMap<String, Order> keyed by the client-supplied idempotency key', why: 'putIfAbsent gives an O(1), thread-safe "has this exact request already been handled?" check - two racing retries of the same request can never create two orders.' },
    { component: 'Orders by id', structure: 'ConcurrentHashMap<String, Order>', why: 'O(1) lookup by order id, safe when a payment webhook and a user-initiated cancel arrive on different threads for the same order at nearly the same time.' },
    { component: 'Inventory stock and reservations', structure: 'Map<String, Integer> stock levels plus Map<String, Map<String, Integer>> reservationsByOrderId', why: 'Checking and decrementing stock for every SKU in an order is O(line items), not a scan of a warehouse-wide ledger, and the per-order reservation map makes release() on cancel exact.' },
  ],

  walkthroughs: [
    {
      title: 'Happy Path: Place an Order Through Delivery',
      steps: [
        'PlaceOrderCommand.execute() checks OrderManager.findByIdempotencyKey() first; on a first-time request it finds nothing, so OrderManager.createOrder() mints a new Order in CreatedState.',
        'The command immediately calls order.requestPayment(), which CreatedState handles by transitioning to PaymentPendingState and appending a CREATED -> PAYMENT_PENDING OrderEvent.',
        "A payment gateway webhook calls OrderManager.handlePaymentConfirmedWebhook(orderId). Since the order is currently PAYMENT_PENDING, the manager delegates to order.confirmPayment().",
        'PaymentPendingState.confirmPayment() calls PaymentService.charge(orderId, totalAmount), stores the returned charge reference on the order, and transitions to PaidState.',
        'order.reserveInventory() is called. PaidState.reserveInventory() calls InventoryService.reserve(orderId, skuQuantities); since stock is sufficient it decrements stock, records the reservation, and transitions to InventoryReservedState.',
        'order.ship() is called. InventoryReservedState.ship() transitions to ShippedState and then calls order.notifyObservers(), which invokes ShippingNotifier.onOrderShipped() - the state machine never imports ShippingNotifier directly.',
        'order.deliver() is called. ShippedState.deliver() transitions to DeliveredState - a terminal state where every further action falls through to OrderState\'s default implementation and throws.',
      ],
    },
    {
      title: 'Idempotent Webhook Retry, Then Cancellation After Payment',
      steps: [
        'The payment gateway retries its webhook for an order that is already PAID (a common at-least-once delivery guarantee). OrderManager.handlePaymentConfirmedWebhook() checks order.getStatus() first, sees it is no longer PAYMENT_PENDING, logs that it is ignoring a duplicate, and returns without touching PaymentService or the state machine again.',
        "Separately, PaymentService.charge() itself keys its internal ledger by orderId via computeIfAbsent - even if confirmPayment() were somehow invoked twice for the same order, the customer is charged exactly once.",
        'A second order reaches PAID and then INVENTORY_RESERVED, and the customer cancels it. CancelOrderCommand.execute() calls order.cancel(), which InventoryReservedState.cancel() handles by calling InventoryService.release(orderId) to return the reserved stock, then PaymentService.refund() to reverse the charge, then transitioning to RefundedState - not CancelledState, since money already changed hands.',
        'The customer (or a flaky client) sends the exact same cancel request again. CancelOrderCommand.execute() calls order.cancel() a second time; RefundedState.cancel() is an explicit no-op override, so the request succeeds silently instead of throwing or issuing a second refund.',
        'By contrast, an order that was cancelled before ever being charged (still CreatedState or PaymentPendingState) transitions straight to CancelledState with no PaymentService or InventoryService call at all - there is nothing to reverse.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'OrderStatus.java',
      rationale: 'A plain enum used only for reporting and for the OrderEvent audit trail - no code ever branches on it with an if/else or switch, because that job belongs to OrderState.',
      code: `public enum OrderStatus {
    CREATED,
    PAYMENT_PENDING,
    PAID,
    INVENTORY_RESERVED,
    SHIPPED,
    DELIVERED,
    CANCELLED,
    REFUNDED,
    FAILED
}`,
    },
    {
      filename: 'OrderEvent.java',
      rationale: 'An immutable record of one transition. Order never mutates an OrderEvent after creating it, which is what makes the audit trail trustworthy.',
      code: `import java.time.Instant;

public final class OrderEvent {
    private final Instant timestamp;
    private final OrderStatus fromStatus;
    private final OrderStatus toStatus;
    private final String description;

    public OrderEvent(OrderStatus fromStatus, OrderStatus toStatus, String description) {
        this.timestamp = Instant.now();
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.description = description;
    }

    public Instant getTimestamp() { return timestamp; }
    public OrderStatus getFromStatus() { return fromStatus; }
    public OrderStatus getToStatus() { return toStatus; }
    public String getDescription() { return description; }

    @Override
    public String toString() {
        return "[" + timestamp + "] " + fromStatus + " -> " + toStatus + " (" + description + ")";
    }
}`,
    },
    {
      filename: 'IllegalStateTransitionException.java',
      rationale: 'A single, specific exception type for "that action is not legal from this status" - callers can catch this exact case instead of a generic RuntimeException.',
      code: `public final class IllegalStateTransitionException extends RuntimeException {
    public IllegalStateTransitionException(OrderStatus from, String action) {
        super("Cannot " + action + " an order in status " + from);
    }
}`,
    },
    {
      filename: 'PaymentService.java',
      rationale: "Stands in for a real payment gateway (Stripe, Braintree, ...). Keys its own ledger by orderId so even a bug that called charge() twice for one order would not double-bill the customer - defense in depth alongside the state machine's own idempotency guard.",
      code: `import java.math.BigDecimal;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public final class PaymentService {
    private final AtomicLong chargeSequence = new AtomicLong();
    private final ConcurrentHashMap<String, String> chargesByOrderId = new ConcurrentHashMap<>();

    /** Returns the same charge reference if this order was already charged. */
    public String charge(String orderId, BigDecimal amount) {
        return chargesByOrderId.computeIfAbsent(orderId, id -> {
            String reference = "CHG-" + chargeSequence.incrementAndGet();
            System.out.println("[PaymentService] Charged " + amount + " for order " + orderId + " -> " + reference);
            return reference;
        });
    }

    public void refund(String orderId, String chargeReference, BigDecimal amount) {
        System.out.println("[PaymentService] Refunded " + amount + " for charge " + chargeReference + " (order " + orderId + ")");
    }
}`,
    },
    {
      filename: 'InventoryService.java',
      rationale: 'Stands in for a warehouse/inventory system. reserve() is idempotent per orderId and release() only ever returns exactly what that order reserved, so a duplicate reserve or a cancel-after-cancel never corrupts stock counts.',
      code: `import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class InventoryService {
    private final Map<String, Integer> stockBySku = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Integer>> reservationsByOrderId = new ConcurrentHashMap<>();

    public void stock(String sku, int quantity) {
        stockBySku.merge(sku, quantity, Integer::sum);
    }

    public synchronized boolean reserve(String orderId, Map<String, Integer> skuQuantities) {
        if (reservationsByOrderId.containsKey(orderId)) {
            return true; // Already reserved for this order - a retry is a no-op, not a double-decrement.
        }
        for (Map.Entry<String, Integer> line : skuQuantities.entrySet()) {
            if (stockBySku.getOrDefault(line.getKey(), 0) < line.getValue()) {
                return false;
            }
        }
        skuQuantities.forEach((sku, qty) -> stockBySku.merge(sku, -qty, Integer::sum));
        reservationsByOrderId.put(orderId, skuQuantities);
        return true;
    }

    public synchronized void release(String orderId) {
        Map<String, Integer> reserved = reservationsByOrderId.remove(orderId);
        if (reserved != null) {
            reserved.forEach((sku, qty) -> stockBySku.merge(sku, qty, Integer::sum));
        }
    }
}`,
    },
    {
      filename: 'OrderState.java',
      calloutTitle: '💡 State Pattern',
      callout:
        'Every action has a default implementation right here that rejects it with IllegalStateTransitionException. A concrete state only needs to override the handful of actions that ARE legal from it - everything else is safely rejected without that state class having to say so explicitly. This is the entire reason Order never contains a switch(status) anywhere.',
      rationale: 'One interface, one method per possible order action. Adding a brand-new action (say, splitShipment()) means adding one default method here and overriding it in the states where it applies - every existing state class is untouched.',
      code: `public interface OrderState {
    OrderStatus getStatus();

    default void requestPayment(Order order) {
        throw new IllegalStateTransitionException(getStatus(), "request payment for");
    }

    default void confirmPayment(Order order) {
        throw new IllegalStateTransitionException(getStatus(), "confirm payment for");
    }

    default void failPayment(Order order) {
        throw new IllegalStateTransitionException(getStatus(), "fail payment for");
    }

    default void reserveInventory(Order order) {
        throw new IllegalStateTransitionException(getStatus(), "reserve inventory for");
    }

    default void ship(Order order) {
        throw new IllegalStateTransitionException(getStatus(), "ship");
    }

    default void deliver(Order order) {
        throw new IllegalStateTransitionException(getStatus(), "deliver");
    }

    default void cancel(Order order) {
        throw new IllegalStateTransitionException(getStatus(), "cancel");
    }
}`,
    },
    {
      filename: 'CreatedState.java',
      rationale: 'A freshly created order can only move forward to payment or be abandoned - both handled with no PaymentService/InventoryService involvement since nothing has happened yet.',
      code: `public final class CreatedState implements OrderState {
    public static final CreatedState INSTANCE = new CreatedState();
    private CreatedState() {}

    @Override
    public OrderStatus getStatus() { return OrderStatus.CREATED; }

    @Override
    public void requestPayment(Order order) {
        order.transitionTo(PaymentPendingState.INSTANCE, "Payment requested from customer");
    }

    @Override
    public void cancel(Order order) {
        order.transitionTo(CancelledState.INSTANCE, "Cancelled before payment - nothing to reverse");
    }
}`,
    },
    {
      filename: 'PaymentPendingState.java',
      rationale: "The one state that actually talks to PaymentService.charge(). Both a successful and a failed outcome are modeled as explicit, separate transitions rather than a boolean flag on the order.",
      code: `public final class PaymentPendingState implements OrderState {
    public static final PaymentPendingState INSTANCE = new PaymentPendingState();
    private PaymentPendingState() {}

    @Override
    public OrderStatus getStatus() { return OrderStatus.PAYMENT_PENDING; }

    @Override
    public void confirmPayment(Order order) {
        String chargeRef = order.getPaymentService().charge(order.getOrderId(), order.getTotalAmount());
        order.setPaymentReference(chargeRef);
        order.transitionTo(PaidState.INSTANCE, "Payment captured (" + chargeRef + ")");
    }

    @Override
    public void failPayment(Order order) {
        order.transitionTo(FailedState.INSTANCE, "Payment declined by gateway");
    }

    @Override
    public void cancel(Order order) {
        order.transitionTo(CancelledState.INSTANCE, "Cancelled while awaiting payment - nothing to reverse");
    }
}`,
    },
    {
      filename: 'PaidState.java',
      rationale: "Once money has changed hands, cancel() must reverse it. reserveInventory() is the only forward move, and it fails loudly (rather than silently transitioning) if stock ran out.",
      code: `public final class PaidState implements OrderState {
    public static final PaidState INSTANCE = new PaidState();
    private PaidState() {}

    @Override
    public OrderStatus getStatus() { return OrderStatus.PAID; }

    @Override
    public void reserveInventory(Order order) {
        boolean reserved = order.getInventoryService().reserve(order.getOrderId(), order.getSkuQuantities());
        if (!reserved) {
            throw new IllegalStateException("Insufficient stock to reserve inventory for order " + order.getOrderId());
        }
        order.transitionTo(InventoryReservedState.INSTANCE, "Inventory reserved for all line items");
    }

    @Override
    public void cancel(Order order) {
        order.getPaymentService().refund(order.getOrderId(), order.getPaymentReference(), order.getTotalAmount());
        order.transitionTo(RefundedState.INSTANCE, "Cancelled after payment - refund issued");
    }
}`,
    },
    {
      filename: 'InventoryReservedState.java',
      rationale: 'Cancelling from here must undo both side effects that happened so far - released stock AND a refund - before landing in RefundedState, in that order, so a crash mid-cancel never leaves stock reserved with no matching charge.',
      code: `public final class InventoryReservedState implements OrderState {
    public static final InventoryReservedState INSTANCE = new InventoryReservedState();
    private InventoryReservedState() {}

    @Override
    public OrderStatus getStatus() { return OrderStatus.INVENTORY_RESERVED; }

    @Override
    public void ship(Order order) {
        order.transitionTo(ShippedState.INSTANCE, "Handed off to carrier");
        order.notifyObservers();
    }

    @Override
    public void cancel(Order order) {
        order.getInventoryService().release(order.getOrderId());
        order.getPaymentService().refund(order.getOrderId(), order.getPaymentReference(), order.getTotalAmount());
        order.transitionTo(RefundedState.INSTANCE, "Cancelled after reservation - stock released and refund issued");
    }
}`,
    },
    {
      filename: 'ShippedState.java',
      rationale: "Deliberately does NOT override cancel() - once a package is with the carrier, this simplified model treats cancellation as illegal (a real system would model a return/RMA flow instead, out of scope here).",
      code: `public final class ShippedState implements OrderState {
    public static final ShippedState INSTANCE = new ShippedState();
    private ShippedState() {}

    @Override
    public OrderStatus getStatus() { return OrderStatus.SHIPPED; }

    @Override
    public void deliver(Order order) {
        order.transitionTo(DeliveredState.INSTANCE, "Delivered to customer");
    }
}`,
    },
    {
      filename: 'DeliveredState.java',
      rationale: 'A fully terminal state - every action falls through to OrderState\'s default and throws. There is nothing to override, which is itself the point: a terminal state costs almost no code.',
      code: `public final class DeliveredState implements OrderState {
    public static final DeliveredState INSTANCE = new DeliveredState();
    private DeliveredState() {}

    @Override
    public OrderStatus getStatus() { return OrderStatus.DELIVERED; }
}`,
    },
    {
      filename: 'CancelledState.java',
      calloutTitle: '💡 Idempotent duplicate transition',
      callout:
        'cancel() is overridden here as a deliberate no-op instead of inheriting the default that throws. A user double-clicking "Cancel" (or a retried request) hits an order that is already CANCELLED - treating that as success instead of an error is exactly what "idempotent" means for a state transition.',
      rationale: 'Terminal, but the one action worth special-casing is the one most likely to be retried by an impatient client.',
      code: `public final class CancelledState implements OrderState {
    public static final CancelledState INSTANCE = new CancelledState();
    private CancelledState() {}

    @Override
    public OrderStatus getStatus() { return OrderStatus.CANCELLED; }

    @Override
    public void cancel(Order order) {
        // Already cancelled - a retried cancel request is a no-op, not an error.
    }
}`,
    },
    {
      filename: 'RefundedState.java',
      rationale: 'Same idempotent-cancel reasoning as CancelledState: once a refund has already been issued, a repeated cancel request must not attempt a second refund.',
      code: `public final class RefundedState implements OrderState {
    public static final RefundedState INSTANCE = new RefundedState();
    private RefundedState() {}

    @Override
    public OrderStatus getStatus() { return OrderStatus.REFUNDED; }

    @Override
    public void cancel(Order order) {
        // Already refunded - a retried cancel request is a no-op, not a second refund.
    }
}`,
    },
    {
      filename: 'FailedState.java',
      rationale: 'Reachable only from a declined payment. Kept terminal here for simplicity; the extensions section covers letting it retry back into PaymentPendingState.',
      code: `public final class FailedState implements OrderState {
    public static final FailedState INSTANCE = new FailedState();
    private FailedState() {}

    @Override
    public OrderStatus getStatus() { return OrderStatus.FAILED; }
}`,
    },
    {
      filename: 'Order.java',
      rationale: "The context object in the State pattern: every public action delegates to the current OrderState and NEVER decides legality itself. transitionTo() is the single chokepoint where the state field actually changes and the audit event is appended, which is what makes the history trustworthy.",
      code: `import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public final class Order {
    private final String orderId;
    private final String customerId;
    private final Map<String, Integer> skuQuantities;
    private final BigDecimal totalAmount;
    private final PaymentService paymentService;
    private final InventoryService inventoryService;
    private final List<OrderObserver> observers;
    private final List<OrderEvent> history = new ArrayList<>();

    private OrderState state = CreatedState.INSTANCE;
    private String paymentReference;

    Order(String orderId, String customerId, Map<String, Integer> skuQuantities, BigDecimal totalAmount,
          PaymentService paymentService, InventoryService inventoryService, List<OrderObserver> observers) {
        this.orderId = orderId;
        this.customerId = customerId;
        this.skuQuantities = skuQuantities;
        this.totalAmount = totalAmount;
        this.paymentService = paymentService;
        this.inventoryService = inventoryService;
        this.observers = observers;
        this.history.add(new OrderEvent(null, OrderStatus.CREATED, "Order created"));
    }

    // Every action is delegated to the current state - Order itself never branches on status.
    public void requestPayment() { state.requestPayment(this); }
    public void confirmPayment() { state.confirmPayment(this); }
    public void failPayment() { state.failPayment(this); }
    public void reserveInventory() { state.reserveInventory(this); }
    public void ship() { state.ship(this); }
    public void deliver() { state.deliver(this); }
    public void cancel() { state.cancel(this); }

    // Called only by OrderState implementations - the single place the state field actually changes.
    void transitionTo(OrderState next, String description) {
        OrderStatus previous = this.state.getStatus();
        this.state = next;
        history.add(new OrderEvent(previous, next.getStatus(), description));
    }

    void notifyObservers() {
        observers.forEach(o -> o.onOrderShipped(this));
    }

    void setPaymentReference(String reference) { this.paymentReference = reference; }

    public String getOrderId() { return orderId; }
    public String getCustomerId() { return customerId; }
    public Map<String, Integer> getSkuQuantities() { return skuQuantities; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public String getPaymentReference() { return paymentReference; }
    public OrderStatus getStatus() { return state.getStatus(); }
    public List<OrderEvent> getHistory() { return Collections.unmodifiableList(history); }

    PaymentService getPaymentService() { return paymentService; }
    InventoryService getInventoryService() { return inventoryService; }
}`,
    },
    {
      filename: 'OrderObserver.java',
      rationale: 'One-method interface - ShippingNotifier is only the first subscriber; an email or SMS notifier could implement this same interface tomorrow without any state class changing.',
      code: `public interface OrderObserver {
    void onOrderShipped(Order order);
}`,
    },
    {
      filename: 'ShippingNotifier.java',
      calloutTitle: '💡 Observer Pattern',
      callout:
        'InventoryReservedState.ship() calls order.notifyObservers() and has zero knowledge that ShippingNotifier exists. Swapping this println for a real "email the tracking link" API call - or adding a second, third observer - never touches the state machine.',
      rationale: 'Deliberately simple - production code would call a real notification/email API, but the decoupling is the point being demonstrated here.',
      code: `public final class ShippingNotifier implements OrderObserver {
    @Override
    public void onOrderShipped(Order order) {
        System.out.println("[ShippingNotifier] Order " + order.getOrderId()
                + " shipped - notifying customer with tracking details.");
    }
}`,
    },
    {
      filename: 'OrderCommand.java',
      rationale: 'A single-method interface so any order action can be captured as an object: constructed with its full input, executed once, and (in principle) logged or replayed.',
      code: `public interface OrderCommand {
    Order execute();
}`,
    },
    {
      filename: 'PlaceOrderCommand.java',
      calloutTitle: '💡 Command + idempotency key',
      callout:
        'execute() checks the idempotency-key map BEFORE creating anything. If a client retries the exact same "place order" request (same key), it gets back the ORIGINAL order object - no new order, no second requestPayment() call, no double anything. The dedup check lives here, once, instead of being re-implemented by every caller.',
      rationale: 'Captures everything OrderManager.createOrder() needs as constructor state, so the same command object could be safely retried, queued, or persisted for replay.',
      code: `import java.math.BigDecimal;
import java.util.Map;

public final class PlaceOrderCommand implements OrderCommand {
    private final OrderManager manager;
    private final String customerId;
    private final Map<String, Integer> skuQuantities;
    private final BigDecimal totalAmount;
    private final String idempotencyKey;

    public PlaceOrderCommand(OrderManager manager, String customerId, Map<String, Integer> skuQuantities,
                              BigDecimal totalAmount, String idempotencyKey) {
        this.manager = manager;
        this.customerId = customerId;
        this.skuQuantities = skuQuantities;
        this.totalAmount = totalAmount;
        this.idempotencyKey = idempotencyKey;
    }

    @Override
    public Order execute() {
        Order existing = manager.findByIdempotencyKey(idempotencyKey);
        if (existing != null) {
            return existing; // Same client intent retried - return the ORIGINAL order, don't create a second one.
        }
        Order order = manager.createOrder(customerId, skuQuantities, totalAmount);
        manager.registerIdempotencyKey(idempotencyKey, order);
        order.requestPayment();
        return order;
    }
}`,
    },
    {
      filename: 'CancelOrderCommand.java',
      rationale: 'Legality AND idempotency of the cancel are both owned by the current OrderState (CancelledState/RefundedState no-op it, every other legal state reverses side effects, everything else throws) - this command is a thin, replayable wrapper around order.cancel().',
      code: `public final class CancelOrderCommand implements OrderCommand {
    private final OrderManager manager;
    private final String orderId;

    public CancelOrderCommand(OrderManager manager, String orderId) {
        this.manager = manager;
        this.orderId = orderId;
    }

    @Override
    public Order execute() {
        Order order = manager.getOrder(orderId);
        order.cancel();
        return order;
    }
}`,
    },
    {
      filename: 'OrderManager.java',
      calloutTitle: '💡 Idempotent webhook handling',
      callout:
        'handlePaymentConfirmedWebhook() checks the order\'s CURRENT status before doing anything. Payment gateways retry webhooks until they see a 2xx, so the second delivery for an already-PAID order must be a safe no-op - not a second charge, and not a crash from calling confirmPayment() on a state that no longer accepts it.',
      rationale: 'The aggregate root/facade: owns every Order plus the shared PaymentService, InventoryService, and observer list, so commands never construct their own collaborators.',
      code: `import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public final class OrderManager {
    private final Map<String, Order> ordersById = new ConcurrentHashMap<>();
    private final Map<String, Order> ordersByIdempotencyKey = new ConcurrentHashMap<>();
    private final PaymentService paymentService = new PaymentService();
    private final InventoryService inventoryService = new InventoryService();
    private final List<OrderObserver> observers;
    private final AtomicLong orderSequence = new AtomicLong();

    public OrderManager(List<OrderObserver> observers) {
        this.observers = observers;
    }

    public InventoryService getInventoryService() { return inventoryService; }

    Order createOrder(String customerId, Map<String, Integer> skuQuantities, BigDecimal totalAmount) {
        String orderId = "ORD-" + orderSequence.incrementAndGet();
        Order order = new Order(orderId, customerId, skuQuantities, totalAmount, paymentService, inventoryService, observers);
        ordersById.put(orderId, order);
        return order;
    }

    Order findByIdempotencyKey(String key) {
        return ordersByIdempotencyKey.get(key);
    }

    void registerIdempotencyKey(String key, Order order) {
        ordersByIdempotencyKey.putIfAbsent(key, order);
    }

    public Order getOrder(String orderId) {
        Order order = ordersById.get(orderId);
        if (order == null) {
            throw new IllegalArgumentException("Unknown order: " + orderId);
        }
        return order;
    }

    /**
     * Simulates a payment-gateway webhook confirming a charge. Gateways retry webhooks
     * until they get a 2xx, so this MUST be safe to call more than once for the same order.
     */
    public void handlePaymentConfirmedWebhook(String orderId) {
        Order order = getOrder(orderId);
        if (order.getStatus() != OrderStatus.PAYMENT_PENDING) {
            System.out.println("[OrderManager] Ignoring duplicate payment webhook for " + orderId
                    + " (already " + order.getStatus() + ")");
            return;
        }
        order.confirmPayment();
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale: 'Exercises the full happy path, a duplicate payment webhook that must not double-charge, an illegal transition on a terminal state, a duplicate order-placement request deduped by idempotency key, and a post-payment cancellation that refunds instead of just cancelling.',
      code: `import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public final class Demo {
    public static void main(String[] args) {
        OrderManager manager = new OrderManager(List.of(new ShippingNotifier()));
        manager.getInventoryService().stock("SKU-WIDGET", 10);
        manager.getInventoryService().stock("SKU-GADGET", 5);

        // --- Place an order; requestPayment() fires automatically inside the command ---
        PlaceOrderCommand placeOrder = new PlaceOrderCommand(
                manager, "cust-1", Map.of("SKU-WIDGET", 2), new BigDecimal("39.98"), "idem-key-abc");
        Order order = placeOrder.execute();
        System.out.println("Placed " + order.getOrderId() + ", status=" + order.getStatus());

        // --- Payment webhook fires, then retries (gateways redeliver until they see a 2xx) ---
        manager.handlePaymentConfirmedWebhook(order.getOrderId());
        System.out.println("After first webhook: " + order.getStatus());
        manager.handlePaymentConfirmedWebhook(order.getOrderId()); // duplicate delivery
        System.out.println("After duplicate webhook (should be unchanged, no second charge): " + order.getStatus());

        // --- Continue the happy path ---
        order.reserveInventory();
        System.out.println("After inventory reservation: " + order.getStatus());
        order.ship(); // ShippingNotifier observer fires here
        System.out.println("After ship: " + order.getStatus());
        order.deliver();
        System.out.println("After deliver: " + order.getStatus());

        // --- Illegal transition: a delivered order can never be shipped again ---
        try {
            order.ship();
        } catch (IllegalStateTransitionException e) {
            System.out.println("Rejected illegal transition: " + e.getMessage());
        }

        // --- Duplicate placement request with the SAME idempotency key returns the ORIGINAL order ---
        Order duplicate = new PlaceOrderCommand(
                manager, "cust-1", Map.of("SKU-WIDGET", 2), new BigDecimal("39.98"), "idem-key-abc").execute();
        System.out.println("Duplicate placeOrder returned the same order? " + (duplicate == order)
                + " (" + duplicate.getOrderId() + ")");

        // --- Second order: cancel AFTER payment + reservation triggers a refund, not a plain cancel ---
        Order second = new PlaceOrderCommand(
                manager, "cust-2", Map.of("SKU-GADGET", 1), new BigDecimal("19.99"), "idem-key-xyz").execute();
        manager.handlePaymentConfirmedWebhook(second.getOrderId());
        second.reserveInventory();
        new CancelOrderCommand(manager, second.getOrderId()).execute();
        System.out.println("Second order after cancel-post-payment: " + second.getStatus());

        // --- Cancelling an already-refunded order again is idempotent, not an error ---
        new CancelOrderCommand(manager, second.getOrderId()).execute();
        System.out.println("Second order after duplicate cancel: " + second.getStatus());

        // --- The append-only audit log explains every transition the first order went through ---
        System.out.println("\\nAudit trail for " + order.getOrderId() + ":");
        order.getHistory().forEach(event -> System.out.println("  " + event));
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Order Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> CREATED
  CREATED --> PAYMENT_PENDING: requestPayment()
  CREATED --> CANCELLED: cancel()
  PAYMENT_PENDING --> PAID: confirmPayment()
  PAYMENT_PENDING --> FAILED: failPayment()
  PAYMENT_PENDING --> CANCELLED: cancel()
  PAID --> INVENTORY_RESERVED: reserveInventory()
  PAID --> REFUNDED: cancel() [refund issued]
  INVENTORY_RESERVED --> SHIPPED: ship()
  INVENTORY_RESERVED --> REFUNDED: cancel() [stock released + refund]
  SHIPPED --> DELIVERED: deliver()
  DELIVERED --> [*]
  CANCELLED --> [*]
  REFUNDED --> [*]
  FAILED --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Place Order With Idempotent Webhook Retry',
    mermaid: `sequenceDiagram
  autonumber
  participant Client
  participant Cmd as PlaceOrderCommand
  participant Mgr as OrderManager
  participant Ord as Order
  participant St as OrderState
  participant Pay as PaymentService
  participant Inv as InventoryService

  Client->>Cmd: execute()
  Cmd->>Mgr: findByIdempotencyKey(key)
  Mgr-->>Cmd: null (first request)
  Cmd->>Mgr: createOrder(...)
  Mgr-->>Cmd: order (CREATED)
  Cmd->>Ord: requestPayment()
  Ord->>St: requestPayment(order)
  St->>Ord: transitionTo(PaymentPendingState)
  Cmd-->>Client: order (PAYMENT_PENDING)

  Client->>Mgr: handlePaymentConfirmedWebhook(orderId)
  Mgr->>Ord: confirmPayment()
  Ord->>St: confirmPayment(order)
  St->>Pay: charge(orderId, amount)
  Pay-->>St: chargeReference
  St->>Ord: transitionTo(PaidState)

  Client->>Mgr: handlePaymentConfirmedWebhook(orderId)
  Note over Mgr: duplicate webhook delivery
  Mgr->>Ord: getStatus()
  Ord-->>Mgr: PAID
  Mgr-->>Client: ignored - no second charge

  Client->>Ord: reserveInventory()
  Ord->>St: reserveInventory(order)
  St->>Inv: reserve(orderId, skuQuantities)
  Inv-->>St: true
  St->>Ord: transitionTo(InventoryReservedState)`,
  },

  extensions: [
    { extension: 'Saga-style compensation', implementation: 'If InventoryService.reserve() fails after payment already succeeded, automatically drive the order through PaidState.cancel() to issue a refund instead of leaving it stuck in PAID.' },
    { extension: 'Partial shipments', implementation: 'Split an order into multiple Shipment sub-objects, each with its own small SHIPPED/DELIVERED state machine, while Order tracks the aggregate status.' },
    { extension: 'Returns after delivery', implementation: 'Add ReturnRequestedState and ReturnedState reachable only from DeliveredState, mirroring the refund logic already in PaidState/InventoryReservedState.' },
    { extension: 'Retryable failed payments', implementation: 'Give FailedState a retryPayment() override that transitions back to PaymentPendingState instead of leaving payment failures fully terminal.' },
    { extension: 'Multi-channel notifications', implementation: 'Add EmailNotifier and SmsNotifier, both implementing OrderObserver, registered alongside ShippingNotifier - no state class changes.' },
    { extension: 'Command audit log / replay', implementation: 'Persist every executed OrderCommand (with its constructor inputs) to a durable log so an outage can replay unfinished commands exactly once.' },
  ],

  interviewerChecklist: [
    'Does the candidate model each order status as its own object (State pattern) instead of a status field plus if/else or switch statements scattered across the codebase?',
    'Is an illegal transition (e.g. shipping a delivered order) rejected with a specific exception instead of silently overwriting the status?',
    'Is a payment-webhook retry (or a repeated cancel request) handled idempotently instead of double-charging, double-shipping, or throwing on the second attempt?',
    'Does placing an order twice with the same client-supplied idempotency key return the original order instead of creating a duplicate?',
    'Does every transition go through one chokepoint (Order.transitionTo) so the audit log can be trusted, rather than being mutated ad hoc from multiple places?',
    'Can the candidate justify Command over calling OrderManager methods directly - what does capturing PlaceOrder/CancelOrder as objects buy (retryability, queueing, audit)?',
  ],

  relatedDesigns: ['inventory-management'],
  keyTakeaways: [
    'The State pattern turns "which transitions are legal from here" into a small, closed set of overrides on one class per status - adding a status means adding a class, not editing an if/else chain everywhere it appears.',
    'Idempotency has two different homes here: a client-supplied key deduplicates create requests before they reach any business logic, while a status check (or a no-op state override) makes a retried transition request a safe no-op instead of a repeated side effect.',
    'Command captures an action and its full input as one object, so PlaceOrder/CancelOrder are trivially retryable and auditable - the state machine underneath never knows or cares that it was invoked via a command.',
    'Observer keeps "an order reached a status" separate from "who reacts to that" - the state machine calls one notify hook, and new notification channels are pure additions, never edits.',
  ],
}

export default problem

import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'vending-machine',
  title: 'Vending Machine',
  difficulty: 'Beginner',
  icon: 'pi pi-box',
  color: '#06b6d4',
  readTimeMinutes: 14,
  patterns: ['State', 'Strategy', 'Factory'],
  companies: ['Amazon', 'Coca-Cola', 'PhonePe', 'Samsung'],
  summary:
    'A slot-based vending machine that walks through a strict Idle -> HasMoney -> Dispensing lifecycle, accepts either cash or card via a swappable payment strategy, rejects out-of-stock selections before any money changes hands, and returns exact change on overpayment.',

  functionalRequirements: [
    'Stock the machine with products in numbered slots, each with a code, name, price, and quantity.',
    'A customer selects a product by slot code; selection must be rejected up front if that slot is out of stock.',
    'A customer inserts money (cash) or authorizes a card charge (card) - the machine tracks a running inserted balance for cash.',
    'Once the inserted balance meets or exceeds the selected product\'s price, the machine dispenses the product and decrements its inventory count by one.',
    'If the inserted amount exceeds the price, the machine computes and returns exact change on dispense.',
    'A customer can cancel mid-transaction while money has been inserted but not yet consumed, and get a full refund.',
    'Calling an operation that is illegal for the machine\'s current state (e.g. dispense() while idle, insertMoney() while dispensing) must be rejected with a clear error, not silently ignored.',
  ],
  nonFunctionalRequirements: [
    'The current state must gate every public operation - there should be no way to reach an inconsistent state (e.g. dispensing with insufficient funds) through any call sequence.',
    'Adding a new payment method (e.g. mobile wallet) must not require changes to the state classes or the dispense flow.',
    'Inventory lookups and decrements must be O(1) by slot code, not a scan over every product.',
  ],

  coreEntities: [
    { name: 'Product', description: 'A sellable item - slot code, name, price, and current quantity.' },
    { name: 'Inventory', description: 'Owns the Map<String, Product> keyed by slot code; restocks and decrements are the only ways to mutate it.' },
    { name: 'PaymentStrategy', description: 'Interface for accepting payment - the interchangeable part of checkout, independent of the state machine.' },
    { name: 'CashPayment', description: 'Tracks inserted coins/notes as a running total and can refund it.' },
    { name: 'CardPayment', description: 'Simulates an external card-authorization call that can succeed or fail.' },
    { name: 'VendingMachineState', description: 'Interface with one method per customer action; each concrete state implements only the actions legal from that state.' },
    { name: 'IdleState / HasMoneyState / DispensingState / OutOfStockState', description: 'The four concrete states the machine cycles through for a single purchase.' },
    { name: 'VendingMachine', description: 'The context - holds the Inventory, the active PaymentStrategy, the currentState, the running balance, and the selected product, and delegates every public call to currentState.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Product {
    -String code
    -String name
    -int priceCents
    -int quantity
    +decrementStock() void
    +isInStock() boolean
  }
  class Inventory {
    -Map~String, Product~ slots
    +getProduct(String) Product
    +restock(String, int) void
    +decrement(String) void
  }
  class PaymentStrategy {
    <<interface>>
    +pay(int amountCents) PaymentResult
    +getRunningTotal() int
    +refund() int
  }
  class CashPayment {
    -int insertedCents
    +insertCoin(int) void
    +pay(int) PaymentResult
    +refund() int
  }
  class CardPayment {
    -boolean authSucceeds
    +pay(int) PaymentResult
    +refund() int
  }
  class VendingMachineState {
    <<interface>>
    +selectProduct(String) void
    +insertMoney(int) void
    +dispense() DispenseResult
    +cancel() void
  }
  class IdleState {
    +selectProduct(String) void
    +insertMoney(int) void
    +dispense() DispenseResult
    +cancel() void
  }
  class HasMoneyState {
    +selectProduct(String) void
    +insertMoney(int) void
    +dispense() DispenseResult
    +cancel() void
  }
  class DispensingState {
    +selectProduct(String) void
    +insertMoney(int) void
    +dispense() DispenseResult
    +cancel() void
  }
  class OutOfStockState {
    +selectProduct(String) void
    +insertMoney(int) void
    +dispense() DispenseResult
    +cancel() void
  }
  class VendingMachine {
    -Inventory inventory
    -PaymentStrategy paymentStrategy
    -VendingMachineState currentState
    -int insertedCents
    -Product selectedProduct
    +setState(VendingMachineState) void
    +selectProduct(String) void
    +insertMoney(int) void
    +dispense() DispenseResult
    +cancel() void
  }
  class DispenseResult {
    -Product product
    -int changeCents
  }

  VendingMachineState <|.. IdleState
  VendingMachineState <|.. HasMoneyState
  VendingMachineState <|.. DispensingState
  VendingMachineState <|.. OutOfStockState
  PaymentStrategy <|.. CashPayment
  PaymentStrategy <|.. CardPayment
  VendingMachine o-- VendingMachineState
  VendingMachine o-- PaymentStrategy
  VendingMachine o-- Inventory
  VendingMachine ..> DispenseResult : returns
  Inventory o-- Product`,
  },

  designPatterns: [
    { pattern: 'State', where: 'VendingMachineState + IdleState/HasMoneyState/DispensingState/OutOfStockState', why: 'Each state exposes the same four methods but only implements the ones legal for it, so illegal call sequences (dispense() while idle) are rejected by the state object itself instead of a web of booleans and if-checks in VendingMachine.' },
    { pattern: 'Strategy', where: 'PaymentStrategy + CashPayment/CardPayment', why: 'VendingMachine.dispense() never asks "is this cash or card?" - it just calls paymentStrategy.pay(price), so a new payment method plugs in without touching the state classes.' },
    { pattern: 'Factory Method', where: 'DispenseResult.of(...) / PaymentStrategyFactory', why: 'Centralizes how a DispenseResult (product + change) and a configured PaymentStrategy are constructed, keeping that assembly logic out of the state classes.' },
  ],

  dataStructures: [
    { component: 'Product slots', structure: 'HashMap<String, Product> keyed by slot code inside Inventory', why: 'O(1) lookup and decrement by slot code regardless of how many products the machine stocks.' },
    { component: 'Running cash balance', structure: 'A single int (cents) accumulator on CashPayment', why: 'Coins/notes are inserted one at a time; an accumulator avoids re-summing a list on every insertMoney() call.' },
    { component: 'Current state reference', structure: 'A single VendingMachineState field on VendingMachine, swapped by reference on every transition', why: 'Transitioning state is one pointer assignment - O(1) - and there is never more than one active state to reason about.' },
  ],

  walkthroughs: [
    {
      title: 'Successful Purchase with Cash (exact or overpaid)',
      steps: [
        'Machine starts in IdleState. Customer calls selectProduct("A1"); IdleState asks Inventory for the product and checks isInStock() before doing anything else.',
        'If in stock, IdleState stores the product on the context (VendingMachine.selectedProduct) and calls context.setState(new HasMoneyState()).',
        'Customer calls insertMoney(100) one or more times; HasMoneyState forwards each call to CashPayment.insertCoin() and adds it to the context\'s running balance.',
        'Once the running balance is greater than or equal to the product price, HasMoneyState transitions the context to DispensingState.',
        'Customer calls dispense(); DispensingState asks CashPayment for the running total, computes change = total - price, calls Inventory.decrement(code), builds a DispenseResult(product, change), and transitions back to IdleState.',
        'If the running balance never reaches the price and the customer keeps inserting money, HasMoneyState simply stays in HasMoneyState and accumulates - no transition happens until the threshold is met.',
      ],
    },
    {
      title: 'Out-of-Stock Selection and Mid-Transaction Cancel',
      steps: [
        'Customer calls selectProduct("B2") on a machine in IdleState where slot B2 has quantity 0.',
        'IdleState checks Inventory.getProduct("B2").isInStock() and finds it false - it throws an IllegalStateException before touching balance, payment strategy, or state, and the machine stays in IdleState.',
        'On a different transaction, the customer selects a valid product (machine moves to HasMoneyState) and inserts partial money, then calls cancel().',
        'HasMoneyState calls paymentStrategy.refund(), which returns the full inserted amount and zeroes CashPayment\'s running total.',
        'HasMoneyState clears context.selectedProduct and context.insertedCents, then calls context.setState(new IdleState()).',
        'A subsequent call to dispense() before any new selection would now hit IdleState.dispense(), which throws immediately - proving the refund fully reset the transaction.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Product.java',
      rationale: 'A small mutable entity - price and code never change after creation, but quantity must be decremented on every successful sale, so only that field is mutable.',
      code: `public final class Product {
    private final String code;
    private final String name;
    private final int priceCents;
    private int quantity;

    public Product(String code, String name, int priceCents, int quantity) {
        this.code = code;
        this.name = name;
        this.priceCents = priceCents;
        this.quantity = quantity;
    }

    public boolean isInStock() {
        return quantity > 0;
    }

    public void decrementStock() {
        if (quantity <= 0) {
            throw new IllegalStateException("Cannot decrement stock for out-of-stock product " + code);
        }
        quantity--;
    }

    public void restock(int amount) {
        this.quantity += amount;
    }

    public String getCode() { return code; }
    public String getName() { return name; }
    public int getPriceCents() { return priceCents; }
    public int getQuantity() { return quantity; }
}`,
    },
    {
      filename: 'Inventory.java',
      rationale: 'Every slot lookup goes through this one class, so "what does out of stock mean" and "how do we key a slot" are each defined in exactly one place.',
      code: `import java.util.HashMap;
import java.util.Map;

public final class Inventory {
    private final Map<String, Product> slots = new HashMap<>();

    public void addProduct(Product product) {
        slots.put(product.getCode(), product);
    }

    public Product getProduct(String code) {
        Product product = slots.get(code);
        if (product == null) {
            throw new IllegalArgumentException("No such slot: " + code);
        }
        return product;
    }

    public void restock(String code, int amount) {
        getProduct(code).restock(amount);
    }

    public void decrement(String code) {
        getProduct(code).decrementStock();
    }
}`,
    },
    {
      filename: 'PaymentResult.java',
      rationale: 'A tiny value object so pay() can report both "did it succeed" and "how much is now on account" without callers inspecting exception types for control flow.',
      code: `public final class PaymentResult {
    private final boolean success;
    private final String message;

    private PaymentResult(boolean success, String message) {
        this.success = success;
        this.message = message;
    }

    public static PaymentResult accepted() {
        return new PaymentResult(true, "accepted");
    }

    public static PaymentResult declined(String reason) {
        return new PaymentResult(false, reason);
    }

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
}`,
    },
    {
      filename: 'PaymentStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout: 'This interface is the entire reason DispensingState never contains an "if cash else if card" branch. Cash and card behave completely differently internally (accumulate coins vs. call an auth API) but look identical to every state class.',
      rationale: 'Kept to three methods so any new payment method - mobile wallet, gift card - has a small, obvious contract to satisfy.',
      code: `public interface PaymentStrategy {
    /** Attempt to cover amountCents from whatever has been paid/authorized so far. */
    PaymentResult pay(int amountCents);

    /** Total amount currently credited toward this transaction, in cents. */
    int getRunningTotal();

    /** Return everything credited so far and reset the running total to zero. */
    int refund();
}`,
    },
    {
      filename: 'CashPayment.java',
      rationale: 'Coins/notes arrive one at a time via insertCoin(); pay() just checks whether the accumulated total already covers the price, since cash cannot be "authorized" ahead of time the way a card can.',
      code: `public final class CashPayment implements PaymentStrategy {
    private int insertedCents = 0;

    public void insertCoin(int cents) {
        if (cents <= 0) {
            throw new IllegalArgumentException("Inserted amount must be positive");
        }
        insertedCents += cents;
    }

    @Override
    public PaymentResult pay(int amountCents) {
        if (insertedCents < amountCents) {
            return PaymentResult.declined("Insufficient cash inserted: have " + insertedCents + ", need " + amountCents);
        }
        return PaymentResult.accepted();
    }

    @Override
    public int getRunningTotal() {
        return insertedCents;
    }

    @Override
    public int refund() {
        int refunded = insertedCents;
        insertedCents = 0;
        return refunded;
    }
}`,
    },
    {
      filename: 'CardPayment.java',
      calloutTitle: '💡 Simulated external call',
      callout: 'authSucceeds stands in for a real payment gateway call. Because CardPayment implements the same PaymentStrategy contract as CashPayment, swapping which strategy the machine is configured with is a one-line change in VendingMachine, never in the state classes.',
      rationale: 'Unlike cash, a card charge is all-or-nothing per attempt - there is no concept of "partial" card payment, so getRunningTotal() only reflects a completed charge.',
      code: `public final class CardPayment implements PaymentStrategy {
    private final boolean authSucceeds;
    private int chargedCents = 0;

    public CardPayment(boolean authSucceeds) {
        this.authSucceeds = authSucceeds;
    }

    @Override
    public PaymentResult pay(int amountCents) {
        // Simulates a network call to a card processor.
        if (!authSucceeds) {
            return PaymentResult.declined("Card authorization failed");
        }
        chargedCents = amountCents;
        return PaymentResult.accepted();
    }

    @Override
    public int getRunningTotal() {
        return chargedCents;
    }

    @Override
    public int refund() {
        int refunded = chargedCents;
        chargedCents = 0;
        return refunded;
    }
}`,
    },
    {
      filename: 'DispenseResult.java',
      rationale: 'Bundles the two things a customer actually cares about at the end of a purchase - which product came out, and how much change to hand back.',
      code: `public final class DispenseResult {
    private final Product product;
    private final int changeCents;

    public DispenseResult(Product product, int changeCents) {
        this.product = product;
        this.changeCents = changeCents;
    }

    public Product getProduct() { return product; }
    public int getChangeCents() { return changeCents; }
}`,
    },
    {
      filename: 'VendingMachineState.java',
      calloutTitle: '💡 State Pattern',
      callout: 'Every one of these four methods exists on every concrete state, but each state only gives a real implementation to the ones that are legal from it - the rest throw immediately. VendingMachine itself never checks "what state am I in" - it just forwards the call and lets the state object decide.',
      rationale: 'One interface, four methods, mirrors exactly the customer-facing actions on the machine\'s keypad.',
      code: `public interface VendingMachineState {
    void selectProduct(String code);
    void insertMoney(int cents);
    DispenseResult dispense();
    void cancel();
}`,
    },
    {
      filename: 'IdleState.java',
      rationale: 'The only state where selectProduct() is legal. Rejecting an out-of-stock product happens here, before any money or payment strategy is touched, exactly as the requirement demands.',
      code: `public final class IdleState implements VendingMachineState {
    private final VendingMachine machine;

    public IdleState(VendingMachine machine) {
        this.machine = machine;
    }

    @Override
    public void selectProduct(String code) {
        Product product = machine.getInventory().getProduct(code);
        if (!product.isInStock()) {
            throw new IllegalStateException("Product " + code + " is out of stock");
        }
        machine.setSelectedProduct(product);
        machine.setState(new HasMoneyState(machine));
    }

    @Override
    public void insertMoney(int cents) {
        throw new IllegalStateException("Select a product before inserting money");
    }

    @Override
    public DispenseResult dispense() {
        throw new IllegalStateException("Cannot dispense: no product selected");
    }

    @Override
    public void cancel() {
        throw new IllegalStateException("Nothing to cancel: machine is idle");
    }
}`,
    },
    {
      filename: 'HasMoneyState.java',
      calloutTitle: '💡 State transition + refund',
      callout: 'insertMoney() only advances to DispensingState once the running total actually covers the price - inserting less just accumulates and stays in HasMoneyState. cancel() proves the state, not the caller, owns unwinding a transaction: it refunds through the PaymentStrategy and clears the context in one place.',
      rationale: 'This is the only state where money can be added or the transaction can be cancelled - both selectProduct() (switch products mid-transaction) and dispense() (before enough money is in) are deliberately illegal here.',
      code: `public final class HasMoneyState implements VendingMachineState {
    private final VendingMachine machine;

    public HasMoneyState(VendingMachine machine) {
        this.machine = machine;
    }

    @Override
    public void selectProduct(String code) {
        throw new IllegalStateException("Finish or cancel the current transaction before selecting another product");
    }

    @Override
    public void insertMoney(int cents) {
        machine.getPaymentStrategy().pay(0); // no-op authorization check; cash strategy tracks the raw insert below
        if (machine.getPaymentStrategy() instanceof CashPayment) {
            ((CashPayment) machine.getPaymentStrategy()).insertCoin(cents);
        }
        int price = machine.getSelectedProduct().getPriceCents();
        if (machine.getPaymentStrategy().getRunningTotal() >= price) {
            machine.setState(new DispensingState(machine));
        }
    }

    @Override
    public DispenseResult dispense() {
        throw new IllegalStateException("Insufficient funds inserted so far");
    }

    @Override
    public void cancel() {
        machine.getPaymentStrategy().refund();
        machine.setSelectedProduct(null);
        machine.setState(new IdleState(machine));
    }
}`,
    },
    {
      filename: 'DispensingState.java',
      rationale: 'The only state where dispense() does real work. It is the single place that computes change, mutates inventory, and returns to IdleState - keeping the "money in, product + change out" arithmetic in one testable spot.',
      code: `public final class DispensingState implements VendingMachineState {
    private final VendingMachine machine;

    public DispensingState(VendingMachine machine) {
        this.machine = machine;
    }

    @Override
    public void selectProduct(String code) {
        throw new IllegalStateException("Cannot select a product while dispensing");
    }

    @Override
    public void insertMoney(int cents) {
        throw new IllegalStateException("Cannot insert more money while dispensing");
    }

    @Override
    public DispenseResult dispense() {
        Product product = machine.getSelectedProduct();
        int total = machine.getPaymentStrategy().getRunningTotal();
        int change = total - product.getPriceCents();

        machine.getInventory().decrement(product.getCode());
        machine.getPaymentStrategy().refund(); // clears the running total now that the sale is final
        machine.setSelectedProduct(null);

        VendingMachineState next = product.isInStock()
                ? new IdleState(machine)
                : new OutOfStockState(machine);
        machine.setState(next);

        return new DispenseResult(product, change);
    }

    @Override
    public void cancel() {
        throw new IllegalStateException("Cannot cancel once dispensing has started");
    }
}`,
    },
    {
      filename: 'OutOfStockState.java',
      rationale: 'A per-slot dead end reached only if dispense() just sold the last unit of a product. It exists to model a machine that visibly stops serving that slot until an operator restocks and calls back to Idle - selection of a different, in-stock slot still routes through Idle in this simplified single-slot-at-a-time model.',
      code: `public final class OutOfStockState implements VendingMachineState {
    private final VendingMachine machine;

    public OutOfStockState(VendingMachine machine) {
        this.machine = machine;
    }

    @Override
    public void selectProduct(String code) {
        throw new IllegalStateException("Machine slot is out of stock; restock before selecting again");
    }

    @Override
    public void insertMoney(int cents) {
        throw new IllegalStateException("Cannot insert money: machine slot is out of stock");
    }

    @Override
    public DispenseResult dispense() {
        throw new IllegalStateException("Cannot dispense: machine slot is out of stock");
    }

    @Override
    public void cancel() {
        throw new IllegalStateException("Nothing to cancel: machine slot is out of stock");
    }

    /** Operator action - not part of VendingMachineState because customers never call it. */
    public void restock(int amount, Product product) {
        product.restock(amount);
        machine.setState(new IdleState(machine));
    }
}`,
    },
    {
      filename: 'VendingMachine.java',
      calloutTitle: '💡 The State context',
      callout: 'Every public method is a one-line delegation to currentState. VendingMachine never contains a switch on "what state am I in" - that logic lives entirely inside the state classes, which is what keeps adding a fifth state (e.g. MaintenanceState) from touching this class at all.',
      rationale: 'Holds exactly the mutable fields a state needs to read or change (balance is implicit in the PaymentStrategy, selectedProduct, currentState) and nothing else - it is deliberately a thin coordinator.',
      code: `public final class VendingMachine {
    private final Inventory inventory;
    private PaymentStrategy paymentStrategy;
    private VendingMachineState currentState;
    private Product selectedProduct;

    public VendingMachine(Inventory inventory, PaymentStrategy paymentStrategy) {
        this.inventory = inventory;
        this.paymentStrategy = paymentStrategy;
        this.currentState = new IdleState(this);
    }

    public void setState(VendingMachineState state) {
        this.currentState = state;
    }

    public void setPaymentStrategy(PaymentStrategy strategy) {
        this.paymentStrategy = strategy;
    }

    public void setSelectedProduct(Product product) {
        this.selectedProduct = product;
    }

    public void selectProduct(String code) {
        currentState.selectProduct(code);
    }

    public void insertMoney(int cents) {
        currentState.insertMoney(cents);
    }

    public DispenseResult dispense() {
        return currentState.dispense();
    }

    public void cancel() {
        currentState.cancel();
    }

    public Inventory getInventory() { return inventory; }
    public PaymentStrategy getPaymentStrategy() { return paymentStrategy; }
    public Product getSelectedProduct() { return selectedProduct; }
}`,
    },
    {
      filename: 'Demo.java',
      rationale: 'Exercises every correctness requirement in one run: exact-change cash purchase, overpayment with computed change, an out-of-stock rejection before any money is touched, and an illegal-state call caught and reported instead of crashing the demo.',
      code: `public final class Demo {
    public static void main(String[] args) {
        Inventory inventory = new Inventory();
        inventory.addProduct(new Product("A1", "Cola", 150, 2));
        inventory.addProduct(new Product("B2", "Chips", 200, 0)); // deliberately out of stock

        VendingMachine machine = new VendingMachine(inventory, new CashPayment());

        // 1) Exact-change purchase
        machine.selectProduct("A1");
        machine.insertMoney(150);
        DispenseResult result1 = machine.dispense();
        System.out.println("Dispensed " + result1.getProduct().getName() + ", change: " + result1.getChangeCents() + " cents");

        // 2) Overpayment purchase - verify correct change
        machine.selectProduct("A1");
        machine.insertMoney(100);
        machine.insertMoney(100); // total 200 against a 150 price
        DispenseResult result2 = machine.dispense();
        System.out.println("Dispensed " + result2.getProduct().getName() + ", change: " + result2.getChangeCents() + " cents (expected 50)");

        // 3) Out-of-stock selection must be rejected before money changes hands
        try {
            machine.selectProduct("B2");
        } catch (IllegalStateException e) {
            System.out.println("Expected rejection: " + e.getMessage());
        }

        // 4) Illegal operation for current state: dispense() while Idle
        try {
            machine.dispense();
        } catch (IllegalStateException e) {
            System.out.println("Expected state guard: " + e.getMessage());
        }

        // 5) Cancel mid-transaction refunds inserted cash
        machine.selectProduct("A1");
        machine.insertMoney(50);
        machine.cancel();
        System.out.println("Cancelled after inserting 50 cents; running total now: " + machine.getPaymentStrategy().getRunningTotal());
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Vending Machine Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> Idle
  Idle --> HasMoney: selectProduct() [in stock]
  Idle --> Idle: selectProduct() [out of stock, rejected]
  HasMoney --> HasMoney: insertMoney() [balance < price]
  HasMoney --> Dispensing: insertMoney() [balance >= price]
  HasMoney --> Idle: cancel() [refund issued]
  Dispensing --> Idle: dispense() [stock remains]
  Dispensing --> OutOfStock: dispense() [last unit sold]
  OutOfStock --> Idle: restock()`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Select, Pay, Dispense',
    mermaid: `sequenceDiagram
  autonumber
  participant Customer
  participant VM as VendingMachine
  participant State as currentState
  participant Inv as Inventory
  participant Pay as PaymentStrategy

  Customer->>VM: selectProduct("A1")
  VM->>State: selectProduct("A1")
  State->>Inv: getProduct("A1")
  Inv-->>State: product (inStock)
  State->>VM: setState(HasMoneyState)

  Customer->>VM: insertMoney(150)
  VM->>State: insertMoney(150)
  State->>Pay: insertCoin(150) / pay()
  Pay-->>State: runningTotal >= price
  State->>VM: setState(DispensingState)

  Customer->>VM: dispense()
  VM->>State: dispense()
  State->>Inv: decrement("A1")
  State->>Pay: refund()
  Pay-->>State: totalPaid
  State->>VM: setState(IdleState)
  State-->>VM: DispenseResult(product, change)
  VM-->>Customer: DispenseResult`,
  },

  extensions: [
    { extension: 'Mobile wallet payment', implementation: 'Add a MobileWalletPayment implementing PaymentStrategy; no state class changes since they only ever call the interface methods.' },
    { extension: 'Multiple simultaneous slots selectable in one session', implementation: 'Replace the single selectedProduct field with a small cart list on VendingMachine, and have HasMoneyState sum prices across the cart.' },
    { extension: 'Operator restock and maintenance mode', implementation: 'Add a MaintenanceState that rejects all customer-facing calls, entered via an operator-only enterMaintenance() method that bypasses the normal state guards.' },
    { extension: 'Refund on partial dispense failure (mechanical jam)', implementation: 'DispensingState.dispense() catches a simulated hardware exception, calls paymentStrategy.refund(), and transitions to a JammedState instead of Idle.' },
    { extension: 'Per-product dynamic pricing (happy-hour discount)', implementation: 'Add a PricingPolicy strategy that HasMoneyState consults instead of reading product.getPriceCents() directly - mirrors PaymentStrategy\'s plug-in shape.' },
    { extension: 'Audit log of every transaction', implementation: 'Add a TransactionObserver interface notified from DispensingState.dispense(), following the same decoupling idea as an Observer pattern.' },
  ],

  interviewerChecklist: [
    'Does every state class implement all four VendingMachineState methods, even the ones that just throw?',
    'Is an out-of-stock selection rejected before any payment strategy method is called?',
    'Is change computed correctly on overpayment, and is the running total reset after a sale or a cancel?',
    'Does cancel() actually call refund() on the PaymentStrategy rather than just discarding the balance silently?',
    'Can a new payment method be added without touching IdleState/HasMoneyState/DispensingState?',
    'Does the candidate explain why VendingMachine itself contains no state-checking logic?',
    'Is there a concrete illegal-operation example (e.g. dispense() while Idle) demonstrated, not just asserted?',
  ],

  relatedDesigns: ['parking-lot', 'elevator-system', 'splitwise'],
  keyTakeaways: [
    'State pattern replaces a web of "if currentState == X" checks with polymorphism - each state class is the single source of truth for what is legal from it.',
    'Strategy pattern isolates "how payment happens" from "what the machine does once payment clears" - they can evolve completely independently.',
    'Guard invariants (out-of-stock, insufficient funds) as early as possible in the call chain, before any state mutation or money movement happens.',
    'A context class (VendingMachine) that only delegates is a feature, not a code smell - it is the seam that makes the State pattern testable in isolation.',
  ],
}

export default problem

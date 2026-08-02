import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'snake-ladder',
  title: 'Snake & Ladder',
  difficulty: 'Beginner',
  icon: 'pi pi-th-large',
  color: '#f59e0b',
  readTimeMinutes: 14,
  patterns: ['Strategy', 'Factory', 'State'],
  companies: ['Amazon', 'Zynga', 'PhonePe', 'Microsoft'],
  summary:
    'A turn-based Snake & Ladder game where a validated, immutable board is assembled by a factory, dice rolling is swappable between real randomness and a scripted sequence for deterministic tests, and the game phase itself governs which moves are legal.',

  functionalRequirements: [
    'The board has N numbered cells (1..N); every player starts off the board at position 0 and only enters play once the game has started.',
    'Two or more players take turns rolling a single shared die in a fixed, repeating rotation.',
    'On a turn, the current player advances by the dice value; if that would move them past the final cell, the roll is wasted and the player stays exactly where they were (a player must land on the final cell exactly to finish).',
    'After a valid move, if the new cell is a snake head or a ladder bottom, the player is immediately relocated to the mapped tail/top; at most one such jump is applied per turn (the destination cell is never re-checked for a second snake or ladder in the same turn).',
    'The first player to land exactly on the final cell wins immediately and no further turns are played.',
    'Board layout (size, snake head-to-tail map, ladder bottom-to-top map) is validated at construction time so a malformed board (out-of-range cell, self-referential jump, wrong-direction snake/ladder, or a cell double-booked as both a snake head and a ladder bottom) can never be built.',
    'Dice behavior must be pluggable so a game can be replayed with a deterministic, scripted sequence of rolls instead of true randomness.',
  ],
  nonFunctionalRequirements: [
    'Resolving whether a landed-on cell is a snake or ladder must be O(1) (a hash map lookup), never a scan of every snake/ladder on the board.',
    'Adding a new dice algorithm (weighted die, two-die sum, etc.) must require zero changes to the turn logic inside Game.',
    'The game must reject operations that are illegal for its current phase (rolling before start, rolling after someone has already won) with a clear exception rather than a silent no-op.',
  ],

  coreEntities: [
    { name: 'GameState', description: 'Enum driving a tiny state machine: NOT_STARTED, IN_PROGRESS, FINISHED - it decides which operations Game will even allow.' },
    { name: 'Player', description: 'A participant with an id, display name, and a mutable current board position (0 until they enter play).' },
    { name: 'Board', description: 'Immutable value object: total size plus the validated snake (head -> tail) and ladder (bottom -> top) maps; the only place that knows how to resolve a landing.' },
    { name: 'BoardFactory', description: 'Static factory that validates a proposed layout and is the only path through which a Board can be constructed.' },
    { name: 'Dice', description: 'Strategy interface for producing the next roll - decouples "how random" from the turn-taking logic.' },
    { name: 'StandardDice', description: 'Real gameplay implementation - a uniform random roll between 1 and the configured face count (6 by default).' },
    { name: 'FixedSequenceDice', description: 'Test/demo implementation that replays a pre-scripted list of rolls, one per call, so a full game can be reproduced exactly.' },
    { name: 'TurnResult', description: 'Immutable summary of one turn - who rolled what, where they started and ended up, and whether a snake, ladder, overshoot, or win occurred.' },
    { name: 'Game', description: 'The controller - owns the player rotation, the board, the dice, and the current GameState; playTurn() is the single entry point for advancing play.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class GameState {
    <<enumeration>>
    NOT_STARTED
    IN_PROGRESS
    FINISHED
  }
  class Player {
    -String id
    -String name
    -int position
    +getPosition() int
  }
  class Board {
    -int size
    -Map~Integer, Integer~ snakes
    -Map~Integer, Integer~ ladders
    +getSize() int
    +resolveLanding(int) int
  }
  class BoardFactory {
    +createBoard(int, Map, Map) Board
  }
  class Dice {
    <<interface>>
    +roll() int
  }
  class StandardDice {
    -Random random
    -int faces
    +roll() int
  }
  class FixedSequenceDice {
    -List~Integer~ sequence
    -int cursor
    +roll() int
  }
  class TurnResult {
    -Player player
    -int diceRoll
    -int startPosition
    -int finalPosition
    -boolean bittenBySnake
    -boolean climbedLadder
    -boolean wonGame
  }
  class Game {
    -List~Player~ players
    -Board board
    -Dice dice
    -int currentTurnIndex
    -GameState state
    +start() void
    +playTurn() TurnResult
  }

  Dice <|.. StandardDice
  Dice <|.. FixedSequenceDice
  BoardFactory ..> Board : creates
  Game o-- Board
  Game o-- Dice
  Game o-- Player
  Game --> GameState
  Game ..> TurnResult : produces`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'Dice interface + StandardDice / FixedSequenceDice', why: 'Game.playTurn() calls dice.roll() and never knows or cares whether the number came from java.util.Random or a scripted list - which is exactly what makes deterministic unit tests possible.' },
    { pattern: 'Factory Method', where: 'BoardFactory.createBoard()', why: 'Board has invariants (in-range cells, correct jump direction, no cell double-booked) that must hold for every instance - routing all construction through one validating method means an invalid Board can never exist.' },
    { pattern: 'State', where: 'GameState enum checked at the top of start() and playTurn()', why: 'Which operations are legal depends entirely on the current phase; encoding that as an explicit enum (rather than ad-hoc booleans like hasStarted/isOver) makes illegal transitions fail loudly instead of corrupting game data.' },
  ],

  dataStructures: [
    { component: 'Snake and ladder lookups', structure: 'Two separate HashMap<Integer, Integer> inside Board (head -> tail, bottom -> top)', why: 'resolveLanding() is a single O(1) map lookup per map instead of scanning a list of Snake/Ladder objects for a match on every single move.' },
    { component: 'Turn rotation', structure: 'List<Player> plus a currentTurnIndex advanced with modulo arithmetic', why: '"Whose turn is it" and "advance to the next player" are both O(1), and the rotation naturally wraps around regardless of player count.' },
  { component: 'Scripted dice rolls', structure: 'List<Integer> plus an int cursor in FixedSequenceDice', why: 'Replaying a fixed script is just "read the next index and increment" - O(1) per roll, and exhausting the script fails fast instead of silently returning garbage.' },
    { component: 'Occupied-start-cell check during validation', structure: 'A single HashSet<Integer> shared across both the snake and ladder validation loops', why: "Add-and-check-return-value on one set is the cheapest way to catch \"this cell is already a snake head\" when validating a ladder bottom, without a second nested loop." },
  ],

  walkthroughs: [
    {
      title: 'Building a Validated Board',
      steps: [
        'Caller hands BoardFactory.createBoard() a size (e.g. 30) plus two plain maps: snake head -> tail, and ladder bottom -> top.',
        'For every snake, the factory checks the head is strictly between 1 and size, the tail is between 1 and size, and tail < head (a snake must move you backward, never forward or in place).',
        'For every ladder, the same range check runs, plus top > bottom (a ladder must move you forward).',
        'A shared HashSet accumulates every snake head and ladder bottom seen so far; if a cell is already in the set, construction fails immediately - a cell cannot be both a snake head and a ladder bottom.',
        'Only after every entry passes does the factory call Board\'s package-private constructor, so an invalid Board object can never exist, even transiently.',
        'The returned Board stores defensive, unmodifiable copies of both maps - nobody outside Board can mutate the layout after the fact.',
      ],
    },
    {
      title: 'Playing One Turn',
      steps: [
        'Game.playTurn() first checks state == IN_PROGRESS; calling it before start() or after a win throws IllegalStateException.',
        'It reads the current player from players.get(currentTurnIndex) and calls dice.roll() exactly once.',
        'It adds the roll to the player\'s position. If that sum exceeds board.getSize(), the move is discarded and the player\'s position is left unchanged (the overshoot rule).',
        'If the move was valid, board.resolveLanding(newPosition) is called - a single lookup that returns the snake tail or ladder top if one applies, otherwise the same cell back.',
        'The player\'s position is updated to the resolved cell; if that resolved cell equals board.getSize(), state flips to FINISHED and the winner is recorded - otherwise currentTurnIndex advances to the next player.',
        'A TurnResult is built and returned, capturing the roll, the before/after positions, and which of "no move / snake bite / ladder climb / win" happened, so a UI or test can narrate the turn without re-deriving any of it.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'GameState.java',
      rationale: 'Three values are enough to describe every legal phase of the game - keeping it an enum (not a String or an int flag) lets the compiler enforce exhaustive handling wherever it is switched on.',
      code: `public enum GameState {
    NOT_STARTED,
    IN_PROGRESS,
    FINISHED
}`,
    },
    {
      filename: 'Player.java',
      rationale: 'Position starts at 0 (off the board) rather than 1, so "has this player even entered play yet" is just position > 0 with no extra flag. setPosition is package-private because only Game is allowed to move a player.',
      code: `public final class Player {
    private final String id;
    private final String name;
    private int position;

    public Player(String id, String name) {
        this.id = id;
        this.name = name;
        this.position = 0;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public int getPosition() { return position; }

    void setPosition(int position) {
        this.position = position;
    }
}`,
    },
    {
      filename: 'InvalidBoardException.java',
      rationale: 'A dedicated unchecked exception for layout problems, so BoardFactory failures are unmistakably a "this board definition is wrong" bug rather than some generic IllegalArgumentException that could mean anything.',
      code: `public final class InvalidBoardException extends RuntimeException {
    public InvalidBoardException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'Board.java',
      rationale:
        "Deliberately has no public constructor - the package-private one is only ever called from BoardFactory once every invariant has been checked, so \"an unvalidated Board\" is not a state the type system allows.",
      code: `import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class Board {
    private final int size;
    private final Map<Integer, Integer> snakes;   // head -> tail
    private final Map<Integer, Integer> ladders;  // bottom -> top

    Board(int size, Map<Integer, Integer> snakes, Map<Integer, Integer> ladders) {
        this.size = size;
        this.snakes = Collections.unmodifiableMap(new HashMap<>(snakes));
        this.ladders = Collections.unmodifiableMap(new HashMap<>(ladders));
    }

    public int getSize() {
        return size;
    }

    /**
     * Applies at most one snake bite or ladder climb triggered by landing on the given cell.
     * The returned cell is never re-checked against either map, by design - chaining
     * through a second snake or ladder in the same turn is out of scope for this model.
     */
    public int resolveLanding(int landedCell) {
        if (snakes.containsKey(landedCell)) {
            return snakes.get(landedCell);
        }
        if (ladders.containsKey(landedCell)) {
            return ladders.get(landedCell);
        }
        return landedCell;
    }
}`,
    },
    {
      filename: 'BoardFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'Every invariant a Board must satisfy - cells in range, snakes pointing backward, ladders pointing forward, no cell double-booked - is checked exactly once, here, before Board\'s constructor is ever called. Callers cannot accidentally skip validation because there is no other way to obtain a Board.',
      rationale: 'A single static method rather than a Builder because a board layout has no optional pieces - it is either a complete, valid definition or it is rejected outright.',
      code: `import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public final class BoardFactory {

    private BoardFactory() {}

    public static Board createBoard(int size, Map<Integer, Integer> snakeHeadToTail, Map<Integer, Integer> ladderBottomToTop) {
        if (size < 10) {
            throw new InvalidBoardException("Board size must be at least 10 cells, got " + size);
        }

        Set<Integer> claimedStartCells = new HashSet<>();

        for (Map.Entry<Integer, Integer> entry : snakeHeadToTail.entrySet()) {
            int head = entry.getKey();
            int tail = entry.getValue();
            requireStartCellInRange(head, size, "Snake head");
            requireDestinationCellInRange(tail, size, "Snake tail");
            if (tail >= head) {
                throw new InvalidBoardException("Snake at " + head + " must move the player backward (tail " + tail + " >= head " + head + ")");
            }
            if (!claimedStartCells.add(head)) {
                throw new InvalidBoardException("Cell " + head + " is already a snake head or ladder bottom");
            }
        }

        for (Map.Entry<Integer, Integer> entry : ladderBottomToTop.entrySet()) {
            int bottom = entry.getKey();
            int top = entry.getValue();
            requireStartCellInRange(bottom, size, "Ladder bottom");
            requireDestinationCellInRange(top, size, "Ladder top");
            if (top <= bottom) {
                throw new InvalidBoardException("Ladder at " + bottom + " must move the player forward (top " + top + " <= bottom " + bottom + ")");
            }
            if (!claimedStartCells.add(bottom)) {
                throw new InvalidBoardException("Cell " + bottom + " is already a snake head or ladder bottom");
            }
        }

        return new Board(size, snakeHeadToTail, ladderBottomToTop);
    }

    // A snake head / ladder bottom can never be the very first cell or the winning cell -
    // landing on the winning cell already ends the game before any jump could apply.
    private static void requireStartCellInRange(int cell, int size, String label) {
        if (cell <= 1 || cell >= size) {
            throw new InvalidBoardException(label + " " + cell + " must be strictly between 1 and " + size);
        }
    }

    // A destination (tail/top) is allowed to land anywhere from cell 1 up to and including
    // the winning cell - a ladder that finishes the game is a legitimate board design.
    private static void requireDestinationCellInRange(int cell, int size, String label) {
        if (cell < 1 || cell > size) {
            throw new InvalidBoardException(label + " " + cell + " must be between 1 and " + size);
        }
    }
}`,
    },
    {
      filename: 'Dice.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This one-method interface is what lets Game.playTurn() stay completely ignorant of where a roll came from. Swap StandardDice for FixedSequenceDice and the exact same Game code produces a fully reproducible playthrough - the whole reason unit tests for this game are possible at all.',
      rationale: 'Kept to a single method with no state exposed, so any implementation - real, scripted, weighted, or mocked - is trivial to write.',
      code: `public interface Dice {
    int roll();
}`,
    },
    {
      filename: 'StandardDice.java',
      rationale: 'The real-gameplay implementation. Face count defaults to 6 but is configurable, so the same class covers a house rule using a 4-sided or 8-sided die.',
      code: `import java.util.Random;

public final class StandardDice implements Dice {
    private final Random random = new Random();
    private final int faces;

    public StandardDice() {
        this(6);
    }

    public StandardDice(int faces) {
        if (faces < 2) {
            throw new IllegalArgumentException("A die needs at least 2 faces");
        }
        this.faces = faces;
    }

    @Override
    public int roll() {
        return random.nextInt(faces) + 1;
    }
}`,
    },
    {
      filename: 'FixedSequenceDice.java',
      calloutTitle: '💡 Strategy Pattern, applied to testing',
      callout:
        'Because Dice is an interface, tests never need to mock random number generation or retry until "the right roll happens" - they just hand Game a FixedSequenceDice with the exact rolls the scenario needs and get a deterministic, repeatable outcome every run.',
      rationale: 'Fails fast with IllegalStateException the moment the script runs out, rather than silently wrapping around or returning zero, so a mis-sized test script is caught immediately.',
      code: `import java.util.ArrayList;
import java.util.List;

public final class FixedSequenceDice implements Dice {
    private final List<Integer> sequence;
    private int cursor = 0;

    public FixedSequenceDice(List<Integer> sequence) {
        if (sequence == null || sequence.isEmpty()) {
            throw new IllegalArgumentException("Sequence must contain at least one scripted roll");
        }
        this.sequence = new ArrayList<>(sequence);
    }

    @Override
    public int roll() {
        if (cursor >= sequence.size()) {
            throw new IllegalStateException("FixedSequenceDice exhausted after " + sequence.size() + " scripted rolls");
        }
        return sequence.get(cursor++);
    }
}`,
    },
    {
      filename: 'TurnResult.java',
      rationale: 'A plain immutable record of what happened, so a UI, CLI, or test assertion can describe or verify a turn without re-deriving any of the logic that produced it.',
      code: `public final class TurnResult {
    private final Player player;
    private final int diceRoll;
    private final int startPosition;
    private final int finalPosition;
    private final boolean movedAtAll;
    private final boolean bittenBySnake;
    private final boolean climbedLadder;
    private final boolean wonGame;

    public TurnResult(Player player, int diceRoll, int startPosition, int finalPosition,
                       boolean movedAtAll, boolean bittenBySnake, boolean climbedLadder, boolean wonGame) {
        this.player = player;
        this.diceRoll = diceRoll;
        this.startPosition = startPosition;
        this.finalPosition = finalPosition;
        this.movedAtAll = movedAtAll;
        this.bittenBySnake = bittenBySnake;
        this.climbedLadder = climbedLadder;
        this.wonGame = wonGame;
    }

    public Player getPlayer() { return player; }
    public int getDiceRoll() { return diceRoll; }
    public int getStartPosition() { return startPosition; }
    public int getFinalPosition() { return finalPosition; }
    public boolean isMovedAtAll() { return movedAtAll; }
    public boolean isBittenBySnake() { return bittenBySnake; }
    public boolean isClimbedLadder() { return climbedLadder; }
    public boolean isWonGame() { return wonGame; }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(player.getName()).append(" rolled ").append(diceRoll).append(": ");
        if (!movedAtAll) {
            sb.append(startPosition).append(" -> stays at ").append(startPosition).append(" (overshoot, roll wasted)");
        } else if (bittenBySnake) {
            sb.append(startPosition).append(" -> bitten by a snake -> ").append(finalPosition);
        } else if (climbedLadder) {
            sb.append(startPosition).append(" -> climbs a ladder -> ").append(finalPosition);
        } else {
            sb.append(startPosition).append(" -> ").append(finalPosition);
        }
        if (wonGame) {
            sb.append("  [").append(player.getName()).append(" WINS!]");
        }
        return sb.toString();
    }
}`,
    },
    {
      filename: 'Game.java',
      calloutTitle: '💡 State Pattern (enum-driven)',
      callout:
        'Every public method starts by checking GameState. There is no reachable code path where a roll happens before start() or after a winner is declared - the enum check turns "the game should already be over" bugs into an immediate, loud IllegalStateException instead of a silently wrong board position.',
      rationale:
        'playTurn() is intentionally the only method that mutates game state; it reads as three straight-line steps - roll, resolve the move (with the overshoot rule), resolve any snake/ladder - so the win condition is a single equality check at the end, not scattered across the class.',
      code: `import java.util.ArrayList;
import java.util.List;

public final class Game {
    private final List<Player> players;
    private final Board board;
    private final Dice dice;
    private int currentTurnIndex = 0;
    private GameState state = GameState.NOT_STARTED;
    private Player winner;

    public Game(List<Player> players, Board board, Dice dice) {
        if (players == null || players.size() < 2) {
            throw new IllegalArgumentException("A game needs at least 2 players");
        }
        this.players = new ArrayList<>(players);
        this.board = board;
        this.dice = dice;
    }

    public void start() {
        if (state != GameState.NOT_STARTED) {
            throw new IllegalStateException("Game has already been started (current state: " + state + ")");
        }
        state = GameState.IN_PROGRESS;
    }

    public TurnResult playTurn() {
        if (state != GameState.IN_PROGRESS) {
            throw new IllegalStateException("Cannot roll while game is in state " + state);
        }

        Player player = players.get(currentTurnIndex);
        int roll = dice.roll();
        int startPosition = player.getPosition();
        int candidate = startPosition + roll;

        boolean movedAtAll = candidate <= board.getSize();
        int positionAfterMove = movedAtAll ? candidate : startPosition; // overshoot rule: stay put

        int finalPosition = movedAtAll ? board.resolveLanding(positionAfterMove) : positionAfterMove;
        boolean bittenBySnake = movedAtAll && finalPosition < positionAfterMove;
        boolean climbedLadder = movedAtAll && finalPosition > positionAfterMove;

        player.setPosition(finalPosition);

        boolean wonGame = finalPosition == board.getSize();
        if (wonGame) {
            state = GameState.FINISHED;
            winner = player;
        } else {
            currentTurnIndex = (currentTurnIndex + 1) % players.size();
        }

        return new TurnResult(player, roll, startPosition, finalPosition, movedAtAll, bittenBySnake, climbedLadder, wonGame);
    }

    public GameState getState() { return state; }
    public Player getWinner() { return winner; }
}`,
    },
    {
      filename: 'Demo.java',
      rationale:
        'Uses FixedSequenceDice to script a full two-player game on a small 30-cell board, guaranteeing (rather than hoping for) at least one snake bite, one ladder climb, one wasted overshoot roll, and a final exact-landing win - every rule in this design gets exercised deterministically on every run.',
      code: `import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class Demo {
    public static void main(String[] args) {
        Map<Integer, Integer> ladders = new HashMap<>();
        ladders.put(3, 16);
        ladders.put(11, 25);

        Map<Integer, Integer> snakes = new HashMap<>();
        snakes.put(24, 6);
        snakes.put(19, 8);

        Board board = BoardFactory.createBoard(30, snakes, ladders);

        Player alice = new Player("p1", "Alice");
        Player bob = new Player("p2", "Bob");

        // Scripted so Alice: climbs the 3->16 ladder, is bitten by the 19->8 snake,
        // overshoots once at position 26, then wins by landing exactly on cell 30.
        // Bob's rolls just occupy his turns and never touch a snake or ladder cell.
        List<Integer> scriptedRolls = Arrays.asList(3, 4, 3, 5, 6, 6, 6, 2, 6, 3, 6, 1, 4);
        Dice dice = new FixedSequenceDice(scriptedRolls);

        Game game = new Game(Arrays.asList(alice, bob), board, dice);
        game.start();

        while (game.getState() != GameState.FINISHED) {
            TurnResult result = game.playTurn();
            System.out.println(result);
        }

        System.out.println();
        System.out.println("Winner: " + game.getWinner().getName() + " at cell " + game.getWinner().getPosition());
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Game Phase Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> NOT_STARTED
  NOT_STARTED --> IN_PROGRESS: start()
  IN_PROGRESS --> IN_PROGRESS: playTurn() - no winner yet
  IN_PROGRESS --> FINISHED: playTurn() - landed exactly on final cell
  FINISHED --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - One Turn',
    mermaid: `sequenceDiagram
  autonumber
  participant Demo
  participant Game
  participant Dice
  participant Board
  participant Player

  Demo->>Game: playTurn()
  Game->>Dice: roll()
  Dice-->>Game: value
  Game->>Player: getPosition()
  Player-->>Game: startPosition
  alt startPosition + value > board size
    Game->>Game: movedAtAll = false (overshoot, stay put)
  else valid move
    Game->>Board: resolveLanding(startPosition + value)
    Board-->>Game: finalPosition (post snake/ladder)
  end
  Game->>Player: setPosition(finalPosition)
  alt finalPosition == board size
    Game->>Game: state = FINISHED, record winner
  else
    Game->>Game: advance currentTurnIndex
  end
  Game-->>Demo: TurnResult`,
  },

  extensions: [
    { extension: 'Multiple dice per turn', implementation: 'Add a TwoDiceStrategy implementing Dice whose roll() sums two independent 1-6 draws; Game is untouched since it only ever calls dice.roll() once and treats the return value as an opaque total.' },
    { extension: 'Extra turn on rolling the max face value', implementation: 'Add a boolean flag to TurnResult (or check diceRoll == dice.maxFace() if that is exposed) and have Game skip advancing currentTurnIndex when it is set.' },
    { extension: 'Chained snakes/ladders', implementation: 'Change Board.resolveLanding() to loop while the result is still a key in either map (with a max-hops guard to avoid an accidental infinite loop from a malformed board) instead of doing a single lookup.' },
    { extension: 'Per-player custom dice (handicap mode)', implementation: 'Store a Map<Player, Dice> in Game instead of one shared Dice, and look up the roller\'s own strategy each turn - Strategy already makes this a one-line change.' },
    { extension: 'Replay / audit log', implementation: 'Have Game append every TurnResult to a List<TurnResult> as it plays; Demo (or a real UI) can later replay the whole game turn-by-turn from that log.' },
    { extension: 'Board editor / random board generator', implementation: 'Add a second factory method, BoardFactory.createRandomBoard(size, snakeCount, ladderCount), that generates candidate maps and retries until they pass the exact same validation used by createBoard().' },
  ],

  interviewerChecklist: [
    'Is landing resolution a map lookup (O(1)) rather than iterating a list of Snake/Ladder objects on every move?',
    'Is the overshoot rule ("roll past the final cell = no move") implemented explicitly, not accidentally allowed by clamping or wrapping the position?',
    'Is board validation centralized in one factory method, so an invalid Board object can never be constructed anywhere in the codebase?',
    'Can the candidate explain why Dice is an interface - specifically, how it enables deterministic tests without touching Game?',
    'Does GameState actually gate behavior (exceptions on illegal calls), or is it just a label nobody checks?',
    'Does the candidate state their chaining assumption out loud (at most one snake/ladder jump per turn) instead of leaving it as an unstated, easy-to-miss design decision?',
    'Is Player kept dumb (a position holder) with Game owning all turn-taking logic, rather than Player deciding when it is its own turn?',
  ],

  relatedDesigns: ['tic-tac-toe', 'vending-machine'],
  keyTakeaways: [
    'Strategy is worth introducing the moment "how a value is produced" needs to vary independently of the logic that consumes it - here, that turns an untestable random game into a fully deterministic one.',
    'Routing all construction of an invariant-heavy object through a single validating factory method is cheaper than defending every call site against a malformed instance later.',
    'An explicit state enum, checked at the top of every mutating method, turns "this should never happen" bugs into immediate, diagnosable exceptions instead of silently wrong game state.',
    'Stating a simplifying assumption explicitly (no chained snake/ladder jumps) is itself a signal of design maturity in an interview - vague behavior is worse than a clearly scoped rule.',
    'Encoding a house rule (exact-landing win, wasted overshoot roll) as a couple of comparisons in one method beats scattering `if` checks for it across the codebase.',
  ],
}

export default problem

import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'tic-tac-toe',
  title: 'Tic-Tac-Toe',
  difficulty: 'Beginner',
  icon: 'pi pi-times',
  color: '#22c55e',
  readTimeMinutes: 13,
  patterns: ['Strategy', 'Factory Method', 'State'],
  companies: ['Google', 'Amazon', 'Microsoft'],
  summary:
    'A two-player game on a configurable N x N grid where the win check runs in O(1) per move via incremental row/column/diagonal counters, and the win condition itself is a swappable Strategy instead of logic baked into the game loop.',

  functionalRequirements: [
    'Support an N x N board where N is chosen when the game is created, not hardcoded to 3x3.',
    'Two players alternate turns placing their assigned symbol (X or O) on any empty cell.',
    'Assign symbols in a deterministic order when the game starts - the first player registered always plays X and moves first.',
    'After every move, determine whether that exact move produced a win without rescanning the whole board.',
    'Detect a draw - board completely full with no winner - as a state distinct from an ongoing game.',
    'Reject a move on an already-occupied cell or a cell outside the board with a clear exception, leaving the board unchanged.',
    'Reject any move once the game has already finished (win or draw) with a clear exception.',
  ],
  nonFunctionalRequirements: [
    'Win-check must be O(1) per move regardless of board size N, not an O(N) row/column scan or an O(N^2) full-board scan.',
    'Adding a new win condition (e.g. "k in a row" on a larger board, or a diagonal-only variant) must not require any change to the Game class.',
    'Illegal moves must fail fast with a typed exception rather than silently being ignored or corrupting the running win-check counters.',
    'The rule "who is X, who is O, who goes first" must live in exactly one place so it can never be duplicated or gotten wrong at a call site.',
  ],

  coreEntities: [
    { name: 'Symbol', description: 'Enum of X, O, and EMPTY - what can occupy a cell. EMPTY is a real board state, not null, so no cell is ever ambiguous.' },
    { name: 'Board', description: 'The N x N grid plus the running row/column/diagonal/anti-diagonal counters per symbol that make win-checking O(1).' },
    { name: 'Player', description: 'A participant - id, display name, and the Symbol they were assigned for this game.' },
    { name: 'PlayerFactory', description: 'Hands out players in turn order, guaranteeing the first player created is X and the second is O.' },
    { name: 'WinningStrategy', description: 'Interface for "did this move win the game?" - the interchangeable part of the rules.' },
    { name: 'LineWinningStrategy', description: 'Concrete strategy: a player wins by filling an entire row, column, or diagonal - generalized to any N, not hardcoded to 3.' },
    { name: 'GameState', description: 'Enum of IN_PROGRESS, X_WON, O_WON, DRAW - governs which operations are legal at any moment.' },
    { name: 'Game', description: 'The controller - owns the board, the two players, whose turn it is, the current state, and the plugged-in winning strategy.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Symbol {
    <<enumeration>>
    X
    O
    EMPTY
  }
  class GameState {
    <<enumeration>>
    IN_PROGRESS
    X_WON
    O_WON
    DRAW
  }
  class Board {
    -int size
    -Symbol[][] grid
    -int[][] rowCounts
    -int[][] colCounts
    -int[] diagonalCounts
    -int[] antiDiagonalCounts
    -int filledCells
    -int lastMoveRow
    -int lastMoveCol
    +placeMark(int, int, Symbol) void
    +getRowCount(Symbol, int) int
    +getColCount(Symbol, int) int
    +getDiagonalCount(Symbol) int
    +getAntiDiagonalCount(Symbol) int
    +isFull() boolean
    +getLastMoveRow() int
    +getLastMoveCol() int
  }
  class Player {
    -String id
    -String name
    -Symbol symbol
    +getSymbol() Symbol
  }
  class PlayerFactory {
    -AtomicInteger playersCreated
    +createNextPlayer(String) Player
    +reset() void
  }
  class WinningStrategy {
    <<interface>>
    +checkWinner(Board, Symbol) boolean
  }
  class LineWinningStrategy {
    +checkWinner(Board, Symbol) boolean
  }
  class InvalidMoveException {
    +InvalidMoveException(String)
  }
  class GameOverException {
    +GameOverException(String)
  }
  class Game {
    -Board board
    -Player[] players
    -WinningStrategy winningStrategy
    -int currentPlayerIndex
    -GameState state
    +makeMove(int, int) void
    +getState() GameState
    +getCurrentPlayer() Player
  }

  WinningStrategy <|.. LineWinningStrategy
  Game o-- Board
  Game o-- WinningStrategy
  Game o-- Player
  Game ..> GameState
  Game ..> PlayerFactory : uses at construction
  Player o-- Symbol
  Board ..> InvalidMoveException : throws
  Game ..> GameOverException : throws
  LineWinningStrategy ..> Board : reads counters from`,
  },

  designPatterns: [
    { pattern: 'Strategy', where: 'WinningStrategy interface + LineWinningStrategy', why: 'Game.makeMove() calls winningStrategy.checkWinner(board, symbol) without knowing HOW winning is defined - a k-in-a-row or diagonal-only variant plugs in through the constructor with zero changes to Game.' },
    { pattern: 'Factory Method', where: 'PlayerFactory.createNextPlayer()', why: 'The rule "first player is X and moves first, second player is O" is enforced in exactly one method instead of being re-derived (and possibly gotten wrong) wherever a Player is constructed.' },
    { pattern: 'State (enum-driven)', where: 'GameState guarding Game.makeMove()', why: 'A single guard clause at the top of makeMove() checks state == IN_PROGRESS - every transition (win, draw, continue) is computed in one place, so "no moves after game over" cannot be bypassed by any code path.' },
  ],

  dataStructures: [
    { component: 'Board cells', structure: 'Symbol[][] (2D array) sized N x N', why: 'O(1) random access to any cell by (row, col) for placement, lookup, and rendering - no scanning needed to read the board.' },
    { component: 'Per-symbol line counters', structure: 'int[2][N] for rows and columns, plus int[2] for the two diagonals, indexed by Symbol.ordinal()', why: 'Turns every win check into 4 array reads instead of re-scanning a full row, column, or diagonal (O(N)) or the whole board (O(N^2)) after each move.' },
    { component: 'Whose turn it is', structure: 'A 2-element Player[] plus an int currentPlayerIndex toggled via 1 - currentPlayerIndex', why: 'O(1) turn switch with no map lookup - the array index doubles as the turn order.' },
  ],

  walkthroughs: [
    {
      title: 'Making a Move',
      steps: [
        'Game.makeMove(row, col) first checks state == IN_PROGRESS; if the game already ended, it throws GameOverException immediately.',
        'It resolves the current player from players[currentPlayerIndex] and calls board.placeMark(row, col, currentSymbol).',
        "Board validates the cell is in-bounds and empty - otherwise it throws InvalidMoveException before touching any counter, so a rejected move never corrupts state.",
        'On a valid placement, Board increments rowCounts[symbol][row], colCounts[symbol][col], and - if the cell sits on a diagonal - diagonalCounts/antiDiagonalCounts[symbol], then records (row, col) as the last move.',
        'Game asks winningStrategy.checkWinner(board, currentSymbol); LineWinningStrategy reads only the four counters touched by this move, so the check is O(1) regardless of N.',
        'If checkWinner returns true, state becomes X_WON or O_WON. Otherwise, if board.isFull() is true, state becomes DRAW. Otherwise the turn toggles and state stays IN_PROGRESS.',
      ],
    },
    {
      title: 'Detecting a Draw vs. an Unfinished Game',
      steps: [
        'Every call to makeMove() checks the winning strategy strictly before checking board.isFull() - a winning move on the very last empty cell is reported as a win, never mislabeled as a draw.',
        'board.isFull() is a simple filledCells == size * size comparison, kept as a running counter incremented on every successful placeMark() - no need to scan the grid for EMPTY cells.',
        'If checkWinner() is false and the board is not full, the game is still IN_PROGRESS - there are empty cells and no line is complete yet.',
        'If checkWinner() is false and the board IS full, state transitions to DRAW - the only way "board full, no winner" can happen.',
        'Once state leaves IN_PROGRESS (X_WON, O_WON, or DRAW), it never changes again - Game exposes no method that mutates state outside of makeMove().',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Symbol.java',
      rationale: 'EMPTY is modeled as a real enum value rather than null, so every cell in the grid always has a well-defined value and callers never need a null check.',
      code: `public enum Symbol {
    X,
    O,
    EMPTY
}`,
    },
    {
      filename: 'GameState.java',
      rationale: 'A flat enum is enough state machine for four states with no per-state behavior beyond "which moves are legal" - a full State-pattern class hierarchy would be ceremony without payoff here.',
      code: `public enum GameState {
    IN_PROGRESS,
    X_WON,
    O_WON,
    DRAW
}`,
    },
    {
      filename: 'InvalidMoveException.java',
      rationale: 'Unchecked on purpose: an out-of-bounds or already-occupied move is a client bug (bad UI input, a replayed request), not a recoverable condition the caller is expected to handle move-by-move.',
      code: `public final class InvalidMoveException extends RuntimeException {
    public InvalidMoveException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'GameOverException.java',
      rationale: 'Kept distinct from InvalidMoveException so a caller can tell "your move was malformed" apart from "the game you tried to move in is already finished" - the two failures call for different UI responses.',
      code: `public final class GameOverException extends RuntimeException {
    public GameOverException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'Board.java',
      calloutTitle: '💡 O(1) win-check bookkeeping',
      callout:
        'Board maintains a running count per symbol for every row, every column, and both diagonals, updated once per placeMark() call. A win check never has to re-read a row or column - it just looks at the four counters touched by the last move. This is the classic trick that turns win detection from O(N) or O(N^2) into O(1), and it generalizes to any N because nothing here assumes size == 3.',
      rationale: 'All counters live on Board (the state owner) rather than on the strategy, so any future WinningStrategy implementation can reuse the same O(1) counters instead of re-deriving them.',
      code: `import java.util.Arrays;

public final class Board {
    private final int size;
    private final Symbol[][] grid;
    private final int[][] rowCounts;        // rowCounts[symbol.ordinal()][row]
    private final int[][] colCounts;        // colCounts[symbol.ordinal()][col]
    private final int[] diagonalCounts;     // diagonalCounts[symbol.ordinal()], main diagonal
    private final int[] antiDiagonalCounts; // antiDiagonalCounts[symbol.ordinal()]
    private int filledCells = 0;
    private int lastMoveRow = -1;
    private int lastMoveCol = -1;

    public Board(int size) {
        if (size < 3) {
            throw new IllegalArgumentException("Board size must be at least 3");
        }
        this.size = size;
        this.grid = new Symbol[size][size];
        for (Symbol[] row : grid) {
            Arrays.fill(row, Symbol.EMPTY);
        }
        // Only X and O ever get placed, so 2 rows/columns of counters is exactly enough.
        this.rowCounts = new int[2][size];
        this.colCounts = new int[2][size];
        this.diagonalCounts = new int[2];
        this.antiDiagonalCounts = new int[2];
    }

    public void placeMark(int row, int col, Symbol symbol) {
        if (row < 0 || row >= size || col < 0 || col >= size) {
            throw new InvalidMoveException(
                    "Cell (" + row + ", " + col + ") is out of bounds for a " + size + "x" + size + " board");
        }
        if (grid[row][col] != Symbol.EMPTY) {
            throw new InvalidMoveException(
                    "Cell (" + row + ", " + col + ") is already occupied by " + grid[row][col]);
        }

        grid[row][col] = symbol;
        int symbolIndex = symbol.ordinal(); // X = 0, O = 1
        rowCounts[symbolIndex][row]++;
        colCounts[symbolIndex][col]++;
        if (row == col) {
            diagonalCounts[symbolIndex]++;
        }
        if (row + col == size - 1) {
            antiDiagonalCounts[symbolIndex]++;
        }
        filledCells++;
        lastMoveRow = row;
        lastMoveCol = col;
    }

    public int getRowCount(Symbol symbol, int row) { return rowCounts[symbol.ordinal()][row]; }
    public int getColCount(Symbol symbol, int col) { return colCounts[symbol.ordinal()][col]; }
    public int getDiagonalCount(Symbol symbol) { return diagonalCounts[symbol.ordinal()]; }
    public int getAntiDiagonalCount(Symbol symbol) { return antiDiagonalCounts[symbol.ordinal()]; }

    public int getSize() { return size; }
    public boolean isFull() { return filledCells == size * size; }
    public int getLastMoveRow() { return lastMoveRow; }
    public int getLastMoveCol() { return lastMoveCol; }
    public Symbol get(int row, int col) { return grid[row][col]; }

    public void print() {
        for (Symbol[] row : grid) {
            StringBuilder line = new StringBuilder();
            for (Symbol s : row) {
                line.append(s == Symbol.EMPTY ? "." : s.toString()).append(' ');
            }
            System.out.println(line.toString().trim());
        }
    }
}`,
    },
    {
      filename: 'Player.java',
      rationale: 'An immutable value object - once a Player is created its symbol never changes, which is exactly what lets PlayerFactory be the single source of truth for symbol assignment.',
      code: `public final class Player {
    private final String id;
    private final String name;
    private final Symbol symbol;

    public Player(String id, String name, Symbol symbol) {
        this.id = id;
        this.name = name;
        this.symbol = symbol;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public Symbol getSymbol() { return symbol; }
}`,
    },
    {
      filename: 'PlayerFactory.java',
      calloutTitle: '💡 Factory Method',
      callout:
        'Without this factory, "the first player is X and moves first" would have to be remembered correctly at every call site that constructs a Player - an easy rule to get backwards in a rematch or a lobby screen. Centralizing it here means Game, and any future UI, can never construct a Player with the wrong symbol.',
      rationale: 'A counter instead of a boolean flag so the same rule extends cleanly if the game later supports more than two players (see Extensions).',
      code: `import java.util.concurrent.atomic.AtomicInteger;

public final class PlayerFactory {
    private final AtomicInteger playersCreated = new AtomicInteger(0);

    public Player createNextPlayer(String name) {
        int turnIndex = playersCreated.getAndIncrement();
        if (turnIndex >= 2) {
            throw new IllegalStateException("Tic-Tac-Toe only supports 2 players per game");
        }
        Symbol assigned = (turnIndex == 0) ? Symbol.X : Symbol.O;
        return new Player("P" + (turnIndex + 1), name, assigned);
    }

    public void reset() {
        playersCreated.set(0);
    }
}`,
    },
    {
      filename: 'WinningStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'This one-method interface is the entire reason Game never has an if/else on "which win rule is active". checkWinner(Board, Symbol) takes only the board and the symbol that just moved - the strategy reads whatever it needs (here, the last move\'s row/column/diagonal counters) directly off the board, so a completely different rule can be swapped in via the Game constructor without touching Game at all.',
      rationale: 'Kept to a single method so any implementation - line-based, k-in-a-row, diagonal-only - stays trivially unit-testable in isolation from Game.',
      code: `public interface WinningStrategy {
    boolean checkWinner(Board board, Symbol symbol);
}`,
    },
    {
      filename: 'LineWinningStrategy.java',
      rationale: 'Every comparison is against board.getSize(), never a literal 3 - the exact same class works unmodified for a 3x3, 5x5, or 20x20 board, because it leans entirely on Board\'s already-generalized counters.',
      code: `public final class LineWinningStrategy implements WinningStrategy {
    @Override
    public boolean checkWinner(Board board, Symbol symbol) {
        int row = board.getLastMoveRow();
        int col = board.getLastMoveCol();
        if (row < 0 || col < 0) {
            return false; // no move has been played yet
        }
        int size = board.getSize();

        if (board.getRowCount(symbol, row) == size) return true;
        if (board.getColCount(symbol, col) == size) return true;
        if (row == col && board.getDiagonalCount(symbol) == size) return true;
        if (row + col == size - 1 && board.getAntiDiagonalCount(symbol) == size) return true;
        return false;
    }
}`,
    },
    {
      filename: 'Game.java',
      calloutTitle: '💡 Enum-driven State machine',
      callout:
        'makeMove() opens with a single guard: if state != IN_PROGRESS, throw. That one line is the entire enforcement of "no moves after the game ends" - every other method reads state but nothing else is allowed to write it. Compare this to scattering "if (gameOver) return;" checks across a UI, a network handler, and a replay tool - here there is exactly one place that can go wrong, and it is trivial to test.',
      rationale: 'Game only orchestrates - it delegates cell validation to Board and win detection to WinningStrategy, so its own logic is just "whose turn, what happened, what state now".',
      code: `public final class Game {
    private final Board board;
    private final Player[] players;
    private final WinningStrategy winningStrategy;
    private int currentPlayerIndex = 0;
    private GameState state = GameState.IN_PROGRESS;

    public Game(int boardSize, String player1Name, String player2Name, WinningStrategy winningStrategy) {
        this.board = new Board(boardSize);
        this.winningStrategy = winningStrategy;
        PlayerFactory factory = new PlayerFactory();
        this.players = new Player[] {
                factory.createNextPlayer(player1Name), // always X, moves first
                factory.createNextPlayer(player2Name)   // always O
        };
    }

    public void makeMove(int row, int col) {
        if (state != GameState.IN_PROGRESS) {
            throw new GameOverException("Game has already finished with state " + state + " - no more moves are allowed");
        }

        Player current = players[currentPlayerIndex];
        board.placeMark(row, col, current.getSymbol()); // throws InvalidMoveException on a bad cell

        if (winningStrategy.checkWinner(board, current.getSymbol())) {
            state = (current.getSymbol() == Symbol.X) ? GameState.X_WON : GameState.O_WON;
            return;
        }
        if (board.isFull()) {
            state = GameState.DRAW;
            return;
        }
        currentPlayerIndex = 1 - currentPlayerIndex; // toggle turn; still IN_PROGRESS
    }

    public GameState getState() { return state; }
    public Player getCurrentPlayer() { return players[currentPlayerIndex]; }
    public Board getBoard() { return board; }
}`,
    },
    {
      filename: 'Demo.java',
      rationale: 'Exercises three independent scenarios end to end - a scripted win, a scripted draw, and a caught illegal move - printing the board after each move of the win sequence so the O(1) counters can be sanity-checked by eye against the printed grid.',
      code: `public final class Demo {
    public static void main(String[] args) {
        System.out.println("=== Game 1: scripted X win on a 3x3 board ===");
        Game winningGame = new Game(3, "Alice", "Bob", new LineWinningStrategy());
        int[][] winningMoves = { {0, 0}, {1, 0}, {0, 1}, {1, 1}, {0, 2} };
        for (int[] move : winningMoves) {
            winningGame.makeMove(move[0], move[1]);
            winningGame.getBoard().print();
            System.out.println("State: " + winningGame.getState());
            System.out.println();
        }

        System.out.println("=== Game 2: scripted draw on a 3x3 board ===");
        Game drawGame = new Game(3, "Alice", "Bob", new LineWinningStrategy());
        int[][] drawMoves = {
                {0, 0}, {0, 1}, {0, 2},
                {1, 1}, {1, 0}, {1, 2},
                {2, 1}, {2, 0}, {2, 2}
        };
        for (int[] move : drawMoves) {
            drawGame.makeMove(move[0], move[1]);
        }
        drawGame.getBoard().print();
        System.out.println("State: " + drawGame.getState());
        System.out.println();

        System.out.println("=== Game 3: illegal move on an already-occupied cell ===");
        Game illegalMoveGame = new Game(3, "Alice", "Bob", new LineWinningStrategy());
        illegalMoveGame.makeMove(1, 1); // Alice (X) takes the center
        try {
            illegalMoveGame.makeMove(1, 1); // Bob tries to take the same cell
        } catch (InvalidMoveException e) {
            System.out.println("Caught expected exception: " + e.getMessage());
        }
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Game Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> IN_PROGRESS
  IN_PROGRESS --> IN_PROGRESS: valid move, no winner yet, board not full
  IN_PROGRESS --> X_WON: LineWinningStrategy confirms X's last move completed a line
  IN_PROGRESS --> O_WON: LineWinningStrategy confirms O's last move completed a line
  IN_PROGRESS --> DRAW: board.isFull() true and no winner
  X_WON --> [*]
  O_WON --> [*]
  DRAW --> [*]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Make a Move',
    mermaid: `sequenceDiagram
  autonumber
  participant Client
  participant G as Game
  participant B as Board
  participant W as LineWinningStrategy

  Client->>G: makeMove(row, col)
  G->>G: check state == IN_PROGRESS
  G->>B: placeMark(row, col, currentSymbol)
  B->>B: validate bounds and occupancy
  B->>B: increment rowCounts/colCounts/diagonalCounts
  B-->>G: mark placed
  G->>W: checkWinner(board, currentSymbol)
  W->>B: getRowCount / getColCount / getDiagonalCount / getAntiDiagonalCount
  B-->>W: counters for the last move's row/col/diagonals
  W-->>G: true or false
  alt winner found
    G->>G: state = X_WON or O_WON
  else board full
    G->>G: state = DRAW
  else
    G->>G: toggle currentPlayerIndex
  end
  G-->>Client: move applied, state reflects outcome`,
  },

  extensions: [
    { extension: 'K-in-a-row on a larger board (Gomoku-style)', implementation: 'Add a KInRowWinningStrategy implementing WinningStrategy that scans outward from board.getLastMoveRow()/getLastMoveCol() in the 4 line directions counting consecutive same-symbol cells, capped at k. Pass it into the Game constructor - no change to Game itself.' },
    { extension: 'Diagonal-only variant', implementation: 'Add a DiagonalOnlyWinningStrategy that only inspects board.getDiagonalCount()/getAntiDiagonalCount(), ignoring rows and columns entirely - a 5-line class thanks to the same interface.' },
    { extension: 'Undo the last move', implementation: 'Track a Deque<int[]> of played (row, col) coordinates in Game; undo() pops the last move, decrements the matching row/col/diagonal counters on Board, clears that cell, and resets state to IN_PROGRESS if it had ended.' },
    { extension: 'AI opponent', implementation: 'Introduce a MoveStrategy interface (e.g. RandomMoveStrategy, MinimaxMoveStrategy) that a Player can optionally delegate to for choosing (row, col) instead of taking human input - Game.makeMove() is unchanged either way.' },
    { extension: 'More than 2 players / more than 2 symbols', implementation: 'Generalize PlayerFactory beyond X/O to a configurable list of marks, and change the turn toggle from 1 - currentPlayerIndex to (currentPlayerIndex + 1) % players.length.' },
    { extension: 'Networked multiplayer', implementation: 'Wrap Game behind a thin server that serializes makeMove() calls per game id and broadcasts the updated board/state to both connected clients after each move - the same Observer idea used for a display board in other LLDs, layered on top without touching Game or Board.' },
  ],

  interviewerChecklist: [
    'Does the win check run in O(1) per move, or does the candidate rescan a row/column/the whole board on every turn?',
    'Is the board size a parameter (N x N), or is 3 hardcoded somewhere in the win-checking logic?',
    'Can a different win condition (k-in-a-row, diagonal-only) be swapped in without editing Game?',
    'Are occupied-cell and out-of-bounds moves rejected with a clear, typed exception rather than silently ignored or overwriting the cell?',
    'Is a move attempted after the game has already ended rejected, and is that check centralized in a single guard rather than duplicated?',
    'Does symbol assignment (who is X, who is O, who goes first) live in one place, or is it re-derived at multiple call sites?',
    'Does the candidate check for a winner strictly before checking for a full board, so a winning move on the last cell is never misreported as a draw?',
  ],

  relatedDesigns: ['snake-ladder', 'vending-machine', 'parking-lot'],
  keyTakeaways: [
    'The O(1) win-check trick: maintain running row/column/diagonal counters per symbol, updated once per move, then inspect only the counters touched by the last move - never rescan the board.',
    'Strategy is what turns "swap in a different win condition" into a one-line constructor change instead of an if/else fork buried inside the game loop.',
    'A tiny Factory Method is enough to make a rule as simple as "X always goes first" impossible to get wrong, because there is exactly one place that assigns symbols.',
    'An enum plus a single guard clause is a complete State machine for a domain this small - reach for a full State-pattern class hierarchy only when different states need genuinely different behavior, not just different legality checks.',
    'Validate at the boundary (Board.placeMark) before mutating any counter - every future win-check depends on those counters staying trustworthy.',
  ],
}

export default problem

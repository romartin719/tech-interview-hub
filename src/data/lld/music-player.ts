import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'music-player',
  title: 'Music Player',
  difficulty: 'Intermediate',
  icon: 'pi pi-play-circle',
  color: '#ec4899',
  readTimeMinutes: 15,
  patterns: ['State', 'Strategy', 'Observer'],
  companies: ['Spotify', 'JioSaavn', 'Gaana', 'Apple'],
  summary:
    'A single-playlist music player whose transport controls (play/pause/stop/next) behave differently depending on what is currently happening, whose "what plays next" logic is swappable between sequential and shuffled without ever interrupting the track already playing, and whose UI reacts to changes through a clean subscription model.',

  functionalRequirements: [
    'Load a playlist of songs and play it from the beginning, or resume playback that was previously paused.',
    'Support play(), pause(), stop(), and next() transport controls, each of which must behave sensibly no matter what state the player is currently in (e.g. pausing an already-paused player, or skipping while stopped).',
    'Support at least two play-order strategies - sequential (playlist order) and shuffled (randomized, non-repeating) - and allow switching between them while a song is already playing.',
    'Switching the play-order strategy mid-playback must never change or interrupt the track currently playing - it only changes what plays after the current one finishes or is skipped.',
    'Shuffled order must not repeat any track until every other track in the playlist has been played once.',
    'Notify any number of interested listeners (a "now playing" UI, a scrobbler, a lock-screen widget) whenever the current track or the playback state changes.',
    'Fail predictably - attempting to play an empty playlist should raise a clear domain error, not throw an unrelated index-out-of-bounds exception.',
  ],
  nonFunctionalRequirements: [
    'Switching play-order strategy is a pure "what happens next" decision - it must be O(1) to apply and must never itself trigger a track change or a playback interruption.',
    'Adding a new transport behavior for an existing control (e.g. what next() does while paused) should mean editing one state class, not adding an if/else to MusicPlayer.',
    'Adding a new play-order algorithm (e.g. "repeat one", "weighted by skip count") should require writing one new class, not touching MusicPlayer or the existing strategies.',
    'Notifying observers must not require MusicPlayer to know anything concrete about what a "now playing" UI or a scrobbler actually is.',
  ],

  coreEntities: [
    { name: 'Song', description: 'An immutable value object - id, title, artist, and duration in seconds.' },
    { name: 'Playlist', description: 'An ordered collection of songs with index-based access; the thing MusicPlayer plays through.' },
    { name: 'PlayerState', description: 'Interface for "what play()/pause()/stop()/next() mean right now" - the interchangeable part of transport control.' },
    { name: 'PlayingState / PausedState / StoppedState', description: 'The three concrete moments a player can be in, each interpreting the same four calls differently.' },
    { name: 'PlayOrderStrategy', description: 'Interface for "what track comes next" - decoupled entirely from whether the player is playing, paused, or stopped.' },
    { name: 'SequentialPlayOrderStrategy / ShuffledPlayOrderStrategy', description: 'Walk the playlist in order, or hand out a randomized, non-repeating permutation of it.' },
    { name: 'PlayerObserver', description: 'Interface for anything that wants to react to a track change or a state change without MusicPlayer knowing what it is.' },
    { name: 'NowPlayingUI', description: 'A concrete observer that prints track and state changes - stands in for a real lock-screen or now-playing widget.' },
    { name: 'MusicPlayer', description: 'The context/orchestrator - owns the playlist, the current index, the current state, the current strategy, and the observer list, and delegates every transport call to currentState.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class Song {
    -String id
    -String title
    -String artist
    -int durationSeconds
    +toString() String
  }
  class Playlist {
    -String name
    -List~Song~ songs
    +addSong(Song) void
    +getSongAt(int) Song
    +size() int
  }
  class PlaylistEmptyException {
    +PlaylistEmptyException(String)
  }
  class PlayerState {
    <<interface>>
    +play(MusicPlayer) void
    +pause(MusicPlayer) void
    +stop(MusicPlayer) void
    +next(MusicPlayer) void
    +name() String
  }
  class PlayingState {
    +play(MusicPlayer) void
    +pause(MusicPlayer) void
    +stop(MusicPlayer) void
    +next(MusicPlayer) void
  }
  class PausedState {
    +play(MusicPlayer) void
    +pause(MusicPlayer) void
    +stop(MusicPlayer) void
    +next(MusicPlayer) void
  }
  class StoppedState {
    +play(MusicPlayer) void
    +pause(MusicPlayer) void
    +stop(MusicPlayer) void
    +next(MusicPlayer) void
  }
  class PlayOrderStrategy {
    <<interface>>
    +onActivated(Playlist, int) void
    +nextIndex(Playlist, int) int
  }
  class SequentialPlayOrderStrategy {
    +onActivated(Playlist, int) void
    +nextIndex(Playlist, int) int
  }
  class ShuffledPlayOrderStrategy {
    -List~Integer~ shuffleOrder
    -int cursor
    +onActivated(Playlist, int) void
    +nextIndex(Playlist, int) int
    -buildShuffledOrder(int, int) List~Integer~
  }
  class PlayerObserver {
    <<interface>>
    +onTrackChanged(Song) void
    +onPlaybackStateChanged(String) void
  }
  class NowPlayingUI {
    +onTrackChanged(Song) void
    +onPlaybackStateChanged(String) void
  }
  class MusicPlayer {
    -Playlist playlist
    -PlayerState currentState
    -PlayOrderStrategy playOrderStrategy
    -List~PlayerObserver~ observers
    -int currentIndex
    +play() void
    +pause() void
    +stop() void
    +next() void
    +setPlayOrderStrategy(PlayOrderStrategy) void
    +currentSong() Song
  }

  PlayerState <|.. PlayingState
  PlayerState <|.. PausedState
  PlayerState <|.. StoppedState
  PlayOrderStrategy <|.. SequentialPlayOrderStrategy
  PlayOrderStrategy <|.. ShuffledPlayOrderStrategy
  PlayerObserver <|.. NowPlayingUI
  MusicPlayer o-- PlayerState
  MusicPlayer o-- PlayOrderStrategy
  MusicPlayer o-- PlayerObserver
  MusicPlayer o-- Playlist
  Playlist o-- Song
  Playlist ..> PlaylistEmptyException : throws`,
  },

  designPatterns: [
    { pattern: 'State', where: 'PlayerState + PlayingState / PausedState / StoppedState', why: 'play()/pause()/stop()/next() mean something different in every mode; State lets each mode own its own interpretation instead of MusicPlayer branching on an enum for every call.' },
    { pattern: 'Strategy', where: 'PlayOrderStrategy + Sequential / Shuffled implementations', why: 'The "what plays next" algorithm is swappable independently of playback state, and swapping it must never touch the track that is currently playing.' },
    { pattern: 'Observer', where: 'PlayerObserver + NowPlayingUI', why: 'Any number of UIs or services can react to track/state changes without MusicPlayer holding a reference to a concrete UI class.' },
  ],

  dataStructures: [
    { component: 'Playlist storage', structure: 'ArrayList<Song>', why: 'Playback needs O(1) access by index (both sequential advance and shuffled jump-to-index), and songs are only ever appended, never removed mid-array in this design.' },
    { component: 'Shuffle order', structure: 'A pre-shuffled List<Integer> of indices plus an int cursor', why: 'Turns "give me a non-repeating random index" into an O(1) pop from a pre-computed permutation instead of re-rolling and re-checking a history set on every call.' },
    { component: 'Observer list', structure: 'ArrayList<PlayerObserver>', why: 'Registration order rarely matters and the list is iterated far more often than mutated, so the simplest collection is also the fastest one here.' },
  ],

  walkthroughs: [
    {
      title: 'Transport Control Flow (play, pause, resume, skip)',
      steps: [
        'MusicPlayer starts in StoppedState with currentIndex = -1 (nothing loaded yet).',
        'play() delegates to StoppedState.play(), which sets currentIndex to 0 if it was -1, notifies observers of the new track, and transitions the player to PlayingState.',
        'pause() delegates to PlayingState.pause(), which simply transitions to PausedState - the track and its position are untouched.',
        'A second play() call now delegates to PausedState.play(), which transitions back to PlayingState without re-notifying a track change - resuming is not restarting.',
        'next() delegates to PlayingState.next(), which asks the active PlayOrderStrategy for the next index, updates currentIndex, and notifies observers of the track change.',
        'Calling pause() while already in StoppedState delegates to StoppedState.pause(), which is a documented no-op - there is nothing to pause.',
      ],
    },
    {
      title: 'Live Play-Order Switch (sequential to shuffled, mid-song)',
      steps: [
        'A song is currently playing at currentIndex = 1 out of a 4-song playlist under SequentialPlayOrderStrategy.',
        'The user taps "Shuffle". MusicPlayer.setPlayOrderStrategy() swaps the active strategy reference and immediately calls onActivated(playlist, currentIndex) on the new strategy.',
        'ShuffledPlayOrderStrategy.onActivated() builds a Fisher-Yates-shuffled order over every index except the one currently playing, and resets its internal cursor to zero.',
        'Nothing about currentIndex, currentState, or the audio position changed - the switch is invisible to whatever is currently audible.',
        'The next next() call pulls the first index out of the freshly shuffled order; once the cursor exhausts that order, a fresh shuffle is built (again excluding whatever just played) so no track repeats before the rest of the playlist has cycled.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'Song.java',
      rationale: 'A plain immutable value object - once a Song is built its four fields never change, so it can be freely shared between Playlist, MusicPlayer, and every observer without defensive copying.',
      code: `public final class Song {
    private final String id;
    private final String title;
    private final String artist;
    private final int durationSeconds;

    public Song(String id, String title, String artist, int durationSeconds) {
        this.id = id;
        this.title = title;
        this.artist = artist;
        this.durationSeconds = durationSeconds;
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getArtist() { return artist; }
    public int getDurationSeconds() { return durationSeconds; }

    @Override
    public String toString() {
        return title + " - " + artist + " (" + durationSeconds + "s)";
    }
}`,
    },
    {
      filename: 'Playlist.java',
      rationale: 'Playlist owns index validation in one place (getSongAt) so both PlayerState implementations and PlayOrderStrategy implementations can trust that any index they are handed back is always playable.',
      code: `import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class Playlist {
    private final String name;
    private final List<Song> songs = new ArrayList<>();

    public Playlist(String name) {
        this.name = name;
    }

    public void addSong(Song song) {
        songs.add(song);
    }

    public Song getSongAt(int index) {
        if (songs.isEmpty()) {
            throw new PlaylistEmptyException("Playlist \\"" + name + "\\" has no songs to play");
        }
        return songs.get(index);
    }

    public int size() {
        return songs.size();
    }

    public String getName() {
        return name;
    }

    public List<Song> asUnmodifiableList() {
        return Collections.unmodifiableList(songs);
    }
}

// A dedicated unchecked exception instead of reusing IndexOutOfBoundsException - callers can
// catch precisely "the playlist is empty" without accidentally swallowing an unrelated bounds bug.
final class PlaylistEmptyException extends RuntimeException {
    public PlaylistEmptyException(String message) {
        super(message);
    }
}`,
    },
    {
      filename: 'PlayerState.java',
      calloutTitle: '💡 State Pattern',
      callout:
        'Without this, MusicPlayer would need a "mode" enum and an if/else ladder inside every one of play(), pause(), stop(), and next() - four methods times three modes is twelve branches to keep in sync. With State, each mode is one small class that only has to get its own four behaviors right, and MusicPlayer.play() is forever just "currentState.play(this)".',
      rationale: 'Kept to four transport methods plus a name() used for logging/observer notifications - anything more would start pulling UI concerns into the state interface.',
      code: `public interface PlayerState {
    void play(MusicPlayer player);
    void pause(MusicPlayer player);
    void stop(MusicPlayer player);
    void next(MusicPlayer player);
    String name();
}`,
    },
    {
      filename: 'PlayingState.java',
      rationale: 'The only state where next() is expected to both advance the track and keep the music going - every other state either ignores next() or treats it specially.',
      code: `public final class PlayingState implements PlayerState {
    @Override
    public void play(MusicPlayer player) {
        // Already playing - a second "play" tap restarts the current track from the top,
        // matching how most real players behave rather than silently doing nothing.
        System.out.println("Restarting \\"" + player.currentSong().getTitle() + "\\" from the top.");
    }

    @Override
    public void pause(MusicPlayer player) {
        player.transitionTo(new PausedState());
    }

    @Override
    public void stop(MusicPlayer player) {
        player.transitionTo(new StoppedState());
    }

    @Override
    public void next(MusicPlayer player) {
        player.advanceTrack();
    }

    @Override
    public String name() {
        return "PLAYING";
    }
}`,
    },
    {
      filename: 'PausedState.java',
      rationale: 'Deliberately asymmetric: resuming never restarts the track (play() just flips state), while skipping while paused moves the pointer but does not start audio - the listener paused on purpose.',
      code: `public final class PausedState implements PlayerState {
    @Override
    public void play(MusicPlayer player) {
        // Resume in place - the track and its position are untouched, only the state changes.
        player.transitionTo(new PlayingState());
    }

    @Override
    public void pause(MusicPlayer player) {
        // Already paused; pausing a paused player is a documented no-op, not an error.
        System.out.println("Already paused.");
    }

    @Override
    public void stop(MusicPlayer player) {
        player.transitionTo(new StoppedState());
    }

    @Override
    public void next(MusicPlayer player) {
        // Advance which track is "current" without starting playback - the player stays paused.
        player.advanceTrack();
    }

    @Override
    public String name() {
        return "PAUSED";
    }
}`,
    },
    {
      filename: 'StoppedState.java',
      rationale: 'The only state whose play() can move currentIndex off -1 for a brand-new player - every other transition from here reuses whatever index was already set.',
      code: `public final class StoppedState implements PlayerState {
    @Override
    public void play(MusicPlayer player) {
        player.startPlaybackFromCurrentIndex();
        player.transitionTo(new PlayingState());
    }

    @Override
    public void pause(MusicPlayer player) {
        // Nothing is playing, so there is nothing to pause - explicitly a no-op.
        System.out.println("Nothing is playing.");
    }

    @Override
    public void stop(MusicPlayer player) {
        System.out.println("Already stopped.");
    }

    @Override
    public void next(MusicPlayer player) {
        // Nothing is playing, so "skip" has nothing to skip from.
        System.out.println("Nothing is playing to skip.");
    }

    @Override
    public String name() {
        return "STOPPED";
    }
}`,
    },
    {
      filename: 'PlayOrderStrategy.java',
      calloutTitle: '💡 Strategy Pattern',
      callout:
        'onActivated() is the whole trick behind the "switching order never interrupts what is playing" requirement: it lets a strategy seed its own bookkeeping around the track already playing, but it has no power to change currentIndex itself. nextIndex() only ever answers "what comes after this" - MusicPlayer decides if and when to act on that answer.',
      rationale: 'Two methods, both pure with respect to currentIndex - neither one is allowed to move the player, which is what keeps a live strategy swap safe.',
      code: `public interface PlayOrderStrategy {
    // Called whenever this strategy becomes the active one, so it can seed any internal
    // bookkeeping (like a shuffle order) around the track that is already playing.
    void onActivated(Playlist playlist, int currentIndex);

    // Returns the index that should play after currentIndex. Never mutates currentIndex -
    // the strategy only ever answers "what's next"; MusicPlayer decides when to move to it.
    int nextIndex(Playlist playlist, int currentIndex);
}`,
    },
    {
      filename: 'SequentialPlayOrderStrategy.java',
      rationale: 'The baseline strategy - stateless, so onActivated() has nothing to do and nextIndex() is a single modulo.',
      code: `public final class SequentialPlayOrderStrategy implements PlayOrderStrategy {
    @Override
    public void onActivated(Playlist playlist, int currentIndex) {
        // Stateless - sequential order needs no memory of what came before.
    }

    @Override
    public int nextIndex(Playlist playlist, int currentIndex) {
        return (currentIndex + 1) % playlist.size();
    }
}`,
    },
    {
      filename: 'ShuffledPlayOrderStrategy.java',
      calloutTitle: '💡 Real Fisher-Yates, not Collections.shuffle() hand-waved away',
      callout:
        'shuffleOrder + cursor is the "history" that guarantees no repeats before a full cycle: every index except the one currently playing is shuffled once, handed out one at a time, and only reshuffled (again excluding whatever just played) once the cursor runs out. A naive "pick a random index and hope it differs from the last one" approach cannot make that guarantee.',
      rationale: 'The Random is injected through a package-visible constructor purely so Demo.java can seed it and produce deterministic, explainable output.',
      code: `import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public final class ShuffledPlayOrderStrategy implements PlayOrderStrategy {
    private final Random random;
    private List<Integer> shuffleOrder = new ArrayList<>();
    private int cursor;

    public ShuffledPlayOrderStrategy() {
        this(new Random());
    }

    // Package-visible so Demo/tests can inject a seeded Random for deterministic output.
    ShuffledPlayOrderStrategy(Random random) {
        this.random = random;
    }

    @Override
    public void onActivated(Playlist playlist, int currentIndex) {
        // Rebuild the shuffle order around the track already playing, excluding it, so the
        // very next nextIndex() call cannot immediately repeat what is playing right now.
        shuffleOrder = buildShuffledOrder(playlist.size(), currentIndex);
        cursor = 0;
    }

    @Override
    public int nextIndex(Playlist playlist, int currentIndex) {
        if (shuffleOrder.isEmpty() || cursor >= shuffleOrder.size()) {
            // The whole remaining playlist has cycled - reshuffle, again excluding whatever
            // just played, so shuffle-next never repeats a track across a reshuffle boundary.
            shuffleOrder = buildShuffledOrder(playlist.size(), currentIndex);
            cursor = 0;
        }
        int next = shuffleOrder.get(cursor);
        cursor++;
        return next;
    }

    // Fisher-Yates over every index except "exclude": walk from the last element down to
    // index 1, swapping each with a uniformly random earlier-or-equal position.
    private List<Integer> buildShuffledOrder(int size, int exclude) {
        List<Integer> indices = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            if (i != exclude) {
                indices.add(i);
            }
        }
        for (int i = indices.size() - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            Collections.swap(indices, i, j);
        }
        return indices;
    }
}`,
    },
    {
      filename: 'MusicPlayer.java',
      calloutTitle: '💡 Observer Pattern',
      callout:
        'MusicPlayer never imports NowPlayingUI - it only ever calls onTrackChanged()/onPlaybackStateChanged() on whatever implements PlayerObserver. A scrobbler, a lock-screen widget, and this now-playing console printer can all subscribe side by side without MusicPlayer growing a single new field for any of them.',
      rationale: 'MusicPlayer is intentionally thin: it forwards every transport call to currentState and every "what next" question to playOrderStrategy, keeping its own logic limited to the three plumbing methods states are allowed to call back into.',
      code: `import java.util.ArrayList;
import java.util.List;

public final class MusicPlayer {
    private final Playlist playlist;
    private final List<PlayerObserver> observers = new ArrayList<>();
    private PlayerState currentState = new StoppedState();
    private PlayOrderStrategy playOrderStrategy = new SequentialPlayOrderStrategy();
    private int currentIndex = -1;

    public MusicPlayer(Playlist playlist) {
        this.playlist = playlist;
    }

    public void addObserver(PlayerObserver observer) {
        observers.add(observer);
    }

    public void setPlayOrderStrategy(PlayOrderStrategy strategy) {
        this.playOrderStrategy = strategy;
        // Only tells the new strategy what's currently playing - it never advances the
        // track itself, which is exactly how switching order mid-playback stays seamless.
        this.playOrderStrategy.onActivated(playlist, currentIndex);
    }

    public void play() { currentState.play(this); }
    public void pause() { currentState.pause(this); }
    public void stop() { currentState.stop(this); }
    public void next() { currentState.next(this); }

    public Song currentSong() {
        return playlist.getSongAt(Math.max(currentIndex, 0));
    }

    // --- Package-visible hooks callable only by PlayerState implementations. ---

    void transitionTo(PlayerState newState) {
        this.currentState = newState;
        observers.forEach(o -> o.onPlaybackStateChanged(newState.name()));
    }

    void startPlaybackFromCurrentIndex() {
        if (currentIndex == -1) {
            currentIndex = 0;
        }
        notifyTrackChanged();
    }

    void advanceTrack() {
        currentIndex = playOrderStrategy.nextIndex(playlist, currentIndex);
        notifyTrackChanged();
    }

    private void notifyTrackChanged() {
        observers.forEach(o -> o.onTrackChanged(playlist.getSongAt(currentIndex)));
    }
}

// Package-private - only MusicPlayer and its observers ever need to see this contract.
interface PlayerObserver {
    void onTrackChanged(Song song);
    void onPlaybackStateChanged(String stateName);
}

final class NowPlayingUI implements PlayerObserver {
    @Override
    public void onTrackChanged(Song song) {
        System.out.println("[NowPlayingUI] Now playing: " + song);
    }

    @Override
    public void onPlaybackStateChanged(String stateName) {
        System.out.println("[NowPlayingUI] Playback state -> " + stateName);
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale: 'Exercises the happy path (play/pause/resume/skip), the documented no-op edge case (pausing while stopped), and a live strategy swap mid-playback with a seeded Random so the "no repeat before a full cycle" guarantee is checkable from the printed output.',
      code: `import java.util.Random;

public final class Demo {
    public static void main(String[] args) {
        Playlist playlist = new Playlist("Road Trip Mix");
        playlist.addSong(new Song("s1", "Midnight City", "M83", 240));
        playlist.addSong(new Song("s2", "Weightless", "Marconi Union", 300));
        playlist.addSong(new Song("s3", "Sunset Drive", "Neon Nomad", 210));
        playlist.addSong(new Song("s4", "Static Hum", "Glass Wave", 195));

        MusicPlayer player = new MusicPlayer(playlist);
        player.addObserver(new NowPlayingUI());

        // Happy path: play, pause, resume, skip.
        player.play();   // STOPPED -> PLAYING, starts at index 0
        player.pause();  // PLAYING -> PAUSED
        player.play();   // PAUSED -> PLAYING, resumes the SAME track, no restart notification
        player.next();   // sequential skip to index 1

        // Edge case: pause() while already STOPPED is a documented no-op, not an error.
        player.stop();
        player.pause();

        // Resume from STOPPED (stays on index 1, does not jump back to index 0)...
        player.play();
        System.out.println("Still on: " + player.currentSong());

        // ...then switch strategies live. This must not change what's playing.
        player.setPlayOrderStrategy(new ShuffledPlayOrderStrategy(new Random(42)));
        System.out.println("Still on after strategy swap: " + player.currentSong());

        // Shuffle now decides the next three skips over the remaining 3 songs - none should
        // repeat before this 3-song remainder has fully cycled.
        player.next();
        player.next();
        player.next();
    }
}`,
    },
  ],

  stateDiagram: {
    title: 'Playback State Lifecycle',
    mermaid: `stateDiagram-v2
  [*] --> Stopped
  Stopped --> Playing: play() [starts at currentIndex, or 0 if unset]
  Playing --> Paused: pause()
  Paused --> Playing: play() [resumes in place]
  Playing --> Stopped: stop()
  Paused --> Stopped: stop()
  Playing --> Playing: next() [advances track]
  Paused --> Paused: next() [advances pointer only]
  Stopped --> Stopped: pause() / next() [no-ops]`,
  },

  sequenceDiagram: {
    title: 'Sequence Diagram - Live Play-Order Strategy Switch',
    mermaid: `sequenceDiagram
  autonumber
  participant UI
  participant Player as MusicPlayer
  participant Old as SequentialPlayOrderStrategy
  participant New as ShuffledPlayOrderStrategy
  participant Obs as NowPlayingUI

  Note over Player: currentIndex = 1, currentState = Playing
  UI->>Player: setPlayOrderStrategy(shuffled)
  Player->>New: onActivated(playlist, 1)
  New->>New: buildShuffledOrder(size=4, exclude=1)
  Note over Player: currentIndex still 1 - nothing playing was touched
  UI->>Player: next()
  Player->>Player: currentState.next(this)
  Player->>New: nextIndex(playlist, 1)
  New-->>Player: shuffleOrder[0]
  Player->>Obs: onTrackChanged(song)
  Obs-->>UI: prints "Now playing: ..."`,
  },

  extensions: [
    { extension: 'Repeat-one / repeat-all modes', implementation: 'Add RepeatOnePlayOrderStrategy (always returns currentIndex) and let RepeatAll simply be the existing SequentialPlayOrderStrategy wrapping around - both are new classes, zero MusicPlayer changes.' },
    { extension: 'Previous track / playback history', implementation: 'Track a small history List<Integer> inside MusicPlayer and add previous() that pops from it, delegated through PlayerState just like next().' },
    { extension: 'Queueing a song to play next without disrupting shuffle', implementation: 'Add an explicit "up next" single-slot field on MusicPlayer that advanceTrack() checks before asking the strategy at all.' },
    { extension: 'Cross-device "now playing" sync', implementation: 'Add a RemoteSyncObserver implementing PlayerObserver that pushes track/state changes to a shared session service, alongside NowPlayingUI.' },
    { extension: 'Crossfade between tracks', implementation: 'Add a transitional CrossfadingState that both the outgoing and incoming PlayingState delegate audio-mixing to before landing in a plain PlayingState.' },
    { extension: 'Play-history-weighted shuffle ("smart shuffle")', implementation: 'A new PlayOrderStrategy that weights buildShuffledOrder-style selection by skip/like counts per song instead of uniform Fisher-Yates.' },
  ],

  interviewerChecklist: [
    'Does every transport method (play/pause/stop/next) have an explicit, sensible behavior in every state, including the "boring" no-op cases like pause-while-stopped?',
    'Is play-order genuinely decoupled from playback state, i.e. can the candidate explain why PlayOrderStrategy has no idea whether the player is playing or paused?',
    'Does switching play-order strategy mid-song leave currentIndex untouched, and can the candidate point to exactly which line would make that true or false?',
    'Is the shuffle a real, inspectable algorithm (Fisher-Yates over indices) rather than "just call a random function and hope"?',
    'Does the shuffle strategy actually guarantee no repeats before a full cycle, and does the candidate know why (pre-shuffled list + cursor vs. re-rolling and checking history)?',
    'Is Observer used so MusicPlayer has zero compile-time dependency on any concrete UI class?',
    'Would adding a fourth state (e.g. Buffering) or a third play-order strategy require touching MusicPlayer at all?',
  ],

  relatedDesigns: ['elevator-system', 'vending-machine', 'tic-tac-toe'],
  keyTakeaways: [
    'State pattern shines when the SAME set of calls needs genuinely different behavior depending on an object\'s current mode - the alternative is an if/else ladder repeated in every method.',
    'A Strategy interface stays safe to hot-swap only if its methods are forbidden from mutating the thing that matters most (here: currentIndex) - "answer the question, don\'t act on it" is the whole contract.',
    'A pre-shuffled list plus a cursor is a simple, O(1)-per-call way to guarantee "no repeats until a full cycle" - it is a queue of decisions made once, not a random draw re-validated every time.',
    'Observer decouples "something changed" from "what to do about it" - the core playback engine never imports a single UI class.',
    'Package-private classes/interfaces (PlayerObserver, PlaylistEmptyException, NowPlayingUI) are a legitimate way to keep a small object model from turning into a file-per-trivial-detail explosion.',
  ],
}

export default problem

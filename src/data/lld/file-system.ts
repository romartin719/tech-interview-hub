import type { LLDProblem } from './types'

const problem: LLDProblem = {
  slug: 'file-system',
  title: 'File System',
  difficulty: 'Intermediate',
  icon: 'pi pi-folder-open',
  color: '#7c3aed',
  readTimeMinutes: 18,
  patterns: ['Composite', 'Visitor'],
  companies: ['Google', 'Microsoft', 'Dropbox', 'Amazon'],
  summary:
    'An in-memory hierarchical file system where files and directories both implement a common node interface so that create, delete, move, and recursive size-computation logic never needs to branch on which concrete type it is holding, while path resolution walks the tree segment by segment through hash-map-backed children instead of ever scanning from the root on every lookup.',

  functionalRequirements: [
    'Create a file at a given absolute path, creating any missing intermediate directories along the way.',
    'Create a directory at a given absolute path, similarly creating missing intermediate directories.',
    'Delete a file or directory (recursively, taking all descendants with it) given its path.',
    'Read the full content of a file and overwrite or append to a file\'s content given its path.',
    'List the immediate children (names and types) of a directory given its path.',
    'Move or rename a file or directory to a new path, relocating its entire subtree if it is a directory.',
    'Compute the total recursive size of a directory (sum of all descendant file sizes) given its path.',
  ],
  nonFunctionalRequirements: [
    'Concurrent mutations from multiple callers (e.g. two threads creating files under the same parent directory at once) must not corrupt a directory\'s children collection or lose an update.',
    "Resolving a path must walk only the segments of that path through each directory's own child lookup, not rescan the whole tree or repeatedly traverse from the root for every intermediate segment beyond what the path itself requires.",
    'Files and directories must be interchangeable wherever the system needs to treat "a thing in the tree" generically - listing, deleting, moving, and sizing must not require type-checking or casting to File vs Directory.',
    'Adding a new kind of node (e.g. a symbolic link) should not require changes to FileSystem\'s public API or to any existing recursive operation such as getSize().',
    'Memory used by file content should be proportional to actual bytes written, not pre-allocated per file.',
  ],

  coreEntities: [
    { name: 'FileSystemNode', description: 'Abstract base class shared by File and Directory - carries name, parent reference, and timestamps, and declares the operations (getSize(), accept()) every node must support regardless of concrete type.' },
    { name: 'File', description: 'A leaf node holding byte content directly; getSize() returns its own content length with no recursion.' },
    { name: 'Directory', description: 'A composite node holding a Map<String, FileSystemNode> of named children; getSize() recurses into every child and sums the results.' },
    { name: 'FileSystemVisitor', description: 'Interface for operations (size computation, search, listing) that need to walk the tree without File or Directory embedding that logic themselves.' },
    { name: 'PathResolver', description: 'Splits a path string into segments and walks a Directory\'s children map segment by segment, optionally creating missing intermediate directories.' },
    { name: 'FileSystem', description: 'The facade - the only object client code holds a reference to; exposes createFile, createDirectory, readFile, writeFile, delete, move, list, and getSize, all keyed by path string.' },
  ],

  classDiagram: {
    mermaid: `classDiagram
  class FileSystemNode {
    <<abstract>>
    #String name
    #Directory parent
    #long createdAt
    #long modifiedAt
    +getName() String
    +getParent() Directory
    +getPath() String
    +touch() void
    +getSize()* long
    +accept(FileSystemVisitor)* void
  }
  class File {
    -StringBuilder content
    +read() String
    +write(String) void
    +append(String) void
    +getSize() long
    +accept(FileSystemVisitor) void
  }
  class Directory {
    -Map~String, FileSystemNode~ children
    +addChild(FileSystemNode) void
    +removeChild(String) FileSystemNode
    +getChild(String) FileSystemNode
    +listChildren() List~FileSystemNode~
    +getSize() long
    +accept(FileSystemVisitor) void
  }
  class FileSystemVisitor {
    <<interface>>
    +visitFile(File) void
    +visitDirectory(Directory) void
  }
  class SizeCalculatorVisitor {
    -long totalSize
    +visitFile(File) void
    +visitDirectory(Directory) void
    +getTotalSize() long
  }
  class PathResolver {
    +resolve(Directory root, String path, boolean createMissing) FileSystemNode
    +resolveParent(Directory root, String path, boolean createMissing) Directory
    -splitSegments(String) List~String~
  }
  class FileSystem {
    -Directory root
    -Object treeLock
    +createFile(String) File
    +createDirectory(String) Directory
    +readFile(String) String
    +writeFile(String, String) void
    +delete(String) void
    +move(String, String) void
    +list(String) List~String~
    +getSize(String) long
  }

  FileSystemNode <|-- File
  FileSystemNode <|-- Directory
  Directory o-- "0..*" FileSystemNode : children
  FileSystemVisitor <|.. SizeCalculatorVisitor
  File ..> FileSystemVisitor : accept()
  Directory ..> FileSystemVisitor : accept()
  FileSystem o-- Directory : root
  FileSystem ..> PathResolver : uses
  FileSystem ..> SizeCalculatorVisitor : uses`,
  },

  designPatterns: [
    {
      pattern: 'Composite',
      where: 'FileSystemNode as the common supertype of File (leaf) and Directory (composite)',
      why: 'Every operation that needs to work on "a node" - delete, move, list, print - can hold a single FileSystemNode reference and call the same method whether it turns out to be a file or a directory with a thousand descendants. Directory.getSize() simply calls getSize() on each child and lets polymorphism decide whether that call returns immediately (File) or recurses further (nested Directory).',
    },
    {
      pattern: 'Visitor',
      where: 'FileSystemVisitor + SizeCalculatorVisitor, dispatched via FileSystemNode.accept()',
      why: 'Size computation happens to be simple enough to live directly in getSize(), but richer read-only operations - searching by extension, computing a checksum tree, building a listing report - would otherwise force File and Directory to grow a new method every time a new traversal is needed. Visitor lets new operations be added as new visitor classes without touching FileSystemNode, File, or Directory at all.',
    },
    {
      pattern: 'Facade',
      where: 'FileSystem exposing path-string methods over the FileSystemNode tree',
      why: 'Client code never touches a Directory or walks children maps directly - it calls createFile("/a/b/c.txt") and everything about path parsing, intermediate-directory creation, and locking happens behind one class, so the internal tree representation can change without breaking callers.',
    },
  ],

  dataStructures: [
    {
      component: "A Directory's children",
      structure: 'LinkedHashMap<String, FileSystemNode> keyed by child name',
      why: 'Name lookup during path resolution is O(1) per segment instead of a linear scan over a List<FileSystemNode>, and LinkedHashMap preserves insertion order so list() returns children in a stable, predictable order rather than hash-bucket order.',
    },
    {
      component: 'Path resolution',
      structure: 'Split the path into segments once, then walk one Map.get() per segment starting from the root Directory',
      why: "Resolving \"/a/b/c\" costs exactly 2 map lookups (into a, then into b) plus a final lookup for c - proportional to path depth, never to total tree size, and never re-walks from the root for each segment beyond the one traversal already in progress.",
    },
    {
      component: "A File's content",
      structure: 'StringBuilder (or byte[] in a byte-oriented variant) instead of a fixed-size array',
      why: 'Writes and appends grow the buffer incrementally, so memory usage tracks actual bytes written rather than a pre-allocated capacity, and getSize() is a cheap length() call.',
    },
    {
      component: 'Concurrent mutation of one directory',
      structure: "A per-directory intrinsic lock (synchronized methods on Directory) rather than one lock for the whole FileSystem",
      why: 'Two threads creating files under different parent directories should never block each other; scoping the lock to the Directory whose children map is actually being mutated keeps contention limited to siblings created under the same parent.',
    },
  ],

  walkthroughs: [
    {
      title: 'Creating a Nested File via Path (e.g. "/docs/2026/report.txt")',
      steps: [
        'FileSystem.createFile("/docs/2026/report.txt") calls PathResolver.resolveParent(root, path, true) to find (or build) the Directory that should contain report.txt.',
        'PathResolver splits the path into segments ["docs", "2026", "report.txt"] and walks all but the last segment starting from root.',
        'At each segment, it calls current.getChild(segment); if the child does not exist and createMissing is true, it synthesizes a new Directory, adds it via current.addChild(), and descends into it - so "docs" and "2026" are both created automatically if this is the very first file ever written under them.',
        "If a segment exists but resolves to a File instead of a Directory, resolution fails fast with an exception rather than silently treating a file as a folder.",
        'Once the walk reaches the parent directory for the final segment ("2026"), FileSystem checks that no child named "report.txt" already exists, constructs a new File, and calls parent.addChild(file) - a call synchronized on that Directory instance.',
        "The new File's parent reference is set to the enclosing Directory, so getPath() can reconstruct the full path later by walking parent references back to root.",
        'FileSystem returns the new File handle to the caller, who can now call writeFile("/docs/2026/report.txt", content) to populate it.',
      ],
    },
    {
      title: 'Computing Recursive Directory Size (e.g. "/docs")',
      steps: [
        'FileSystem.getSize("/docs") resolves the path to a FileSystemNode via PathResolver.resolve(root, path, false) - no intermediate directories are created for a read-only query.',
        'If the resolved node is a File, its own getSize() returns its content length immediately with zero recursion - the base case of the Composite.',
        'If the resolved node is a Directory, its getSize() iterates every entry in its children map and calls getSize() on each one, summing the results without ever asking "is this a File or a Directory?".',
        "A nested Directory's getSize() call recurses the same way one level deeper, so the entire subtree is walked using one polymorphic method rather than a type-switching traversal function.",
        'Equivalently, the same query could be answered by constructing a SizeCalculatorVisitor and calling directory.accept(visitor): visitFile() adds a leaf\'s size and visitDirectory() calls accept() on every child, keeping the exact same recursion but outside the node classes entirely.',
        'Because each Directory only ever consults its own children map (never siblings or the whole tree), the cost is exactly proportional to the number of descendants under "/docs", not the size of the whole file system.',
        'The final summed value is returned up through every stack frame back to FileSystem.getSize(), which hands it to the caller as a single long.',
      ],
    },
  ],

  codeFiles: [
    {
      filename: 'FileSystemNode.java',
      calloutTitle: '💡 Composite\'s common contract',
      callout:
        "A naive design would give File and Directory almost nothing in common and force every caller to check 'if (node instanceof File) ... else if (node instanceof Directory) ...' before doing anything useful. Declaring getSize() and accept() as abstract methods here means Directory.getSize() can call child.getSize() on every child without ever knowing or caring which subclass it actually got back - the polymorphic dispatch does the branching that a type-switch would otherwise need to do by hand, and it does it correctly no matter how deep the tree gets.",
      rationale: 'Holds everything every node needs regardless of type: a name, a parent pointer for path reconstruction and move operations, and timestamps - plus the two abstract hooks (getSize, accept) that make Composite and Visitor both work.',
      code: `public abstract class FileSystemNode {
    protected String name;
    protected Directory parent;
    protected final long createdAt;
    protected long modifiedAt;

    protected FileSystemNode(String name, Directory parent) {
        this.name = name;
        this.parent = parent;
        this.createdAt = System.currentTimeMillis();
        this.modifiedAt = this.createdAt;
    }

    public String getName() { return name; }
    public Directory getParent() { return parent; }
    public long getCreatedAt() { return createdAt; }
    public long getModifiedAt() { return modifiedAt; }

    protected void setName(String name) { this.name = name; }
    protected void setParent(Directory parent) { this.parent = parent; }
    protected void touch() { this.modifiedAt = System.currentTimeMillis(); }

    /** Reconstructs the absolute path by walking parent references back to the root. */
    public String getPath() {
        if (parent == null) {
            return "/";
        }
        String parentPath = parent.getPath();
        return parentPath.equals("/") ? "/" + name : parentPath + "/" + name;
    }

    /** Base case for File, recursive sum for Directory - Composite's whole payoff in one method signature. */
    public abstract long getSize();

    /** Lets external operations (SizeCalculatorVisitor, a future SearchVisitor) walk the tree without File/Directory knowing about them. */
    public abstract void accept(FileSystemVisitor visitor);
}`,
    },
    {
      filename: 'File.java',
      rationale: 'A leaf node: content lives directly on the object as a StringBuilder so writes and appends grow incrementally instead of requiring a fixed pre-allocated buffer, and getSize() is a direct length read with no recursion.',
      code: `public final class File extends FileSystemNode {
    private final StringBuilder content = new StringBuilder();

    public File(String name, Directory parent) {
        super(name, parent);
    }

    public synchronized String read() {
        return content.toString();
    }

    public synchronized void write(String newContent) {
        content.setLength(0);
        content.append(newContent);
        touch();
    }

    public synchronized void append(String extra) {
        content.append(extra);
        touch();
    }

    @Override
    public synchronized long getSize() {
        return content.length();
    }

    @Override
    public void accept(FileSystemVisitor visitor) {
        visitor.visitFile(this);
    }
}`,
    },
    {
      filename: 'Directory.java',
      calloutTitle: '💡 Map-backed children, not a List',
      callout:
        "A List<FileSystemNode> would make getChild(name) an O(n) linear scan through every sibling on every single path-resolution step - fine for a handful of files, painful the moment a directory holds thousands. Keying children by name in a LinkedHashMap turns that into a single O(1) hash lookup per path segment, while still preserving insertion order for a predictable list() output. Combined with synchronized addChild/removeChild, two threads creating files under the same parent at the same time can never leave the map in a torn state - one call simply waits for the other's monitor to release.",
      rationale: "Owns the children map and every mutating method needed by FileSystem: add, remove, lookup, and listing - plus the recursive getSize() that is Composite's textbook example.",
      code: `import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Directory extends FileSystemNode {
    private final Map<String, FileSystemNode> children = new LinkedHashMap<>();

    public Directory(String name, Directory parent) {
        super(name, parent);
    }

    public synchronized void addChild(FileSystemNode node) {
        if (children.containsKey(node.getName())) {
            throw new IllegalArgumentException("A node named '" + node.getName() + "' already exists here");
        }
        children.put(node.getName(), node);
        node.setParent(this);
        touch();
    }

    public synchronized FileSystemNode removeChild(String name) {
        FileSystemNode removed = children.remove(name);
        if (removed == null) {
            throw new IllegalArgumentException("No such child: " + name);
        }
        touch();
        return removed;
    }

    public synchronized FileSystemNode getChild(String name) {
        return children.get(name);
    }

    public synchronized boolean hasChild(String name) {
        return children.containsKey(name);
    }

    public synchronized List<FileSystemNode> listChildren() {
        return new ArrayList<>(children.values());
    }

    /** The recursive case of Composite: sum every child's size, whatever concrete type each child is. */
    @Override
    public synchronized long getSize() {
        long total = 0;
        for (FileSystemNode child : children.values()) {
            total += child.getSize();
        }
        return total;
    }

    @Override
    public void accept(FileSystemVisitor visitor) {
        visitor.visitDirectory(this);
    }
}`,
    },
    {
      filename: 'FileSystemVisitor.java',
      rationale: 'A two-method interface, one per concrete node type. Any new read-only tree operation (search, checksum, report generation) implements this instead of adding a method to FileSystemNode itself.',
      code: `public interface FileSystemVisitor {
    void visitFile(File file);
    void visitDirectory(Directory directory);
}`,
    },
    {
      filename: 'SizeCalculatorVisitor.java',
      rationale: 'Demonstrates the Visitor alternative to Directory.getSize(): the exact same recursive summation, but living outside the node classes so a second, third, or fourth tree-walking operation never has to touch File or Directory again.',
      code: `public final class SizeCalculatorVisitor implements FileSystemVisitor {
    private long totalSize = 0;

    @Override
    public void visitFile(File file) {
        totalSize += file.getSize();
    }

    @Override
    public void visitDirectory(Directory directory) {
        for (FileSystemNode child : directory.listChildren()) {
            child.accept(this);
        }
    }

    public long getTotalSize() {
        return totalSize;
    }
}`,
    },
    {
      filename: 'PathResolver.java',
      rationale: "Centralizes every bit of path-string parsing and segment-by-segment tree walking so FileSystem's methods stay one-liners; also the only place that knows how to auto-create missing intermediate directories.",
      code: `import java.util.ArrayList;
import java.util.List;

public final class PathResolver {

    /** Resolves the full path to a node. Returns null if any segment is missing and createMissing is false. */
    public FileSystemNode resolve(Directory root, String path, boolean createMissing) {
        List<String> segments = splitSegments(path);
        if (segments.isEmpty()) {
            return root;
        }
        Directory current = root;
        for (int i = 0; i < segments.size() - 1; i++) {
            current = descendOrCreate(current, segments.get(i), createMissing);
            if (current == null) {
                return null;
            }
        }
        String last = segments.get(segments.size() - 1);
        FileSystemNode found = current.getChild(last);
        if (found == null && createMissing) {
            Directory created = new Directory(last, current);
            current.addChild(created);
            return created;
        }
        return found;
    }

    /** Resolves and, if needed, creates every directory up to (but not including) the final path segment. */
    public Directory resolveParent(Directory root, String path, boolean createMissing) {
        List<String> segments = splitSegments(path);
        Directory current = root;
        for (int i = 0; i < segments.size() - 1; i++) {
            current = descendOrCreate(current, segments.get(i), createMissing);
            if (current == null) {
                throw new IllegalArgumentException("No such directory: " + path);
            }
        }
        return current;
    }

    private Directory descendOrCreate(Directory current, String segment, boolean createMissing) {
        FileSystemNode child = current.getChild(segment);
        if (child == null) {
            if (!createMissing) {
                return null;
            }
            Directory created = new Directory(segment, current);
            current.addChild(created);
            return created;
        }
        if (!(child instanceof Directory)) {
            throw new IllegalStateException("'" + segment + "' is a file, not a directory");
        }
        return (Directory) child;
    }

    private List<String> splitSegments(String path) {
        List<String> segments = new ArrayList<>();
        for (String part : path.split("/")) {
            if (!part.isEmpty()) {
                segments.add(part);
            }
        }
        return segments;
    }
}`,
    },
    {
      filename: 'FileSystem.java',
      calloutTitle: '💡 Facade over the node tree',
      callout:
        "Every method here takes a path string and returns a plain value - callers never see a Directory, never call addChild() themselves, and never have to know that resolution walks a LinkedHashMap one segment at a time. That means the entire internal representation (Map-backed children, PathResolver's segment walk, per-directory locking) can be swapped for something else - a persisted B-tree, a remote metadata service - without a single call site in the rest of the application changing.",
      rationale: 'The only class client code touches. Wraps PathResolver for every path-based operation and delegates size computation to the node tree\'s own polymorphic getSize().',
      code: `import java.util.List;
import java.util.stream.Collectors;

public final class FileSystem {
    private final Directory root = new Directory("", null);
    private final PathResolver resolver = new PathResolver();

    public File createFile(String path) {
        Directory parent = resolver.resolveParent(root, path, true);
        String name = lastSegment(path);
        File file = new File(name, parent);
        parent.addChild(file);
        return file;
    }

    public Directory createDirectory(String path) {
        Directory parent = resolver.resolveParent(root, path, true);
        String name = lastSegment(path);
        Directory dir = new Directory(name, parent);
        parent.addChild(dir);
        return dir;
    }

    public String readFile(String path) {
        return asFile(path).read();
    }

    public void writeFile(String path, String content) {
        asFile(path).write(content);
    }

    public void delete(String path) {
        Directory parent = resolver.resolveParent(root, path, false);
        parent.removeChild(lastSegment(path));
    }

    public void move(String oldPath, String newPath) {
        FileSystemNode node = resolver.resolve(root, oldPath, false);
        if (node == null) {
            throw new IllegalArgumentException("No such path: " + oldPath);
        }
        Directory oldParent = node.getParent();
        Directory newParent = resolver.resolveParent(root, newPath, true);
        oldParent.removeChild(node.getName());
        node.setName(lastSegment(newPath));
        newParent.addChild(node);
    }

    public List<String> list(String path) {
        FileSystemNode node = resolver.resolve(root, path, false);
        if (!(node instanceof Directory)) {
            throw new IllegalArgumentException("Not a directory: " + path);
        }
        return ((Directory) node).listChildren().stream()
                .map(FileSystemNode::getName)
                .collect(Collectors.toList());
    }

    /** Uses Directory's own recursive getSize() - Composite means this works identically for a file or a whole subtree. */
    public long getSize(String path) {
        FileSystemNode node = resolver.resolve(root, path, false);
        if (node == null) {
            throw new IllegalArgumentException("No such path: " + path);
        }
        return node.getSize();
    }

    private File asFile(String path) {
        FileSystemNode node = resolver.resolve(root, path, false);
        if (!(node instanceof File)) {
            throw new IllegalArgumentException("Not a file: " + path);
        }
        return (File) node;
    }

    private String lastSegment(String path) {
        String[] parts = path.split("/");
        return parts[parts.length - 1];
    }
}`,
    },
    {
      filename: 'Demo.java',
      rationale: 'Walks through creating nested files (auto-creating intermediate directories), writing and reading content, listing a directory, moving a subtree, and computing a recursive size to show Composite paying off end to end.',
      code: `public final class Demo {
    public static void main(String[] args) {
        FileSystem fs = new FileSystem();

        // 1) Intermediate directories "docs" and "2026" do not exist yet - createFile builds them automatically.
        fs.createFile("/docs/2026/report.txt");
        fs.writeFile("/docs/2026/report.txt", "Q3 results are in.");
        fs.createFile("/docs/2026/notes.txt");
        fs.writeFile("/docs/2026/notes.txt", "Follow up with finance.");

        System.out.println("Contents of /docs/2026: " + fs.list("/docs/2026"));
        System.out.println("report.txt says: " + fs.readFile("/docs/2026/report.txt"));

        // 2) A sibling file directly under /docs.
        fs.createFile("/docs/README.txt");
        fs.writeFile("/docs/README.txt", "See the 2026 folder for quarterly reports.");

        // 3) Recursive size: /docs/getSize() sums README.txt plus everything under 2026/, without
        //    FileSystem or Directory ever asking "is this a File or a Directory?" along the way.
        System.out.println("Total size of /docs: " + fs.getSize("/docs") + " bytes");

        // 4) Move the whole 2026/ subtree under a new archive/ directory - children move with it intact.
        fs.move("/docs/2026", "/docs/archive/2026");
        System.out.println("Contents of /docs after move: " + fs.list("/docs"));
        System.out.println("Contents of /docs/archive/2026: " + fs.list("/docs/archive/2026"));

        // 5) Delete the archived subtree entirely.
        fs.delete("/docs/archive");
        System.out.println("Contents of /docs after delete: " + fs.list("/docs"));
        System.out.println("Total size of /docs after delete: " + fs.getSize("/docs") + " bytes");
    }
}`,
    },
  ],

  sequenceDiagram: {
    title: 'Sequence Diagram - Creating a Nested File Auto-Creates Intermediate Directories',
    mermaid: `sequenceDiagram
  autonumber
  participant Client
  participant FS as FileSystem
  participant PR as PathResolver
  participant Root as Directory (root)
  participant Docs as Directory ("docs")
  participant Y2026 as Directory ("2026")

  Client->>FS: createFile("/docs/2026/report.txt")
  activate FS
  FS->>PR: resolveParent(root, path, createMissing=true)
  activate PR
  PR->>Root: getChild("docs")
  Root-->>PR: null
  PR->>Root: addChild(new Directory("docs"))
  Note over Docs: "docs" created on demand
  PR->>Docs: getChild("2026")
  Docs-->>PR: null
  PR->>Docs: addChild(new Directory("2026"))
  Note over Y2026: "2026" created on demand
  PR-->>FS: Directory "2026"
  deactivate PR
  FS->>Y2026: addChild(new File("report.txt"))
  Y2026-->>FS: (child added)
  FS-->>Client: File handle for report.txt
  deactivate FS`,
  },

  extensions: [
    { extension: 'Symbolic links', implementation: 'Add a SymbolicLink node extending FileSystemNode whose getSize() and accept() delegate to the node its target path resolves to, letting PathResolver dereference it transparently mid-walk.' },
    { extension: 'Permissions / ACLs', implementation: "Add a Permissions value object to FileSystemNode and have FileSystem check read/write/execute bits before delegating to a node's read/write/list methods, throwing AccessDeniedException otherwise." },
    { extension: 'File watchers / change notifications', implementation: 'Add a List<FileSystemListener> on Directory and File; touch(), addChild(), and removeChild() publish events, so a caller can subscribe to changes under a subtree without polling.' },
    { extension: 'Versioning / snapshots', implementation: "Instead of File.write() overwriting content in place, append immutable Revision objects to a list and let read() default to the latest, enabling readFile(path, version) for point-in-time reads." },
    { extension: 'Per-directory quota enforcement', implementation: 'Give Directory a maxBytes field and have addChild()/write() walk up parent references checking each ancestor\'s current getSize() against its quota before allowing the mutation.' },
    { extension: 'Path resolution caching', implementation: 'Add an LRU Map<String, FileSystemNode> cache in FileSystem keyed by absolute path, invalidated (or evicted) on any delete/move affecting that path or an ancestor, to skip repeated segment-by-segment walks for hot paths.' },
  ],

  interviewerChecklist: [
    'Does treating File and Directory as the same FileSystemNode type let delete/move/list/getSize avoid instanceof checks entirely?',
    'Is path resolution proportional to path depth (segment-by-segment map lookups) rather than a full tree scan or repeated root-to-leaf walks?',
    'Is concurrent mutation of a single directory\'s children made safe, and is the lock scoped to that directory rather than the whole file system?',
    'Can a new node type (symbolic link, mount point) be added without changing FileSystem\'s public API or any existing recursive method?',
    'Does move() correctly reparent an entire subtree in O(1) (relinking one node) rather than recursively copying every descendant?',
    'Is getSize() for a directory truly recursive through polymorphism, or does it secretly special-case nesting depth?',
    'Does the Visitor alternative to instance methods make sense here, and can the candidate articulate when a new read-only operation would justify adding one over extending FileSystemNode directly?',
  ],

  relatedDesigns: ['library-management', 'multilevel-cache', 'parking-lot'],
  keyTakeaways: [
    'Composite is the single idea that makes a file system tree tractable: File and Directory sharing one FileSystemNode type means delete, move, list, and getSize are each one method, not one method per concrete type times every call site.',
    "A directory's children belong in a Map<String, FileSystemNode>, not a List - it turns the single most frequent operation (does this name exist here?) from O(n) into O(1) and is what makes path resolution cheap.",
    'Path resolution should cost proportional to path depth: walk one map lookup per segment starting from wherever you already are, never restart from the root for each remaining segment.',
    "Visitor is the escape hatch for operations that don't belong baked into every node subclass - useful the moment you have more than one or two tree-walking behaviors (size, search, checksums) competing for space in File and Directory.",
    'A move() is a metadata operation (reparent one node, relink two maps), not a data-copying operation - recognizing that keeps moving a million-file subtree just as cheap as moving an empty one.',
  ],
}

export default problem

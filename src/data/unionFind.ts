import type { Topic } from '@/types/problems'

export const unionFindTopic: Topic = {
  id: 'union-find',
  name: 'Union Find',
  icon: 'pi-link',
  description: 'Disjoint set union, path compression, and connectivity problems',
  interviewPhases: [
    {
      name: 'Phase 1: Basic DSU',
      description: 'Core connectivity problems. Implement DSU with path compression and union by rank.',
      problems: [
        { id: 'uf-i-1', name: 'Find if Path Exists in Graph', url: 'https://leetcode.com/problems/find-if-path-exists-in-graph/' },
        { id: 'uf-i-2', name: 'Number of Provinces', url: 'https://leetcode.com/problems/number-of-provinces/' },
        { id: 'uf-i-3', name: 'Redundant Connection', url: 'https://leetcode.com/problems/redundant-connection/' },
        { id: 'uf-i-4', name: 'Number of Connected Components', url: 'https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/' },
        { id: 'uf-i-5', name: 'Graph Valid Tree', url: 'https://leetcode.com/problems/graph-valid-tree/' },
        { id: 'uf-i-6', name: 'Number of Operations to Make Network Connected', url: 'https://leetcode.com/problems/number-of-operations-to-make-network-connected/' },
      ],
    },
    {
      name: 'Phase 2: Intermediate DSU',
      description: 'Apply DSU to grouping, string, and equation problems.',
      problems: [
        { id: 'uf-i-7', name: 'Accounts Merge', url: 'https://leetcode.com/problems/accounts-merge/' },
        { id: 'uf-i-8', name: 'Most Stones Removed with Same Row or Column', url: 'https://leetcode.com/problems/most-stones-removed-with-same-row-or-column/' },
        { id: 'uf-i-9', name: 'Satisfiability of Equality Equations', url: 'https://leetcode.com/problems/satisfiability-of-equality-equations/' },
        { id: 'uf-i-10', name: 'Smallest String With Swaps', url: 'https://leetcode.com/problems/smallest-string-with-swaps/' },
        { id: 'uf-i-11', name: 'Regions Cut By Slashes', url: 'https://leetcode.com/problems/regions-cut-by-slashes/' },
        { id: 'uf-i-12', name: 'Redundant Connection II', url: 'https://leetcode.com/problems/redundant-connection-ii/' },
      ],
    },
    {
      name: 'Phase 3: Advanced DSU',
      description: 'DSU combined with sorting, offline processing, and grid problems.',
      problems: [
        { id: 'uf-i-13', name: 'Making A Large Island', url: 'https://leetcode.com/problems/making-a-large-island/' },
        { id: 'uf-i-14', name: 'Number of Islands II', url: 'https://leetcode.com/problems/number-of-islands-ii/' },
        { id: 'uf-i-15', name: 'Count Unreachable Pairs of Nodes', url: 'https://leetcode.com/problems/count-unreachable-pairs-of-nodes-in-an-undirected-graph/' },
        { id: 'uf-i-16', name: 'Minimize Malware Spread', url: 'https://leetcode.com/problems/minimize-malware-spread/' },
        { id: 'uf-i-17', name: 'Minimize Malware Spread II', url: 'https://leetcode.com/problems/minimize-malware-spread-ii/' },
        { id: 'uf-i-18', name: 'Remove Max Number of Edges to Keep Graph Fully Traversable', url: 'https://leetcode.com/problems/remove-max-number-of-edges-to-keep-graph-fully-traversable/' },
        { id: 'uf-i-19', name: 'Checking Existence of Edge Length Limited Paths', url: 'https://leetcode.com/problems/checking-existence-of-edge-length-limited-paths/' },
        { id: 'uf-i-20', name: 'Last Day Where You Can Still Cross', url: 'https://leetcode.com/problems/last-day-where-you-can-still-cross/' },
        { id: 'uf-i-21', name: 'Graph Connectivity With Threshold', url: 'https://leetcode.com/problems/graph-connectivity-with-threshold/' },
        { id: 'uf-i-22', name: 'Minimum Cost to Connect All Points', url: 'https://leetcode.com/problems/min-cost-to-connect-all-points/' },
      ],
    },
  ],
  cpPhases: [
    {
      name: 'CSES DSU Problems',
      description: 'Classic DSU problems from the CSES problem set.',
      problems: [
        { id: 'uf-cp-1', name: 'Building Roads', url: 'https://cses.fi/problemset/task/1666' },
        { id: 'uf-cp-2', name: 'Building Teams', url: 'https://cses.fi/problemset/task/1668' },
        { id: 'uf-cp-3', name: 'Round Trip', url: 'https://cses.fi/problemset/task/1669' },
        { id: 'uf-cp-4', name: 'Road Reparation', url: 'https://cses.fi/problemset/task/1675' },
        { id: 'uf-cp-5', name: 'Road Construction', url: 'https://cses.fi/problemset/task/1676' },
        { id: 'uf-cp-6', name: 'New Roads Queries', url: 'https://cses.fi/problemset/task/1691' },
      ],
    },
    {
      name: 'Codeforces DSU Problems',
      description: 'Codeforces problems where DSU is the key technique.',
      problems: [
        { id: 'uf-cp-7', name: 'Learning Languages', url: 'https://codeforces.com/problemset/problem/277/A' },
        { id: 'uf-cp-8', name: 'News Distribution', url: 'https://codeforces.com/problemset/problem/1167/C' },
        { id: 'uf-cp-9', name: 'DZY Loves Chemistry', url: 'https://codeforces.com/problemset/problem/459/B' },
        { id: 'uf-cp-10', name: 'The Door Problem', url: 'https://codeforces.com/problemset/problem/776/D' },
        { id: 'uf-cp-11', name: 'Colorful Graph', url: 'https://codeforces.com/problemset/problem/246/D' },
        { id: 'uf-cp-12', name: 'Friends and Queries', url: 'https://codeforces.com/problemset/problem/670/D' },
      ],
    },
  ],
  resources: [
    { name: 'NeetCode - Union Find', description: 'Clear introduction to DSU with path compression and union by rank.', type: 'video', category: 'interview', url: 'https://neetcode.io/roadmap' },
    { name: 'William Fiset - Union Find', description: 'Thorough explanation of DSU variants and optimizations.', type: 'video', category: 'both', url: 'https://www.youtube.com/@WilliamFiset-videos' },
    { name: 'CP-Algorithms - DSU', description: 'In-depth coverage of DSU theory, proofs, and applications.', type: 'written', category: 'both', url: 'https://cp-algorithms.com/data_structures/disjoint_set_union.html' },
    { name: 'USACO Guide - DSU', description: 'Structured DSU learning path with curated practice problems.', type: 'written', category: 'cp', url: 'https://usaco.guide/gold/dsu' },
    { name: 'LeetCode - Union Find Tag', description: 'All LeetCode problems tagged with Union Find.', type: 'written', category: 'interview', url: 'https://leetcode.com/tag/union-find/' },
  ],
  interviewTimeline: [
    { title: 'Week 1: DSU Implementation & Basics', description: 'Implement DSU with path compression and union by rank from scratch. Solve Phase 1 problems (6 problems).' },
    { title: 'Week 2: Intermediate Applications', description: 'Solve Phase 2 problems (6 problems). Practice applying DSU to grouping, strings, and equations.' },
    { title: 'Week 3: Advanced DSU Patterns', description: 'Solve Phase 3 problems (10 problems). Master offline sorting + DSU and grid connectivity patterns.' },
  ],
  cpTimeline: [
    { title: 'Week 1-2: CSES DSU', description: 'Complete all CSES DSU problems. Master the core operations and edge cases.' },
    { title: 'Week 3-4: Codeforces Practice', description: 'Solve CF 1200-1800 rated DSU problems. Learn weighted DSU and bipartite DSU variants.' },
  ],
  studyApproach: {
    interview: 'Always implement DSU with both path compression and union by rank. Recognize connectivity problems quickly — if the question asks about connected components, merging groups, or cycle detection in undirected graphs, DSU is likely the right tool.',
    cp: 'Learn weighted DSU (to track edge weights or relative values within components) and rollback DSU (for offline divide-and-conquer). Practice recognizing when offline sorting + DSU beats online approaches.',
  },
  patternsSummary: [
    'Basic Connectivity - Count components, check if nodes are connected',
    'Cycle Detection - Detect cycles in undirected graphs via union',
    'Dynamic Connectivity - Add edges and query connectivity online',
    'Offline Sorted DSU - Sort edges/queries then process with DSU',
    'Grid DSU - Treat grid cells as DSU nodes for island-type problems',
    'Weighted DSU - Track relative values or ranks within components',
    'Bipartite DSU - Two-coloring with DSU for parity problems',
  ],
}

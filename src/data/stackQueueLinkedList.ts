import type { Topic } from '@/types/problems'

export const stackQueueLinkedListTopic: Topic = {
  id: 'stack-queue-linkedlist',
  name: 'Stack, Queue & LinkedList',
  icon: 'pi-arrow-right-arrow-left',
  description: 'Master fundamental data structures and their interview patterns',
  interviewPhases: [
    {
      name: 'Stack Problems',
      description: 'Matching, monotonic stacks, expression evaluation.',
      problems: [
        { id: 'sql-i-1', name: 'Valid Parentheses', url: 'https://leetcode.com/problems/valid-parentheses/' },
        { id: 'sql-i-2', name: 'Min Stack', url: 'https://leetcode.com/problems/min-stack/' },
        { id: 'sql-i-3', name: 'Implement Queue using Stacks', url: 'https://leetcode.com/problems/implement-queue-using-stacks/' },
        { id: 'sql-i-4', name: 'Daily Temperatures', url: 'https://leetcode.com/problems/daily-temperatures/' },
        { id: 'sql-i-5', name: 'Largest Rectangle in Histogram', url: 'https://leetcode.com/problems/largest-rectangle-in-histogram/' },
        { id: 'sql-i-6', name: 'Basic Calculator II', url: 'https://leetcode.com/problems/basic-calculator-ii/' },
      ],
    },
    {
      name: 'Queue Problems',
      description: 'Queue manipulation, circular queues, sliding window with queues.',
      problems: [
        { id: 'sql-i-7', name: 'Implement Stack using Queues', url: 'https://leetcode.com/problems/implement-stack-using-queues/' },
        { id: 'sql-i-8', name: 'Design Circular Queue', url: 'https://leetcode.com/problems/design-circular-queue/' },
        { id: 'sql-i-9', name: 'Moving Average from Data Stream', url: 'https://leetcode.com/problems/moving-average-from-data-stream/' },
      ],
    },
    {
      name: 'Linked List Problems',
      description: 'Reversal, two pointers, cycle detection, merge operations.',
      problems: [
        { id: 'sql-i-10', name: 'Reverse Linked List', url: 'https://leetcode.com/problems/reverse-linked-list/' },
        { id: 'sql-i-11', name: 'Merge Two Sorted Lists', url: 'https://leetcode.com/problems/merge-two-sorted-lists/' },
        { id: 'sql-i-12', name: 'Remove Nth Node From End of List', url: 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/' },
        { id: 'sql-i-13', name: 'Linked List Cycle', url: 'https://leetcode.com/problems/linked-list-cycle/' },
        { id: 'sql-i-14', name: 'Linked List Cycle II', url: 'https://leetcode.com/problems/linked-list-cycle-ii/' },
        { id: 'sql-i-15', name: 'Intersection of Two Linked Lists', url: 'https://leetcode.com/problems/intersection-of-two-linked-lists/' },
        { id: 'sql-i-16', name: 'Palindrome Linked List', url: 'https://leetcode.com/problems/palindrome-linked-list/' },
        { id: 'sql-i-17', name: 'Remove Duplicates from Sorted List', url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-list/' },
      ],
    },
    {
      name: 'Advanced Problems',
      description: 'Combining multiple data structures and complex pointer manipulation.',
      problems: [
        { id: 'sql-i-18', name: 'LRU Cache', url: 'https://leetcode.com/problems/lru-cache/' },
        { id: 'sql-i-19', name: 'Add Two Numbers', url: 'https://leetcode.com/problems/add-two-numbers/' },
        { id: 'sql-i-20', name: 'Reverse Nodes in k-Group', url: 'https://leetcode.com/problems/reverse-nodes-in-k-group/' },
        { id: 'sql-i-21', name: 'Copy List with Random Pointer', url: 'https://leetcode.com/problems/copy-list-with-random-pointer/' },
        { id: 'sql-i-22', name: 'Sort List', url: 'https://leetcode.com/problems/sort-list/' },
        { id: 'sql-i-23', name: 'Reorder List', url: 'https://leetcode.com/problems/reorder-list/' },
        { id: 'sql-i-24', name: 'Flatten a Multilevel Doubly Linked List', url: 'https://leetcode.com/problems/flatten-a-multilevel-doubly-linked-list/' },
        { id: 'sql-i-25', name: 'Design Browser History', url: 'https://leetcode.com/problems/design-browser-history/' },
      ],
    },
  ],
  cpPhases: [],
  resources: [
    { name: 'NeetCode - Linked List & Stack', description: 'Clear explanations of all core patterns.', type: 'video', category: 'interview', url: 'https://neetcode.io/roadmap' },
    { name: 'Striver - LinkedList & Stack Series', description: 'Comprehensive coverage with implementations.', type: 'video', category: 'both', url: 'https://takeuforward.org/data-structure/linked-list-data-structure/' },
    { name: 'Back To Back SWE - LinkedList', description: 'Great thought process breakdown.', type: 'video', category: 'interview', url: 'https://www.youtube.com/@BackToBackSWE' },
    { name: 'LeetCode LinkedList Explore Card', description: 'Structured learning path.', type: 'written', category: 'interview', url: 'https://leetcode.com/explore/learn/card/linked-list/' },
    { name: 'GeeksforGeeks Stack/Queue/LinkedList', description: 'Reference with examples.', type: 'written', category: 'interview', url: 'https://www.geeksforgeeks.org/data-structures/' },
  ],
  interviewTimeline: [
    { title: 'Week 1-2: Basic Operations', description: 'Stack basics (1-6), Queue (7-9), LinkedList basics (10-12).' },
    { title: 'Week 3-4: Two Pointers & Cycle Detection', description: 'Linked list problems 13-17.' },
    { title: 'Week 5-6: Advanced Patterns', description: 'Problems 18-25. LRU Cache, k-Group reversal, Sort List.' },
  ],
  cpTimeline: [],
  studyApproach: {
    interview: 'Master basic operations first, then two-pointer techniques and cycle detection, then advanced combinations. Practice until you can code them without looking at solutions.',
    cp: '',
  },
  patternsSummary: [
    'Stack - Matching, monotonic stack, expression evaluation',
    'Queue - Circular queue, sliding window, BFS',
    'LinkedList - Reversal, two pointers, fast/slow',
    'Cycle Detection - Floyd\'s algorithm',
    'LRU Cache - HashMap + doubly linked list',
    'Merge Operations - Two pointer merge',
    'k-Group Operations - Segmented reversal',
  ],
}

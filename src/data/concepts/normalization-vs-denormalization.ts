import type { Concept } from './types'

const concept: Concept = {
  slug: 'normalization-vs-denormalization',
  title: 'Normalization vs Denormalization',
  number: 8,
  category: 'Data & Storage',
  icon: 'pi pi-sitemap',
  summary: 'Splitting data to avoid duplication vs duplicating data to avoid joins.',
  readTimeMinutes: 7,
  blocks: [
    {
      type: 'paragraph',
      text:
        'Normalization structures a schema so each fact is stored exactly once - related data lives in separate tables linked by foreign keys, which avoids update anomalies where the same fact duplicated in multiple places can quietly drift out of sync. Denormalization is the deliberate opposite: duplicating some data across tables or documents so a read never needs a join, trading storage and write complexity for read speed. Neither is "correct" in the abstract - the right choice depends on whether the system is read-heavy or write-heavy, and how tolerant it is of staleness.',
    },
    {
      type: 'table',
      caption: 'Before / After: displaying a customer name on an order',
      headers: ['', 'Schema', 'To display an order'],
      rows: [
        ['Normalized', 'orders(id, customer_id, ...) + customers(id, name, ...)', 'JOIN orders to customers on customer_id every time.'],
        ['Denormalized', 'orders(id, customer_id, customer_name, ...)', 'Read the order row alone - no join needed.'],
      ],
    },
    {
      type: 'paragraph',
      text:
        'The denormalized version needs every historical order updated if a customer legitimately renames their account - or, more commonly, that duplicated name is treated as an intentional point-in-time snapshot: an order should show the customer\'s name AS OF the order date, so "staleness" here is actually the correct behavior, not a bug.',
    },
    {
      type: 'table',
      caption: 'Normalized vs Denormalized',
      headers: ['', 'Pros', 'Cons'],
      rows: [
        ['Normalized', 'No duplicate-data drift; smaller storage footprint.', 'Reads needing related data require joins, which get expensive as tables and traffic grow.'],
        ['Denormalized', 'Fast reads with no joins - great for read-heavy access patterns.', 'Writes must update every duplicated copy (or accept eventual inconsistency), and storage grows.'],
      ],
    },
    {
      type: 'paragraph',
      text:
        'In practice, denormalize when the same joined shape is queried constantly in a read-heavy system - which is exactly what a materialized view, a search index, or a CQRS read model is doing under the hood: precomputing the join once, ahead of time, so every read is cheap.',
    },
    {
      type: 'callout',
      kind: 'tip',
      text:
        '"Denormalize for reads" is the same underlying idea as Caching and CQRS\'s read model - all three trade write-time cost/complexity for read-time speed, just at different layers of the stack (schema design vs. a cache in front of the DB vs. a separately maintained read model). Naming that connection explicitly is a strong signal of depth in an interview.',
    },
  ],
  relatedConcepts: ['caching', 'cqrs', 'database-replication'],
}

export default concept

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { hldTopics as newTopics, type HLDTopic } from '@/data/hld'
import { hldTopics as legacyTopicsRaw } from '@/data/hldTopics'
import MermaidDiagram from '@/components/hld/MermaidDiagram.vue'
import DeepDiveTabs from '@/components/hld/DeepDiveTabs.vue'
import CodeBlock from '@/components/shared/CodeBlock.vue'

type LegacyTopic = (typeof legacyTopicsRaw)[number]

const route = useRoute()

const newTopic = computed<HLDTopic | undefined>(() =>
  newTopics.find((t) => t.slug === route.params.slug),
)
const legacyTopic = computed<LegacyTopic | undefined>(() =>
  newTopic.value ? undefined : legacyTopicsRaw.find((t) => t.slug === route.params.slug),
)
const topic = computed(() => newTopic.value ?? legacyTopic.value)

const difficultyClass = computed(() => {
  switch (topic.value?.difficulty) {
    case 'Beginner':
      return 'difficulty-beginner'
    case 'Intermediate':
      return 'difficulty-intermediate'
    case 'Advanced':
      return 'difficulty-advanced'
    default:
      return ''
  }
})

const relatedTopics = computed(() => {
  const slugs = topic.value?.relatedDesigns ?? []
  return slugs
    .map((slug) => newTopics.find((t) => t.slug === slug) ?? legacyTopicsRaw.find((t) => t.slug === slug))
    .filter((t): t is HLDTopic | LegacyTopic => Boolean(t))
})

const tocSections = [
  { id: 'understanding-problem', label: 'Understanding the Problem' },
  { id: 'naive-first-cut', label: 'Naive First Cut' },
  { id: 'prior-art', label: 'Prior Art' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'technology-choices', label: 'Technology Choices' },
  { id: 'scale-estimation', label: 'Scale Estimation' },
  { id: 'core-entities', label: 'Core Entities' },
  { id: 'api-interface', label: 'API / System Interface' },
  { id: 'high-level-design', label: 'High-Level Design' },
  { id: 'core-flows', label: 'Core Flows' },
  { id: 'deep-dives', label: 'Deep Dives' },
  { id: 'self-audit', label: 'Design Self-Audit' },
  { id: 'final-architecture', label: 'Final Architecture' },
  { id: 'key-technologies', label: 'Key Technologies' },
  { id: 'expected-depth', label: 'Expected at Each Level' },
  { id: 'key-takeaways', label: 'Key Takeaways' },
  { id: 'related', label: 'Related' },
]

// Ordered list of `newTopic` sections, filtered to the ones actually rendered so that
// numbered badges and the "On this page" nav never skip/duplicate a number when a
// section is conditionally hidden (e.g. API / System Interface for topics with no
// client-facing endpoints, or Related when there's nothing to relate).
const visibleSectionIds = computed(() => {
  const t = newTopic.value
  if (!t) return []
  return tocSections
    .map((s) => s.id)
    .filter((id) => {
      if (id === 'api-interface') return t.apiInterface.length > 0
      if (id === 'related') return relatedTopics.value.length > 0 || t.relatedConcepts.length > 0
      return true
    })
})

function sectionNumber(id: string) {
  return visibleSectionIds.value.indexOf(id) + 1
}

const visibleTocSections = computed(() =>
  tocSections.filter((s) => visibleSectionIds.value.includes(s.id)),
)

// Systemcraft's own "why this pick" note leads with a rhetorical question
// ("Why Redis over application-level counters?") before the explanation - bold that
// lead-in the same way if the note follows that shape, otherwise render it plain.
function splitLeadQuestion(note: string) {
  const idx = note.indexOf('? ')
  if (idx === -1) return { lead: '', rest: note }
  return { lead: note.slice(0, idx + 1), rest: note.slice(idx + 2) }
}

function formatApiInterface(topic: HLDTopic) {
  return topic.apiInterface
    .map((e) => {
      const lines = [`${e.method} ${e.path}`]
      lines.push(`    ${e.description}`)
      if (e.example) {
        e.example.split('\n').forEach((line) => lines.push(`    ${line}`))
      }
      return lines.join('\n')
    })
    .join('\n\n')
}
</script>

<template>
  <div v-if="topic" class="hld-detail">
    <RouterLink to="/hld" class="back-link">
      <i class="pi pi-arrow-left"></i>
      Back to High Level Design
    </RouterLink>

    <!-- ============================= NEW (systemcraft-aligned) SCHEMA ============================= -->
    <template v-if="newTopic">
      <p class="breadcrumb">Home <i class="pi pi-angle-right"></i> {{ newTopic.title }}</p>

      <div class="hld-detail-layout">
        <div class="hld-detail-main">
          <header class="detail-header">
            <div class="header-icon-chip" :style="{ background: newTopic.color }">
              <i :class="newTopic.icon"></i>
            </div>
            <div class="header-text">
              <div class="header-title-row">
                <h1>{{ newTopic.title }}</h1>
                <span class="sc-tag difficulty-tag" :class="difficultyClass">{{ newTopic.difficulty }}</span>
              </div>
              <p class="header-meta">
                <i class="pi pi-clock"></i> {{ newTopic.readTimeMinutes }} min read
                <span v-if="newTopic.prerequisites?.length">
                  · Prerequisites: {{ newTopic.prerequisites.join(', ') }}
                </span>
              </p>
              <div class="tag-row">
                <span v-for="t in newTopic.topics" :key="t" class="sc-tag">{{ t }}</span>
              </div>
              <div class="company-row">
                <span class="company-label">Asked at:</span>
                <span v-for="c in newTopic.companies" :key="c" class="company-name">{{ c }}</span>
              </div>
              <RouterLink
                v-if="newTopic.simulator"
                :to="`/hld/${newTopic.slug}/simulate`"
                class="sc-btn-primary simulator-cta"
              >
                <i class="pi pi-sitemap"></i>
                Try the Simulator
              </RouterLink>
            </div>
          </header>

          <section id="understanding-problem" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('understanding-problem') }}</span> Understanding the Problem</h2>
            <p class="section-body">{{ newTopic.understandingProblem }}</p>
            <p v-if="newTopic.realExamples" class="section-body">
              <strong>Real examples:</strong> {{ newTopic.realExamples }}
            </p>
          </section>

          <section id="naive-first-cut" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('naive-first-cut') }}</span> Naive First Cut</h2>
            <MermaidDiagram
              :title="newTopic.naiveFirstCut.diagram.title"
              :definition="newTopic.naiveFirstCut.diagram.mermaid"
            />
            <CodeBlock v-if="newTopic.naiveFirstCut.code" :code="newTopic.naiveFirstCut.code" />
            <h3 class="subheading">Why this breaks</h3>
            <ul class="bullet-list">
              <li v-for="w in newTopic.naiveFirstCut.whyThisBreaks" :key="w">{{ w }}</li>
            </ul>
            <p class="section-body closing-note">{{ newTopic.naiveFirstCut.closingNote }}</p>
          </section>

          <section id="prior-art" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('prior-art') }}</span> Prior Art We're Drawing From</h2>
            <div class="sc-card subsection-card" v-for="p in newTopic.priorArt" :key="p.title">
              <h3>
                <a v-if="p.link" :href="p.link" target="_blank" rel="noopener noreferrer" class="prior-art-link">
                  {{ p.title }} <i class="pi pi-external-link"></i>
                </a>
                <template v-else>{{ p.title }}</template>
              </h3>
              <p>{{ p.description }}</p>
            </div>
          </section>

          <section id="requirements" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('requirements') }}</span> Requirements</h2>
            <h3 class="inline-heading">Core (Top 3)</h3>
            <ol class="bullet-list">
              <li v-for="r in newTopic.requirements.core" :key="r">{{ r }}</li>
            </ol>
            <h3 class="inline-heading">Below the Line</h3>
            <ul class="bullet-list">
              <li v-for="r in newTopic.requirements.belowTheLine" :key="r">{{ r }}</li>
            </ul>
            <div v-if="newTopic.requirements.nonFunctionalTable.length > 0" class="sc-card table-card nfr-table">
              <table class="sc-table">
                <thead>
                  <tr>
                    <th>NFR</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in newTopic.requirements.nonFunctionalTable" :key="r.metric">
                    <td>{{ r.metric }}</td>
                    <td>{{ r.target }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="technology-choices" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('technology-choices') }}</span> Technology Choices</h2>
            <div class="sc-card table-card">
              <table class="sc-table">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Purpose</th>
                    <th>Primary Pick</th>
                    <th>Alternatives</th>
                    <th>Why Primary Wins Here</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in newTopic.technologyChoices" :key="row.tier">
                    <td>{{ row.tier }}</td>
                    <td>{{ row.purpose }}</td>
                    <td>{{ row.primaryPick }}</td>
                    <td>{{ row.alternatives }}</td>
                    <td>{{ row.whyPrimaryWins }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="section-body">
              <strong v-if="splitLeadQuestion(newTopic.technologyChoicesNote).lead">{{ splitLeadQuestion(newTopic.technologyChoicesNote).lead }}</strong>
              {{ splitLeadQuestion(newTopic.technologyChoicesNote).rest }}
            </p>
          </section>

          <section id="scale-estimation" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('scale-estimation') }}</span> Scale Estimation</h2>
            <ul class="bullet-list">
              <li v-for="s in newTopic.scaleEstimation" :key="s">{{ s }}</li>
            </ul>
          </section>

          <section id="core-entities" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('core-entities') }}</span> Core Entities</h2>
            <ul class="bullet-list">
              <li v-for="e in newTopic.coreEntities" :key="e.name"><strong>{{ e.name }}</strong> — {{ e.description }}</li>
            </ul>
          </section>

          <section v-if="newTopic.apiInterface.length > 0" id="api-interface" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('api-interface') }}</span> API / System Interface</h2>
            <pre class="sc-code-block api-code-block">{{ formatApiInterface(newTopic) }}</pre>
            <template v-if="newTopic.apiSecurityNote">
              <h3 class="inline-heading">Security notes</h3>
              <p class="section-body">{{ newTopic.apiSecurityNote }}</p>
            </template>
          </section>

          <section id="high-level-design" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('high-level-design') }}</span> High-Level Design</h2>
            <p class="section-body">{{ newTopic.highLevelDesignIntro }}</p>
            <div v-for="b in newTopic.builds" :key="b.title" class="build-block">
              <h3 class="build-title">{{ b.title }}</h3>
              <p class="section-body">{{ b.body }}</p>
              <div v-if="b.insightCallout" class="sc-card callout-card">
                <p>💡 {{ b.insightCallout }}</p>
              </div>
              <template v-if="b.newComponents">
                <div class="sc-card subsection-card" v-for="nc in b.newComponents" :key="nc.name">
                  <h4>{{ nc.name }}</h4>
                  <p>{{ nc.description }}</p>
                </div>
              </template>
              <MermaidDiagram v-if="b.diagram" :title="b.diagram.title" :definition="b.diagram.mermaid" />
              <ul v-if="b.steps" class="bullet-list numbered-steps">
                <li v-for="s in b.steps" :key="s">{{ s }}</li>
              </ul>
              <p v-if="b.closingNote" class="section-body closing-note">{{ b.closingNote }}</p>
            </div>
          </section>

          <section id="core-flows" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('core-flows') }}</span> Core Flows</h2>
            <div v-for="f in newTopic.coreFlows" :key="f.title" class="flow-block">
              <h3 class="build-title">{{ f.title }}</h3>
              <MermaidDiagram :title="f.diagram.title" :definition="f.diagram.mermaid" />
              <div v-if="f.nonObviousFailure" class="sc-card callout-card warning">
                <p><strong>Non-obvious failure:</strong> {{ f.nonObviousFailure }}</p>
              </div>
            </div>
          </section>

          <section id="deep-dives" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('deep-dives') }}</span> Deep Dives</h2>
            <div class="sc-card subsection-card deep-dive-card" v-for="d in newTopic.deepDives" :key="d.title">
              <h3>{{ d.title }}</h3>
              <p>{{ d.problem }}</p>
              <p v-if="d.simpleTerms" class="simple-terms"><strong>In simple terms:</strong> {{ d.simpleTerms }}</p>
              <MermaidDiagram v-if="d.diagram" :title="d.diagram.title" :definition="d.diagram.mermaid" />
              <DeepDiveTabs :bad="d.bad" :good="d.good" :great="d.great" />
            </div>
          </section>

          <section id="self-audit" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('self-audit') }}</span> Design Self-Audit</h2>
            <div class="sc-card subsection-card" v-for="q in newTopic.selfAudit" :key="q.question">
              <h3>{{ q.question }}</h3>
              <p>{{ q.answer }}</p>
            </div>
          </section>

          <section id="final-architecture" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('final-architecture') }}</span> Final Architecture</h2>
            <MermaidDiagram :title="newTopic.finalArchitecture.title" :definition="newTopic.finalArchitecture.mermaid" />
          </section>

          <section id="key-technologies" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('key-technologies') }}</span> Key Technologies</h2>
            <div class="sc-card table-card">
              <table class="sc-table">
                <thead>
                  <tr>
                    <th>Term</th>
                    <th>What it is</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="g in newTopic.keyTechnologies" :key="g.term">
                    <td>{{ g.term }}</td>
                    <td>{{ g.definition }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="expected-depth" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('expected-depth') }}</span> What's Expected at Each Level</h2>
            <div class="sc-card subsection-card">
              <h3>Mid-level</h3>
              <p>{{ newTopic.expectedDepth.mid }}</p>
            </div>
            <div class="sc-card subsection-card">
              <h3>Senior</h3>
              <p>{{ newTopic.expectedDepth.senior }}</p>
            </div>
            <div class="sc-card subsection-card">
              <h3>Staff+</h3>
              <p>{{ newTopic.expectedDepth.staffPlus }}</p>
            </div>
          </section>

          <section id="key-takeaways" class="detail-section">
            <h2><span class="section-number">{{ sectionNumber('key-takeaways') }}</span> Key Takeaways</h2>
            <ul class="key-takeaways">
              <li v-for="k in newTopic.keyTakeaways" :key="k">{{ k }}</li>
            </ul>
          </section>

          <section id="related" class="detail-section" v-if="relatedTopics.length || newTopic.relatedConcepts.length">
            <h2><span class="section-number">{{ sectionNumber('related') }}</span> Related</h2>
            <div v-if="relatedTopics.length" class="related-designs-row">
              <RouterLink
                v-for="r in relatedTopics"
                :key="r.slug"
                :to="`/hld/${r.slug}`"
                class="sc-card related-design-card"
              >
                <div class="card-icon-chip" :style="{ background: r.color }">
                  <i :class="r.icon"></i>
                </div>
                {{ r.title }}
              </RouterLink>
            </div>
            <div v-if="newTopic.relatedConcepts.length" class="related-concepts-row">
              <div class="sc-card concept-chip" v-for="c in newTopic.relatedConcepts" :key="c.name">
                <strong>{{ c.name }}</strong> — {{ c.description }}
              </div>
            </div>
          </section>
        </div>

        <aside class="hld-toc">
          <div class="toc-card">
            <div class="toc-title">On this page</div>
            <a v-for="s in visibleTocSections" :key="s.id" :href="`#${s.id}`" class="toc-link">{{ s.label }}</a>
          </div>
        </aside>
      </div>
    </template>

    <!-- ============================= LEGACY SCHEMA (pending migration) ============================= -->
    <template v-else-if="legacyTopic">
      <header class="detail-header">
        <div class="header-icon-chip" :style="{ background: legacyTopic.color }">
          <i :class="legacyTopic.icon"></i>
        </div>
        <div class="header-text">
          <div class="header-title-row">
            <h1>{{ legacyTopic.title }}</h1>
            <span class="sc-tag difficulty-tag" :class="difficultyClass">{{ legacyTopic.difficulty }}</span>
          </div>
          <p class="header-summary">{{ legacyTopic.summary }}</p>
          <div class="tag-row">
            <span v-for="c in legacyTopic.concepts" :key="c" class="sc-tag">{{ c }}</span>
          </div>
          <div class="company-row">
            <span class="company-label">Asked by:</span>
            <span v-for="c in legacyTopic.companies" :key="c" class="company-name">{{ c }}</span>
          </div>
          <RouterLink
            v-if="legacyTopic.simulator"
            :to="`/hld/${legacyTopic.slug}/simulate`"
            class="sc-btn-primary simulator-cta"
          >
            <i class="pi pi-sitemap"></i>
            Try the Simulator
          </RouterLink>
        </div>
      </header>

      <section class="detail-section">
        <h2><span class="section-number">1</span> TL;DR</h2>
        <p class="section-body">{{ legacyTopic.tldr }}</p>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">2</span> Understanding the Problem</h2>
        <p class="section-body">{{ legacyTopic.problemFraming }}</p>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">3</span> Prior Art We're Drawing From</h2>
        <div class="sc-card subsection-card" v-for="p in legacyTopic.priorArt" :key="p.title">
          <h3>{{ p.title }}</h3>
          <p>{{ p.description }}</p>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">4</span> Core Entities</h2>
        <div class="sc-card table-card">
          <table class="sc-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in legacyTopic.coreEntities" :key="e.name">
                <td>{{ e.name }}</td>
                <td>{{ e.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">5</span> Requirements</h2>
        <div class="requirements-grid">
          <div class="sc-card requirements-card">
            <h3>Core</h3>
            <ul>
              <li v-for="r in legacyTopic.requirements.core" :key="r">{{ r }}</li>
            </ul>
          </div>
          <div class="sc-card requirements-card">
            <h3>Below the Line</h3>
            <ul>
              <li v-for="r in legacyTopic.requirements.belowTheLine" :key="r">{{ r }}</li>
            </ul>
          </div>
          <div class="sc-card requirements-card">
            <h3>Non-Functional</h3>
            <table class="sc-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in legacyTopic.requirements.nonFunctionalTable" :key="r.metric">
                  <td>{{ r.metric }}</td>
                  <td>{{ r.target }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">6</span> Scale Estimation (Back-of-Envelope)</h2>
        <p class="section-body">{{ legacyTopic.capacityEstimate }}</p>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">7</span> High-Level Architecture</h2>
        <p class="section-body">{{ legacyTopic.architecture }}</p>
        <div class="diagram-stack">
          <template v-for="d in legacyTopic.diagrams" :key="d.title">
            <MermaidDiagram :title="d.title" :definition="d.mermaid" />
            <ul v-if="d.bullets" class="diagram-bullets">
              <li v-for="b in d.bullets" :key="b">{{ b }}</li>
            </ul>
          </template>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">8</span> Approaches Compared</h2>
        <div class="sc-card subsection-card approach-card" v-for="a in legacyTopic.approaches" :key="a.name">
          <h3>{{ a.name }}</h3>
          <p>{{ a.description }}</p>
          <div class="approach-pros-cons">
            <div>
              <div class="approach-label pros">Pros</div>
              <ul>
                <li v-for="p in a.pros" :key="p">{{ p }}</li>
              </ul>
            </div>
            <div>
              <div class="approach-label cons">Cons</div>
              <ul>
                <li v-for="c in a.cons" :key="c">{{ c }}</li>
              </ul>
            </div>
          </div>
          <p v-if="a.usedBy" class="approach-used-by"><strong>Used by:</strong> {{ a.usedBy }}</p>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">9</span> Where This Fits</h2>
        <div class="sc-card table-card">
          <table class="sc-table">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Blocks</th>
                <th>Key</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in legacyTopic.whereThisFits" :key="l.layer">
                <td>{{ l.layer }}</td>
                <td>{{ l.blocks }}</td>
                <td>{{ l.key }}</td>
                <td>{{ l.example }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">10</span> API / System Interface</h2>
        <div class="sc-card api-card" v-for="e in legacyTopic.apiInterface" :key="e.method + e.path">
          <div class="api-endpoint-row">
            <span class="sc-method-chip">{{ e.method }}</span>
            <code class="api-path">{{ e.path }}</code>
          </div>
          <p class="api-description">{{ e.description }}</p>
          <pre v-if="e.example" class="sc-code-block">{{ e.example }}</pre>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">11</span> Deep Dive</h2>
        <div class="sc-card subsection-card" v-for="d in legacyTopic.deepDive" :key="d.title">
          <h3>{{ d.title }}</h3>
          <p>{{ d.body }}</p>
          <MermaidDiagram v-if="d.diagram" :definition="d.diagram" />
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">12</span> Trade-offs</h2>
        <div class="sc-card subsection-card" v-for="t in legacyTopic.tradeoffs" :key="t.title">
          <h3>{{ t.title }}</h3>
          <p>{{ t.body }}</p>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">13</span> What Happens If It Fails</h2>
        <div class="sc-card subsection-card">
          <h3>{{ legacyTopic.failureMode.title }}</h3>
          <p>{{ legacyTopic.failureMode.body }}</p>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">14</span> Key Technologies</h2>
        <div class="sc-card table-card">
          <table class="sc-table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Definition</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in legacyTopic.keyTechnologies" :key="g.term">
                <td>{{ g.term }}</td>
                <td>{{ g.definition }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">15</span> Design Self-Audit</h2>
        <div class="sc-card subsection-card" v-for="q in legacyTopic.selfAudit" :key="q.question">
          <h3>{{ q.question }}</h3>
          <p>{{ q.answer }}</p>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">16</span> Interview Cheat Sheet</h2>
        <div class="sc-card table-card">
          <table class="sc-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Answer</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in legacyTopic.cheatSheet" :key="c.question">
                <td>{{ c.question }}</td>
                <td>{{ c.answer }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">17</span> What's Expected at Each Level</h2>
        <div class="sc-card subsection-card">
          <h3>Mid-level</h3>
          <p>{{ legacyTopic.expectedDepth.mid }}</p>
        </div>
        <div class="sc-card subsection-card">
          <h3>Senior</h3>
          <p>{{ legacyTopic.expectedDepth.senior }}</p>
        </div>
        <div class="sc-card subsection-card">
          <h3>Staff+</h3>
          <p>{{ legacyTopic.expectedDepth.staffPlus }}</p>
        </div>
      </section>

      <section class="detail-section">
        <h2><span class="section-number">18</span> Key Takeaways</h2>
        <ul class="key-takeaways">
          <li v-for="k in legacyTopic.keyTakeaways" :key="k">{{ k }}</li>
        </ul>
      </section>

      <section class="detail-section" v-if="relatedTopics.length">
        <h2><span class="section-number">19</span> Related Designs</h2>
        <div class="related-designs-row">
          <RouterLink
            v-for="r in relatedTopics"
            :key="r.slug"
            :to="`/hld/${r.slug}`"
            class="sc-card related-design-card"
          >
            <div class="card-icon-chip" :style="{ background: r.color }">
              <i :class="r.icon"></i>
            </div>
            {{ r.title }}
          </RouterLink>
        </div>
      </section>
    </template>
  </div>

  <div v-else class="not-found">
    <p>We couldn't find that design topic.</p>
    <RouterLink to="/hld" class="back-link">
      <i class="pi pi-arrow-left"></i>
      Back to High Level Design
    </RouterLink>
  </div>
</template>

<style scoped>
.hld-detail {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  padding-bottom: 2rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--sc-text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  width: fit-content;
}

.back-link:hover {
  color: var(--sc-text);
}

.breadcrumb {
  color: var(--sc-text-muted);
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.hld-detail-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  align-items: start;
}

@media (min-width: 1200px) {
  .hld-detail-layout {
    grid-template-columns: 1fr 220px;
  }
}

.hld-detail-main {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  min-width: 0;
}

.hld-toc {
  display: none;
}

@media (min-width: 1200px) {
  .hld-toc {
    display: block;
  }
}

.toc-card {
  position: sticky;
  top: 1rem;
  background: var(--sc-surface);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toc-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sc-accent-2);
  margin-bottom: 0.25rem;
}

.toc-link {
  color: var(--sc-text-muted);
  text-decoration: none;
  font-size: 0.82rem;
  line-height: 1.5;
}

.toc-link:hover {
  color: var(--sc-text);
}

.detail-header {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--sc-border);
}

.header-icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  min-width: 3.25rem;
  border-radius: var(--sc-radius-md);
  color: #ffffff;
  font-size: 1.4rem;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.header-title-row h1 {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--sc-text);
}

.difficulty-tag {
  font-weight: 600;
}

.difficulty-beginner {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.25);
  color: #6ee7b7;
}

.difficulty-intermediate {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.25);
  color: #fcd34d;
}

.difficulty-advanced {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}

.header-meta {
  color: var(--sc-text-muted);
  font-size: 0.85rem;
  margin: 0.4rem 0 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.header-summary {
  color: var(--sc-text-muted);
  font-size: 0.98rem;
  margin: 0.5rem 0 0.75rem;
  line-height: 1.5;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.company-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.company-label {
  color: var(--sc-text-muted);
}

.company-name {
  color: var(--sc-accent-2);
  font-weight: 500;
}

.simulator-cta {
  margin-top: 0.85rem;
  width: fit-content;
  text-decoration: none;
}

.detail-section h2 {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: var(--sc-fs-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--sc-text);
  margin-bottom: 1rem;
}

.inline-heading {
  font-size: var(--sc-fs-lg);
  font-weight: 700;
  color: var(--sc-text);
  margin: 1.5rem 0 0.75rem;
}

.inline-heading:first-of-type {
  margin-top: 0;
}

.section-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  min-width: 1.75rem;
  border-radius: 50%;
  background: var(--sc-gradient-primary);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 700;
}

.section-body {
  color: var(--sc-text-muted);
  line-height: 1.75;
  font-size: var(--sc-fs-base);
  white-space: pre-line;
  margin-bottom: 0.75rem;
}

.closing-note {
  font-style: italic;
}

.subheading {
  font-size: var(--sc-fs-md);
  font-weight: 700;
  color: var(--sc-text);
  margin: 1rem 0 0.5rem;
}

.bullet-list {
  padding-left: 1.25rem;
  color: var(--sc-text-muted);
  line-height: 1.75;
  font-size: var(--sc-fs-base);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.requirements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.requirements-card {
  padding: 1.25rem 1.5rem;
}

.requirements-card h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 0.75rem;
}

.requirements-card ul,
.requirements-card ol {
  padding-left: 1.25rem;
  color: var(--sc-text-muted);
  line-height: 1.7;
  font-size: 0.92rem;
}

.subsection-card {
  padding: 1.25rem 1.5rem;
  margin-bottom: 1rem;
}

.subsection-card h3 {
  font-size: var(--sc-fs-lg);
  font-weight: 700;
  color: var(--sc-accent-2);
  margin-bottom: 0.5rem;
}

.subsection-card h4 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--sc-text);
  margin-bottom: 0.35rem;
}

.prior-art-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--sc-accent-2);
  text-decoration: none;
}

.prior-art-link:hover {
  color: var(--sc-accent-hover, var(--sc-accent));
  text-decoration: underline;
}

.prior-art-link .pi-external-link {
  font-size: 0.75rem;
}

.subsection-card p {
  color: var(--sc-text-muted);
  line-height: 1.75;
  font-size: var(--sc-fs-base);
}

.simple-terms {
  color: var(--sc-text-muted);
  font-size: var(--sc-fs-base);
  line-height: 1.75;
  margin-bottom: 0.75rem;
}

.table-card {
  padding: 0;
  overflow: hidden;
}

.nfr-table {
  margin-top: 0;
}

.diagram-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.25rem;
}

.api-card {
  padding: 1.25rem 1.5rem;
  margin-bottom: 1rem;
}

.api-endpoint-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.5rem;
}

.api-path {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.88rem;
  color: var(--sc-text);
}

.api-description {
  color: var(--sc-text-muted);
  font-size: 0.92rem;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.api-code-block {
  margin-bottom: 1rem;
}

.callout-card {
  padding: 1rem 1.25rem;
  margin: 1rem 0;
  border-left: 3px solid var(--sc-accent);
}

.callout-card.warning {
  border-left-color: var(--sc-status-warning);
}

.callout-card p {
  color: var(--sc-text);
  font-size: var(--sc-fs-base);
  line-height: 1.75;
  margin: 0;
}

.diagram-bullets {
  padding-left: 1.25rem;
  color: var(--sc-text-muted);
  line-height: 1.6;
  font-size: 0.92rem;
}

.build-block,
.flow-block {
  margin-top: 1.5rem;
}

.build-title {
  font-size: var(--sc-fs-lg);
  font-weight: 700;
  color: var(--sc-accent-2);
  margin-bottom: 0.6rem;
}

.numbered-steps {
  margin-top: 0.75rem;
}

.deep-dive-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.approach-card {
  padding: 1.25rem 1.5rem;
}

.approach-pros-cons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin: 0.75rem 0;
}

.approach-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 0.35rem;
}

.approach-label.pros {
  color: var(--sc-status-healthy);
}

.approach-label.cons {
  color: var(--sc-status-bottleneck);
}

.approach-pros-cons ul {
  padding-left: 1.1rem;
  color: var(--sc-text-muted);
  font-size: 0.9rem;
  line-height: 1.6;
}

.approach-used-by {
  color: var(--sc-text-muted);
  font-size: 0.88rem;
}

.key-takeaways {
  padding-left: 1.25rem;
  color: var(--sc-text-muted);
  line-height: 1.75;
  font-size: var(--sc-fs-base);
}

.related-designs-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.related-design-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  text-decoration: none;
  color: var(--sc-text);
  font-weight: 600;
  font-size: 0.95rem;
}

.related-design-card .card-icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  border-radius: var(--sc-radius-sm);
  color: #ffffff;
  font-size: 0.9rem;
}

.related-concepts-row {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.concept-chip {
  padding: 0.85rem 1.1rem;
  font-size: var(--sc-fs-base);
  color: var(--sc-text-muted);
  line-height: 1.75;
}

.concept-chip strong {
  color: var(--sc-text);
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
  color: var(--sc-text-muted);
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'

const ycJobs = [
  { company: 'Trellis AI (YC W24)', role: 'Engineers — building self-improving agents', type: 'AI / ML' },
  { company: 'Arc Prize Foundation (YC W26)', role: 'Platform Engineer for ARC-AGI-4', type: 'AI / ML' },
  { company: 'Kyber (YC W23)', role: 'Head of Engineering', type: 'Leadership' },
  { company: 'Substrate AI', role: 'Harness Engineers', type: 'AI / Infrastructure' },
  { company: 'Akkari (YC P26)', role: 'Founding Engineer', type: 'Full-Stack' },
  { company: 'Adaptional (YC S25)', role: 'AI Engineers', type: 'AI / ML' },
  { company: 'Proliferate (YC S25)', role: 'Founding Engineers', type: 'Full-Stack' },
  { company: 'Bild AI (YC W25)', role: 'Founding Product Engineer', type: 'Product Eng' },
  { company: 'CollectWise (YC F24)', role: 'AI Agent Engineer', type: 'AI / ML' },
  { company: '9 Mothers (YC P26)', role: 'Lead Robotics Engineer', type: 'Robotics' },
  { company: 'Mbodi AI (YC P25)', role: 'Senior Robotics Engineer (Systems/Controls)', type: 'Robotics' },
  { company: 'Jiga (YC W21)', role: 'Engineering roles', type: 'Full-Stack' },
  { company: 'Bloom (YC P26)', role: 'Engineering roles', type: 'Full-Stack' },
  { company: 'PostHog (YC W20)', role: 'Multiple engineering roles', type: 'Full-Stack' },
  { company: 'Hightouch (YC S19)', role: 'Multiple engineering roles', type: 'Data' },
  { company: 'HackerRank (YC S11)', role: 'Multiple engineering roles', type: 'Full-Stack' },
  { company: 'EasyPost (YC S13)', role: 'Engineering roles', type: 'Full-Stack' },
  { company: 'RamAIn (YC W26)', role: 'Founding GTM Operations Lead', type: 'Operations' },
  { company: 'MDalgorithms', role: 'Growth Marketer ($80K-$140K, remote)', type: 'Marketing' },
]

const bigTechHiring = [
  { company: 'Google', roles: 'SWE, ML Engineer, Cloud Architect, SRE', level: 'L3-L7', salary: '$140K-$450K+', focus: 'AI/ML, Cloud, Search' },
  { company: 'Apple', roles: 'iOS Engineer, ML Researcher, Systems Engineer', level: 'ICT2-ICT6', salary: '$150K-$400K+', focus: 'Apple Intelligence, Vision Pro, Silicon' },
  { company: 'Amazon', roles: 'SDE, Data Engineer, Solutions Architect', level: 'L4-L7', salary: '$130K-$380K+', focus: 'AWS AI, Alexa+, Robotics' },
  { company: 'Microsoft', roles: 'SWE, PM, AI Researcher', level: '59-67', salary: '$140K-$400K+', focus: 'Copilot, Azure AI, Gaming' },
  { company: 'Meta', roles: 'SWE, Research Scientist, Infra Engineer', level: 'E3-E7', salary: '$150K-$450K+', focus: 'AI, AR/VR, WhatsApp' },
  { company: 'Netflix', roles: 'Senior SWE, Data Engineer', level: 'Senior+', salary: '$200K-$500K+', focus: 'Streaming, ML Personalization' },
  { company: 'Stripe', roles: 'Backend Engineer, Infra Engineer', level: 'L2-L5', salary: '$170K-$400K+', focus: 'Payments, AI Fraud Detection' },
  { company: 'Anthropic', roles: 'Research Engineer, SWE, ML Engineer', level: 'Various', salary: '$200K-$500K+', focus: 'AI Safety, Claude Models, Infrastructure' },
  { company: 'OpenAI', roles: 'Research Engineer, SWE, Applied AI', level: 'Various', salary: '$200K-$500K+', focus: 'GPT models, Codex, Safety' },
]

interface CompBand {
  company: string
  category: 'FAANG' | 'Product' | 'Fintech' | 'Startup' | 'Enterprise'
  sde1: string
  sde2: string
  sde3: string
}

const levelDefinitions = [
  {
    level: 'SDE-1 / L3-L4',
    years: '~0-2 yrs',
    range: '$120K - $190K',
    note: 'Entry level. New grads and early-career engineers, close mentorship, well-scoped tasks.',
  },
  {
    level: 'SDE-2 / L5',
    years: '~2-5 yrs',
    range: '$160K - $290K',
    note: 'The most common switch band. Owns features end-to-end with limited oversight.',
  },
  {
    level: 'SDE-3+ / L6-L7',
    years: '~5-8+ yrs',
    range: '$220K - $450K+',
    note: 'Senior / Staff. Cross-team scope, technical leadership, ambiguous problems.',
  },
]

const compBands: CompBand[] = [
  { company: 'Google', category: 'FAANG', sde1: '$155K - $195K', sde2: '$200K - $290K', sde3: '$280K - $450K+' },
  { company: 'Meta', category: 'FAANG', sde1: '$160K - $200K', sde2: '$210K - $310K', sde3: '$300K - $480K+' },
  { company: 'Amazon', category: 'FAANG', sde1: '$135K - $175K', sde2: '$175K - $260K', sde3: '$250K - $400K+' },
  { company: 'Apple', category: 'FAANG', sde1: '$150K - $190K', sde2: '$195K - $280K', sde3: '$270K - $430K+' },
  { company: 'Netflix', category: 'FAANG', sde1: '$170K - $210K', sde2: '$220K - $320K', sde3: '$320K - $500K+' },
  { company: 'Microsoft', category: 'Enterprise', sde1: '$130K - $170K', sde2: '$170K - $250K', sde3: '$240K - $400K+' },
  { company: 'Nvidia', category: 'Product', sde1: '$150K - $190K', sde2: '$195K - $280K', sde3: '$270K - $420K+' },
  { company: 'Anthropic', category: 'Product', sde1: '$180K - $230K', sde2: '$230K - $340K', sde3: '$330K - $520K+' },
  { company: 'OpenAI', category: 'Product', sde1: '$180K - $230K', sde2: '$230K - $340K', sde3: '$330K - $520K+' },
  { company: 'Stripe', category: 'Fintech', sde1: '$150K - $190K', sde2: '$195K - $280K', sde3: '$270K - $420K+' },
  { company: 'Airbnb', category: 'Product', sde1: '$150K - $190K', sde2: '$195K - $280K', sde3: '$260K - $410K+' },
  { company: 'Uber', category: 'Product', sde1: '$140K - $180K', sde2: '$180K - $260K', sde3: '$250K - $390K+' },
  { company: 'LinkedIn', category: 'Product', sde1: '$135K - $175K', sde2: '$175K - $255K', sde3: '$240K - $380K+' },
  { company: 'Salesforce', category: 'Enterprise', sde1: '$120K - $160K', sde2: '$160K - $230K', sde3: '$220K - $350K+' },
  { company: 'Adobe', category: 'Enterprise', sde1: '$120K - $160K', sde2: '$160K - $225K', sde3: '$215K - $340K+' },
  { company: 'Oracle', category: 'Enterprise', sde1: '$110K - $150K', sde2: '$150K - $210K', sde3: '$200K - $320K+' },
  { company: 'IBM', category: 'Enterprise', sde1: '$100K - $135K', sde2: '$135K - $185K', sde3: '$180K - $280K+' },
  { company: 'Databricks', category: 'Startup', sde1: '$160K - $200K', sde2: '$210K - $300K', sde3: '$290K - $460K+' },
  { company: 'Snowflake', category: 'Startup', sde1: '$155K - $195K', sde2: '$200K - $290K', sde3: '$280K - $440K+' },
  { company: 'Palantir', category: 'Product', sde1: '$140K - $180K', sde2: '$180K - $260K', sde3: '$250K - $390K+' },
  { company: 'Coinbase', category: 'Fintech', sde1: '$150K - $190K', sde2: '$195K - $280K', sde3: '$270K - $420K+' },
  { company: 'Block (Square)', category: 'Fintech', sde1: '$145K - $185K', sde2: '$190K - $270K', sde3: '$260K - $400K+' },
  { company: 'DoorDash', category: 'Startup', sde1: '$135K - $175K', sde2: '$175K - $250K', sde3: '$240K - $370K+' },
  { company: 'ServiceNow', category: 'Enterprise', sde1: '$125K - $165K', sde2: '$165K - $235K', sde3: '$225K - $350K+' },
  { company: 'Datadog', category: 'Startup', sde1: '$140K - $180K', sde2: '$180K - $260K', sde3: '$250K - $390K+' },
]

const compCategories = ['All', 'FAANG', 'Product', 'Fintech', 'Startup', 'Enterprise']
const selectedCompCategory = ref('All')

const filteredCompBands = computed(() =>
  selectedCompCategory.value === 'All'
    ? compBands
    : compBands.filter((c) => c.category === selectedCompCategory.value),
)

function getCategorySeverity(category: string): string {
  if (category === 'FAANG') return 'danger'
  if (category === 'Fintech') return 'success'
  if (category === 'Startup') return 'warn'
  if (category === 'Enterprise') return 'info'
  return 'secondary'
}

const hotSkills = [
  { skill: 'AI/ML Engineering', demand: 'Very High', growth: '+85%', note: 'Every company building AI agents and copilots' },
  { skill: 'Rust', demand: 'High', growth: '+65%', note: 'Systems programming, WebAssembly, crypto' },
  { skill: 'Platform / DevOps', demand: 'High', growth: '+40%', note: 'Kubernetes, Terraform, CI/CD pipelines' },
  { skill: 'Full-Stack (React/Next.js)', demand: 'High', growth: '+25%', note: 'Still the most common web stack' },
  { skill: 'Data Engineering', demand: 'High', growth: '+45%', note: 'Streaming, lakehouse, real-time analytics' },
  { skill: 'Security Engineering', demand: 'Very High', growth: '+70%', note: 'Supply chain security, AI safety' },
  { skill: 'Robotics / Embodied AI', demand: 'Growing', growth: '+90%', note: 'Humanoid robots, autonomous systems' },
  { skill: 'Go / Backend Systems', demand: 'High', growth: '+30%', note: 'Microservices, distributed systems' },
]

function getTypeSeverity(type: string): string {
  if (type.includes('AI')) return 'info'
  if (type.includes('Full-Stack')) return 'success'
  if (type.includes('Robotics')) return 'warn'
  if (type.includes('Leadership')) return 'danger'
  return 'secondary'
}
</script>

<template>
  <div>
    <div class="section-header">
      <h1><i class="pi pi-briefcase"></i> Job Postings & Market</h1>
      <p>Latest software engineering openings and hiring trends</p>
      <Tag value="Updated: April 24, 2026" severity="info" style="margin-top: 0.5rem" />
    </div>

    <h2 style="margin-bottom: 1rem">YC Startup Jobs (from HN Jobs)</h2>
    <DataTable :value="ycJobs" stripedRows paginator :rows="10" size="small">
      <Column field="company" header="Company" sortable style="min-width: 200px" />
      <Column field="role" header="Role" style="min-width: 250px" />
      <Column field="type" header="Type">
        <template #body="{ data }">
          <Tag :value="data.type" :severity="getTypeSeverity(data.type) as any" />
        </template>
      </Column>
    </DataTable>

    <h2 style="margin: 2rem 0 1rem">Big Tech Hiring Overview</h2>
    <div class="bigtech-grid">
      <Card v-for="company in bigTechHiring" :key="company.company" class="company-card">
        <template #title>{{ company.company }}</template>
        <template #content>
          <div class="company-detail">
            <p><strong>Roles:</strong> {{ company.roles }}</p>
            <p><strong>Levels:</strong> {{ company.level }}</p>
            <p><strong>Comp Range:</strong> <span class="salary">{{ company.salary }}</span></p>
            <p><strong>Focus Areas:</strong> {{ company.focus }}</p>
          </div>
        </template>
      </Card>
    </div>

    <div class="target-companies-cta">
      <div>
        <h2 style="margin: 0 0 0.35rem"><i class="pi pi-flag"></i> Job Hunt: Target Companies (India)</h2>
        <p style="margin: 0">
          SDE-1/2/3 compensation bands across FAANG, Product, Fintech, HFT, GCC, Enterprise, Startup, and
          Services companies in India - filterable by category, location, and level.
        </p>
      </div>
      <router-link to="/jobs/target-companies" class="p-button p-component target-companies-link">
        Explore Target Companies <i class="pi pi-arrow-right"></i>
      </router-link>
    </div>

    <h2 style="margin: 2rem 0 1rem">
      <i class="pi pi-wallet"></i> Compensation Bands by Level (US)
      <Tag value="Editorial estimates" severity="warn" style="margin-left: 0.5rem; vertical-align: middle" />
    </h2>
    <p class="comp-disclaimer">
      These ranges are editorial estimates compiled from public sources (levels.fyi, Blind, company career
      pages) as of 2026 - not scraped real offer reports. Actual comp varies heavily by location, negotiation,
      equity refreshers, and market conditions. Treat these as a starting point for research, not a quote.
    </p>

    <div class="level-cards">
      <Card v-for="lvl in levelDefinitions" :key="lvl.level" class="level-card">
        <template #title>{{ lvl.level }}</template>
        <template #subtitle>{{ lvl.years }}</template>
        <template #content>
          <p class="level-range">{{ lvl.range }}</p>
          <p class="level-note">{{ lvl.note }}</p>
        </template>
      </Card>
    </div>

    <div class="comp-filter-row">
      <label for="comp-category">Filter by category:</label>
      <Select
        id="comp-category"
        v-model="selectedCompCategory"
        :options="compCategories"
        style="min-width: 180px"
      />
    </div>

    <DataTable :value="filteredCompBands" stripedRows paginator :rows="10" size="small" sortField="company" :sortOrder="1">
      <Column field="company" header="Company" sortable style="min-width: 160px" />
      <Column field="category" header="Category" sortable style="min-width: 130px">
        <template #body="{ data }">
          <Tag :value="data.category" :severity="getCategorySeverity(data.category) as any" />
        </template>
      </Column>
      <Column field="sde1" header="SDE-1" sortable />
      <Column field="sde2" header="SDE-2" sortable />
      <Column field="sde3" header="SDE-3+" sortable />
    </DataTable>

    <h2 style="margin: 2rem 0 1rem">Hottest Skills in Demand (2026)</h2>
    <DataTable :value="hotSkills" stripedRows>
      <Column field="skill" header="Skill" sortable />
      <Column field="demand" header="Demand">
        <template #body="{ data }">
          <Tag
            :value="data.demand"
            :severity="data.demand === 'Very High' ? 'danger' : data.demand === 'High' ? 'warn' : 'info'"
          />
        </template>
      </Column>
      <Column field="growth" header="YoY Growth">
        <template #body="{ data }">
          <span style="color: #16a34a; font-weight: 600">{{ data.growth }}</span>
        </template>
      </Column>
      <Column field="note" header="Notes" />
    </DataTable>

    <Accordion style="margin-top: 2rem">
      <AccordionPanel value="resources">
        <AccordionHeader>Job Search Resources</AccordionHeader>
        <AccordionContent>
          <ul class="resources-list">
            <li><strong>Levels.fyi</strong> — <a href="https://www.levels.fyi" target="_blank">levels.fyi</a> — Salary data and company comparisons</li>
            <li><strong>HN Who's Hiring</strong> — Monthly thread on Hacker News with startup jobs</li>
            <li><strong>LinkedIn Jobs</strong> — <a href="https://www.linkedin.com/jobs" target="_blank">linkedin.com/jobs</a> — Largest professional job board</li>
            <li><strong>Indeed</strong> — <a href="https://www.indeed.com" target="_blank">indeed.com</a> — Broad job search engine</li>
            <li><strong>Wellfound (AngelList)</strong> — <a href="https://wellfound.com" target="_blank">wellfound.com</a> — Startup-focused job board</li>
            <li><strong>Glassdoor</strong> — <a href="https://www.glassdoor.com" target="_blank">glassdoor.com</a> — Reviews and salary info</li>
            <li><strong>Layoffs.fyi</strong> — <a href="https://layoffs.fyi" target="_blank">layoffs.fyi</a> — Track tech layoffs (165K+ in 2026)</li>
            <li><strong>Blind</strong> — Anonymous professional network for compensation data</li>
            <li><strong>Hiring Without Whiteboards</strong> — GitHub list of companies with humane hiring processes</li>
          </ul>
        </AccordionContent>
      </AccordionPanel>
      <AccordionPanel value="tips">
        <AccordionHeader>Job Search Tips for 2026</AccordionHeader>
        <AccordionContent>
          <ul class="resources-list">
            <li><strong>AI skills are non-negotiable</strong> — Even non-AI roles expect familiarity with LLMs and AI tools</li>
            <li><strong>Build in public</strong> — GitHub projects, blog posts, and Twitter presence matter more than ever</li>
            <li><strong>Target growing companies</strong> — Startups with recent funding rounds are hiring aggressively</li>
            <li><strong>Negotiate with data</strong> — Use levels.fyi and Blind for compensation benchmarks</li>
            <li><strong>Prepare for AI-augmented interviews</strong> — Some companies test your ability to use AI tools effectively</li>
            <li><strong>Focus on system design</strong> — Senior roles heavily weight system design interviews</li>
          </ul>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </div>
</template>

<style scoped>
.bigtech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.target-companies-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  border: 1px solid var(--p-content-border-color, #334155);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  margin: 2rem 0 1.5rem;
}

.target-companies-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color, #fff);
  border-radius: 6px;
  padding: 0.6rem 1.1rem;
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
}

.comp-disclaimer {
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #94a3b8);
  margin-bottom: 1rem;
  max-width: 70ch;
}

.level-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.level-range {
  font-size: 1.1rem;
  font-weight: 700;
  color: #16a34a;
  margin-bottom: 0.4rem;
}

.level-note {
  font-size: 0.85rem;
  margin: 0;
}

.comp-filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.company-detail p {
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
}

.salary {
  color: #16a34a;
  font-weight: 600;
}

.resources-list {
  padding-left: 1.5rem;
  line-height: 2;
}

.resources-list a {
  color: var(--p-primary-color);
}
</style>

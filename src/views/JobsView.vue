<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
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

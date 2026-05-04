<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'

const topNews = [
  {
    title: 'OpenAI launches GPT-5.5',
    source: 'Hacker News / OpenAI',
    url: 'https://openai.com/index/introducing-gpt-5-5/',
    description: 'New AI model with significantly improved agentic coding, computer use, and scientific research capabilities. Priced at $5/1M input, $30/1M output tokens.',
    category: 'AI',
    hot: true,
    points: 1334,
  },
  {
    title: 'DeepSeek releases V4 models',
    source: 'Hacker News / DeepSeek',
    url: 'https://api-docs.deepseek.com/',
    description: 'V4 Pro (1.6T params) and V4 Flash preview — cheapest in their class while benchmarking competitively against top closed-source models. 1M token context window.',
    category: 'AI',
    hot: true,
    points: 774,
  },
  {
    title: 'Bitwarden CLI compromised in supply chain attack',
    source: 'Hacker News / Socket.dev',
    url: 'https://socket.dev/blog/bitwarden-cli-compromised',
    description: 'Ongoing Checkmarx supply chain campaign compromises the popular password manager CLI tool.',
    category: 'Security',
    hot: true,
    points: 743,
  },
  {
    title: 'Anthropic posts Claude Code quality postmortem',
    source: 'Hacker News / Anthropic',
    url: 'https://www.anthropic.com/engineering/april-23-postmortem',
    description: 'An update addressing recent quality reports in Claude Code, detailing root causes and fixes.',
    category: 'AI',
    hot: false,
    points: 714,
  },
  {
    title: 'Meta cuts 10% of workforce (~8,000 employees)',
    source: 'Techmeme / Bloomberg',
    url: '#',
    description: 'Meta plans layoffs on May 20 to offset heavy AI infrastructure spending. Part of broader tech sector cost-cutting.',
    category: 'Industry',
    hot: true,
    points: 0,
  },
  {
    title: 'Microsoft offers voluntary buyouts for first time',
    source: 'Techmeme / CNBC',
    url: '#',
    description: 'First-ever retirement program targeting 7% of US employees. 51-year company history first.',
    category: 'Industry',
    hot: false,
    points: 0,
  },
  {
    title: 'GPT-5.5 enhanced Codex with computer use',
    source: 'Techmeme / OpenAI',
    url: '#',
    description: 'Codex gains expanded browser interaction and file management capabilities powered by GPT-5.5.',
    category: 'AI',
    hot: false,
    points: 0,
  },
  {
    title: 'Huawei Ascend 950 chips to support DeepSeek V4',
    source: 'Techmeme / Reuters',
    url: '#',
    description: 'Huawei Ascend supernode based on Ascend 950 AI chips will fully support the new DeepSeek V4 model.',
    category: 'AI / Hardware',
    hot: false,
    points: 0,
  },
  {
    title: 'Open-source models closing gap with frontier AI',
    source: 'Techmeme / X',
    url: '#',
    description: 'Open-source LLMs are now only 3-6 months behind frontier models, challenging commercial pricing power.',
    category: 'AI',
    hot: false,
    points: 0,
  },
  {
    title: 'Tech layoffs accelerate in 2026',
    source: 'Techmeme / Semafor',
    url: '#',
    description: '165,269 tech employees laid off across 1,064 companies in 2026. Meta and Microsoft announce simultaneous workforce reductions.',
    category: 'Industry',
    hot: true,
    points: 0,
  },
]

const trendingRepos = [
  { name: 'zilliztech/claude-context', lang: 'TypeScript', stars: '8.7k', today: '1,011', desc: 'Code search MCP for Claude Code — make entire codebase the context for any coding agent' },
  { name: 'Alishahryar1/free-claude-code', lang: 'Python', stars: '6.1k', today: '1,962', desc: 'Use Claude Code for free in the terminal, VSCode extension, or via Discord' },
  { name: 'Z4nzu/hackingtool', lang: 'Python', stars: '61.5k', today: '1,383', desc: 'ALL IN ONE Hacking Tool for Hackers' },
  { name: 'huggingface/ml-intern', lang: 'Python', stars: '4.3k', today: '720', desc: 'Open-source ML engineer that reads papers, trains models, and ships ML models' },
  { name: 'HKUDS/RAG-Anything', lang: 'Python', stars: '18.4k', today: '590', desc: 'RAG-Anything: All-in-One RAG Framework' },
  { name: 'ruvnet/RuView', lang: 'Rust', stars: '50k', today: '429', desc: 'WiFi-based human pose estimation and vital sign monitoring without video' },
  { name: 'open-metadata/OpenMetadata', lang: 'TypeScript', stars: '13.1k', today: '776', desc: 'Unified metadata platform for data discovery and governance' },
  { name: 'Anil-matcha/Open-Generative-AI', lang: 'JavaScript', stars: '7.3k', today: '316', desc: 'Open-source AI image and video generation with 200+ models' },
  { name: 'microsoft/ai-agents-for-beginners', lang: 'Jupyter', stars: '59.1k', today: '208', desc: '12 Lessons to Get Started Building AI Agents' },
  { name: 'PowerShell/PowerShell', lang: 'C#', stars: '52.9k', today: '67', desc: 'PowerShell for every system' },
]

function getCategoryColor(category: string) {
  if (category.includes('AI')) return '#8b5cf6'
  if (category.includes('Security')) return '#ef4444'
  if (category.includes('Industry')) return '#f59e0b'
  return '#3b82f6'
}
</script>

<template>
  <div>
    <div class="section-header">
      <h1><i class="pi pi-megaphone"></i> Tech News</h1>
      <p>Latest headlines from Hacker News, Techmeme, LinkedIn, Twitter/X, and GitHub Trending</p>
      <Tag value="Updated: April 24, 2026" severity="info" style="margin-top: 0.5rem" />
    </div>

    <h2 style="margin-bottom: 1rem">Top Headlines</h2>
    <div class="news-list">
      <Card v-for="news in topNews" :key="news.title" class="news-card">
        <template #title>
          <div class="news-title-row">
            <Tag v-if="news.hot" value="HOT" severity="danger" style="margin-right: 0.5rem" />
            <Tag
              :value="news.category"
              :style="{ background: getCategoryColor(news.category), color: 'white', marginRight: '0.5rem' }"
            />
            <a v-if="news.url !== '#'" :href="news.url" target="_blank" class="news-link">
              {{ news.title }}
            </a>
            <span v-else>{{ news.title }}</span>
          </div>
        </template>
        <template #content>
          <p>{{ news.description }}</p>
          <div class="news-meta">
            <span><i class="pi pi-link"></i> {{ news.source }}</span>
            <span v-if="news.points"><i class="pi pi-arrow-up"></i> {{ news.points }} points</span>
          </div>
        </template>
      </Card>
    </div>

    <h2 style="margin: 2rem 0 1rem"><i class="pi pi-github"></i> GitHub Trending Today</h2>
    <DataTable :value="trendingRepos" stripedRows>
      <Column field="name" header="Repository">
        <template #body="{ data }">
          <a :href="'https://github.com/' + data.name" target="_blank" class="repo-link">
            {{ data.name }}
          </a>
        </template>
      </Column>
      <Column field="desc" header="Description" style="max-width: 350px" />
      <Column field="lang" header="Language">
        <template #body="{ data }">
          <Tag :value="data.lang" severity="secondary" />
        </template>
      </Column>
      <Column field="stars" header="Total Stars" />
      <Column field="today" header="Stars Today">
        <template #body="{ data }">
          <span style="color: #16a34a; font-weight: 600">+{{ data.today }}</span>
        </template>
      </Column>
    </DataTable>

    <Accordion style="margin-top: 2rem">
      <AccordionPanel value="sources">
        <AccordionHeader>Data Sources & How to Stay Updated</AccordionHeader>
        <AccordionContent>
          <ul class="sources-list">
            <li><strong>Hacker News</strong> — <a href="https://news.ycombinator.com" target="_blank">news.ycombinator.com</a> — Top tech discussions and links</li>
            <li><strong>Techmeme</strong> — <a href="https://www.techmeme.com" target="_blank">techmeme.com</a> — Curated tech news aggregator</li>
            <li><strong>GitHub Trending</strong> — <a href="https://github.com/trending" target="_blank">github.com/trending</a> — Trending open source projects</li>
            <li><strong>LinkedIn Tech</strong> — Follow #TechNews, #SoftwareEngineering, #AI on LinkedIn</li>
            <li><strong>Twitter/X</strong> — Follow @OpenAI, @AnthropicAI, @GoogleAI, @TechCrunch, @veraborisovna</li>
            <li><strong>The Pragmatic Engineer</strong> — <a href="https://newsletter.pragmaticengineer.com" target="_blank">newsletter.pragmaticengineer.com</a></li>
            <li><strong>TLDR Newsletter</strong> — <a href="https://tldr.tech" target="_blank">tldr.tech</a> — Daily tech newsletter</li>
            <li><strong>Layoffs.fyi</strong> — <a href="https://layoffs.fyi" target="_blank">layoffs.fyi</a> — Track tech layoffs in real-time</li>
          </ul>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </div>
</template>

<style scoped>
.news-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.news-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.news-link {
  color: var(--p-primary-color);
  text-decoration: none;
  font-weight: 600;
}

.news-link:hover {
  text-decoration: underline;
}

.news-meta {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.news-meta i {
  margin-right: 0.25rem;
}

.repo-link {
  color: var(--p-primary-color);
  text-decoration: none;
  font-weight: 500;
}

.repo-link:hover {
  text-decoration: underline;
}

.sources-list {
  padding-left: 1.5rem;
  line-height: 2;
}

.sources-list a {
  color: var(--p-primary-color);
}
</style>

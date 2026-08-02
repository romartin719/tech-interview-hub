<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Select from 'primevue/select'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import {
  targetCompanies,
  companyCategories,
  companyLocations,
  levelInfo,
  formatLpa,
  overallRange,
  formatLpaCompact,
  levelExtent,
  applicationStatuses,
  type Level,
  type ApplicationStatus,
} from '@/data/targetCompanies'

const route = useRoute()
const router = useRouter()

const level = computed<Level | null>(() => {
  const raw = route.params.level as string | undefined
  return raw === 'sde-1' || raw === 'sde-2' || raw === 'sde-3' ? raw : null
})

const tabs: { label: string; to: string }[] = [
  { label: 'Overview', to: '/jobs/target-companies' },
  { label: 'SDE-1', to: '/jobs/target-companies/sde-1' },
  { label: 'SDE-2', to: '/jobs/target-companies/sde-2' },
  { label: 'SDE-3', to: '/jobs/target-companies/sde-3' },
]

function isActiveTab(to: string): boolean {
  return route.path === to
}

function goTo(to: string) {
  router.push(to)
}

const range = overallRange()

// --- Filters (level pages only) ---
const searchQuery = ref('')
const selectedCategory = ref<string>('All')
const selectedLocation = ref<string>('All')
const minComp = ref<number | null>(null)

const categoryFilters = computed(() => ['All', ...companyCategories])
const locationOptions = computed(() => ['All', ...companyLocations])

function resetFilters() {
  searchQuery.value = ''
  selectedCategory.value = 'All'
  selectedLocation.value = 'All'
  minComp.value = null
}

const filteredCompanies = computed(() => {
  const referenceLevel: Level = level.value ?? 'sde-2'
  return targetCompanies
    .filter((c) => {
      if (searchQuery.value && !c.company.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
      if (selectedCategory.value !== 'All' && c.category !== selectedCategory.value) return false
      if (selectedLocation.value !== 'All' && !c.locations.includes(selectedLocation.value)) return false
      if (minComp.value && c[referenceLevel].low < minComp.value) return false
      return true
    })
    .map((c) => ({
      ...c,
      sde1Sort: c['sde-1'].low,
      sde2Sort: c['sde-2'].low,
      sde3Sort: c['sde-3'].low,
    }))
})

const levelSortFieldMap: Record<Level, string> = {
  'sde-1': 'sde1Sort',
  'sde-2': 'sde2Sort',
  'sde-3': 'sde3Sort',
}

// --- Overview "at a glance" preview (top companies by SDE-3, no filters) ---
const previewCompanies = computed(() =>
  [...targetCompanies].sort((a, b) => b['sde-3'].high - a['sde-3'].high).slice(0, 8),
)

function barStyle(lowHigh: { low: number; high: number }, level: Level): { left: string; width: string } {
  const extent = levelExtent(level)
  const span = extent.high - extent.low || 1
  const left = ((lowHigh.low - extent.low) / span) * 100
  const width = ((lowHigh.high - lowHigh.low) / span) * 100
  return { left: `${left}%`, width: `${Math.max(width, 2)}%` }
}

// --- Local (device-only) application tracker ---
const STORAGE_KEY = 'tc-tracker-v1'
interface TrackerEntry {
  status: ApplicationStatus
  comment: string
}
const tracker = reactive<Record<string, TrackerEntry>>({})

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) Object.assign(tracker, JSON.parse(raw))
  } catch {
    /* ignore corrupt/unavailable storage */
  }
})

function persistTracker() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker))
  } catch {
    /* ignore quota/unavailable storage */
  }
}

function getStatus(company: string): ApplicationStatus {
  return tracker[company]?.status ?? 'Not started'
}
function setStatus(company: string, status: ApplicationStatus) {
  tracker[company] = { status, comment: tracker[company]?.comment ?? '' }
  persistTracker()
}
function getComment(company: string): string {
  return tracker[company]?.comment ?? ''
}
function setComment(company: string, comment: string) {
  tracker[company] = { status: tracker[company]?.status ?? 'Not started', comment }
  persistTracker()
}
</script>

<template>
  <div class="tc-page">
    <nav class="tc-breadcrumb">
      <router-link to="/">Home</router-link>
      <i class="pi pi-angle-right"></i>
      <router-link to="/jobs">Jobs</router-link>
      <i class="pi pi-angle-right"></i>
      <span v-if="level">{{ levelInfo[level].label }} Target Companies &amp; Salary Bands in India</span>
      <span v-else>Target Companies &amp; Salary Bands in India</span>
    </nav>

    <div class="tc-hero">
      <span class="tc-badge">India · 2026<template v-if="level"> · {{ levelInfo[level].tierLabel }}</template></span>

      <h1 v-if="level" class="tc-h1">
        <em>{{ levelInfo[level].label }}</em> Salaries by Company
      </h1>
      <h1 v-else class="tc-h1">Software Engineer <span class="tc-accent">Salaries</span> in India</h1>

      <p class="tc-intro">
        <template v-if="level">
          Compensation across {{ targetCompanies.length }} companies in India for {{ levelInfo[level].label }}
          ({{ levelInfo[level].years }}), compiled from self-reported offers where available and editorial
          estimates elsewhere - the Evidence column shows which is which. Search, filter by location and
          category, and sort any column.
        </template>
        <template v-else>
          Total-compensation bands across {{ targetCompanies.length }} companies in India, broken down by
          level. Compiled from self-reported job-offer data where enough of it exists, backfilled with
          editorial estimates for companies with thin or no reports.
        </template>
      </p>

      <div class="tc-stats">
        <div class="tc-stat">
          <strong>{{ level ? formatLpa(levelInfo[level].typicalRange) : `${targetCompanies.length}` }}</strong>
          <span>{{ level ? 'Typical Range' : 'Companies' }}</span>
        </div>
        <div class="tc-stat">
          <strong>{{ level ? targetCompanies.length : companyCategories.length }}</strong>
          <span>{{ level ? 'Companies' : 'Categories' }}</span>
        </div>
        <div class="tc-stat">
          <strong>{{ level ? companyCategories.length : companyLocations.length }}</strong>
          <span>{{ level ? 'Categories' : 'Locations' }}</span>
        </div>
        <div class="tc-stat" v-if="!level">
          <strong>{{ formatLpaCompact(range.low) }}-{{ formatLpaCompact(range.high) }}</strong>
          <span>Range</span>
        </div>
      </div>

      <p v-if="level" class="tc-equiv"><strong>Equivalent titles:</strong> {{ levelInfo[level].equivalentTitles }}</p>

      <nav class="tc-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.to"
          type="button"
          class="tc-tab"
          :class="{ on: isActiveTab(tab.to) }"
          @click="goTo(tab.to)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- OVERVIEW -->
    <template v-if="!level">
      <div class="tc-levels">
        <a
          v-for="key in (['sde-1', 'sde-2', 'sde-3'] as Level[])"
          :key="key"
          class="tc-level"
          :style="{ borderTopColor: levelInfo[key].borderColor }"
          @click.prevent="goTo(`/jobs/target-companies/${key}`)"
        >
          <div class="tc-level-top">
            <span class="tc-level-badge">{{ levelInfo[key].label }}</span>
            <span class="tc-level-yrs">{{ levelInfo[key].years }}</span>
          </div>
          <div class="tc-level-range">{{ formatLpa(levelInfo[key].typicalRange) }}</div>
          <div class="tc-level-desc">{{ levelInfo[key].description }}</div>
          <span class="tc-level-go">Explore {{ levelInfo[key].label }} →</span>
        </a>
      </div>

      <h2 class="tc-section-title">Companies at a Glance</h2>
      <p class="tc-section-note">
        A sample of {{ previewCompanies.length }} companies sorted by senior-level (SDE-3) compensation. Open a
        level tab above for the full, filterable list of all {{ targetCompanies.length }} companies.
      </p>
      <table class="tc-preview-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>SDE-1</th>
            <th>SDE-2</th>
            <th>SDE-3</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in previewCompanies" :key="c.company">
            <td class="tc-preview-company">{{ c.company }}</td>
            <td>{{ formatLpa(c['sde-1']) }}</td>
            <td>{{ formatLpa(c['sde-2']) }}</td>
            <td>{{ formatLpa(c['sde-3']) }}</td>
            <td>
              <span v-if="c.reportCount === null" class="tc-est">est</span>
              <span v-else class="tc-reports" :class="{ 'tc-reports-strong': c.reportCount >= 6 }">{{ c.reportCount }} reports</span>
            </td>
          </tr>
        </tbody>
      </table>

      <Accordion style="margin-top: 2rem">
        <AccordionPanel value="methodology">
          <AccordionHeader>How This Data Is Built</AccordionHeader>
          <AccordionContent>
            <ol class="tc-method-list">
              <li>Bands are total compensation (base + annualised stock + target bonus) in INR LPA for India-based roles, drawn from self-reported job-offer data where a company has enough of it.</li>
              <li>The Evidence column shows the real report count backing a company's band (e.g. "48 reports"), or "est" when there isn't enough self-reported data yet and the band is an editorial estimate instead.</li>
              <li>Companies are grouped into 8 categories (FAANG, Product, Fintech, HFT, GCC, Enterprise, Startup, Services) that roughly track how differently each tier pays.</li>
              <li>Level titles aren't standardized across companies - bands are normalized onto SDE-1/2/3 by years of experience and scope, not by matching ladder codes literally.</li>
              <li>Re-reviewed periodically as more offer data becomes available - not live-synced to any single source.</li>
            </ol>
          </AccordionContent>
        </AccordionPanel>
        <AccordionPanel value="honesty">
          <AccordionHeader>Reading These Numbers Honestly</AccordionHeader>
          <AccordionContent>
            <ul class="tc-method-list">
              <li>Rows marked "est" have too few (or no) self-reported offers behind them - treat those as a starting point for research, not a quote. Rows with a reports count have real data behind them, though self-reported data skews high: people post after a good offer, rarely an average one.</li>
              <li>Total comp differs from take-home pay once you account for taxes, PF, and vesting schedules on equity - stock only lands if you stay through the vest.</li>
              <li>Level titles aren't standardized across companies - compare by years of experience and scope, not by matching ladder codes ("SDE-2", "L4", etc.) literally.</li>
              <li>Data leans toward large India tech hubs (Bengaluru, Hyderabad, Pune) and may not represent smaller cities or fully remote roles as precisely.</li>
              <li>Always confirm with the recruiter - these are estimates, not offers.</li>
            </ul>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </template>

    <!-- LEVEL PAGE -->
    <template v-else>
      <p class="tc-disclaimer">
        Compiled from self-reported job offers where enough exist, backfilled with editorial estimates
        otherwise - check the Evidence column per row. Data window as of 2026. Status/comment tracking below
        is saved only on this device, not synced to your account.
      </p>

      <div class="tc-filters-primary">
        <input v-model="searchQuery" type="text" class="tc-search" placeholder="Search company..." />
        <div class="tc-seg">
          <button
            v-for="cat in categoryFilters"
            :key="cat"
            type="button"
            :class="{ on: selectedCategory === cat }"
            @click="selectedCategory = cat"
          >
            {{ cat }}
          </button>
        </div>
      </div>

      <div class="tc-filters-secondary">
        <Select v-model="selectedLocation" :options="locationOptions" style="min-width: 160px" />
        <span class="tc-mincomp">
          min <input v-model.number="minComp" type="number" min="0" placeholder="0" class="tc-mincomp-input" /> LPA
        </span>
        <a href="#" class="tc-reset" @click.prevent="resetFilters">Reset filters</a>
      </div>

      <p class="tc-count">{{ filteredCompanies.length }} of {{ targetCompanies.length }} companies</p>

      <DataTable
        :value="filteredCompanies"
        stripedRows
        paginator
        :rows="10"
        size="small"
        :sortField="levelSortFieldMap[level]"
        :sortOrder="-1"
      >
        <Column field="company" header="Company" sortable style="min-width: 170px">
          <template #body="{ data }">
            <a :href="data.careersUrl" target="_blank" rel="noopener" class="tc-apply" :title="`Careers page for ${data.company} (opens in a new tab)`">
              {{ data.company }}<span class="tc-ext" aria-hidden="true">↗</span>
            </a>
          </template>
        </Column>
        <Column field="category" header="Category" sortable style="min-width: 120px">
          <template #body="{ data }"><span class="tc-cat">{{ data.category }}</span></template>
        </Column>
        <Column header="Location" sortable sortField="locations" style="min-width: 140px">
          <template #body="{ data }">{{ data.locations.join(', ') }}</template>
        </Column>
        <Column :field="levelSortFieldMap[level]" header="Est. Comp (LPA)" sortable style="min-width: 170px">
          <template #body="{ data }">
            <div class="tc-comp">
              {{ formatLpa(data[level]) }}
              <div class="tc-bar"><i :style="barStyle(data[level], level)"></i></div>
            </div>
          </template>
        </Column>
        <Column field="reportCount" header="Evidence" sortable style="min-width: 90px">
          <template #body="{ data }">
            <span v-if="data.reportCount === null" class="tc-est" title="Editorial estimate - no offer reports yet">est</span>
            <span
              v-else
              class="tc-reports"
              :class="{ 'tc-reports-strong': data.reportCount >= 6 }"
              :title="`${data.reportCount} real offer reports back this band`"
            >
              {{ data.reportCount }} reports
            </span>
          </template>
        </Column>
        <Column header="Status" style="min-width: 150px">
          <template #body="{ data }">
            <select
              class="tc-stsel"
              :value="getStatus(data.company)"
              @change="setStatus(data.company, ($event.target as HTMLSelectElement).value as ApplicationStatus)"
            >
              <option v-for="s in applicationStatuses" :key="s" :value="s">{{ s }}</option>
            </select>
          </template>
        </Column>
        <Column header="Comment" style="min-width: 160px">
          <template #body="{ data }">
            <input
              type="text"
              class="tc-cmt"
              placeholder="Add a note..."
              :value="getComment(data.company)"
              @input="setComment(data.company, ($event.target as HTMLInputElement).value)"
            />
          </template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.tc-page {
  --tc-accent: #818cf8;
  --tc-accent-bg: rgba(129, 140, 248, 0.12);
  max-width: 1150px;
}

.tc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #94a3b8);
  margin-bottom: 1.5rem;
}

.tc-breadcrumb a {
  color: var(--p-text-muted-color, #94a3b8);
  text-decoration: none;
}

.tc-breadcrumb a:hover {
  text-decoration: underline;
}

.tc-hero {
  text-align: center;
  max-width: 780px;
  margin: 0 auto 1.5rem;
}

.tc-badge {
  display: inline-block;
  background: var(--tc-accent-bg);
  color: var(--tc-accent);
  border: 1px solid rgba(129, 140, 248, 0.35);
  border-radius: 20px;
  padding: 0.3rem 0.9rem;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  margin-bottom: 1rem;
}

.tc-h1 {
  font-size: 2.2rem;
  margin-bottom: 0.75rem;
}

.tc-h1 em {
  font-style: normal;
  color: var(--tc-accent);
}

.tc-accent {
  color: var(--tc-accent);
}

.tc-intro {
  color: var(--p-text-muted-color, #cbd5e1);
  margin-bottom: 1.5rem;
}

.tc-stats {
  display: flex;
  justify-content: center;
  gap: 2.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.tc-stat {
  display: flex;
  flex-direction: column;
}

.tc-stat strong {
  font-size: 1.4rem;
  color: var(--tc-accent);
}

.tc-stat span {
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--p-text-muted-color, #94a3b8);
}

.tc-equiv {
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #94a3b8);
  margin-bottom: 1.25rem;
}

.tc-tabs {
  display: inline-flex;
  gap: 0.4rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 0.35rem;
}

.tc-tab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--tc-accent);
  border-radius: 9px;
  padding: 0.45rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.tc-tab.on {
  background: var(--tc-accent);
  color: #fff;
}

/* Overview: level cards */
.tc-levels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
  margin: 2rem 0;
}

.tc-level {
  display: block;
  border: 1px solid var(--p-content-border-color, #334155);
  border-top: 3px solid;
  border-radius: 10px;
  padding: 1.25rem;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.tc-level-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
}

.tc-level-badge {
  font-weight: 700;
  color: var(--tc-accent);
}

.tc-level-yrs {
  font-size: 0.75rem;
  color: var(--p-text-muted-color, #94a3b8);
}

.tc-level-range {
  font-weight: 700;
  color: var(--tc-accent);
  margin-bottom: 0.5rem;
}

.tc-level-desc {
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #cbd5e1);
  margin-bottom: 0.75rem;
}

.tc-level-go {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--tc-accent);
}

.tc-section-title {
  margin: 2rem 0 0.5rem;
}

.tc-section-note {
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 0.9rem;
  margin-bottom: 1rem;
  max-width: 75ch;
}

.tc-preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.tc-preview-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--p-content-border-color, #334155);
  color: var(--p-text-muted-color, #94a3b8);
  font-size: 0.75rem;
  text-transform: uppercase;
}

.tc-preview-table td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--p-content-border-color, #1e293b);
}

.tc-preview-company {
  font-weight: 600;
}

.tc-method-list {
  padding-left: 1.5rem;
  line-height: 1.9;
}

/* Level page filters */
.tc-disclaimer {
  font-size: 0.8rem;
  color: var(--p-text-muted-color, #94a3b8);
  max-width: 80ch;
  margin: 0 auto 1.5rem;
  text-align: center;
}

.tc-filters-primary {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.tc-search {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--p-content-border-color, #334155);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  color: inherit;
  min-width: 220px;
}

.tc-seg {
  display: inline-flex;
  flex-wrap: wrap;
  border: 1px solid var(--p-content-border-color, #334155);
  border-radius: 8px;
  overflow: hidden;
}

.tc-seg button {
  background: transparent;
  border: none;
  border-right: 1px solid var(--p-content-border-color, #334155);
  color: inherit;
  padding: 0.5rem 0.85rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.tc-seg button:last-child {
  border-right: none;
}

.tc-seg button.on {
  background: var(--tc-accent);
  color: #fff;
  font-weight: 600;
}

.tc-filters-secondary {
  display: flex;
  align-items: center;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.tc-mincomp {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.tc-mincomp-input {
  width: 70px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--p-content-border-color, #334155);
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  color: inherit;
}

.tc-reset {
  font-size: 0.85rem;
  color: var(--tc-accent);
  text-decoration: none;
}

.tc-reset:hover {
  text-decoration: underline;
}

.tc-count {
  text-align: center;
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #94a3b8);
  margin-bottom: 0.75rem;
}

.tc-apply {
  color: var(--tc-accent);
  text-decoration: none;
  font-weight: 600;
}

.tc-apply:hover {
  text-decoration: underline;
}

.tc-ext {
  margin-left: 0.2rem;
  font-size: 0.75rem;
}

.tc-cat {
  display: inline-block;
  background: var(--tc-accent-bg);
  color: var(--tc-accent);
  border-radius: 6px;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.tc-comp {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tc-bar {
  position: relative;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  width: 100%;
}

.tc-bar i {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 2px;
  background: var(--tc-accent);
  display: block;
}

.tc-est {
  display: inline-block;
  background: rgba(148, 163, 184, 0.15);
  color: var(--p-text-muted-color, #94a3b8);
  border-radius: 6px;
  padding: 0.1rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 600;
}

.tc-reports {
  display: inline-block;
  white-space: nowrap;
  background: rgba(148, 163, 184, 0.15);
  color: var(--p-text-muted-color, #94a3b8);
  border-radius: 6px;
  padding: 0.1rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 600;
}

.tc-reports-strong {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.tc-stsel {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--p-content-border-color, #334155);
  border-radius: 6px;
  padding: 0.35rem 0.4rem;
  color: inherit;
  font-size: 0.8rem;
}

.tc-cmt {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--p-content-border-color, #334155);
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  color: inherit;
  font-size: 0.8rem;
}
</style>

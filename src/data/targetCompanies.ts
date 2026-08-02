export type CompanyCategory = 'FAANG' | 'Product' | 'Fintech' | 'HFT' | 'GCC' | 'Enterprise' | 'Startup' | 'Services'

export type Level = 'sde-1' | 'sde-2' | 'sde-3'

export interface LpaRange {
  low: number
  high: number
}

export interface TargetCompany {
  company: string
  category: CompanyCategory
  locations: string[]
  careersUrl: string
  /** Real offer reports backing this company's bands, or null when it's a pure editorial estimate. */
  reportCount: number | null
  'sde-1': LpaRange
  'sde-2': LpaRange
  'sde-3': LpaRange
}

export interface LevelInfo {
  key: Level
  label: string
  shortLabel: string
  years: string
  tierLabel: string
  equivalentTitles: string
  typicalRange: LpaRange
  description: string
  borderColor: string
}

export const targetCompanies: TargetCompany[] = [
  // FAANG
  { company: 'Netflix', category: 'FAANG', locations: ['Mumbai'], careersUrl: 'https://jobs.netflix.com', reportCount: null, 'sde-1': { low: 40, high: 60 }, 'sde-2': { low: 60, high: 100 }, 'sde-3': { low: 100, high: 160 } },
  { company: 'Meta', category: 'FAANG', locations: ['Bengaluru'], careersUrl: 'https://metacareers.com', reportCount: null, 'sde-1': { low: 35, high: 55 }, 'sde-2': { low: 50, high: 85 }, 'sde-3': { low: 80, high: 130 } },
  { company: 'LinkedIn', category: 'FAANG', locations: ['Bengaluru'], careersUrl: 'https://careers.linkedin.com', reportCount: 10, 'sde-1': { low: 35, high: 54 }, 'sde-2': { low: 53, high: 80 }, 'sde-3': { low: 78, high: 93 } },
  { company: 'Apple', category: 'FAANG', locations: ['Bengaluru', 'Hyderabad'], careersUrl: 'https://apple.com/careers', reportCount: null, 'sde-1': { low: 30, high: 48 }, 'sde-2': { low: 45, high: 70 }, 'sde-3': { low: 70, high: 110 } },
  { company: 'Amazon', category: 'FAANG', locations: ['Bengaluru', 'Gurgaon', 'Hyderabad', 'Chennai'], careersUrl: 'https://amazon.jobs', reportCount: 48, 'sde-1': { low: 24, high: 40 }, 'sde-2': { low: 44, high: 57 }, 'sde-3': { low: 63, high: 92 } },
  { company: 'Microsoft', category: 'FAANG', locations: ['Noida', 'Bengaluru', 'Hyderabad'], careersUrl: 'https://careers.microsoft.com', reportCount: 139, 'sde-1': { low: 32, high: 40 }, 'sde-2': { low: 40, high: 54 }, 'sde-3': { low: 65, high: 110 } },
  { company: 'Google', category: 'FAANG', locations: ['Bengaluru', 'Gurgaon', 'Hyderabad'], careersUrl: 'https://careers.google.com', reportCount: 98, 'sde-1': { low: 22, high: 36 }, 'sde-2': { low: 41, high: 57 }, 'sde-3': { low: 60, high: 107 } },
  // Product
  { company: 'Figma', category: 'Product', locations: ['Remote'], careersUrl: 'https://figma.com/careers', reportCount: null, 'sde-1': { low: 40, high: 62 }, 'sde-2': { low: 60, high: 95 }, 'sde-3': { low: 90, high: 140 } },
  { company: 'Wayfair', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://wayfair.com/careers', reportCount: 13, 'sde-1': { low: 46, high: 62 }, 'sde-2': { low: 62, high: 81 }, 'sde-3': { low: 66, high: 81 } },
  { company: 'Databricks', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://databricks.com/company/careers', reportCount: null, 'sde-1': { low: 40, high: 60 }, 'sde-2': { low: 55, high: 85 }, 'sde-3': { low: 90, high: 140 } },
  { company: 'Notion', category: 'Product', locations: ['Remote'], careersUrl: 'https://notion.so/careers', reportCount: null, 'sde-1': { low: 38, high: 58 }, 'sde-2': { low: 58, high: 90 }, 'sde-3': { low: 85, high: 130 } },
  { company: 'Vercel', category: 'Product', locations: ['Remote'], careersUrl: 'https://vercel.com/careers', reportCount: null, 'sde-1': { low: 35, high: 58 }, 'sde-2': { low: 55, high: 88 }, 'sde-3': { low: 85, high: 130 } },
  { company: 'Snowflake', category: 'Product', locations: ['Pune'], careersUrl: 'https://snowflake.com/careers', reportCount: null, 'sde-1': { low: 35, high: 55 }, 'sde-2': { low: 55, high: 85 }, 'sde-3': { low: 85, high: 125 } },
  { company: 'Airbnb', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://careers.airbnb.com', reportCount: null, 'sde-1': { low: 35, high: 55 }, 'sde-2': { low: 55, high: 85 }, 'sde-3': { low: 85, high: 125 } },
  { company: 'Rubrik', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://rubrik.com/company/careers', reportCount: null, 'sde-1': { low: 35, high: 55 }, 'sde-2': { low: 50, high: 85 }, 'sde-3': { low: 80, high: 120 } },
  { company: 'Canva', category: 'Product', locations: ['Remote'], careersUrl: 'https://lifeatcanva.com', reportCount: null, 'sde-1': { low: 35, high: 55 }, 'sde-2': { low: 55, high: 85 }, 'sde-3': { low: 82, high: 125 } },
  { company: 'Datadog', category: 'Product', locations: ['Remote'], careersUrl: 'https://careers.datadoghq.com', reportCount: null, 'sde-1': { low: 35, high: 55 }, 'sde-2': { low: 55, high: 85 }, 'sde-3': { low: 82, high: 120 } },
  { company: 'HashiCorp', category: 'Product', locations: ['Remote', 'Bengaluru'], careersUrl: 'https://hashicorp.com/careers', reportCount: null, 'sde-1': { low: 32, high: 50 }, 'sde-2': { low: 50, high: 80 }, 'sde-3': { low: 80, high: 115 } },
  { company: 'GitLab', category: 'Product', locations: ['Remote'], careersUrl: 'https://about.gitlab.com/jobs', reportCount: null, 'sde-1': { low: 30, high: 50 }, 'sde-2': { low: 50, high: 80 }, 'sde-3': { low: 80, high: 115 } },
  { company: 'Atlassian', category: 'Product', locations: ['Bengaluru', 'Remote'], careersUrl: 'https://atlassian.com/company/careers', reportCount: 15, 'sde-1': { low: 31, high: 50 }, 'sde-2': { low: 56, high: 78 }, 'sde-3': { low: 82, high: 114 } },
  { company: 'Coupang', category: 'Product', locations: ['Remote'], careersUrl: 'https://coupang.jobs', reportCount: null, 'sde-1': { low: 30, high: 50 }, 'sde-2': { low: 50, high: 78 }, 'sde-3': { low: 75, high: 112 } },
  { company: 'Uber', category: 'Product', locations: ['Bengaluru', 'Hyderabad'], careersUrl: 'https://uber.com/careers', reportCount: 9, 'sde-1': { low: 32, high: 50 }, 'sde-2': { low: 46, high: 64 }, 'sde-3': { low: 86, high: 136 } },
  { company: 'Confluent', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://confluent.io/careers', reportCount: 5, 'sde-1': { low: 32, high: 49 }, 'sde-2': { low: 49, high: 76 }, 'sde-3': { low: 70, high: 102 } },
  { company: 'Nvidia', category: 'Product', locations: ['Bengaluru', 'Pune', 'Hyderabad'], careersUrl: 'https://nvidia.com/careers', reportCount: null, 'sde-1': { low: 30, high: 48 }, 'sde-2': { low: 45, high: 75 }, 'sde-3': { low: 70, high: 110 } },
  { company: 'Cloudflare', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://cloudflare.com/careers', reportCount: null, 'sde-1': { low: 30, high: 48 }, 'sde-2': { low: 48, high: 75 }, 'sde-3': { low: 75, high: 110 } },
  { company: 'MongoDB', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://mongodb.com/careers', reportCount: null, 'sde-1': { low: 30, high: 48 }, 'sde-2': { low: 48, high: 72 }, 'sde-3': { low: 72, high: 105 } },
  { company: 'Arista Networks', category: 'Product', locations: ['Bengaluru', 'Pune'], careersUrl: 'https://arista.com/careers', reportCount: 12, 'sde-1': { low: 28, high: 47 }, 'sde-2': { low: 33, high: 52 }, 'sde-3': { low: 69, high: 99 } },
  { company: 'Palo Alto Networks', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://paloaltonetworks.com/careers', reportCount: null, 'sde-1': { low: 28, high: 45 }, 'sde-2': { low: 45, high: 72 }, 'sde-3': { low: 72, high: 105 } },
  { company: 'CrowdStrike', category: 'Product', locations: ['Bengaluru', 'Pune'], careersUrl: 'https://crowdstrike.com/careers', reportCount: null, 'sde-1': { low: 28, high: 45 }, 'sde-2': { low: 45, high: 72 }, 'sde-3': { low: 70, high: 105 } },
  { company: 'Twilio', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://twilio.com/careers', reportCount: null, 'sde-1': { low: 28, high: 45 }, 'sde-2': { low: 45, high: 70 }, 'sde-3': { low: 70, high: 100 } },
  { company: 'Booking.com', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://careers.booking.com', reportCount: null, 'sde-1': { low: 28, high: 45 }, 'sde-2': { low: 45, high: 70 }, 'sde-3': { low: 70, high: 100 } },
  { company: 'Postman', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://postman.com/company/careers', reportCount: null, 'sde-1': { low: 28, high: 45 }, 'sde-2': { low: 45, high: 70 }, 'sde-3': { low: 70, high: 100 } },
  { company: 'Media.net', category: 'Product', locations: ['Mumbai', 'Bengaluru'], careersUrl: 'https://media.net/careers', reportCount: null, 'sde-1': { low: 25, high: 45 }, 'sde-2': { low: 40, high: 70 }, 'sde-3': { low: 65, high: 100 } },
  { company: 'Cohesity', category: 'Product', locations: ['Bengaluru', 'Pune'], careersUrl: 'https://cohesity.com/careers', reportCount: null, 'sde-1': { low: 28, high: 45 }, 'sde-2': { low: 45, high: 70 }, 'sde-3': { low: 70, high: 100 } },
  { company: 'Splunk', category: 'Product', locations: ['Hyderabad'], careersUrl: 'https://splunk.com/careers', reportCount: null, 'sde-1': { low: 28, high: 45 }, 'sde-2': { low: 45, high: 70 }, 'sde-3': { low: 68, high: 100 } },
  { company: 'Elastic', category: 'Product', locations: ['Remote', 'Bengaluru'], careersUrl: 'https://elastic.co/careers', reportCount: null, 'sde-1': { low: 28, high: 45 }, 'sde-2': { low: 45, high: 70 }, 'sde-3': { low: 68, high: 100 } },
  { company: 'Dream11', category: 'Product', locations: ['Mumbai'], careersUrl: 'https://dream11.com/careers', reportCount: 6, 'sde-1': { low: 28, high: 45 }, 'sde-2': { low: 49, high: 69 }, 'sde-3': { low: 67, high: 100 } },
  { company: 'Intuit', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://jobs.intuit.com', reportCount: 11, 'sde-1': { low: 29, high: 45 }, 'sde-2': { low: 39, high: 47 }, 'sde-3': { low: 72, high: 103 } },
  { company: 'Salesforce (MuleSoft)', category: 'Product', locations: ['Bengaluru', 'Hyderabad'], careersUrl: 'https://salesforce.com/company/careers', reportCount: null, 'sde-1': { low: 26, high: 42 }, 'sde-2': { low: 45, high: 72 }, 'sde-3': { low: 70, high: 105 } },
  { company: 'Disney+ Hotstar', category: 'Product', locations: ['Bengaluru', 'Mumbai'], careersUrl: 'https://hotstar.com/careers', reportCount: null, 'sde-1': { low: 24, high: 42 }, 'sde-2': { low: 42, high: 68 }, 'sde-3': { low: 65, high: 98 } },
  { company: 'Adobe', category: 'Product', locations: ['Noida', 'Bengaluru'], careersUrl: 'https://adobe.com/careers', reportCount: null, 'sde-1': { low: 26, high: 42 }, 'sde-2': { low: 42, high: 66 }, 'sde-3': { low: 66, high: 105 } },
  { company: 'HubSpot', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://hubspot.com/careers', reportCount: null, 'sde-1': { low: 26, high: 42 }, 'sde-2': { low: 42, high: 66 }, 'sde-3': { low: 64, high: 95 } },
  { company: 'Workday', category: 'Product', locations: ['Pune'], careersUrl: 'https://workday.com/careers', reportCount: null, 'sde-1': { low: 25, high: 42 }, 'sde-2': { low: 42, high: 65 }, 'sde-3': { low: 65, high: 95 } },
  { company: 'Zscaler', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://zscaler.com/careers', reportCount: null, 'sde-1': { low: 26, high: 42 }, 'sde-2': { low: 40, high: 65 }, 'sde-3': { low: 65, high: 95 } },
  { company: 'Games24x7', category: 'Product', locations: ['Bengaluru', 'Mumbai'], careersUrl: 'https://games24x7.com/careers', reportCount: null, 'sde-1': { low: 24, high: 42 }, 'sde-2': { low: 40, high: 65 }, 'sde-3': { low: 60, high: 90 } },
  { company: 'ThoughtSpot', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://thoughtspot.com/careers', reportCount: null, 'sde-1': { low: 25, high: 42 }, 'sde-2': { low: 40, high: 65 }, 'sde-3': { low: 65, high: 95 } },
  { company: 'Juniper Networks', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://juniper.net/careers', reportCount: null, 'sde-1': { low: 26, high: 42 }, 'sde-2': { low: 42, high: 65 }, 'sde-3': { low: 62, high: 92 } },
  { company: 'Zoom', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://careers.zoom.us', reportCount: null, 'sde-1': { low: 26, high: 42 }, 'sde-2': { low: 42, high: 65 }, 'sde-3': { low: 62, high: 92 } },
  { company: 'Gameskraft', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://gameskraft.com/careers', reportCount: null, 'sde-1': { low: 24, high: 42 }, 'sde-2': { low: 40, high: 65 }, 'sde-3': { low: 62, high: 92 } },
  { company: 'Harness', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://harness.io/company/careers', reportCount: null, 'sde-1': { low: 24, high: 42 }, 'sde-2': { low: 40, high: 65 }, 'sde-3': { low: 62, high: 92 } },
  { company: 'DigitalOcean', category: 'Product', locations: ['Hyderabad', 'Bengaluru'], careersUrl: 'https://digitalocean.com/careers', reportCount: null, 'sde-1': { low: 26, high: 42 }, 'sde-2': { low: 42, high: 65 }, 'sde-3': { low: 62, high: 92 } },
  { company: 'Nutanix', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://nutanix.com/careers', reportCount: 5, 'sde-1': { low: 26, high: 42 }, 'sde-2': { low: 38, high: 59 }, 'sde-3': { low: 53, high: 77 } },
  { company: 'ServiceNow', category: 'Product', locations: ['Hyderabad', 'Bengaluru'], careersUrl: 'https://servicenow.com/careers', reportCount: 19, 'sde-1': { low: 26, high: 41 }, 'sde-2': { low: 26, high: 45 }, 'sde-3': { low: 37, high: 57 } },
  { company: 'Akamai', category: 'Product', locations: ['Bengaluru', 'Chennai'], careersUrl: 'https://akamai.com/careers', reportCount: null, 'sde-1': { low: 24, high: 40 }, 'sde-2': { low: 40, high: 62 }, 'sde-3': { low: 60, high: 90 } },
  { company: 'Arm', category: 'Product', locations: ['Bengaluru', 'Noida'], careersUrl: 'https://arm.com/careers', reportCount: null, 'sde-1': { low: 24, high: 40 }, 'sde-2': { low: 40, high: 62 }, 'sde-3': { low: 60, high: 88 } },
  { company: 'Autodesk', category: 'Product', locations: ['Bengaluru', 'Pune'], careersUrl: 'https://autodesk.com/careers', reportCount: null, 'sde-1': { low: 24, high: 40 }, 'sde-2': { low: 40, high: 62 }, 'sde-3': { low: 60, high: 88 } },
  { company: 'BrowserStack', category: 'Product', locations: ['Mumbai'], careersUrl: 'https://browserstack.com/careers', reportCount: null, 'sde-1': { low: 22, high: 40 }, 'sde-2': { low: 38, high: 60 }, 'sde-3': { low: 58, high: 88 } },
  { company: 'MPL', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://mpl.live/careers', reportCount: null, 'sde-1': { low: 22, high: 40 }, 'sde-2': { low: 38, high: 60 }, 'sde-3': { low: 58, high: 88 } },
  { company: 'Hasura', category: 'Product', locations: ['Bengaluru', 'Remote'], careersUrl: 'https://hasura.io/careers', reportCount: null, 'sde-1': { low: 22, high: 40 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 58, high: 85 } },
  { company: 'Wingify', category: 'Product', locations: ['Delhi'], careersUrl: 'https://wingify.com/careers', reportCount: null, 'sde-1': { low: 22, high: 40 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 56, high: 84 } },
  { company: 'ShareChat', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://sharechat.com/careers', reportCount: null, 'sde-1': { low: 22, high: 40 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 55, high: 82 } },
  { company: 'Sprinklr', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://sprinklr.com/careers', reportCount: null, 'sde-1': { low: 22, high: 40 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 55, high: 82 } },
  { company: 'Rippling', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://rippling.com/careers', reportCount: 7, 'sde-1': { low: 31, high: 39 }, 'sde-2': { low: 47, high: 60 }, 'sde-3': { low: 94, high: 130 } },
  { company: 'AMD', category: 'Product', locations: ['Bengaluru', 'Hyderabad'], careersUrl: 'https://amd.com/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 58, high: 85 } },
  { company: 'Meesho', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://meesho.io/jobs', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 55, high: 85 } },
  { company: 'Fortinet', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://fortinet.com/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 36, high: 58 }, 'sde-3': { low: 56, high: 85 } },
  { company: 'Texas Instruments', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://careers.ti.com', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 56, high: 82 } },
  { company: 'Marvell', category: 'Product', locations: ['Pune', 'Bengaluru', 'Hyderabad'], careersUrl: 'https://marvell.com/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 56, high: 84 } },
  { company: 'Atlan', category: 'Product', locations: ['Remote', 'Delhi'], careersUrl: 'https://atlan.com/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 56, high: 84 } },
  { company: 'Observe.AI', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://observe.ai/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 36, high: 58 }, 'sde-3': { low: 56, high: 84 } },
  { company: 'JFrog', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://jfrog.com/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 36, high: 58 }, 'sde-3': { low: 56, high: 84 } },
  { company: 'Dynatrace', category: 'Product', locations: ['Pune', 'Bengaluru'], careersUrl: 'https://careers.dynatrace.com', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 56, high: 84 } },
  { company: 'Intel', category: 'Product', locations: ['Bengaluru', 'Hyderabad'], careersUrl: 'https://intel.com/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 36, high: 55 }, 'sde-3': { low: 55, high: 82 } },
  { company: 'Tekion', category: 'Product', locations: ['Bengaluru', 'Chennai'], careersUrl: 'https://tekion.com/careers', reportCount: 8, 'sde-1': { low: 20, high: 37 }, 'sde-2': { low: 32, high: 57 }, 'sde-3': { low: 47, high: 84 } },
  { company: 'Expedia Group', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://careers.expediagroup.com', reportCount: 10, 'sde-1': { low: 23, high: 37 }, 'sde-2': { low: 25, high: 41 }, 'sde-3': { low: 46, high: 66 } },
  { company: 'Urban Company', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://urbancompany.com/careers', reportCount: null, 'sde-1': { low: 20, high: 36 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 50, high: 78 } },
  { company: 'Druva', category: 'Product', locations: ['Pune'], careersUrl: 'https://druva.com/careers', reportCount: null, 'sde-1': { low: 20, high: 36 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 55, high: 82 } },
  { company: 'Swiggy', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://careers.swiggy.com', reportCount: 4, 'sde-1': { low: 22, high: 36 }, 'sde-2': { low: 32, high: 50 }, 'sde-3': { low: 53, high: 81 } },
  { company: 'Micron', category: 'Product', locations: ['Hyderabad', 'Bengaluru'], careersUrl: 'https://micron.com/careers', reportCount: null, 'sde-1': { low: 20, high: 35 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 54, high: 80 } },
  { company: 'Gainsight', category: 'Product', locations: ['Hyderabad', 'Bengaluru'], careersUrl: 'https://gainsight.com/careers', reportCount: null, 'sde-1': { low: 20, high: 35 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 52, high: 78 } },
  { company: 'Trellix', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://trellix.com/careers', reportCount: null, 'sde-1': { low: 20, high: 35 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 52, high: 78 } },
  { company: 'Ola', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://olacabs.com/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 48, high: 75 } },
  { company: 'Innovaccer', category: 'Product', locations: ['Noida'], careersUrl: 'https://innovaccer.com/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 52, high: 78 } },
  { company: 'Whatfix', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://whatfix.com/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 52, high: 78 } },
  { company: 'Agoda', category: 'Product', locations: ['Gurgaon', 'Bengaluru'], careersUrl: 'https://careers.agoda.com', reportCount: 9, 'sde-1': { low: 24, high: 34 }, 'sde-2': { low: 37, high: 52 }, 'sde-3': { low: 55, high: 77 } },
  { company: 'Western Digital', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://westerndigital.com/company/careers', reportCount: null, 'sde-1': { low: 20, high: 34 }, 'sde-2': { low: 34, high: 52 }, 'sde-3': { low: 52, high: 76 } },
  { company: 'MediaTek', category: 'Product', locations: ['Noida', 'Bengaluru'], careersUrl: 'https://mediatek.com/careers', reportCount: null, 'sde-1': { low: 20, high: 34 }, 'sde-2': { low: 34, high: 52 }, 'sde-3': { low: 52, high: 76 } },
  { company: 'Uniphore', category: 'Product', locations: ['Chennai', 'Bengaluru'], careersUrl: 'https://uniphore.com/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'Qualcomm', category: 'Product', locations: ['Bengaluru', 'Hyderabad'], careersUrl: 'https://qualcomm.com/careers', reportCount: 13, 'sde-1': { low: 21, high: 33 }, 'sde-2': { low: 37, high: 55 }, 'sde-3': { low: 39, high: 61 } },
  { company: 'Zomato', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://zomato.com/careers', reportCount: 5, 'sde-1': { low: 20, high: 32 }, 'sde-2': { low: 34, high: 54 }, 'sde-3': { low: 49, high: 78 } },
  { company: 'Freshworks', category: 'Product', locations: ['Chennai', 'Hyderabad'], careersUrl: 'https://freshworks.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 52, high: 78 } },
  { company: 'Samsung R&D', category: 'Product', locations: ['Bengaluru', 'Noida'], careersUrl: 'https://samsung.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'MakeMyTrip', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://careers.makemytrip.com', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'MoEngage', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://moengage.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 32, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'CleverTap', category: 'Product', locations: ['Mumbai', 'Bengaluru'], careersUrl: 'https://clevertap.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 32, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'Yellow.ai', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://yellow.ai/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'Qualys', category: 'Product', locations: ['Pune'], careersUrl: 'https://qualys.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 32, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'Flipkart', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://flipkartcareers.com', reportCount: 29, 'sde-1': { low: 19, high: 32 }, 'sde-2': { low: 27, high: 38 }, 'sde-3': { low: 48, high: 77 } },
  { company: 'Nykaa', category: 'Product', locations: ['Mumbai'], careersUrl: 'https://nykaa.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 48 }, 'sde-3': { low: 45, high: 70 } },
  { company: 'Lenskart', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://lenskart.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 48 }, 'sde-3': { low: 45, high: 70 } },
  { company: 'Blinkit', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://blinkit.com/careers', reportCount: 9, 'sde-1': { low: 22, high: 30 }, 'sde-2': { low: 32, high: 48 }, 'sde-3': { low: 50, high: 74 } },
  { company: 'Icertis', category: 'Product', locations: ['Pune'], careersUrl: 'https://icertis.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 30, high: 48 }, 'sde-3': { low: 46, high: 70 } },
  { company: 'Tata 1mg', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://1mg.com/jobs', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 48 }, 'sde-3': { low: 46, high: 70 } },
  { company: 'Cult.fit', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://cult.fit/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 48 }, 'sde-3': { low: 46, high: 70 } },
  { company: 'OYO', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://oyorooms.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 48 }, 'sde-3': { low: 46, high: 70 } },
  { company: 'BigBasket', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://bigbasket.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 46 }, 'sde-3': { low: 44, high: 68 } },
  { company: 'Okta', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://okta.com/company/careers', reportCount: 6, 'sde-1': { low: 25, high: 30 }, 'sde-2': { low: 38, high: 46 }, 'sde-3': { low: 56, high: 69 } },
  { company: 'Darwinbox', category: 'Product', locations: ['Hyderabad'], careersUrl: 'https://darwinbox.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 46 }, 'sde-3': { low: 45, high: 68 } },
  { company: 'Cvent', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://careers.cvent.com', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 45 }, 'sde-3': { low: 45, high: 68 } },
  { company: 'ixigo', category: 'Product', locations: ['Gurgaon'], careersUrl: 'https://ixigo.com/careers', reportCount: null, 'sde-1': { low: 14, high: 28 }, 'sde-2': { low: 26, high: 44 }, 'sde-3': { low: 42, high: 64 } },
  { company: 'Chargebee', category: 'Product', locations: ['Chennai'], careersUrl: 'https://chargebee.com/careers', reportCount: 3, 'sde-1': { low: 17, high: 27 }, 'sde-2': { low: 31, high: 48 }, 'sde-3': { low: 48, high: 71 } },
  { company: 'Safe Security', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://safe.security/careers', reportCount: 3, 'sde-1': { low: 19, high: 27 }, 'sde-2': { low: 29, high: 41 }, 'sde-3': { low: 44, high: 60 } },
  { company: 'Salesforce', category: 'Product', locations: ['Bengaluru', 'Hyderabad'], careersUrl: 'https://salesforce.com/company/careers', reportCount: 38, 'sde-1': { low: 22, high: 26 }, 'sde-2': { low: 42, high: 59 }, 'sde-3': { low: 63, high: 80 } },
  { company: 'HighRadius', category: 'Product', locations: ['Hyderabad', 'Bhubaneswar'], careersUrl: 'https://highradius.com/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 40, high: 60 } },
  { company: 'Info Edge (Naukri)', category: 'Product', locations: ['Noida'], careersUrl: 'https://infoedge.in/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 42, high: 62 } },
  { company: 'New Relic', category: 'Product', locations: ['Hyderabad'], careersUrl: 'https://newrelic.com/about/careers', reportCount: 6, 'sde-1': { low: 19, high: 26 }, 'sde-2': { low: 29, high: 40 }, 'sde-3': { low: 42, high: 59 } },
  { company: 'Myntra', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://careers.myntra.com', reportCount: 6, 'sde-1': { low: 16, high: 25 }, 'sde-2': { low: 24, high: 39 }, 'sde-3': { low: 36, high: 57 } },
  { company: 'Zoho', category: 'Product', locations: ['Chennai'], careersUrl: 'https://zoho.com/careers', reportCount: null, 'sde-1': { low: 12, high: 24 }, 'sde-2': { low: 22, high: 38 }, 'sde-3': { low: 38, high: 58 } },
  { company: 'NetApp', category: 'Product', locations: ['Bengaluru'], careersUrl: 'https://netapp.com/careers', reportCount: 4, 'sde-1': { low: 14, high: 18 }, 'sde-2': { low: 21, high: 28 }, 'sde-3': { low: 31, high: 42 } },
  { company: 'Synopsys', category: 'Product', locations: ['Bengaluru', 'Noida', 'Hyderabad'], careersUrl: 'https://synopsys.com/careers', reportCount: 5, 'sde-1': { low: 11, high: 16 }, 'sde-2': { low: 18, high: 24 }, 'sde-3': { low: 26, high: 36 } },
  // Fintech
  { company: 'Stripe', category: 'Fintech', locations: ['Bengaluru', 'Remote'], careersUrl: 'https://stripe.com/jobs', reportCount: null, 'sde-1': { low: 38, high: 58 }, 'sde-2': { low: 55, high: 85 }, 'sde-3': { low: 80, high: 130 } },
  { company: 'Coinbase', category: 'Fintech', locations: ['Remote'], careersUrl: 'https://coinbase.com/careers', reportCount: 7, 'sde-1': { low: 37, high: 56 }, 'sde-2': { low: 55, high: 84 }, 'sde-3': { low: 58, high: 92 } },
  { company: 'Juspay', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://juspay.in/careers', reportCount: null, 'sde-1': { low: 22, high: 40 }, 'sde-2': { low: 38, high: 60 }, 'sde-3': { low: 58, high: 88 } },
  { company: 'PhonePe', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://phonepe.com/careers', reportCount: 15, 'sde-1': { low: 27, high: 39 }, 'sde-2': { low: 43, high: 54 }, 'sde-3': { low: 51, high: 118 } },
  { company: 'CRED', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://careers.cred.club', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 45, high: 70 }, 'sde-3': { low: 60, high: 90 } },
  { company: 'Groww', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://groww.in/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 50, high: 78 } },
  { company: 'Navi', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://navi.com/careers', reportCount: null, 'sde-1': { low: 20, high: 36 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 50, high: 78 } },
  { company: 'Upstox', category: 'Fintech', locations: ['Mumbai'], careersUrl: 'https://upstox.com/careers', reportCount: null, 'sde-1': { low: 20, high: 36 }, 'sde-2': { low: 34, high: 55 }, 'sde-3': { low: 52, high: 80 } },
  { company: 'Fi Money', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://fi.money/careers', reportCount: null, 'sde-1': { low: 20, high: 36 }, 'sde-2': { low: 34, high: 54 }, 'sde-3': { low: 52, high: 78 } },
  { company: 'smallcase', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://smallcase.com/careers', reportCount: null, 'sde-1': { low: 20, high: 36 }, 'sde-2': { low: 34, high: 54 }, 'sde-3': { low: 52, high: 78 } },
  { company: 'Setu', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://setu.co/careers', reportCount: null, 'sde-1': { low: 20, high: 36 }, 'sde-2': { low: 34, high: 54 }, 'sde-3': { low: 52, high: 78 } },
  { company: 'slice', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://sliceit.com/careers', reportCount: null, 'sde-1': { low: 20, high: 36 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'Jupiter', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://jupiter.money/careers', reportCount: null, 'sde-1': { low: 20, high: 36 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'Zeta', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://zeta.tech/careers', reportCount: 4, 'sde-1': { low: 21, high: 36 }, 'sde-2': { low: 32, high: 45 }, 'sde-3': { low: 53, high: 77 } },
  { company: 'Mastercard', category: 'Fintech', locations: ['Pune', 'Gurgaon'], careersUrl: 'https://mastercard.com/careers', reportCount: 6, 'sde-1': { low: 22, high: 36 }, 'sde-2': { low: 26, high: 40 }, 'sde-3': { low: 57, high: 82 } },
  { company: 'Zerodha', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://zerodha.com/careers', reportCount: null, 'sde-1': { low: 20, high: 35 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'PayPal', category: 'Fintech', locations: ['Bengaluru', 'Chennai'], careersUrl: 'https://paypal.com/careers', reportCount: 14, 'sde-1': { low: 21, high: 35 }, 'sde-2': { low: 23, high: 38 }, 'sde-3': { low: 34, high: 47 } },
  { company: 'Angel One', category: 'Fintech', locations: ['Mumbai', 'Bengaluru'], careersUrl: 'https://angelone.in/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'INDmoney', category: 'Fintech', locations: ['Gurgaon'], careersUrl: 'https://indmoney.com/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'Acko', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://acko.com/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'American Express', category: 'Fintech', locations: ['Gurgaon', 'Bengaluru'], careersUrl: 'https://aexp.com/careers', reportCount: 6, 'sde-1': { low: 20, high: 34 }, 'sde-2': { low: 24, high: 34 }, 'sde-3': { low: 50, high: 74 } },
  { company: 'Pine Labs', category: 'Fintech', locations: ['Noida'], careersUrl: 'https://pinelabs.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'BharatPe', category: 'Fintech', locations: ['Gurgaon', 'Bengaluru'], careersUrl: 'https://bharatpe.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'ClearTax', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://cleartax.in/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'Cashfree', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://cashfree.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'PolicyBazaar', category: 'Fintech', locations: ['Gurgaon'], careersUrl: 'https://policybazaar.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 26, high: 45 }, 'sde-3': { low: 42, high: 66 } },
  { company: 'CoinDCX', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://coindcx.com/careers', reportCount: 5, 'sde-1': { low: 23, high: 28 }, 'sde-2': { low: 35, high: 44 }, 'sde-3': { low: 52, high: 65 } },
  { company: 'Go Digit', category: 'Fintech', locations: ['Pune', 'Bengaluru'], careersUrl: 'https://godigit.com/careers', reportCount: null, 'sde-1': { low: 14, high: 28 }, 'sde-2': { low: 26, high: 44 }, 'sde-3': { low: 42, high: 64 } },
  { company: 'MobiKwik', category: 'Fintech', locations: ['Gurgaon'], careersUrl: 'https://mobikwik.com/careers', reportCount: null, 'sde-1': { low: 14, high: 28 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 40, high: 62 } },
  { company: 'Razorpay', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://razorpay.com/careers', reportCount: 10, 'sde-1': { low: 16, high: 28 }, 'sde-2': { low: 20, high: 29 }, 'sde-3': { low: 40, high: 62 } },
  { company: 'Visa', category: 'Fintech', locations: ['Bengaluru'], careersUrl: 'https://visa.com/careers', reportCount: 16, 'sde-1': { low: 17, high: 24 }, 'sde-2': { low: 30, high: 44 }, 'sde-3': { low: 32, high: 44 } },
  { company: 'Paytm', category: 'Fintech', locations: ['Noida', 'Bengaluru'], careersUrl: 'https://paytm.com/careers', reportCount: 5, 'sde-1': { low: 13, high: 23 }, 'sde-2': { low: 28, high: 45 }, 'sde-3': { low: 38, high: 59 } },
  { company: 'M2P Fintech', category: 'Fintech', locations: ['Chennai', 'Bengaluru'], careersUrl: 'https://m2pfintech.com/careers', reportCount: 6, 'sde-1': { low: 14, high: 17 }, 'sde-2': { low: 22, high: 27 }, 'sde-3': { low: 34, high: 47 } },
  // HFT
  { company: 'Jane Street', category: 'HFT', locations: ['Remote'], careersUrl: 'https://janestreet.com/join-jane-street', reportCount: null, 'sde-1': { low: 60, high: 95 }, 'sde-2': { low: 95, high: 150 }, 'sde-3': { low: 140, high: 220 } },
  { company: 'Citadel', category: 'HFT', locations: ['Remote'], careersUrl: 'https://citadel.com/careers', reportCount: null, 'sde-1': { low: 55, high: 90 }, 'sde-2': { low: 90, high: 140 }, 'sde-3': { low: 130, high: 200 } },
  { company: 'Hudson River Trading', category: 'HFT', locations: ['Remote'], careersUrl: 'https://hudsonrivertrading.com/careers', reportCount: null, 'sde-1': { low: 50, high: 85 }, 'sde-2': { low: 85, high: 135 }, 'sde-3': { low: 125, high: 190 } },
  { company: 'Two Sigma', category: 'HFT', locations: ['Remote'], careersUrl: 'https://twosigma.com/careers', reportCount: null, 'sde-1': { low: 45, high: 75 }, 'sde-2': { low: 75, high: 120 }, 'sde-3': { low: 110, high: 170 } },
  { company: 'Optiver', category: 'HFT', locations: ['Mumbai'], careersUrl: 'https://optiver.com/careers', reportCount: null, 'sde-1': { low: 40, high: 70 }, 'sde-2': { low: 65, high: 110 }, 'sde-3': { low: 100, high: 160 } },
  { company: 'Susquehanna (SIG)', category: 'HFT', locations: ['Bengaluru'], careersUrl: 'https://sig.com/careers', reportCount: null, 'sde-1': { low: 40, high: 68 }, 'sde-2': { low: 65, high: 105 }, 'sde-3': { low: 95, high: 150 } },
  { company: 'Tower Research', category: 'HFT', locations: ['Gurgaon'], careersUrl: 'https://tower-research.com/open-positions', reportCount: null, 'sde-1': { low: 40, high: 65 }, 'sde-2': { low: 60, high: 110 }, 'sde-3': { low: 90, high: 160 } },
  { company: 'Millennium', category: 'HFT', locations: ['Bengaluru', 'Mumbai'], careersUrl: 'https://mlp.com/careers', reportCount: null, 'sde-1': { low: 40, high: 65 }, 'sde-2': { low: 65, high: 105 }, 'sde-3': { low: 100, high: 155 } },
  { company: 'Squarepoint', category: 'HFT', locations: ['Bengaluru'], careersUrl: 'https://squarepoint-capital.com/careers', reportCount: null, 'sde-1': { low: 38, high: 62 }, 'sde-2': { low: 60, high: 100 }, 'sde-3': { low: 95, high: 145 } },
  { company: 'Graviton Research', category: 'HFT', locations: ['Gurgaon'], careersUrl: 'https://gravitontrading.com', reportCount: null, 'sde-1': { low: 35, high: 60 }, 'sde-2': { low: 55, high: 100 }, 'sde-3': { low: 80, high: 140 } },
  { company: 'Quadeye', category: 'HFT', locations: ['Gurgaon'], careersUrl: 'https://quadeye.com/careers', reportCount: null, 'sde-1': { low: 35, high: 60 }, 'sde-2': { low: 55, high: 95 }, 'sde-3': { low: 85, high: 140 } },
  { company: 'NK Securities', category: 'HFT', locations: ['Gurgaon'], careersUrl: 'https://nksecurities.com', reportCount: null, 'sde-1': { low: 35, high: 60 }, 'sde-2': { low: 55, high: 95 }, 'sde-3': { low: 85, high: 140 } },
  { company: 'DE Shaw', category: 'HFT', locations: ['Hyderabad'], careersUrl: 'https://deshawindia.com/careers', reportCount: null, 'sde-1': { low: 35, high: 55 }, 'sde-2': { low: 55, high: 90 }, 'sde-3': { low: 90, high: 150 } },
  { company: 'AlphaGrep', category: 'HFT', locations: ['Bengaluru', 'Mumbai'], careersUrl: 'https://alpha-grep.com', reportCount: null, 'sde-1': { low: 30, high: 55 }, 'sde-2': { low: 50, high: 90 }, 'sde-3': { low: 80, high: 130 } },
  { company: 'WorldQuant', category: 'HFT', locations: ['Mumbai'], careersUrl: 'https://worldquant.com/careers', reportCount: null, 'sde-1': { low: 30, high: 52 }, 'sde-2': { low: 50, high: 85 }, 'sde-3': { low: 80, high: 130 } },
  { company: 'Arcesium', category: 'HFT', locations: ['Bengaluru', 'Hyderabad'], careersUrl: 'https://arcesium.com/careers', reportCount: null, 'sde-1': { low: 25, high: 42 }, 'sde-2': { low: 42, high: 65 }, 'sde-3': { low: 65, high: 95 } },
  // GCC
  { company: 'Bloomberg', category: 'GCC', locations: ['Mumbai'], careersUrl: 'https://bloomberg.com/careers', reportCount: null, 'sde-1': { low: 30, high: 48 }, 'sde-2': { low: 48, high: 75 }, 'sde-3': { low: 72, high: 105 } },
  { company: 'Kotak Mahindra Bank', category: 'GCC', locations: ['Mumbai', 'Bengaluru'], careersUrl: 'https://kotak.com/careers', reportCount: 6, 'sde-1': { low: 32, high: 44 }, 'sde-2': { low: 49, high: 68 }, 'sde-3': { low: 72, high: 100 } },
  { company: 'Morgan Stanley', category: 'GCC', locations: ['Bengaluru', 'Mumbai'], careersUrl: 'https://morganstanley.com/careers', reportCount: null, 'sde-1': { low: 22, high: 40 }, 'sde-2': { low: 40, high: 62 }, 'sde-3': { low: 62, high: 90 } },
  { company: 'BlackRock', category: 'GCC', locations: ['Gurgaon', 'Mumbai'], careersUrl: 'https://blackrock.com/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 58, high: 85 } },
  { company: 'Fidelity Investments', category: 'GCC', locations: ['Bengaluru', 'Chennai'], careersUrl: 'https://fidelity.com/careers', reportCount: null, 'sde-1': { low: 20, high: 35 }, 'sde-2': { low: 35, high: 55 }, 'sde-3': { low: 55, high: 80 } },
  { company: 'Nomura', category: 'GCC', locations: ['Mumbai', 'Powai'], careersUrl: 'https://nomura.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'UBS', category: 'GCC', locations: ['Pune', 'Mumbai'], careersUrl: 'https://ubs.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 32, high: 50 }, 'sde-3': { low: 50, high: 72 } },
  { company: 'MSCI', category: 'GCC', locations: ['Mumbai', 'Pune'], careersUrl: 'https://msci.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 32, high: 50 }, 'sde-3': { low: 50, high: 72 } },
  { company: 'Wells Fargo', category: 'GCC', locations: ['Bengaluru', 'Hyderabad', 'Chennai'], careersUrl: 'https://wellsfargojobs.com', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 50, high: 72 } },
  { company: 'Optum (UHG)', category: 'GCC', locations: ['Noida', 'Gurgaon', 'Hyderabad', 'Bengaluru'], careersUrl: 'https://careers.unitedhealthgroup.com', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 50, high: 72 } },
  { company: 'Deutsche Bank', category: 'GCC', locations: ['Pune', 'Bengaluru'], careersUrl: 'https://db.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 30, high: 48 }, 'sde-3': { low: 48, high: 70 } },
  { company: 'Barclays', category: 'GCC', locations: ['Pune', 'Chennai'], careersUrl: 'https://home.barclays/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 30, high: 48 }, 'sde-3': { low: 48, high: 70 } },
  { company: 'Citi', category: 'GCC', locations: ['Pune', 'Chennai', 'Mumbai'], careersUrl: 'https://jobs.citi.com', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 30, high: 48 }, 'sde-3': { low: 48, high: 70 } },
  { company: 'Mercedes-Benz R&D', category: 'GCC', locations: ['Bengaluru'], careersUrl: 'https://mercedes-benz.co.in/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 30, high: 48 }, 'sde-3': { low: 46, high: 70 } },
  { company: 'JPMorgan Chase', category: 'GCC', locations: ['Bengaluru', 'Hyderabad', 'Mumbai'], careersUrl: 'https://jpmorganchase.com/careers', reportCount: 23, 'sde-1': { low: 19, high: 30 }, 'sde-2': { low: 25, high: 32 }, 'sde-3': { low: 31, high: 40 } },
  { company: 'Standard Chartered', category: 'GCC', locations: ['Bengaluru', 'Chennai'], careersUrl: 'https://sc.com/careers', reportCount: null, 'sde-1': { low: 16, high: 28 }, 'sde-2': { low: 28, high: 45 }, 'sde-3': { low: 45, high: 68 } },
  { company: 'HSBC', category: 'GCC', locations: ['Pune', 'Hyderabad'], careersUrl: 'https://hsbc.com/careers', reportCount: null, 'sde-1': { low: 16, high: 28 }, 'sde-2': { low: 28, high: 45 }, 'sde-3': { low: 45, high: 68 } },
  { company: 'S&P Global', category: 'GCC', locations: ['Gurgaon', 'Hyderabad', 'Mumbai'], careersUrl: 'https://spglobal.com/careers', reportCount: null, 'sde-1': { low: 16, high: 28 }, 'sde-2': { low: 28, high: 45 }, 'sde-3': { low: 44, high: 66 } },
  { company: 'Goldman Sachs', category: 'GCC', locations: ['Bengaluru', 'Hyderabad'], careersUrl: 'https://goldmansachs.com/careers', reportCount: 8, 'sde-1': { low: 18, high: 27 }, 'sde-2': { low: 38, high: 56 }, 'sde-3': { low: 63, high: 91 } },
  { company: 'FactSet', category: 'GCC', locations: ['Hyderabad', 'Chennai'], careersUrl: 'https://factset.com/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 42, high: 62 } },
  { company: 'BNY Mellon', category: 'GCC', locations: ['Pune', 'Chennai'], careersUrl: 'https://bny.com/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 42, high: 62 } },
  { company: 'BNP Paribas', category: 'GCC', locations: ['Mumbai', 'Chennai'], careersUrl: 'https://bnpparibas.com/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 42, high: 62 } },
  { company: 'Societe Generale', category: 'GCC', locations: ['Bengaluru', 'Chennai'], careersUrl: 'https://societegenerale.com/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 42, high: 62 } },
  { company: 'GE HealthCare', category: 'GCC', locations: ['Bengaluru'], careersUrl: 'https://gehealthcare.com/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 42, high: 62 } },
  { company: 'Philips', category: 'GCC', locations: ['Bengaluru', 'Pune'], careersUrl: 'https://philips.com/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 42, high: 62 } },
  { company: 'Siemens', category: 'GCC', locations: ['Bengaluru', 'Pune'], careersUrl: 'https://siemens.com/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 42, high: 64 } },
  { company: 'Honeywell', category: 'GCC', locations: ['Bengaluru', 'Hyderabad', 'Pune'], careersUrl: 'https://careers.honeywell.com', reportCount: null, 'sde-1': { low: 12, high: 24 }, 'sde-2': { low: 24, high: 40 }, 'sde-3': { low: 40, high: 60 } },
  { company: 'Bosch', category: 'GCC', locations: ['Bengaluru', 'Coimbatore'], careersUrl: 'https://bosch.in/careers', reportCount: null, 'sde-1': { low: 12, high: 24 }, 'sde-2': { low: 24, high: 38 }, 'sde-3': { low: 38, high: 58 } },
  { company: 'HDFC Bank', category: 'GCC', locations: ['Mumbai', 'Bengaluru'], careersUrl: 'https://hdfcbank.com/careers', reportCount: null, 'sde-1': { low: 10, high: 20 }, 'sde-2': { low: 20, high: 34 }, 'sde-3': { low: 34, high: 52 } },
  { company: 'ICICI Bank', category: 'GCC', locations: ['Mumbai', 'Hyderabad'], careersUrl: 'https://icicicareers.com', reportCount: null, 'sde-1': { low: 10, high: 20 }, 'sde-2': { low: 20, high: 34 }, 'sde-3': { low: 34, high: 52 } },
  // Enterprise
  { company: 'VMware', category: 'Enterprise', locations: ['Bengaluru', 'Pune'], careersUrl: 'https://careers.vmware.com', reportCount: null, 'sde-1': { low: 24, high: 40 }, 'sde-2': { low: 40, high: 60 }, 'sde-3': { low: 60, high: 90 } },
  { company: 'Cisco', category: 'Enterprise', locations: ['Bengaluru'], careersUrl: 'https://cisco.com/careers', reportCount: null, 'sde-1': { low: 22, high: 38 }, 'sde-2': { low: 38, high: 58 }, 'sde-3': { low: 58, high: 85 } },
  { company: 'Target', category: 'Enterprise', locations: ['Bengaluru'], careersUrl: 'https://india.target.com/careers', reportCount: null, 'sde-1': { low: 20, high: 34 }, 'sde-2': { low: 34, high: 52 }, 'sde-3': { low: 52, high: 78 } },
  { company: 'SAP Labs', category: 'Enterprise', locations: ['Bengaluru'], careersUrl: 'https://sap.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'Oracle', category: 'Enterprise', locations: ['Bengaluru', 'Hyderabad', 'Noida'], careersUrl: 'https://oracle.com/careers', reportCount: 62, 'sde-1': { low: 22, high: 31 }, 'sde-2': { low: 24, high: 50 }, 'sde-3': { low: 39, high: 59 } },
  { company: 'Walmart Global Tech', category: 'Enterprise', locations: ['Bengaluru', 'Chennai'], careersUrl: 'https://careers.walmart.com', reportCount: 61, 'sde-1': { low: 18, high: 30 }, 'sde-2': { low: 24, high: 32 }, 'sde-3': { low: 26, high: 39 } },
  { company: 'Dell Technologies', category: 'Enterprise', locations: ['Bengaluru', 'Pune', 'Hyderabad'], careersUrl: 'https://jobs.dell.com', reportCount: null, 'sde-1': { low: 16, high: 28 }, 'sde-2': { low: 28, high: 45 }, 'sde-3': { low: 45, high: 68 } },
  { company: 'Nielsen', category: 'Enterprise', locations: ['Gurgaon', 'Mumbai', 'Bengaluru'], careersUrl: 'https://nielsen.com/careers', reportCount: 8, 'sde-1': { low: 17, high: 24 }, 'sde-2': { low: 26, high: 36 }, 'sde-3': { low: 32, high: 51 } },
  { company: 'IBM', category: 'Enterprise', locations: ['Bengaluru', 'Pune', 'Hyderabad', 'Kochi'], careersUrl: 'https://ibm.com/careers', reportCount: 9, 'sde-1': { low: 13, high: 16 }, 'sde-2': { low: 20, high: 25 }, 'sde-3': { low: 30, high: 37 } },
  // Startup
  { company: 'Sarvam AI', category: 'Startup', locations: ['Bengaluru'], careersUrl: 'https://sarvam.ai/careers', reportCount: null, 'sde-1': { low: 30, high: 55 }, 'sde-2': { low: 50, high: 85 }, 'sde-3': { low: 80, high: 130 } },
  { company: 'Zepto', category: 'Startup', locations: ['Bengaluru', 'Mumbai'], careersUrl: 'https://zeptonow.com/careers', reportCount: 23, 'sde-1': { low: 24, high: 39 }, 'sde-2': { low: 40, high: 54 }, 'sde-3': { low: 83, high: 115 } },
  { company: 'Rapido', category: 'Startup', locations: ['Bengaluru'], careersUrl: 'https://rapido.bike/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'Porter', category: 'Startup', locations: ['Bengaluru'], careersUrl: 'https://porter.in/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 32, high: 52 }, 'sde-3': { low: 50, high: 75 } },
  { company: 'OfBusiness', category: 'Startup', locations: ['Gurgaon'], careersUrl: 'https://ofbusiness.com/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'Udaan', category: 'Startup', locations: ['Bengaluru'], careersUrl: 'https://udaan.com/careers', reportCount: null, 'sde-1': { low: 18, high: 34 }, 'sde-2': { low: 30, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'Sprinto', category: 'Startup', locations: ['Remote', 'Bengaluru'], careersUrl: 'https://sprinto.com/careers', reportCount: null, 'sde-1': { low: 18, high: 32 }, 'sde-2': { low: 32, high: 50 }, 'sde-3': { low: 48, high: 72 } },
  { company: 'Zetwerk', category: 'Startup', locations: ['Bengaluru'], careersUrl: 'https://zetwerk.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 48 }, 'sde-3': { low: 46, high: 70 } },
  { company: 'Spinny', category: 'Startup', locations: ['Gurgaon'], careersUrl: 'https://spinny.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 46 }, 'sde-3': { low: 44, high: 66 } },
  { company: 'Unacademy', category: 'Startup', locations: ['Bengaluru'], careersUrl: 'https://unacademy.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 46 }, 'sde-3': { low: 44, high: 66 } },
  { company: 'Scaler', category: 'Startup', locations: ['Bengaluru'], careersUrl: 'https://scaler.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 46 }, 'sde-3': { low: 44, high: 66 } },
  { company: 'NoBroker', category: 'Startup', locations: ['Bengaluru'], careersUrl: 'https://nobroker.in/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 46 }, 'sde-3': { low: 44, high: 66 } },
  { company: 'Ather Energy', category: 'Startup', locations: ['Bengaluru'], careersUrl: 'https://atherenergy.com/careers', reportCount: null, 'sde-1': { low: 16, high: 30 }, 'sde-2': { low: 28, high: 46 }, 'sde-3': { low: 44, high: 68 } },
  { company: 'Cars24', category: 'Startup', locations: ['Gurgaon'], careersUrl: 'https://cars24.com/careers', reportCount: 9, 'sde-1': { low: 17, high: 29 }, 'sde-2': { low: 30, high: 45 }, 'sde-3': { low: 38, high: 58 } },
  { company: 'PhysicsWallah', category: 'Startup', locations: ['Noida'], careersUrl: 'https://physicswallah.com/careers', reportCount: null, 'sde-1': { low: 14, high: 28 }, 'sde-2': { low: 26, high: 45 }, 'sde-3': { low: 42, high: 65 } },
  { company: 'Delhivery', category: 'Startup', locations: ['Gurgaon', 'Bengaluru'], careersUrl: 'https://delhivery.com/careers', reportCount: null, 'sde-1': { low: 14, high: 28 }, 'sde-2': { low: 26, high: 45 }, 'sde-3': { low: 42, high: 65 } },
  { company: 'PharmEasy', category: 'Startup', locations: ['Mumbai', 'Bengaluru'], careersUrl: 'https://pharmeasy.in/careers', reportCount: null, 'sde-1': { low: 14, high: 28 }, 'sde-2': { low: 26, high: 44 }, 'sde-3': { low: 42, high: 64 } },
  { company: 'upGrad', category: 'Startup', locations: ['Mumbai'], careersUrl: 'https://upgrad.com/careers', reportCount: null, 'sde-1': { low: 14, high: 28 }, 'sde-2': { low: 26, high: 42 }, 'sde-3': { low: 40, high: 62 } },
  // Services
  { company: 'ZS Associates', category: 'Services', locations: ['Pune', 'Gurgaon', 'Bengaluru'], careersUrl: 'https://zs.com/careers', reportCount: null, 'sde-1': { low: 16, high: 28 }, 'sde-2': { low: 28, high: 45 }, 'sde-3': { low: 44, high: 66 } },
  { company: 'Fractal Analytics', category: 'Services', locations: ['Mumbai', 'Bengaluru', 'Gurgaon'], careersUrl: 'https://fractal.ai/careers', reportCount: null, 'sde-1': { low: 14, high: 26 }, 'sde-2': { low: 26, high: 44 }, 'sde-3': { low: 42, high: 65 } },
  { company: 'Publicis Sapient', category: 'Services', locations: ['Gurgaon', 'Bengaluru'], careersUrl: 'https://publicissapient.com/careers', reportCount: null, 'sde-1': { low: 12, high: 24 }, 'sde-2': { low: 24, high: 40 }, 'sde-3': { low: 38, high: 58 } },
  { company: 'GlobalLogic', category: 'Services', locations: ['Noida', 'Bengaluru'], careersUrl: 'https://globallogic.com/careers', reportCount: null, 'sde-1': { low: 10, high: 22 }, 'sde-2': { low: 20, high: 38 }, 'sde-3': { low: 35, high: 55 } },
  { company: 'Nagarro', category: 'Services', locations: ['Gurgaon', 'Pune'], careersUrl: 'https://nagarro.com/careers', reportCount: null, 'sde-1': { low: 10, high: 20 }, 'sde-2': { low: 20, high: 34 }, 'sde-3': { low: 32, high: 50 } },
  { company: 'Tata Elxsi', category: 'Services', locations: ['Bengaluru', 'Chennai', 'Pune'], careersUrl: 'https://tataelxsi.com/careers', reportCount: null, 'sde-1': { low: 8, high: 18 }, 'sde-2': { low: 18, high: 32 }, 'sde-3': { low: 30, high: 48 } },
  { company: 'Accenture', category: 'Services', locations: ['Bengaluru', 'Pune', 'Hyderabad'], careersUrl: 'https://accenture.com/careers', reportCount: null, 'sde-1': { low: 8, high: 18 }, 'sde-2': { low: 16, high: 30 }, 'sde-3': { low: 28, high: 45 } },
  { company: 'Persistent Systems', category: 'Services', locations: ['Pune', 'Nagpur', 'Bengaluru'], careersUrl: 'https://persistent.com/careers', reportCount: null, 'sde-1': { low: 8, high: 18 }, 'sde-2': { low: 17, high: 30 }, 'sde-3': { low: 29, high: 46 } },
  { company: 'EPAM', category: 'Services', locations: ['Hyderabad', 'Pune', 'Bengaluru'], careersUrl: 'https://epam.com/careers', reportCount: 8, 'sde-1': { low: 14, high: 17 }, 'sde-2': { low: 21, high: 26 }, 'sde-3': { low: 31, high: 39 } },
  { company: 'LTIMindtree', category: 'Services', locations: ['Pan-India'], careersUrl: 'https://ltimindtree.com/careers', reportCount: null, 'sde-1': { low: 7, high: 15 }, 'sde-2': { low: 14, high: 26 }, 'sde-3': { low: 25, high: 40 } },
  { company: 'Capgemini', category: 'Services', locations: ['Pan-India'], careersUrl: 'https://capgemini.com/careers', reportCount: null, 'sde-1': { low: 7, high: 15 }, 'sde-2': { low: 14, high: 26 }, 'sde-3': { low: 25, high: 40 } },
  { company: 'HCL Tech', category: 'Services', locations: ['Pan-India'], careersUrl: 'https://hcltech.com/careers', reportCount: null, 'sde-1': { low: 6, high: 14 }, 'sde-2': { low: 13, high: 25 }, 'sde-3': { low: 24, high: 38 } },
  { company: 'TCS', category: 'Services', locations: ['Pan-India'], careersUrl: 'https://tcs.com/careers', reportCount: null, 'sde-1': { low: 6, high: 14 }, 'sde-2': { low: 12, high: 24 }, 'sde-3': { low: 22, high: 38 } },
  { company: 'Infosys', category: 'Services', locations: ['Pan-India'], careersUrl: 'https://infosys.com/careers', reportCount: null, 'sde-1': { low: 6, high: 14 }, 'sde-2': { low: 12, high: 24 }, 'sde-3': { low: 22, high: 38 } },
  { company: 'Wipro', category: 'Services', locations: ['Pan-India'], careersUrl: 'https://careers.wipro.com', reportCount: null, 'sde-1': { low: 6, high: 14 }, 'sde-2': { low: 12, high: 24 }, 'sde-3': { low: 22, high: 38 } },
  { company: 'Cognizant', category: 'Services', locations: ['Pan-India'], careersUrl: 'https://cognizant.com/careers', reportCount: null, 'sde-1': { low: 6, high: 14 }, 'sde-2': { low: 12, high: 24 }, 'sde-3': { low: 22, high: 38 } },
  { company: 'Tech Mahindra', category: 'Services', locations: ['Pan-India'], careersUrl: 'https://techmahindra.com/careers', reportCount: null, 'sde-1': { low: 6, high: 14 }, 'sde-2': { low: 13, high: 24 }, 'sde-3': { low: 23, high: 37 } },
  { company: 'Thoughtworks', category: 'Services', locations: ['Bengaluru', 'Pune', 'Gurgaon', 'Chennai'], careersUrl: 'https://thoughtworks.com/careers', reportCount: 3, 'sde-1': { low: 9, high: 13 }, 'sde-2': { low: 14, high: 20 }, 'sde-3': { low: 21, high: 30 } },
  { company: 'Deloitte', category: 'Services', locations: ['Bengaluru', 'Hyderabad', 'Pune', 'Gurgaon'], careersUrl: 'https://deloitte.com/careers', reportCount: 6, 'sde-1': { low: 7, high: 10 }, 'sde-2': { low: 11, high: 16 }, 'sde-3': { low: 17, high: 24 } },
]

export const companyCategories: CompanyCategory[] = ['FAANG', 'Product', 'Fintech', 'HFT', 'GCC', 'Enterprise', 'Startup', 'Services']

export const companyLocations: string[] = Array.from(new Set(targetCompanies.flatMap((c) => c.locations))).sort()

export const levelInfo: Record<Level, LevelInfo> = {
  'sde-1': {
    key: 'sde-1',
    label: 'SDE-1',
    shortLabel: 'SDE-1',
    years: '~0-2 yrs',
    tierLabel: 'Entry level',
    equivalentTitles: 'SDE-1 · SWE I · Google L3 · Amazon SDE-1 · MTS-1',
    typicalRange: { low: 18, high: 45 },
    description: 'New grads and early-career engineers. Well-scoped tasks with close mentorship from senior teammates.',
    borderColor: '#22c55e',
  },
  'sde-2': {
    key: 'sde-2',
    label: 'SDE-2',
    shortLabel: 'SDE-2',
    years: '~2-5 yrs',
    tierLabel: 'Mid level',
    equivalentTitles: 'SDE-2 · SWE II · Google L4 · Amazon SDE-2 · Microsoft 61-62',
    typicalRange: { low: 29, high: 70 },
    description: 'The most common switch band. Owns features end-to-end with limited oversight.',
    borderColor: '#eab308',
  },
  'sde-3': {
    key: 'sde-3',
    label: 'SDE-3',
    shortLabel: 'SDE-3',
    years: '~5-8+ yrs',
    tierLabel: 'Senior level',
    equivalentTitles: 'SDE-3 · Senior SWE · Google L5 · Amazon SDE-3 · Microsoft 63-65',
    typicalRange: { low: 43, high: 105 },
    description: 'Senior / Staff. Cross-team scope, technical leadership, and ambiguous problems.',
    borderColor: '#ef4444',
  },
}

export function formatLpa(range: LpaRange): string {
  const fmt = (n: number) => (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1))
  return `₹${fmt(range.low)}L - ₹${fmt(range.high)}L`
}

export function overallRange(): LpaRange {
  return {
    low: Math.min(...targetCompanies.map((c) => c['sde-1'].low)),
    high: Math.max(...targetCompanies.map((c) => c['sde-3'].high)),
  }
}

export function formatLpaCompact(n: number): string {
  return n >= 100 ? `₹${(n / 100).toFixed(n % 100 === 0 ? 0 : 1)}Cr` : `₹${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}L`
}

/** Min/max across the full dataset for one level - used to position the comp-range bar. */
export function levelExtent(level: Level): LpaRange {
  return {
    low: Math.min(...targetCompanies.map((c) => c[level].low)),
    high: Math.max(...targetCompanies.map((c) => c[level].high)),
  }
}

export const applicationStatuses = ['Not started', 'Interested', 'Applied', 'Referral', 'Interviewing', 'Offer', 'Rejected'] as const
export type ApplicationStatus = (typeof applicationStatuses)[number]

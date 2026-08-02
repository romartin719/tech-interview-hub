import realTimeLeaderboard from './real-time-leaderboard'
import rateLimiter from './rate-limiter'
import pastebin from './pastebin'
import uniqueIdGenerator from './unique-id-generator'
import keyValueStore from './key-value-store'
import urlShortener from './url-shortener'
import socialFeed from './social-feed'
import chatSystem from './chat-system'
import notificationSystem from './notification-system'
import photoSharing from './photo-sharing'
import ticketBooking from './ticket-booking'
import newsAggregator from './news-aggregator'
import jobScheduler from './job-scheduler'
import delayedTriggerService from './delayed-trigger-service'
import digitalWallet from './digital-wallet'
import foodDelivery from './food-delivery'
import stockBroker from './stock-broker'
import rideSharing from './ride-sharing'
import videoStreaming from './video-streaming'
import collaborativeEditing from './collaborative-editing'
import searchAutocomplete from './search-autocomplete'
import nearbyService from './nearby-service'
import shoppingCart from './shopping-cart'
import qaForum from './qa-forum'
import imageProcessingMicroservice from './image-processing-microservice'
import businessRulesEngine from './business-rules-engine'
import cloudFileStorage from './cloud-file-storage'
import metricsMonitoring from './metrics-monitoring'
import adServingSystem from './ad-serving-system'
import paymentSystem from './payment-system'
import messageQueue from './message-queue'
import webCrawler from './web-crawler'
import aiChatSystem from './ai-chat-system'
import freightLogisticsSystem from './freight-logistics-system'
import realTimeLoadBidding from './real-time-load-bidding'

export * from './types'
export type { HLDTopic } from './types'

/**
 * Topics migrated to the systemcraft-aligned schema. All topics from the legacy
 * `@/data/hldTopics` file have been migrated here; `HLDView.vue` / `HLDDetailView.vue`
 * still merge in the legacy file defensively via slug dedup, but every slug in it
 * now has a match here.
 */
export const hldTopics = [
  realTimeLeaderboard,
  rateLimiter,
  pastebin,
  uniqueIdGenerator,
  keyValueStore,
  urlShortener,
  socialFeed,
  chatSystem,
  notificationSystem,
  photoSharing,
  ticketBooking,
  newsAggregator,
  jobScheduler,
  delayedTriggerService,
  digitalWallet,
  foodDelivery,
  stockBroker,
  rideSharing,
  videoStreaming,
  collaborativeEditing,
  searchAutocomplete,
  nearbyService,
  shoppingCart,
  qaForum,
  imageProcessingMicroservice,
  businessRulesEngine,
  cloudFileStorage,
  metricsMonitoring,
  adServingSystem,
  paymentSystem,
  messageQueue,
  webCrawler,
  aiChatSystem,
  freightLogisticsSystem,
  realTimeLoadBidding,
]

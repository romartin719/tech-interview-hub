import parkingLot from './parking-lot'
import musicPlayer from './music-player'
import multilevelCache from './multilevel-cache'
import snakeLadder from './snake-ladder'
import splitwise from './splitwise'
import vendingMachine from './vending-machine'
import elevatorSystem from './elevator-system'
import ticTacToe from './tic-tac-toe'
import urlShortener from './url-shortener'
import inventoryManagement from './inventory-management'
import orderManagement from './order-management'
import restaurantBooking from './restaurant-booking'
import libraryManagement from './library-management'
import rateLimiter from './rate-limiter'
import paymentWallet from './payment-wallet'
import taskScheduler from './task-scheduler'
import ecommerceCart from './ecommerce-cart'
import deliverySlotBooking from './delivery-slot-booking'
import queueManagement from './queue-management'
import fileSystem from './file-system'
import pubsubSystem from './pubsub-system'
import rideMatchingEngine from './ride-matching-engine'

export * from './types'

export const lldProblems = [
  // Beginner
  parkingLot,
  ticTacToe,
  snakeLadder,
  vendingMachine,
  libraryManagement,
  // Intermediate
  splitwise,
  musicPlayer,
  multilevelCache,
  urlShortener,
  rateLimiter,
  paymentWallet,
  taskScheduler,
  ecommerceCart,
  deliverySlotBooking,
  queueManagement,
  fileSystem,
  // Advanced
  elevatorSystem,
  inventoryManagement,
  orderManagement,
  restaurantBooking,
  pubsubSystem,
  rideMatchingEngine,
]

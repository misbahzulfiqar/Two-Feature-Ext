import { Queue } from "bullmq";
import { Redis } from "ioredis";

const SCRAPE_LISTING_QUEUE = "scrape-listing";

let connection: Redis | undefined;
let scrapeListingQueue: Queue | undefined;
let connectedUrl: string | undefined;

export function getScrapeListingQueue(redisUrl: string): Queue {
  if (scrapeListingQueue && connectedUrl === redisUrl) {
    return scrapeListingQueue;
  }
  if (connection) {
    connection.disconnect();
  }
  connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  connectedUrl = redisUrl;
  scrapeListingQueue = new Queue(SCRAPE_LISTING_QUEUE, { connection });
  return scrapeListingQueue;
}

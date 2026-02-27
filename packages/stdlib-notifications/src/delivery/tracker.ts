/**
 * Delivery tracking implementation
 */

import { 
  DeliveryEvent, 
  DeliveryTracker, 
  DeliveryStats, 
  DeliveryFilter,
  NotificationStatus,
  NotificationId,
  Timestamp
} from './types';

export class InMemoryDeliveryTracker implements DeliveryTracker {
  private events: Map<NotificationId, DeliveryEvent[]> = new Map();
  private latestStatus: Map<NotificationId, NotificationStatus> = new Map();
  
  async trackEvent(event: DeliveryEvent): Promise<void> {
    // Get existing events for this notification
    const existing = this.events.get(event.notificationId) || [];
    
    // Add new event
    existing.push(event);
    
    // Sort by timestamp
    existing.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Store
    this.events.set(event.notificationId, existing);
    
    // Update latest status
    this.latestStatus.set(event.notificationId, event.status);
  }
  
  async getEvents(notificationId: NotificationId): Promise<DeliveryEvent[]> {
    return this.events.get(notificationId) || [];
  }
  
  async getStatus(notificationId: NotificationId): Promise<NotificationStatus> {
    return this.latestStatus.get(notificationId) || NotificationStatus.QUEUED;
  }
  
  async getStats(filter?: DeliveryFilter): Promise<DeliveryStats> {
    let allEvents: DeliveryEvent[] = [];
    
    if (filter?.notificationId) {
      allEvents = this.events.get(filter.notificationId) || [];
    } else {
      // Collect all events
      for (const events of this.events.values()) {
        allEvents.push(...events);
      }
    }
    
    // Apply filters
    if (filter) {
      if (filter.status) {
        allEvents = allEvents.filter(e => e.status === filter.status);
      }
      
      if (filter.provider) {
        allEvents = allEvents.filter(e => e.provider === filter.provider);
      }
      
      if (filter.from) {
        allEvents = allEvents.filter(e => e.timestamp >= filter.from!);
      }
      
      if (filter.to) {
        allEvents = allEvents.filter(e => e.timestamp <= filter.to!);
      }
      
      // Apply pagination
      if (filter.offset) {
        allEvents = allEvents.slice(filter.offset);
      }
      
      if (filter.limit) {
        allEvents = allEvents.slice(0, filter.limit);
      }
    }
    
    // Calculate stats
    const stats: DeliveryStats = {
      total: 0,
      queued: 0,
      sending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      bounced: 0,
      unsubscribed: 0
    };
    
    // Track unique notifications for total count
    const uniqueNotifications = new Set<NotificationId>();
    const deliveryTimes: number[] = [];
    
    for (const event of allEvents) {
      uniqueNotifications.add(event.notificationId);
      
      switch (event.status) {
        case NotificationStatus.QUEUED:
          stats.queued++;
          break;
        case NotificationStatus.SENDING:
          stats.sending++;
          break;
        case NotificationStatus.SENT:
          stats.sent++;
          break;
        case NotificationStatus.DELIVERED:
          stats.delivered++;
          // Calculate delivery time
          const events = await this.getEvents(event.notificationId);
          const sentEvent = events.find(e => e.status === NotificationStatus.SENT);
          if (sentEvent) {
            const latency = event.timestamp.getTime() - sentEvent.timestamp.getTime();
            deliveryTimes.push(latency);
          }
          break;
        case NotificationStatus.FAILED:
          stats.failed++;
          break;
        case NotificationStatus.BOUNCED:
          stats.bounced++;
          break;
        case NotificationStatus.UNSUBSCRIBED:
          stats.unsubscribed++;
          break;
      }
    }
    
    stats.total = uniqueNotifications.size;
    
    // Calculate average delivery time
    if (deliveryTimes.length > 0) {
      stats.averageDeliveryTime = deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length;
    }
    
    return stats;
  }
  
  async updateStatus(
    notificationId: NotificationId, 
    status: NotificationStatus, 
    metadata?: any
  ): Promise<void> {
    const event: DeliveryEvent = {
      id: `evt_${notificationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notificationId,
      status,
      timestamp: new Date(),
      metadata
    };
    
    await this.trackEvent(event);
  }
  
  // Helper methods for testing
  clear(): void {
    this.events.clear();
    this.latestStatus.clear();
  }
  
  count(): number {
    return this.latestStatus.size;
  }
}

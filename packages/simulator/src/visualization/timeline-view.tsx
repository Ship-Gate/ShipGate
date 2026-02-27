/**
 * Timeline Viewer Component
 * 
 * Visualizes simulation timeline with events.
 */

import React, { useState, useMemo } from 'react';
import type { Timeline, TimelineEvent } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineViewProps {
  /** Timeline data */
  timeline: Timeline;
  /** Selected event ID */
  selectedEventId?: string;
  /** On event select */
  onEventSelect?: (event: TimelineEvent) => void;
  /** Filter by event type */
  filterTypes?: TimelineEvent['type'][];
  /** Theme */
  theme?: 'light' | 'dark';
  /** Custom styles */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const TimelineView: React.FC<TimelineViewProps> = ({
  timeline,
  selectedEventId,
  onEventSelect,
  filterTypes,
  theme = 'light',
  className = '',
}) => {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const filteredEvents = useMemo(() => {
    if (!filterTypes || filterTypes.length === 0) {
      return timeline.events;
    }
    return timeline.events.filter(e => filterTypes.includes(e.type));
  }, [timeline.events, filterTypes]);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const isDark = theme === 'dark';

  const styles = {
    container: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      padding: '12px',
      backgroundColor: isDark ? '#1e1e1e' : '#f8f9fa',
      color: isDark ? '#d4d4d4' : '#24292e',
      borderRadius: '6px',
      maxHeight: '500px',
      overflow: 'auto',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
      paddingBottom: '8px',
      borderBottom: `1px solid ${isDark ? '#404040' : '#e1e4e8'}`,
    },
    title: {
      fontWeight: 'bold',
      fontSize: '14px',
    },
    stats: {
      fontSize: '11px',
      color: isDark ? '#888' : '#6a737d',
    },
    eventList: {
      position: 'relative' as const,
    },
    timelineLine: {
      position: 'absolute' as const,
      left: '8px',
      top: '0',
      bottom: '0',
      width: '2px',
      backgroundColor: isDark ? '#404040' : '#e1e4e8',
    },
    event: {
      position: 'relative' as const,
      marginLeft: '24px',
      marginBottom: '8px',
      padding: '8px 12px',
      borderRadius: '6px',
      backgroundColor: isDark ? '#252526' : '#fff',
      border: `1px solid ${isDark ? '#3c3c3c' : '#e1e4e8'}`,
      cursor: 'pointer',
    },
    eventSelected: {
      borderColor: isDark ? '#388bfd' : '#54aeff',
      backgroundColor: isDark ? '#264f78' : '#ddf4ff',
    },
    eventDot: {
      position: 'absolute' as const,
      left: '-20px',
      top: '12px',
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      border: `2px solid ${isDark ? '#1e1e1e' : '#f8f9fa'}`,
    },
    eventHeader: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '4px',
    },
    eventType: {
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      padding: '2px 6px',
      borderRadius: '4px',
      marginRight: '8px',
    },
    eventTime: {
      fontSize: '11px',
      color: isDark ? '#888' : '#6a737d',
      marginLeft: 'auto',
    },
    eventBehavior: {
      fontWeight: 500,
      color: isDark ? '#9cdcfe' : '#005cc5',
    },
    eventStatus: {
      marginLeft: '8px',
      fontSize: '12px',
    },
    eventDetails: {
      marginTop: '8px',
      padding: '8px',
      borderRadius: '4px',
      backgroundColor: isDark ? '#1e1e1e' : '#f6f8fa',
      fontFamily: 'monospace',
      fontSize: '11px',
    },
    detailSection: {
      marginBottom: '8px',
    },
    detailLabel: {
      fontWeight: 600,
      marginBottom: '4px',
      color: isDark ? '#9cdcfe' : '#005cc5',
    },
    detailValue: {
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-all' as const,
    },
    emptyMessage: {
      color: isDark ? '#888' : '#6a737d',
      fontStyle: 'italic',
      padding: '20px',
      textAlign: 'center' as const,
    },
  };

  const getEventColor = (type: TimelineEvent['type'], success?: boolean) => {
    if (type === 'behavior') {
      return success 
        ? (isDark ? '#3fb950' : '#2da44e')
        : (isDark ? '#f85149' : '#cf222e');
    }
    switch (type) {
      case 'state_change': return isDark ? '#a371f7' : '#8250df';
      case 'invariant_check': return isDark ? '#a5d6ff' : '#0969da';
      case 'error': return isDark ? '#f85149' : '#cf222e';
      default: return isDark ? '#888' : '#6a737d';
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <span style={styles.title}>Timeline</span>
        <span style={styles.stats}>
          {filteredEvents.length} events • {formatTime(timeline.durationMs)}
        </span>
      </div>

      {filteredEvents.length === 0 ? (
        <div style={styles.emptyMessage}>No events recorded</div>
      ) : (
        <div style={styles.eventList}>
          <div style={styles.timelineLine} />
          
          {filteredEvents.map(event => {
            const isExpanded = expandedEvents.has(event.id);
            const isSelected = selectedEventId === event.id;
            const success = event.output?.success;
            const color = getEventColor(event.type, success);

            return (
              <div
                key={event.id}
                style={{
                  ...styles.event,
                  ...(isSelected ? styles.eventSelected : {}),
                }}
                onClick={() => {
                  toggleExpand(event.id);
                  onEventSelect?.(event);
                }}
              >
                <div
                  style={{
                    ...styles.eventDot,
                    backgroundColor: color,
                  }}
                />

                <div style={styles.eventHeader}>
                  <span
                    style={{
                      ...styles.eventType,
                      backgroundColor: color + '20',
                      color,
                    }}
                  >
                    {event.type}
                  </span>

                  {event.behavior && (
                    <span style={styles.eventBehavior}>{event.behavior}</span>
                  )}

                  {event.type === 'behavior' && (
                    <span style={styles.eventStatus}>
                      {success ? '✓' : '✗'}
                    </span>
                  )}

                  <span style={styles.eventTime}>
                    +{formatTime(event.relativeTime)}
                    {event.durationMs && ` (${event.durationMs}ms)`}
                  </span>
                </div>

                {isExpanded && (
                  <div style={styles.eventDetails}>
                    {event.input && Object.keys(event.input).length > 0 && (
                      <div style={styles.detailSection}>
                        <div style={styles.detailLabel}>Input:</div>
                        <div style={styles.detailValue}>
                          {JSON.stringify(event.input, null, 2)}
                        </div>
                      </div>
                    )}

                    {event.output && (
                      <div style={styles.detailSection}>
                        <div style={styles.detailLabel}>Output:</div>
                        <div style={styles.detailValue}>
                          {JSON.stringify(event.output, null, 2)}
                        </div>
                      </div>
                    )}

                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div style={styles.detailSection}>
                        <div style={styles.detailLabel}>Metadata:</div>
                        <div style={styles.detailValue}>
                          {JSON.stringify(event.metadata, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimelineView;

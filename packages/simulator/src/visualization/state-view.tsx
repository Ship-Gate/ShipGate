/**
 * State Viewer Component
 * 
 * Visualizes simulator state in a tree structure.
 */

import React, { useState, useMemo } from 'react';
import type { SimulatorState, EntityInstance } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StateViewProps {
  /** Current simulator state */
  state: SimulatorState;
  /** Selected entity type */
  selectedEntity?: string;
  /** On entity select callback */
  onEntitySelect?: (entityType: string, entityId: string) => void;
  /** On entity click callback */
  onEntityClick?: (entityType: string, entityId: string, entity: EntityInstance) => void;
  /** Collapsed sections */
  collapsed?: Record<string, boolean>;
  /** Theme */
  theme?: 'light' | 'dark';
  /** Custom styles */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const StateView: React.FC<StateViewProps> = ({
  state,
  selectedEntity,
  onEntitySelect,
  onEntityClick,
  collapsed: initialCollapsed = {},
  theme = 'light',
  className = '',
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(initialCollapsed);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());

  const entityTypes = useMemo(() => Object.keys(state.entities), [state.entities]);

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEntity = (entityId: string) => {
    setExpandedEntities(prev => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

  const isDark = theme === 'dark';

  const styles = {
    container: {
      fontFamily: 'monospace',
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
    version: {
      fontSize: '11px',
      color: isDark ? '#888' : '#6a737d',
    },
    entitySection: {
      marginBottom: '8px',
    },
    entityHeader: {
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: '4px',
      backgroundColor: isDark ? '#2d2d2d' : '#fff',
      border: `1px solid ${isDark ? '#404040' : '#e1e4e8'}`,
    },
    entityHeaderSelected: {
      backgroundColor: isDark ? '#264f78' : '#ddf4ff',
      borderColor: isDark ? '#388bfd' : '#54aeff',
    },
    chevron: {
      marginRight: '8px',
      transition: 'transform 0.2s',
      width: '12px',
    },
    entityName: {
      fontWeight: 500,
      color: isDark ? '#569cd6' : '#0366d6',
    },
    entityCount: {
      marginLeft: 'auto',
      fontSize: '11px',
      color: isDark ? '#888' : '#6a737d',
      backgroundColor: isDark ? '#404040' : '#f1f3f5',
      padding: '2px 6px',
      borderRadius: '10px',
    },
    entityList: {
      marginLeft: '20px',
      marginTop: '4px',
    },
    entityItem: {
      padding: '4px 8px',
      marginBottom: '2px',
      borderRadius: '4px',
      cursor: 'pointer',
      backgroundColor: isDark ? '#252526' : '#fff',
      border: `1px solid ${isDark ? '#3c3c3c' : '#e1e4e8'}`,
    },
    entityItemHover: {
      backgroundColor: isDark ? '#2a2d2e' : '#f6f8fa',
    },
    entityId: {
      color: isDark ? '#9cdcfe' : '#005cc5',
      fontSize: '11px',
    },
    entityData: {
      marginTop: '4px',
      paddingLeft: '12px',
      borderLeft: `2px solid ${isDark ? '#404040' : '#e1e4e8'}`,
    },
    field: {
      display: 'flex',
      marginBottom: '2px',
    },
    fieldName: {
      color: isDark ? '#9cdcfe' : '#005cc5',
      marginRight: '8px',
    },
    fieldValue: {
      color: isDark ? '#ce9178' : '#032f62',
    },
    emptyMessage: {
      color: isDark ? '#888' : '#6a737d',
      fontStyle: 'italic',
      padding: '8px',
    },
  };

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <span style={styles.title}>Simulator State</span>
        <span style={styles.version}>v{state.version}</span>
      </div>

      {entityTypes.length === 0 ? (
        <div style={styles.emptyMessage}>No entities defined</div>
      ) : (
        entityTypes.map(entityType => {
          const store = state.entities[entityType];
          const isCollapsed = collapsed[entityType];
          const isSelected = selectedEntity === entityType;
          const entities = Object.values(store.items);

          return (
            <div key={entityType} style={styles.entitySection}>
              <div
                style={{
                  ...styles.entityHeader,
                  ...(isSelected ? styles.entityHeaderSelected : {}),
                }}
                onClick={() => {
                  toggleCollapse(entityType);
                  onEntitySelect?.(entityType, '');
                }}
              >
                <span
                  style={{
                    ...styles.chevron,
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  }}
                >
                  ▼
                </span>
                <span style={styles.entityName}>{entityType}</span>
                <span style={styles.entityCount}>{store.count}</span>
              </div>

              {!isCollapsed && entities.length > 0 && (
                <div style={styles.entityList}>
                  {entities.map(entity => {
                    const isExpanded = expandedEntities.has(entity.id);
                    
                    return (
                      <div
                        key={entity.id}
                        style={styles.entityItem}
                        onClick={() => {
                          toggleEntity(entity.id);
                          onEntityClick?.(entityType, entity.id, entity);
                        }}
                      >
                        <span style={styles.entityId}>{entity.id.slice(0, 8)}...</span>
                        
                        {isExpanded && (
                          <div style={styles.entityData}>
                            {Object.entries(entity.data).map(([key, value]) => (
                              <div key={key} style={styles.field}>
                                <span style={styles.fieldName}>{key}:</span>
                                <span style={styles.fieldValue}>
                                  {formatValue(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isCollapsed && entities.length === 0 && (
                <div style={{ ...styles.emptyMessage, marginLeft: '20px' }}>
                  No {entityType} entities
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return '{...}';
  return String(value);
}

export default StateView;

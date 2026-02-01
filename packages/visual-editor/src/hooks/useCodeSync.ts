'use client';

import { useMemo } from 'react';
import { useEditorStore } from './useEditorStore';
import { serializeToISL } from '@/lib/serializer';

export function useCodeSync() {
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);
  const domainName = useEditorStore((state) => state.domainName);
  const domainVersion = useEditorStore((state) => state.domainVersion);

  const islCode = useMemo(() => {
    return serializeToISL({
      nodes,
      edges,
      domainName,
      domainVersion,
    });
  }, [nodes, edges, domainName, domainVersion]);

  return {
    islCode,
    domainName,
    domainVersion,
  };
}

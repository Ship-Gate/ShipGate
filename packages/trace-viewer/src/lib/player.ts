/**
 * Trace Playback Engine
 * 
 * Controls playback of verification traces with play/pause/step functionality.
 */

import { create } from 'zustand';
import type { Trace, TraceEvent, State, ViewerFilter, PlaybackState } from '@/types';
import { computeStateAtIndex, computeStateDiff, filterEventsByType, searchEvents } from './trace';

interface TracePlayerState {
  // Trace data
  trace: Trace | null;
  filteredEvents: TraceEvent[];
  
  // Playback state
  currentIndex: number;
  playing: boolean;
  speed: number;
  looping: boolean;
  
  // Computed state
  currentState: State;
  previousState: State | null;
  stateDiff: { path: string[]; oldValue: unknown; newValue: unknown }[];
  callStack: string[];
  
  // Filters
  filter: ViewerFilter;
  
  // Actions
  loadTrace: (trace: Trace) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBack: () => void;
  jumpTo: (index: number) => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  jumpToFailure: () => void;
  setSpeed: (speed: number) => void;
  setLooping: (looping: boolean) => void;
  setFilter: (filter: Partial<ViewerFilter>) => void;
  reset: () => void;
}

const defaultFilter: ViewerFilter = {
  eventTypes: [],
  showPassing: true,
  showFailing: true,
  searchQuery: '',
};

export const useTracePlayer = create<TracePlayerState>((set, get) => {
  let playInterval: ReturnType<typeof setInterval> | null = null;

  const stopPlayback = () => {
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
  };

  const startPlayback = () => {
    stopPlayback();
    const { speed } = get();
    const intervalMs = 1000 / speed;

    playInterval = setInterval(() => {
      const { currentIndex, playing, filteredEvents: fe, looping: loop } = get();
      
      if (!playing) {
        stopPlayback();
        return;
      }

      if (currentIndex >= fe.length - 1) {
        if (loop) {
          get().jumpToStart();
        } else {
          get().pause();
        }
        return;
      }

      get().stepForward();
    }, intervalMs);
  };

  const computeCurrentState = (trace: Trace | null, index: number): State => {
    if (!trace) return {};
    return computeStateAtIndex(trace, index);
  };

  const computeCallStack = (trace: Trace | null, index: number): string[] => {
    if (!trace) return [];
    
    const stack: string[] = [];
    for (let i = 0; i <= index; i++) {
      const event = trace.events[i];
      if (!event) continue;
      if (event.type === 'call' && event.data.kind === 'call') {
        stack.push(event.data.function);
      } else if (event.type === 'return' && event.data.kind === 'return') {
        const fnName = event.data.function;
        const idx = stack.lastIndexOf(fnName);
        if (idx >= 0) stack.splice(idx, 1);
      }
    }
    return stack;
  };

  const applyFilters = (trace: Trace | null, filter: ViewerFilter): TraceEvent[] => {
    if (!trace) return [];
    
    let events = trace.events;
    
    // Filter by event type
    if (filter.eventTypes.length > 0) {
      events = filterEventsByType(events, filter.eventTypes);
    }
    
    // Filter by pass/fail
    if (!filter.showPassing || !filter.showFailing) {
      events = events.filter(e => {
        if (e.type !== 'check' || e.data.kind !== 'check') return true;
        const passed = (e.data as { passed: boolean }).passed;
        return (passed && filter.showPassing) || (!passed && filter.showFailing);
      });
    }
    
    // Search filter
    if (filter.searchQuery) {
      events = searchEvents(events, filter.searchQuery);
    }
    
    return events;
  };

  return {
    // Initial state
    trace: null,
    filteredEvents: [],
    currentIndex: 0,
    playing: false,
    speed: 1,
    looping: false,
    currentState: {},
    previousState: null,
    stateDiff: [],
    callStack: [],
    filter: defaultFilter,

    // Actions
    loadTrace: (trace) => {
      stopPlayback();
      const filter = get().filter;
      const filteredEvents = applyFilters(trace, filter);
      const currentState = computeCurrentState(trace, 0);
      const callStack = computeCallStack(trace, 0);
      
      set({
        trace,
        filteredEvents,
        currentIndex: 0,
        playing: false,
        currentState,
        previousState: null,
        stateDiff: [],
        callStack,
      });
    },

    play: () => {
      set({ playing: true });
      startPlayback();
    },

    pause: () => {
      stopPlayback();
      set({ playing: false });
    },

    togglePlay: () => {
      const { playing } = get();
      if (playing) {
        get().pause();
      } else {
        get().play();
      }
    },

    stepForward: () => {
      const { trace, filteredEvents, currentIndex } = get();
      if (currentIndex >= filteredEvents.length - 1) return;
      
      const newIndex = currentIndex + 1;
      const previousState = computeCurrentState(trace, currentIndex);
      const currentState = computeCurrentState(trace, newIndex);
      const stateDiff = computeStateDiff(previousState, currentState);
      const callStack = computeCallStack(trace, newIndex);
      
      set({
        currentIndex: newIndex,
        previousState,
        currentState,
        stateDiff,
        callStack,
      });
    },

    stepBack: () => {
      const { trace, currentIndex } = get();
      if (currentIndex <= 0) return;
      
      const newIndex = currentIndex - 1;
      const previousState = newIndex > 0 ? computeCurrentState(trace, newIndex - 1) : null;
      const currentState = computeCurrentState(trace, newIndex);
      const stateDiff = computeStateDiff(previousState, currentState);
      const callStack = computeCallStack(trace, newIndex);
      
      set({
        currentIndex: newIndex,
        previousState,
        currentState,
        stateDiff,
        callStack,
      });
    },

    jumpTo: (index) => {
      const { trace, filteredEvents } = get();
      if (index < 0 || index >= filteredEvents.length) return;
      
      const previousState = index > 0 ? computeCurrentState(trace, index - 1) : null;
      const currentState = computeCurrentState(trace, index);
      const stateDiff = computeStateDiff(previousState, currentState);
      const callStack = computeCallStack(trace, index);
      
      set({
        currentIndex: index,
        previousState,
        currentState,
        stateDiff,
        callStack,
      });
    },

    jumpToStart: () => {
      get().jumpTo(0);
    },

    jumpToEnd: () => {
      const { filteredEvents } = get();
      get().jumpTo(filteredEvents.length - 1);
    },

    jumpToFailure: () => {
      const { trace, filteredEvents } = get();
      if (!trace) return;
      
      const failureIndex = filteredEvents.findIndex(
        e => e.type === 'check' && 
        e.data.kind === 'check' && 
        !(e.data as { passed: boolean }).passed
      );
      
      if (failureIndex >= 0) {
        get().jumpTo(failureIndex);
      }
    },

    setSpeed: (speed) => {
      set({ speed });
      const { playing } = get();
      if (playing) {
        startPlayback(); // Restart with new speed
      }
    },

    setLooping: (looping) => {
      set({ looping });
    },

    setFilter: (filterUpdate) => {
      const { trace, filter } = get();
      const newFilter = { ...filter, ...filterUpdate };
      const filteredEvents = applyFilters(trace, newFilter);
      
      set({
        filter: newFilter,
        filteredEvents,
        currentIndex: 0,
      });
      
      // Recompute state for new filtered view
      if (trace && filteredEvents.length > 0) {
        const currentState = computeCurrentState(trace, 0);
        const callStack = computeCallStack(trace, 0);
        set({
          currentState,
          previousState: null,
          stateDiff: [],
          callStack,
        });
      }
    },

    reset: () => {
      stopPlayback();
      set({
        trace: null,
        filteredEvents: [],
        currentIndex: 0,
        playing: false,
        speed: 1,
        looping: false,
        currentState: {},
        previousState: null,
        stateDiff: [],
        callStack: [],
        filter: defaultFilter,
      });
    },
  };
});

export type { PlaybackState };

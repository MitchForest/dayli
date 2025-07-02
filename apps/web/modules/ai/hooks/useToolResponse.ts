import { useMemo } from 'react';
import type { UniversalToolResponse } from '../schemas/universal.schema';
import type { Action } from '../schemas/universal.schema';

interface UseToolResponseOptions {
  onAction?: (action: Action) => void;
}

export function useToolResponse(
  responses: UniversalToolResponse | UniversalToolResponse[] | undefined,
  options: UseToolResponseOptions = {}
) {
  const normalizedResponses = useMemo(() => {
    if (!responses) return [];
    return Array.isArray(responses) ? responses : [responses];
  }, [responses]);

  const actions = useMemo(() => {
    return normalizedResponses.flatMap(response => response.ui?.actions || []);
  }, [normalizedResponses]);

  const suggestions = useMemo(() => {
    return normalizedResponses.flatMap(response => response.ui?.suggestions || []);
  }, [normalizedResponses]);

  const errors = useMemo(() => {
    return normalizedResponses
      .filter(response => response.error)
      .map(response => response.error!);
  }, [normalizedResponses]);

  const notifications = useMemo(() => {
    return normalizedResponses
      .filter(response => response.ui?.notification?.show)
      .map(response => response.ui!.notification!);
  }, [normalizedResponses]);

  const requiresConfirmation = useMemo(() => {
    return normalizedResponses.some(response => response.ui?.confirmationRequired);
  }, [normalizedResponses]);

  const confirmationIds = useMemo(() => {
    return normalizedResponses
      .filter(response => response.ui?.confirmationId)
      .map(response => response.ui!.confirmationId!);
  }, [normalizedResponses]);

  const handleAction = (action: Action) => {
    options.onAction?.(action);
  };

  return {
    responses: normalizedResponses,
    actions,
    suggestions,
    errors,
    notifications,
    requiresConfirmation,
    confirmationIds,
    handleAction,
  };
} 
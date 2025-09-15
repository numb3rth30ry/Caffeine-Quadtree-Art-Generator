import { useQuery } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { FileReference } from '../backend';

export function useFileReferences() {
  const { actor, isFetching } = useActor();

  return useQuery<FileReference[]>({
    queryKey: ['fileReferences'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listFileReferences();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useFileReference(path: string) {
  const { actor, isFetching } = useActor();

  return useQuery<FileReference>({
    queryKey: ['fileReference', path],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getFileReference(path);
    },
    enabled: !!actor && !isFetching && !!path,
  });
}

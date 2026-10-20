import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { list, save, dispense } from "./data";
import { useAuth } from "../app/context";
export function useRows(table: string) {
  const { scope } = useAuth();
  return useQuery({
    queryKey: ["records", scope, table],
    queryFn: () => list(table, scope),
  });
}
export function useSave(table: string) {
  const { scope } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      id,
    }: {
      data: Record<string, unknown>;
      id?: string;
    }) => save(table, data, scope, id),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["records"] }),
  });
}
export function useDispense() {
  const { scope } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => dispense(data, scope),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["records"] }),
  });
}

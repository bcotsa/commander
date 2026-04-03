import { useQuery } from '@tanstack/react-query'
import { searchCommanders, searchCards } from '@/lib/scryfall'

export function useCommanderSearch(query: string) {
  return useQuery({
    queryKey: ['scryfall', 'commanders', query],
    queryFn: () => searchCommanders(query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  })
}

export function useCardSearch(query: string) {
  return useQuery({
    queryKey: ['scryfall', 'cards', query],
    queryFn: () => searchCards(query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  })
}

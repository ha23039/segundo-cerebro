import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IsoDate } from '../../lib/dates'
import * as api from './api'
import type { ReviewText } from './domain/review'

export function useReviews() {
  return useQuery({ queryKey: ['reviews'], queryFn: api.fetchReviews })
}

export function useReviewMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['reviews'] })
  return {
    save: useMutation({ mutationFn: ({ weekStart, text }: { weekStart: IsoDate; text: ReviewText }) => api.saveReview(weekStart, text), onSuccess }),
    remove: useMutation({ mutationFn: api.deleteReview, onSuccess }),
  }
}

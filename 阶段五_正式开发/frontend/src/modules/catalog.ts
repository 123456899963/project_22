import { http } from '@/api/http'

export interface PageData<T> {
  items: T[]
  page: number
  size: number
  total: number
  hasMore: boolean
}

export interface SubcategoryItem {
  code: string
  name: string
  teaCount: number
  contentStatus: 'normal' | 'constructing'
}

export interface CategoryItem {
  code: string
  name: string
  teaCount: number
  contentStatus: 'normal' | 'constructing'
  subcategories: SubcategoryItem[]
}

export interface TeaSummary {
  id: number
  name: string
  categoryCode: string
  categoryName: string
  subcategoryCode?: string
  subcategoryName?: string
  grade?: string
  productionYear?: number
  yearBand?: string
  originPrimary?: string
  coverUrl?: string
  tags?: string[]
}

export interface TeaImageItem {
  id: number
  type: string
  seq: number
  url: string
  thumbUrl?: string
  sourceLicense?: string
}

export interface TeaDetail {
  id: number
  name: string
  aliases: string[]
  category: { code: string; name: string }
  subcategory: { code: string; name: string }
  grades: string[]
  productionYear?: number
  yearBand?: string
  origin: { primary: string[]; secondary: string[] }
  quality: { tags: string[]; description: string }
  brewing: Record<string, string>
  harvestPeriods: string[]
  standards: string[]
  images: TeaImageItem[]
  lastUpdateAt: string
  commentCount: number
  disclaimer: string
}

export interface HomeData {
  categories: CategoryItem[]
  featured: TeaSummary[]
  identifyEntry: string
  updatedAt: string
}

export interface SearchResult {
  items: Array<TeaSummary & { matchedAlias?: string }>
  page: number
  size: number
  total: number
  hasMore: boolean
}

export interface IdentifyOption {
  dimension: 'shape' | 'color' | 'soup' | 'ferment' | 'aroma'
  values: Array<{ code: string; label: string }>
}

export interface IdentifyResult {
  items: TeaSummary[]
  suggestions: TeaSummary[]
  page: number
  size: number
  total: number
  hasMore: boolean
}

export interface GalleryItem {
  id: number
  teaId: number
  teaName: string
  categoryCode: string
  imageType: string
  seq: number
  url: string
  thumbUrl?: string
  authorNickname?: string
  anonymous?: boolean
  tab: string
}

export const catalogApi = {
  home: () => http.get<HomeData>('/home'),
  categories: () => http.get<CategoryItem[]>('/categories'),
  teas: (params: Record<string, unknown>) => http.get<PageData<TeaSummary>>('/teas', params),
  tea: (id: string | number) => http.get<TeaDetail>(`/teas/${id}`),
  search: (q: string, page = 1, size = 12) =>
    http.get<SearchResult>('/search', { q, page, size }),
  identifyOptions: () => http.get<IdentifyOption[]>('/identify/options'),
  identifyResults: (payload: Record<string, unknown>) =>
    http.post<IdentifyResult>('/identify/results', payload),
  gallery: (tab: string, category: string | undefined, page = 1, size = 24) =>
    http.get<PageData<GalleryItem>>('/gallery', { tab, category, page, size })
}

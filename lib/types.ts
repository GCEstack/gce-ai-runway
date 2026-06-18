export type Agent = 'KIMI' | 'CLAUDE'
export type Service = 'spotify' | 'tidal' | 'beatport'
export type FeedSource = 'beatport' | '1001tracklists' | 'youtube'
export type RunStatus = 'running' | 'completed' | 'failed'

export type PlaylistStatus = 'active' | 'deleted'

export interface Playlist {
  id: string
  name: string
  agent: Agent
  service: Service
  external_id: string | null
  track_count: number
  prompt_name: string | null
  status: PlaylistStatus
  user_id: string
  created_at: string
  tags?: string | null
  comments?: string | null
  energy?: 'low' | 'medium' | 'high' | 'peak' | null
  rating?: number | null
  description?: string | null
  genre?: string | null
  bpm_min?: number | null
  bpm_max?: number | null
}

export interface Track {
  id: string
  title: string
  artist: string
  album: string | null
  source: Service
  isrc: string | null
  discovered_by: Agent
  prompt_name: string | null
  discovered_at: string
  release_date?: string | null
  tags?: string | null
  comments?: string | null
  keep_remove?: 'keep' | 'remove' | null
  playlist_id?: string | null
}

export interface Rating {
  id: string
  playlist_id: string
  rated_by: string
  rating: number | null
  feedback: string | null
  tracks_kept: number
  tracks_removed: number
  created_at: string
}

export interface Prompt {
  id: string
  name: string
  label: string | null
  genre: string | null
  energy: string | null
  bpm_min: number | null
  bpm_max: number | null
  timeframe: string | null
  release_date_range: string | null
  exclude_playlist: string | null
  limit: number
  description: string | null
  created_by: string | null
  created_at: string
}

export interface FeedItem {
  id: string
  source: FeedSource
  title: string
  artist: string | null
  url: string | null
  genre: string | null
  label: string | null
  published_at: string | null
  processed: boolean
}

export interface AgentRun {
  id: string
  agent: Agent
  prompt_name: string | null
  tracks_found: number
  tracks_matched: number
  started_at: string
  completed_at: string | null
  status: RunStatus
}

// API request/response shapes
export interface DiscoverRequest {
  prompt_id: string
  agent: Agent
}

export interface CreatePlaylistRequest {
  name: string
  agent: Agent
  service: Service
  track_ids: string[]
  prompt_name?: string
}

export interface RateRequest {
  playlist_id: string
  rating: number
  feedback?: string
  tracks_kept?: number
  tracks_removed?: number
}

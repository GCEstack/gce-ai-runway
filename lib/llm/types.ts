export type Persona = 'KIMI' | 'CLAUDE'

export interface TrackCandidate {
  title: string
  artist: string
  album: string
  source: 'spotify' | 'tidal'
  track_id: string
  url: string
  releaseDate?: string
}

export interface CuratedTrack extends TrackCandidate {
  score: number
  curation_reason: string
}

export interface CurationInput {
  persona: Persona
  promptName: string
  candidates: TrackCandidate[]
  targetCount: number
}

export interface PlaylistMetaInput {
  persona: Persona
  promptName: string
  genre?: string | null
  energy?: string | null
  bpmMin?: number | null
  bpmMax?: number | null
}

export interface PlaylistMeta {
  name: string
  description: string
}

export interface SourceTrack {
  title: string
  artist: string
  album: string
  source: 'spotify' | 'tidal'
}

export interface QueryEnhancerInput {
  persona: Persona
  sourcePlaylist: {
    name: string
    genre?: string | null
    energy?: string | null
    bpm_min?: number | null
    bpm_max?: number | null
    description?: string | null
    tags?: string | null
    comments?: string | null
  }
  sourceTracks: SourceTrack[]
  service: 'spotify' | 'tidal'
}

export interface EnhancedQueries {
  queries: string[]
  reasoning: string
}

export interface LLMMessage {
  role: 'system' | 'user'
  content: string
}

export type ResponseFormatType = 'json_object' | 'json_schema'

export interface LLMOptions {
  persona: Persona
  messages: LLMMessage[]
  temperature?: number
  max_tokens?: number
  responseFormat?: {
    type: ResponseFormatType
    schema?: object
  }
}

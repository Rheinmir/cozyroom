export type Artist = {
  id: string
  name: string
  image_url?: string
}

export type Album = {
  id: string
  artist_id: string
  artist_name: string
  title: string
  year: number
  cover_url: string
  artist_image_url?: string
}

export type Track = {
  id: string
  album_id: string
  title: string
  track_num: number
  duration_s: number
  artist_id?: string
  artist_name?: string
  album_title?: string
}

export type Stats = {
  artists: number
  albums: number
  tracks: number
}

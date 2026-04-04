export interface ScryfallCard {
  id: string
  name: string
  mana_cost?: string
  type_line: string
  oracle_text?: string
  power?: string
  toughness?: string
  color_identity: string[]
  image_uris?: ScryfallImageUris
  card_faces?: ScryfallCardFace[]
  set_name: string
  rarity: string
  prices?: { usd?: string; usd_foil?: string }
  scryfall_uri: string
}

export interface ScryfallCardFace {
  name: string
  mana_cost?: string
  type_line: string
  oracle_text?: string
  power?: string
  toughness?: string
  image_uris?: ScryfallImageUris
}

export interface ScryfallImageUris {
  small: string
  normal: string
  large: string
  art_crop: string
  border_crop: string
}

export interface ScryfallSearchResult {
  object: 'list'
  total_cards: number
  has_more: boolean
  data: ScryfallCard[]
}

export interface ScryfallError {
  object: 'error'
  code: string
  status: number
  details: string
}

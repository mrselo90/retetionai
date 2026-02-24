export interface ProductI18nSnapshot {
  title: string;
  description_html: string;
  specs_json: Record<string, any>;
  faq_json: any[];
}

export interface ShopSettingsRecord {
  shop_id: string;
  default_source_lang: string;
  enabled_langs: string[];
  multi_lang_rag_enabled: boolean;
}

export interface RetrievedProductEmbedding {
  productId: string;
  lang: string;
  similarity: number;
  distance: number;
  productName?: string;
  title?: string;
  descriptionText?: string;
}


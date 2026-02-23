# Gereksiz / Silinmeye Aday Dosyalar – Manifest

Bu dosya, projede tespit edilen gereksiz veya silinmeye aday döküman ve kod parçalarını listeler. Silmeden önce inceleyip karar verebilirsiniz. İsterseniz bu klasördeki kopyaları yedek olarak tutabilirsiniz.

---

## 1. Root dizini – tek seferlik / özet dökümanlar

| Dosya | Gerekçe |
|-------|--------|
| `MIGRATION_010_STATUS.md` | Migration 010 için tek seferlik durum özeti; migration zaten uygulanmış (activeContext'te belirtiliyor). |
| `DEPLOY_NOW.md` | Belirli commit'lere ve "SSH bekleniyor" durumuna özel tek seferlik deploy notu; güncel değil. |
| `DEPLOY_INSTRUCTIONS.md` | Kısa DigitalOcean deploy adımları; docs/deployment/DEPLOYMENT.md ile örtüşüyor, tek yerde toplanabilir. |
| `PERFORMANCE_OPTIMIZATIONS.md` | Belirli performans dalgasına özel deploy rehberi; docs/performance/OPTIMIZATION.md genel rehber olarak duruyor, içerik örtüşmesi var. |
| `UXUI-COMPLETE.md` | UX/UI tamamlama özeti; memory-bank/ux-ui-complete-summary.md ile neredeyse aynı içerik (ikisi de "89% complete"). |

---

## 2. memory-bank – tamamlanmış / durum özeti dosyaları

| Dosya | Gerekçe |
|-------|--------|
| `memory-bank/tasks-testing.md` | Test task listesi (tamamlanmış olabilir). |
| `memory-bank/tasks-marketplace-ready.md` | Marketplace task listesi. |
| `memory-bank/tasks-kubernetes-newrelic.md` | K8s/New Relic task listesi. |
| `memory-bank/roadmap-to-marketplace.md` | Roadmap özeti. |
| `memory-bank/roadmap-shopify-perfect-match.md` | Shopify roadmap. |
| `memory-bank/audit-shopify-perfect-match.md` | Audit özeti. |
| `memory-bank/ux-ui-improvements.md` | UX iyileştirme notları. |
| `memory-bank/ux-ui-complete-summary.md` | UX tamamlama özeti (root'taki UXUI-COMPLETE.md ile duplicate). |
| `memory-bank/CURRENT_STATUS.md` | Sunucu/durum özeti (IP, pm2; hızla güncel dışı kalabilir). |
| `memory-bank/SHOPIFY_READINESS_ASSESSMENT.md` | Tek seferlik değerlendirme. |

---

## 3. docs – tekrarlı veya örtüşen rehberler

| Dosya | Gerekçe |
|-------|--------|
| `docs/setup/whatsapp-setup.md` | WhatsApp kurulum; docs/installation/whatsapp-setup.md ile duplicate (installation ana rehber olarak kalabilir). |
| `docs/guides/troubleshooting.md` | Troubleshooting; docs/installation/troubleshooting.md ile aynı konu iki yerde (biri aday). |

---

## 4. Supabase – çok sayıda migration talimatı

| Dosya | Gerekçe |
|-------|--------|
| `supabase/RUN_NOW.md` | Migration nasıl çalıştırılır – dört ayrı dokümandan biri; tek README veya MIGRATION_INSTRUCTIONS altında birleştirilebilir. |
| `supabase/RUN_MIGRATIONS.md` | Aynı konu, fazla talimat. |
| `supabase/QUICK_START.md` | Aynı konu, fazla talimat. |
| `supabase/MIGRATION_INSTRUCTIONS.md` | Aynı konu; bir tanesi kalıp diğerleri aday. |

---

## 5. Scripts – tek kullanımlık / tanı araçları (isteğe bağlı)

| Dosya | Gerekçe |
|-------|--------|
| `scripts/check-tables.js` | Tanı amaçlı, sürekli kullanım yok. |
| `scripts/check-columns.js` | Tanı amaçlı, sürekli kullanım yok. |
| `scripts/check-integration.js` | Tanı amaçlı, sürekli kullanım yok. |
| `scripts/check-migration.ts` | Tanı amaçlı, sürekli kullanım yok. |

---

## 6. Eski / yedek dosyalar

| Dosya | Gerekçe |
|-------|--------|
| `.cursor/rules/isolation_rules/visual-maps/van_mode_split/van-qa-validation.md.old` | Açıkça .old yedek. |

---

## 7. Referans SQL (migration'larla örtüşebilir)

| Dosya | Gerekçe |
|-------|--------|
| `docs/sql/product_enrichment_columns.sql` | Referans SQL; migration'larda (örn. 013) karşılığı varsa sadece dokümantasyon veya gereksiz aday. |

---

## Özet

- **Toplam aday:** 27 dosya
- **Kopyalar:** Bu klasörde `root/`, `memory-bank/`, `docs/`, `supabase/`, `scripts/`, `cursor-rules/`, `docs-sql/` altında orijinal yapı korunarak kopyaları bulunur.
- **Silme:** Ana projeden silmeden önce bu listeyi ve kopyaları inceleyin; onayladığınız dosyaları silebilirsiniz.

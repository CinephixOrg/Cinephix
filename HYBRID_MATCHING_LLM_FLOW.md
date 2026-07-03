## LLM Entegrasyon Akış Şeması

Aşağıdaki akış, `Analyze` butonuna basıldığında LLM'e gönderilecek verinin hazırlanması, model seçimi, güvenlik ve rollout adımlarını sırayla gösterir.

```mermaid
flowchart TD
  A[Analyze butonuna basıldı] --> B[Backend: GET/POST /api/match/user/:id]
  B --> C[`llmFormatterService.formatForLLM()` ile sabit JSON oluştur]
  C --> D{PII/Gizlilik kontrolü}
  D -->|maskele| E[ID hashleme, profile_pic_url redaction]
  D -->|gerekmiyorsa| E
  E --> F[Prompt template ekle (`prompt_template`) ve istek meta bilgisi]
  F --> G{Model Türü Seçimi}
  G -->|Bütçe Cloud| H[OpenAI gpt-3.5-turbo via `llmAdapter`]
  G -->|Orta Kalite Cloud| I[gpt-4o-mini / Anthropic via `llmAdapter`]
  G -->|Yerel OSS| J[Quantized Llama/Mistral via local adapter]
  H --> K[İstek: caching + rate-limit kontrolü]
  I --> K
  J --> K
  K --> L[LLM cevabını parse et + JSON şema validasyonu]
  L --> M[Analiz & kısa özet, strengths, conversation starters, graph_ascii]
  M --> N[Sonuçları cache ve telemetry ile kaydet]
  N --> O[Frontend: Analyze modal'a döndür (buton default disabled)]
  O --> P[A/B Rollout & monitoring, maliyet takibi]

  style A fill:#fef3c7,stroke:#f59e0b
  style P fill:#ecfeff,stroke:#06b6d4
```

Kısa adımlar (sıralı):
- 1) `getMatchWithUser` çağrısı → 2) `llmFormatterService` ile sabit JSON → 3) PII redaction
- 4) Prompt template ve output-key şeması belirleme
- 5) `llmAdapter` ile model çağrısı (cache + rate-limit)
- 6) Output validasyonu, kısa analiz + graph verisi üretme
- 7) Sonuçları kaydet, frontend'e döndür, A/B rollout yap

Güvenlik ve operasyon notları:
- PII kesinlikle maskelenmeli/hasedlenmeli öncesinde dışa çıkmadan.
- Her LLM isteği için cevap şeması validasyonu yapın (zorunlu anahtarlar: `analysis`, `strengths`, `weaknesses`, `conversation_starters`, `graph_ascii`).
- Önbellekleme ve rate-limit ile maliyet kontrolü şart.

Bu dosya, akışı hızlıca görselleştirir; isterseniz benzer şemayı frontend tasarımına uygun SVG/PNG olarak da üretebilirim.

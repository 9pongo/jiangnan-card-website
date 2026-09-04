# 江南寶卡正式化工程包

本文件是江南寶卡從 GitHub Pages 展示版進入正式營運環境的可執行交接包。它將現有程式可直接交付的內容、工程可補齊項目、以及必須由公司或供應商決定的外部依賴分開列示。

**重要界線：** GitHub Pages 與 `/admin/` 目前僅供展示及審稿，不能連到正式 API，也不能接受會員付費、後台登入或真實個資。訂單目前是「付款意向＋庫存保留」，不是付款成功；不可直接對外販售。

## 1. 目前可交付基線

| 領域 | 已有內容 | 工程證據 |
| --- | --- | --- |
| 公開網站 | 商品、活動、公告、Banner、商品／文章詳細頁、購物車展示與會員介面 | `index.html`、`product.html`、`post.html` |
| 後台 | 商品、公告、Banner、寄售、訂單、成員／權限的操作介面與展示模式 | `admin/` |
| 商品價格 | 原價／活動價、雙人覆核、提案、撤回、駁回與調價歷程 | `server/db/migrations/008` 至 `010`、`server/src/server.js` |
| Banner | 店內活動與第三方廣告共用版位、審核、排程、優先權、素材上傳意圖 | `server/db/migrations/002`、`011`、`server/src/storage.js` |
| 會員 | 不可修改 Email 帳號、密碼雜湊、地址、Email 驗證、忘記密碼、付款前手機驗證、條款同意紀錄 | `server/src/customer-membership.js`、`015`、`016` |
| 訂單意向 | 伺服器重新計價、冪等鍵、現貨保留、逾時釋放與稽核紀錄 | `server/db/migrations/006`、`012`、`server/src/server.js` |
| 後台授權 | demo 角色、本機權限驗收，以及 production OIDC JWT 驗證與資料庫角色對應 | `server/src/auth.js`、`server/src/server.js` |
| 資料與稽核 | PostgreSQL migration、不可更新／刪除的 `audit_log` | `server/db/migrations/` |
| 條款頁面 | 使用者規章與隱私權條款獨立頁面，註冊時會保存同意版本與時間 | `terms.html`、`privacy.html` |

## 2. 正式上線前的工作包

### P0：付款、履約與金流對帳

這是正式收款前不可省略的工程包。現有程式不能把 `pending_payment` 改為 `paid`。

1. 選定公司簽約的金流商，取得 sandbox 與 production webhook 規格、簽章機制、退款 API 與對帳檔格式。
2. 建立 `payment_attempts`、`payment_webhook_inbox`、退款紀錄與出貨履約紀錄 migration。每筆交易必須以金流交易識別碼與訂單號建立唯一索引。
3. 實作建立付款單、簽名驗證 webhook、去重 inbox、交易式更新訂單為 `paid`、可重試對帳與退款。Webhook 超時、非 2xx 或簽章錯誤都只能標為待對帳，不可自動視為付款成功。
4. 將庫存保留規則與付款完成規則放在同一資料庫交易；付款失敗／逾時應可安全釋放庫存；重送 webhook 不可重複扣庫存或重複出貨。
5. 串接發票服務前，先確認開立／作廢／折讓、載具、捐贈與對帳責任；發票開立必須由付款成功事件驅動且可追溯。
6. 對預購商品定義訂金、尾款、取消、到貨通知與逾期未取規則；對現貨商品定義出貨／店取／取消／退款狀態機。

**驗收證據：** 金流 sandbox 成功、失敗、取消、逾時、重送 webhook、退款與對帳檔各至少一筆；每筆可從訂單號查回金流識別碼、稽核紀錄與履約結果。

### P0：顧客通知

現有 `customer-membership.js` 在 `NODE_ENV=production` 會故意拒絕發送驗證碼，避免把本機展示碼誤當作正式驗證。因此必須完成下列接點後才可開放註冊與付款：

1. 由公司決定 Email 與 SMS 供應商、發信網域、寄件人、簡訊簽名與帳單責任。
2. 建立通知 provider adapter：只接受 `email_registration`、`password_reset`、`phone_payment` 三種目的；驗證碼不得寫入 API 回應、日誌、前端或分析平台。
3. 對每個 Email／手機／IP 增加傳送與驗證速率限制，並將失敗、鎖定與傳送供應商回應記入可查核紀錄。
4. 加入模板版本、語言、逾時時間、重送冷卻時間與供應商故障的 fail-closed 行為。
5. 實測 Email 驗證、忘記密碼、付款前手機驗證、重送、過期碼、錯誤碼、手機換號與供應商故障。

**驗收證據：** production 環境的 API 不再回傳 `verificationCode`；真實測試帳號可收到三種訊息；未驗證手機無法建立付款單。

### P0：正式雲端與後台 SSO

現有 API 同時支援 AWS S3 與 GCS 作為 Banner 素材儲存，容器與 PostgreSQL 設計不綁單一雲端。選定公司既有治理較完整的 AWS 或 GCP 後，依下表一次建立。

| 能力 | AWS 建議 | GCP 建議 | 完成定義 |
| --- | --- | --- | --- |
| API 容器 | ECS Fargate／App Runner | Cloud Run | 私有資料庫連線、HTTPS、健康檢查與自動部署 |
| PostgreSQL | RDS PostgreSQL | Cloud SQL PostgreSQL | 私網、每日備份、PITR、還原演練 |
| Banner | S3＋CloudFront | Cloud Storage＋Cloud CDN | 私有上傳、公開 CDN 讀取、版本控管 |
| 排程 | EventBridge＋受限呼叫 | Cloud Scheduler＋受限呼叫 | 每分鐘安全呼叫逾時訂單釋放 API |
| 秘密 | Secrets Manager | Secret Manager | 工作負載身分讀取；Git 與瀏覽器無秘密 |
| 後台登入 | 公司 IdP OIDC | 公司 IdP OIDC | 已授權帳號可登入、未知帳號 403 |

部署環境必填設定以 `.env.production.example` 為準：`NODE_ENV=production`、`AUTH_MODE=oidc`、`DATABASE_URL`、`PUBLIC_ORIGIN`、`OIDC_ISSUER`、`OIDC_AUDIENCE`、`ORDER_EXPIRY_TOKEN`、`ORDER_EXPIRY_ACTOR_ID`、`ASSET_STORAGE_PROVIDER`、`ASSET_BUCKET`、`ASSET_PUBLIC_BASE_URL`。部署前必跑：

```powershell
cd server
npm run verify:production-config
```

### P1：安全、個資與營運韌性

1. 於 API 入口設置 WAF、速率限制、DDoS／機器人防護及正式後台的網路限制；應用程式既有 header 不能取代邊界防護。
2. 對 Banner 物件建立事件串接防毒、真實影像格式與尺寸檢查；未通過掃描者不得變成可發布素材。
3. 建立個資存取記錄、資料主體請求流程、資料刪除／封存工作、備份加密、還原演練與保留年限。
4. 確認條款版本及生效日，將 `CUSTOMER_TERMS_VERSION`、`CUSTOMER_PRIVACY_VERSION` 設為正式版本值；若條款變更，需定義既有會員重新同意規則。
5. 將 `audit_log`、付款 inbox、訂單與資料庫備份納入監控／告警；告警應包含排程失敗、付款對帳差異、庫存負值、登入拒絕異常及素材掃描失敗。
6. 建立 CI：migration 檢查、`npm test`、靜態 JavaScript 檢查、依賴漏洞掃描與 staging smoke test。

### P1：寄售售出與結算

目前寄售僅做到收件與上架流程；後台刻意沒有「手動售出」或「手動結算」按鈕。

1. 定義寄售品唯一識別、寄售人、收件照片／品況、委託售價、服務費率、合約版本、可售庫存與結算帳戶資料。
2. 將寄售商品售出事件綁定付款完成，而非人工點選；同一筆售出只能結算一次。
3. 建立寄售款可付、付款中、已付款、退款／爭議的不可逆帳務紀錄與對帳流程。
4. 定義寄售到期、退回、價格調整授權、遺失／毀損及爭議處理規則，並在會員／寄售條款中公開。

## 3. 一次性交接輸入單

以下內容無法由程式推定，請由店主、公司 IT 或簽約供應商一次提供。不要在 Git、聊天紀錄或 `runtime-config.js` 提供密碼、金鑰或 Token。

| 項目 | 提供者 | 所需資料 |
| --- | --- | --- |
| 雲端選擇與帳戶 | 公司 IT | AWS 或 GCP 專案／帳戶、區域、工作負載身分、網域與 DNS 權限 |
| API 與前台網域 | 公司 IT／店主 | `api`、`admin`、`www` 網域、憑證及 CDN 規則 |
| 後台 SSO | 公司 IT | OIDC issuer、audience、JWKS、登入方式、要授權的人員 subject 與角色 |
| 金流與發票 | 財務／簽約窗口 | 商家代號、sandbox、webhook 規格、簽章驗證、退款與對帳格式 |
| Email 與 SMS | 營運／採購 | 供應商、寄件網域、簡訊簽名、帳務帳號、模板核可文字 |
| 物流與店取 | 營運 | 可用物流、配送溫層、運費規則、店取通知與逾期規則 |
| 條款與個資 | 店主／法務 | 條款生效日、公司資訊、客服窗口、實際第三方與資料保存政策 |
| 商品與寄售規則 | 店主 | 預購訂金、取消、活動價、寄售費率、結算週期與爭議規則 |

## 4. 角色與權限基線

現有後台角色：`admin`、`product_editor`、`content_editor`、`ad_operator`、`consignment_staff`。正式模式僅以 OIDC `subject` 對應 `users.external_subject` 後取得資料庫角色；不可相信前端角色欄位，也不可自動替 SSO 新帳號建立管理權限。

| 角色 | 可負責的作業 | 不可自行完成的作業 |
| --- | --- | --- |
| 商品編輯 | 建立商品、活動價提案、送審 | 核准自己的商品或價格 |
| 商品審核 | 核准／駁回他人提案 | 核准自己的提案 |
| 廣告營運 | 建立店內／第三方 Banner 草稿、送審 | 核准自己的廣告 |
| 內容編輯 | 公告與活動內容 | 未核准的對外發布 |
| 寄售人員 | 收件、品況、上架狀態 | 手動確認售出或付款結算 |
| 管理員 | 帳號授權、覆核、營運監督 | 以後台繞過付款 webhook 或稽核紀錄 |

## 5. 上線關卡與驗收

只有全部 P0 通過才可接受顧客付款。每一關都要留下截圖、測試訂單號或供應商事件識別碼。

- [ ] 雲端：production 設定檢查通過，資料庫私網、備份與還原演練完成。
- [ ] SSO：有效管理者、未授權 SSO 帳號、缺少 token、失效 token 均得到預期結果。
- [ ] 通知：Email 註冊、密碼重設、SMS 付款驗證實機通過，且 API／日誌不洩漏驗證碼。
- [ ] 付款：成功、取消、失敗、webhook 重送、逾時、退款及對帳差異皆可安全處理。
- [ ] 庫存：最後一件商品的同時結帳、付款逾時釋放、重送同一冪等鍵均無超賣或重複扣庫存。
- [ ] 商品：原價、活動價、雙人覆核與價格歷程於前後台一致。
- [ ] Banner：上傳、掃描拒絕、核准、排程、店內活動優先與第三方「廣告」標示均正確。
- [ ] 寄售：收件至上架的狀態機、寄售人個資權限與稽核記錄正確；售出／結算尚未完成前不可承諾對外服務。
- [ ] 隱私：正式條款、客服與資料主體請求窗口、第三方清單及 Cookie 實作一致。
- [ ] 監控：健康檢查、錯誤、付款對帳差異、排程失敗、資料庫容量與備份失敗均有告警接收者。

## 6. 交付順序

1. 公司選定 AWS 或 GCP 與正式網域，建立 staging。
2. 工程完成通知、金流 webhook／對帳及 CI 測試，再以 sandbox 驗收。
3. 公司提供 SSO、金流、通知與條款最終資料，注入秘密管理服務，不提交至 Git。
4. 執行 migration、production 設定檢查、staging 全關卡驗收與還原演練。
5. 進行一次受控的 production 低流量發布；付款、庫存、通知與告警全部觀察正常後再開放完整商品目錄。

相關部署細節請見 [DEPLOYMENT.md](DEPLOYMENT.md)、安全風險請見 [SECURITY_REVIEW.md](SECURITY_REVIEW.md)、本機驗收案例請見 [QA_CHECKLIST.md](QA_CHECKLIST.md)。

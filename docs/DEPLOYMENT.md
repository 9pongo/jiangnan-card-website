# 江南寶卡正式版部署基線

## 第一階段範圍

- 公開官網：商品、活動、公告、寄售入口、Banner 讀取。
- 管理後台：Banner 草稿、送審、發布、排程、活動與第三方廣告分類。
- API：公開 Banner 查詢、管理端 Banner 建立與發布工作流。
- 資料：PostgreSQL、物件儲存與不可變更的 `audit_log` 操作紀錄。

訂單、付款、庫存扣減與寄售款項結算不得以這個初始 API 直接上線；這些流程需要各自的交易、冪等鍵、對帳與權限設計。

## 雲端選擇

部署到公司既有 SSO、監控、備份和網路治理較完整的一側。應用程式保持容器化與 PostgreSQL 相容，不綁定單一雲端。

| 能力 | AWS | GCP |
| --- | --- | --- |
| 容器 API | ECS Fargate 或 App Runner | Cloud Run |
| PostgreSQL | RDS PostgreSQL | Cloud SQL PostgreSQL |
| Banner 圖片 | S3 與 CloudFront | Cloud Storage 與 Cloud CDN |
| 排程 | EventBridge 與 SQS | Cloud Scheduler 與 Pub/Sub |
| 監控 | CloudWatch | Cloud Logging 與 Monitoring |

## 必要安全控制

1. 正式環境設定 `AUTH_MODE=oidc`、`OIDC_ISSUER` 與 `OIDC_AUDIENCE` 後，以公司 SSO 的 OIDC JWT 驗證。`x-demo-role` 僅在 `AUTH_MODE=demo` 可用；正式模式會忽略它。每個 SSO subject 必須先對應至 `users.external_subject`，權限只從資料庫角色取得。
2. 素材上傳由 API 驗證檔案類型與大小後簽發短效 S3／Cloud Storage 上傳網址。瀏覽器與 Git 儲存庫不得保存雲端金鑰；實際圖片尺寸與安全掃描須在物件建立事件中驗證。
3. 第三方廣告由廣告營運建立，店長或管理員核准才能進入 `published`／`scheduled` 狀態。
4. 所有發布、停用、優先權變更與排程調整寫入 `audit_log`；資料庫觸發器會拒絕 `UPDATE` 和 `DELETE`，稽核表僅能新增。
5. PostgreSQL 啟用每日備份、時間點還原及異地備援；物件儲存開啟版本控管與生命週期政策。
6. API 僅經 HTTPS 對外，資料庫只放在私有網路。後台另加 WAF、速率限制與管理網段／SSO 條件。
7. API 已停用 `X-Powered-By`，並回傳 `nosniff`、點擊框架防護、Referrer Policy 與 Permissions Policy；production 模式加上 HSTS。CDN／反向代理仍須統一施加 HTTPS、WAF 與速率限制，不能以本機 header 取代邊界防護。
8. 顧客會員與後台員工帳號必須分離。顧客使用不可修改的電子信箱登入，付款前需驗證手機；正式環境必須由核可的 Email 與 SMS 供應商送出驗證碼。程式在 production 沒有通知服務時會拒絕驗證，禁止使用本機展示碼。

## Banner 素材上傳

1. 正式環境設定 `ASSET_STORAGE_PROVIDER=s3` 或 `gcs`、`ASSET_BUCKET`、`ASSET_PUBLIC_BASE_URL`，並以服務執行身分提供最小權限：建立短效 PUT 簽名、讀取新物件的中繼資料。S3 使用 `AWS_REGION` 與工作負載 IAM Role；GCP 使用 Cloud Run／GKE 的 Workload Identity。不得設定長效 access key 到前端或 Git。
2. 後台僅允許 PNG、JPG、WebP，檔案最大 5 MB。API 先建立 `banner_assets` 上傳意圖，簽名 URL 五分鐘後失效；瀏覽器直傳物件儲存，API 以伺服器身分驗證物件的 Content-Type 與大小後才允許將該素材建立為 Banner。
3. S3 bucket 或 Cloud Storage bucket 必須設定 CORS，僅允許正式後台 origin 對短效 PUT URL 發送 `PUT` 與 `Content-Type`。公開素材只經 CDN 的 `ASSET_PUBLIC_BASE_URL` 提供。
4. 目前完成驗證只核對物件中繼資料；正式上線前仍必須在物件建立事件上串接惡意檔掃描與實際影像格式／尺寸檢查，掃描未通過的素材不得標記為 `uploaded` 或用於發布 Banner。

## 商品價格與活動價審核

1. `priceCents` 是結帳唯一採用的售價；`originalPriceCents` 是前台劃線顯示的原價，必須大於或等於售價。前端傳入的價格不會被結帳 API 信任，訂單一律在資料庫交易內重新讀取商品售價。
2. 商品編輯若申請直接上架，任何角色建立的新商品都會進入 `pending_review`；另一位具 `product:approve` 權限的人核准後才變成 `published`。建立人不得自行核准。
3. 已上架商品的任何修改都會建立 `product_change_proposals` 待審提案；提案人不得自行核准。公開前台會繼續顯示原本已發布的商品與價格；核准時才會在同一筆資料庫交易中套用提案並留下稽核紀錄。
4. 每個商品同時只能有一筆待審變更。若店員需要更正已送審的價格，應由具審核權者處理原提案後再提交，避免兩筆價格提案互相覆蓋。
5. 提案人可撤回自己的待審變更；具 `product:approve` 權限且非提案人的審核者可駁回並填寫原因。撤回、駁回原因、核准人與時間都會保留在提案與 `audit_log`，不會改寫原本公開商品價格。
6. 商品管理頁透過 `GET /api/v1/admin/products/:id/change-history` 顯示唯讀調價歷程。此 API 需要 `product:view`，只回傳伺服器保存的提案與審核資訊，不接受前台傳回的稽核內容。
7. 每項商品必須設定分類：`booster`（卡包）、`single_card`（單卡）、`accessories`（卡牌周邊）或 `toy_model`（玩具模型）。分類會隨商品提案一起審核，公開 API 回傳相同欄位供前台篩選；既有未含分類的提案會以 `booster` 相容處理。

## 寄售案件作業

1. 寄售案件的作業狀態僅允許 `submitted → received → listed → returned`，或在收件前 `submitted → cancelled`；每次變更均由 API 驗證前一狀態並寫入稽核紀錄。
2. 後台不提供手動標記「售出」或手動結算寄售款項。這兩個動作必須由付款、庫存與對帳流程以可重試且可稽核的交易處理，避免單一後台按鈕造成卡片與款項狀態不一致。

## 訂單意圖與庫存保留

1. 建立訂單意圖時，現貨商品會在同一交易中扣除可售庫存，並記錄 `expires_at`；預設保留時間為 30 分鐘，可由 `ORDER_INTENT_TTL_MINUTES` 調整。訂單意圖不是付款成功，也不可由後台手動改成已付款。
2. 由受管排程器呼叫 `POST /api/v1/internal/orders/release-expired`，帶入 `X-Order-Expiry-Token`。排程執行身分必須設定 `ORDER_EXPIRY_TOKEN` 與已對應 `users` 的 `ORDER_EXPIRY_ACTOR_ID`；API 會在同一交易中釋回保留現貨、標記訂單 `expired`、記錄釋放時間與稽核資料。逾時作業可安全重試。
3. 正式環境將此端點置於私有網路，僅允許 EventBridge／Cloud Scheduler 等排程工作負載呼叫；不得在瀏覽器、GitHub Pages 或管理後台暴露該 token。

## Banner 顯示規則

1. 僅選擇 `published` 或 `scheduled`，且目前位於 `starts_at` 與 `ends_at` 期間的素材。
2. 同版位的「店內活動」若優先權至少為 `900`，一定優先於第三方廣告。
3. 其餘素材依優先值、有效時間與曝光上限輪播；每次選取與點擊都以伺服器事件鍵紀錄。
4. 第三方 Banner 在前台必須顯示「廣告」，外部連結使用 `rel="noopener sponsored"`。

## 本機啟動

```powershell
cd outputs
docker compose up --build
```

既有本機資料庫升級時，依序套用新的 SQL migration，例如：

```powershell
docker compose exec -T db psql -U jiangnan_card -d jiangnan_card -f /docker-entrypoint-initdb.d/014_product_categories.sql
docker compose up -d --build api
```

- 公開網站：`http://localhost:4173/`
- 後台展示：`http://localhost:4173/admin/`
- API 健康檢查：`http://localhost:3000/health`

本機 compose 預設啟用 `ASSET_STORAGE_PROVIDER=local`，將 Banner 圖片放在 Docker named volume，讓完整上傳、驗證與建立 Banner 的流程可以在不使用雲端憑證下驗收。此 provider 只允許非 production 模式，不能用於正式部署。

目前 GitHub Pages 只負責靜態展示；正式 API 與後台需要部署至公司選定的 AWS 或 GCP 帳戶。

## 公開前台設定

1. 將公開官網部署至 CDN 或靜態網站服務，並在發布階段將 `runtime-config.js` 的 `window.JIANGNAN_API_BASE` 覆寫為公開 API 的 HTTPS origin；不要將任何金鑰放入此檔案。
2. 公開首頁會讀取已發布商品、公告、活動與 Banner。商品詳細頁使用 `product.html?id={uuid}`，公告與活動詳細頁使用 `post.html?slug={slug}`。
3. API 必須以 `PUBLIC_ORIGIN` 僅允許正式官網來源的 CORS 請求。GitHub Pages 是展示用途，`runtime-config.js` 保持空值，不可連到正式訂單 API。

## 後台 SSO 連線

1. 正式後台部署時，將 `window.JIANGNAN_ADMIN_API_BASE` 設為 HTTPS API origin，並由公司 OIDC 用戶端提供 `window.JIANGNAN_GET_ACCESS_TOKEN` 非同步函式；函式只能回傳短效 access token，不能將使用者密碼、client secret 或雲端金鑰寫入瀏覽器。
2. 後台 API 用戶端僅以 `Authorization: Bearer` 傳送該 token。API 會以 `external_subject` 對應資料庫角色並拒絕未知帳號；不能使用前端傳來的角色名稱授權。
3. 若以上兩項任一未設定，後台會保持展示模式。GitHub Pages 的 `/admin/` 不是正式管理後台，不能填入正式 API 網址或存取權杖。

### OIDC 上線前檢核

1. 複製專案根目錄的 `.env.production.example` 到部署平台的秘密管理服務或環境變數設定；範本只說明欄位，不得填入或提交真實密碼、Token、OIDC client secret 或雲端金鑰。
2. 將 `AUTH_MODE=oidc`、`OIDC_ISSUER` 與 `OIDC_AUDIENCE` 設為公司核發 access token 的實際值。production 模式若不是 `oidc`，API 會拒絕啟動；`x-demo-role` 只可用在本機 demo 模式。
3. 由管理員先建立可登入人員的 `users.external_subject` 對應與角色。未知 subject 必須回 403，不得因登入而自動建立帳號；離職或調職時先停用 IdP 存取，再調整應用程式角色。
4. 在部署工作負載注入設定後、切換流量前執行：

```powershell
cd server
npm run verify:production-config
```

此檢查會拒絕 demo 授權模式、缺少 OIDC／資料庫／素材／排程設定、非 HTTPS 公開來源、本機素材 provider 與展示用的到期訂單 token。它只驗證設定完整性，不能取代公司 IdP 的實際登入驗收。
5. 使用一個已授權帳號與一個未授權帳號進行 staging 驗收：已授權帳號應只得到資料庫角色授予的功能；未知帳號應回 403；缺少或無效 access token 應回 401；正式 API 不得接受 `x-demo-role`。

## 資料庫遷移

新資料庫容器會依序套用 `001_initial.sql` 到 `017_payment_integration_foundation.sql` 與種子資料。正式環境必須由 CI/CD 在部署前以受管的遷移工作執行相同 SQL，並記錄執行版本；不得依賴應用程式啟動時自動變更資料庫結構。

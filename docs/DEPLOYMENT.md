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
2. 素材上傳由 API 驗證檔案類型、大小、尺寸後簽發短效 S3／Cloud Storage 上傳網址。瀏覽器與 Git 儲存庫不得保存雲端金鑰。
3. 第三方廣告由廣告營運建立，店長或管理員核准才能進入 `published`／`scheduled` 狀態。
4. 所有發布、停用、優先權變更與排程調整寫入 `audit_log`；資料庫觸發器會拒絕 `UPDATE` 和 `DELETE`，稽核表僅能新增。
5. PostgreSQL 啟用每日備份、時間點還原及異地備援；物件儲存開啟版本控管與生命週期政策。
6. API 僅經 HTTPS 對外，資料庫只放在私有網路。後台另加 WAF、速率限制與管理網段／SSO 條件。

## 商品價格與活動價審核

1. `priceCents` 是結帳唯一採用的售價；`originalPriceCents` 是前台劃線顯示的原價，必須大於或等於售價。前端傳入的價格不會被結帳 API 信任，訂單一律在資料庫交易內重新讀取商品售價。
2. 商品編輯若申請直接上架，任何角色建立的新商品都會進入 `pending_review`；另一位具 `product:approve` 權限的人核准後才變成 `published`。建立人不得自行核准。
3. 已上架商品的任何修改都會建立 `product_change_proposals` 待審提案；提案人不得自行核准。公開前台會繼續顯示原本已發布的商品與價格；核准時才會在同一筆資料庫交易中套用提案並留下稽核紀錄。
4. 每個商品同時只能有一筆待審變更。若店員需要更正已送審的價格，應由具審核權者處理原提案後再提交，避免兩筆價格提案互相覆蓋。
5. 提案人可撤回自己的待審變更；具 `product:approve` 權限且非提案人的審核者可駁回並填寫原因。撤回、駁回原因、核准人與時間都會保留在提案與 `audit_log`，不會改寫原本公開商品價格。

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

- 公開網站：`http://localhost:4173/`
- 後台展示：`http://localhost:4173/admin/`
- API 健康檢查：`http://localhost:3000/health`

目前 GitHub Pages 只負責靜態展示；正式 API 與後台需要部署至公司選定的 AWS 或 GCP 帳戶。

## 公開前台設定

1. 將公開官網部署至 CDN 或靜態網站服務，並在發布階段將 `runtime-config.js` 的 `window.JIANGNAN_API_BASE` 覆寫為公開 API 的 HTTPS origin；不要將任何金鑰放入此檔案。
2. 公開首頁會讀取已發布商品、公告、活動與 Banner。商品詳細頁使用 `product.html?id={uuid}`，公告與活動詳細頁使用 `post.html?slug={slug}`。
3. API 必須以 `PUBLIC_ORIGIN` 僅允許正式官網來源的 CORS 請求。GitHub Pages 是展示用途，`runtime-config.js` 保持空值，不可連到正式訂單 API。

## 後台 SSO 連線

1. 正式後台部署時，將 `window.JIANGNAN_ADMIN_API_BASE` 設為 HTTPS API origin，並由公司 OIDC 用戶端提供 `window.JIANGNAN_GET_ACCESS_TOKEN` 非同步函式；函式只能回傳短效 access token，不能將使用者密碼、client secret 或雲端金鑰寫入瀏覽器。
2. 後台 API 用戶端僅以 `Authorization: Bearer` 傳送該 token。API 會以 `external_subject` 對應資料庫角色並拒絕未知帳號；不能使用前端傳來的角色名稱授權。
3. 若以上兩項任一未設定，後台會保持展示模式。GitHub Pages 的 `/admin/` 不是正式管理後台，不能填入正式 API 網址或存取權杖。

## 資料庫遷移

新資料庫容器會依序套用 `001_initial.sql` 到 `010_product_change_review_note.sql` 與種子資料。正式環境必須由 CI/CD 在部署前以受管的遷移工作執行相同 SQL，並記錄執行版本；不得依賴應用程式啟動時自動變更資料庫結構。

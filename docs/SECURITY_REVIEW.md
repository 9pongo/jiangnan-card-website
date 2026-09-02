# 本機程式安全檢查

檢查基準：目前工作目錄程式碼、Docker compose、本機 Docker API 和 `npm audit --omit=dev`。本文件是本機程式審查，不是 AWS／GCP、公司 SSO、金流廠商或滲透測試的替代證明。

## 已修正

| 項目 | 處置 | 證據 |
| --- | --- | --- |
| Demo API／PostgreSQL 對區網曝露 | compose port 改為 `127.0.0.1` 綁定，避免本機驗收的 demo 角色被同網段直接使用。 | `docker-compose.yml` |
| 開發 Banner 儲存被誤用於 production | `ASSET_STORAGE_PROVIDER=local` 在 `NODE_ENV=production` 會明確回 503。 | `server/src/storage.js` |
| 回應指紋與瀏覽器基線 | 移除 `X-Powered-By`，加上 `nosniff`、frame、referrer、permissions headers；production 加 HSTS。 | `server/src/server.js` |
| 商品、內容與寄售稽核一致性 | 相關寫入與 `audit_log` 在同一 PostgreSQL 交易提交，稽核表有拒絕 UPDATE／DELETE 的 trigger。 | `server/src/server.js`、遷移檔 |
| 未驗證 Banner 素材 | Banner 建立前要求已完成素材驗證；僅允許 PNG/JPG/WebP、最大 5 MB。 | `server/src/storage.js` |
| 商品價格遭前端篡改 | 訂單意圖在交易內重新讀取商品售價／訂金，不信任購物車傳入金額。 | `server/src/server.js` |
| 套件已知漏洞 | 生產相依套件掃描回報 0 known vulnerabilities。 | `npm audit --omit=dev`，2026-09-02 |

## 上線前仍須完成的風險控制

| 風險 | 嚴重度 | 上線前要求 |
| --- | --- | --- |
| Demo 角色授權 | P0 | 正式環境必須設 `AUTH_MODE=oidc`、有效 issuer/audience，並只讓已對應 `users.external_subject` 的帳號存取；不得公開 `x-demo-role` 模式。 |
| 付款與履約 | P0 | 尚未實作付款回呼簽章、冪等對帳、退款、發票、出貨與寄售售出結算；不得將訂單意圖視為付款成功。 |
| 網路邊界與節流 | P1 | API 放在私有資料庫網路、HTTPS 反向代理、WAF、速率限制、管理網段／SSO 條件下；app 層尚未自行提供通用速率限制。 |
| Banner 惡意檔檢查 | P1 | S3/GCS 物件建立後要有防毒、真實圖片格式／尺寸掃描，通過前不可標示為 uploaded。 |
| 個資保護與保留 | P1 | 訂單 email 與寄售聯絡方式屬個資；正式環境需加密備份、存取紀錄、保留／刪除政策、隱私告知和資料主體請求流程。 |
| 秘密與部署 | P1 | 不得將 OIDC、金流或雲端長效金鑰放入 Git、`runtime-config.js` 或瀏覽器；CI/CD 應使用工作負載身分與祕密管理服務。 |
| 自動化測試 | P1 | `npm test` 目前是 0 test cases；需在 CI 加入 API、交易、授權和前端互動回歸測試。 |

## 結論

本機 demo 目前可以在 loopback 範圍驗收網站與後台流程，並已移除可立即修正的網路曝露。它尚不具備正式上線條件；P0 與 P1 項目完成並取得外部環境證據後，才能進行 production Go／No-Go 審查。

# 雲端與供應商整合交接指南

這份文件的受眾是接手 AWS／GCP、公司 SSO、Email／SMS 與金流串接的工程團隊。它描述可依賴的邊界與必須維持的安全規則；不包含任何帳號、金鑰或真實交易資料。

## 交接目標

交接後，整合團隊應能在不修改商品、庫存、會員與後台權限核心規則的情況下完成：

1. 將靜態前台、後台與 API 部署到正式網域。
2. 由公司 OIDC 登入後台並將 `subject` 對應到既有資料庫角色。
3. 將 Email／SMS 驗證碼交給核可通知供應商，而非回傳展示碼。
4. 將付款意向轉為金流付款單，安全處理簽章 webhook、退款與對帳。
5. 將 Banner 上傳改接 S3 或 GCS，並在素材掃描後才可發布。

## 已固定的系統邊界

| 邊界 | 固定規則 | 整合團隊可替換部分 |
| --- | --- | --- |
| 商品價格 | 結帳時由資料庫重算價格與訂金；前端金額不可信 | 無 |
| 庫存 | 現貨在建立訂單意向時交易式保留；逾時才由內部排程釋放 | 排程平台與網路限制 |
| 顧客帳號 | Email 是不可修改登入帳號；付款前需已驗證 Email 與手機 | Email／SMS 寄送 adapter |
| 後台權限 | 只從資料庫的 `users.external_subject`／`role` 取權限 | IdP、subject 對應與 access token 取得方式 |
| 付款 | webhook 必須驗簽、事件去重、失敗時待對帳；不得由後台手動改為已付款 | 金流 provider adapter、金鑰、回呼網址與對帳檔 |
| Banner | 正式環境只能用 S3 或 GCS；前端不存雲端金鑰 | Bucket、CDN、工作負載身分與掃描服務 |

## 服務拓樸

```text
瀏覽器 ── HTTPS ──> 靜態前台 / 正式後台
                       │            │
                       │ CORS        │ OIDC access token
                       v            v
                    API / Container <── 公司 IdP JWKS
                       │  │  │
                       │  │  └──> 受管物件儲存 + CDN
                       │  └─────> Email / SMS provider
                       └────────> 私有 PostgreSQL

金流 Provider ── 簽章 webhook ──> API 私有 callback endpoint
排程平台 ── 私有 token ──────────> /api/v1/internal/orders/release-expired
```

## 正式設定與注入位置

以專案根目錄 `.env.production.example` 作為欄位清單，所有實際值放在 AWS Secrets Manager、GCP Secret Manager 或公司等效的祕密管理服務。不可放進 Git、`runtime-config.js`、前端 bundle、CI log 或客服工具。

| 類型 | 目前必填設定 | 用途 |
| --- | --- | --- |
| API／資料庫 | `DATABASE_URL`、`PUBLIC_ORIGIN` | API 私網資料庫與可呼叫的正式前台 origin |
| SSO | `AUTH_MODE=oidc`、`OIDC_ISSUER`、`OIDC_AUDIENCE` | 後台 JWT 驗簽與 audience 驗證 |
| 庫存排程 | `ORDER_EXPIRY_TOKEN`、`ORDER_EXPIRY_ACTOR_ID` | 只供受管排程呼叫逾時釋放端點 |
| Banner | `ASSET_STORAGE_PROVIDER`、`ASSET_BUCKET`、`ASSET_PUBLIC_BASE_URL`、`AWS_REGION`（S3） | 產生短效上傳網址與 CDN 公開素材網址 |
| 條款 | `CUSTOMER_TERMS_VERSION`、`CUSTOMER_PRIVACY_VERSION` | 新會員同意時保存的正式版本 |

部署前必跑：

```powershell
cd server
npm run verify:production-config
```

資料庫 migration 不由 API 啟動時自動執行。部署流程應先建立 `server/Dockerfile.migrate`、以私網 `DATABASE_URL` 執行一次性 job，確認完成後才部署 API。runner 會保存檔名與 SHA-256，並在同名 migration 遭改寫時停止；平台必須限制同時只能有一個 migration job。

## SSO 串接契約

1. 正式後台要以 `window.JIANGNAN_GET_ACCESS_TOKEN` 非同步函式取得短效 access token，參考 `admin/admin-api.js`。函式回傳 token 字串，不可回傳密碼或 client secret。
2. API 僅接受 `Authorization: Bearer <token>`；`server/src/auth.js` 驗證 issuer、audience 與 JWKS。
3. 先由管理員將 IdP `sub` 寫入 `users.external_subject` 並指定既有角色。未知 subject 必須回 403；不能在登入時自動給角色。
4. staging 驗收必含：有效授權者 200、未知 subject 403、缺少 token 401、錯誤 audience 401、`x-demo-role` 在 production 無效。

## 通知串接契約

目前 production 會拒絕未設定的驗證碼寄送。整合時應在 `server/src/customer-membership.js` 的 `issueChallenge` 接入通知 adapter，且維持下列規則：

- 支援目的：`email_registration`、`password_reset`、`phone_payment`。
- 驗證碼在資料庫僅存雜湊，十分鐘過期；同一目的的新碼會使舊碼失效。
- production API 回應不可包含驗證碼、完整電話、Email provider 回應或供應商 token。
- adapter timeout、非成功回應或未知結果必須讓請求失敗，不可宣稱已送達。
- 加上手機、Email 與 IP 的傳送／驗證限流後，再開放公開註冊。

## 金流串接契約

付款資料表已由 `017_payment_integration_foundation.sql` 建立，供 provider adapter 使用。金流整合不得跳過下列序列：

1. 客戶已驗證手機後建立 `/api/v1/checkout/intents`，取得 `pending_payment` 訂單意向。
2. 付款 adapter 以付款嘗試的 UUID 冪等鍵向 provider 建立付款單，將 provider 交易號與回應摘要寫入 `payment_attempts`。
3. provider webhook 先以原始 body 驗簽，然後以 `(provider, provider_event_id)` 寫入 `payment_webhook_inbox`。同一事件重送不得重複入帳。
4. 只有已驗簽且可比對付款金額、幣別、訂單與 provider 交易號的 callback，可交易式更新付款嘗試與訂單為 `paid`。
5. 超時、金額不符、未知交易號、驗簽失敗、callback 處理失敗或對帳差異，都建立 `payment_reconciliation_cases`；禁止自動補登或重試扣款。
6. 退款必須由已付款的原付款嘗試建立新的可稽核退款事件，不能直接改寫付款紀錄。

資料表中可能出現交易參考資料，僅允許付款服務帳號與受授權的對帳作業讀取；備份與 log 管線同樣適用加密與最小權限。

## 網域、CORS 與發布

建議至少使用三個 HTTPS origin：`www`（顧客前台）、`admin`（後台）、`api`（API）。在發布階段產生前台設定檔，僅放入 API 公開 origin；不要讓 GitHub Pages、預覽站或任意 localhost origin 呼叫正式 API。

`PUBLIC_ORIGIN` 只列出實際可呼叫 API 的前台 origin。後台的 API 使用 Bearer token，不靠 CORS 決定授權。WAF、CDN、TLS、DNS 與資料庫私網皆由雲端單位管理，但驗收記錄需併入本專案的上線證據。

## API 規格與驗收

- 已有 API 的機器可讀規格：[`openapi.yaml`](openapi.yaml)。
- 現有本機案例：[`QA_CHECKLIST.md`](QA_CHECKLIST.md)。
- 雲端與付款上線關卡：[`PRODUCTION_ENGINEERING_PACKAGE.md`](PRODUCTION_ENGINEERING_PACKAGE.md)。

當供應商規格、Webhooks、SSO claims 或正式網域到位後，整合團隊應先更新 OpenAPI／adapter 測試，再進 staging。任何 production 宣告都必須附上真實 IdP、通知、金流、對帳、備份還原與監控驗收證據。

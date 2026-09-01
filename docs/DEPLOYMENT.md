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

## 資料庫遷移

新資料庫容器會依序套用 `001_initial.sql`、`002_banner_workflow.sql` 與種子資料。正式環境必須由 CI/CD 在部署前以受管的遷移工作執行相同 SQL，並記錄執行版本；不得依賴應用程式啟動時自動變更資料庫結構。

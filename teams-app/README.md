# Teams App Package

## Setup Steps

### 1. Đăng ký Azure Bot

1. Vào https://portal.azure.com → tạo resource **Azure Bot**
2. Chọn **Multi Tenant**
3. Ghi lại `App ID` và tạo **Client Secret** trong App registrations
4. Messaging endpoint: `https://your-domain.com/teams/messages`

### 2. Cấu hình env

```env
TEAMS_APP_ID=<App ID từ Azure>
TEAMS_APP_PASSWORD=<Client Secret>
```

### 3. Build manifest package

```bash
# Thay ${TEAMS_APP_ID} trong manifest.json bằng App ID thật
# Thêm 2 icon: color.png (192x192) và outline.png (32x32)
cd teams-app
zip cozyroom-teams.zip manifest.json color.png outline.png
```

### 4. Sideload vào Teams

1. Mở Teams → Apps → Manage your apps
2. Click **Upload an app** → **Upload a custom app**
3. Chọn `cozyroom-teams.zip`
4. Install → Open chat với bot

## Notes

- Bot chỉ hoạt động khi server có HTTPS public URL
- Dev local: dùng ngrok → `ngrok http 8080`
- Messaging endpoint = `https://<ngrok-url>/teams/messages`

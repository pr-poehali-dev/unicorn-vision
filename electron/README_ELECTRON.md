# Сборка десктопного приложения

## 1. Установить зависимости

```bash
npm install --save-dev electron electron-builder
```

## 2. Добавить в package.json

В корень файла (после `"version"`) добавить:
```json
"main": "electron/main.cjs",
```

В секцию `"scripts"` добавить:
```json
"electron:dev": "NODE_ENV=development electron .",
"electron:build:win": "vite build && electron-builder --win",
"electron:build:mac": "vite build && electron-builder --mac",
"electron:build:linux": "vite build && electron-builder --linux"
```

В корень файла добавить секцию `"build"`:
```json
"build": {
  "appId": "dev.netmon.app",
  "productName": "Мониторинг сети",
  "directories": { "output": "dist-electron" },
  "files": ["dist/**/*", "electron/**/*", "public/**/*"],
  "win": { "target": "nsis" },
  "mac": { "target": "dmg" },
  "linux": { "target": "AppImage" },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

## 3. Собрать .exe (Windows)

```bash
npm run electron:build:win
```

Готовый установщик появится в папке `dist-electron/`.

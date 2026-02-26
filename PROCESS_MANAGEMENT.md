# 🚀 Gestión de Procesos - Controla.Agentes

## ⚠️ Problema de Puertos Ocupados

Los puertos **3847** (API) y **3848** (Bot) pueden quedarse ocupados si:
- El servidor se cierra bruscamente (corte de luz, kill -9)
- Se inician múltiples instancias sin cerrar las anteriores
- Los procesos no liberan los puertos correctamente al cerrar

---

## 🛠️ Soluciones

### Opción 1: Usar Scripts de Gestión (Recomendado)

**Iniciar servicios limpiamente:**
```bash
cd /var/www/agentes
./scripts/clean-start.sh
```

Este script:
1. Mata procesos anteriores
2. Espera a que liberen puertos
3. Inicia API y Bot
4. Muestra el estado

**Detener servicios:**
```bash
./scripts/stop.sh
```

---

### Opción 2: Comandos Manuales

**Matar procesos existentes:**
```bash
pkill -9 -f "node /var/www/agentes/app.js"
pkill -9 -f "node /var/www/agentes/server/index.js"
sleep 2
```

**Verificar puertos:**
```bash
# Con netstat
netstat -tlnp | grep -E "3847|3848"

# Con ss
ss -tlnp | grep -E "3847|3848"

# Con lsof
lsof -i :3847
lsof -i :3848
```

**Iniciar servicios:**
```bash
# Terminal 1 - API + Web App
cd /var/www/agentes
npm run server

# Terminal 2 - Bot WhatsApp
cd /var/www/agentes
npm start
```

---

### Opción 3: Usar PM2 (Producción)

**Instalar PM2:**
```bash
npm install -g pm2
```

**Crear ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'controla-api',
      script: './server/index.js',
      cwd: '/var/www/agentes',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-api-error.log',
      out_file: './logs/pm2-api-out.log',
      log_file: './logs/pm2-api-combined.log',
      time: true
    },
    {
      name: 'controla-bot',
      script: './app.js',
      cwd: '/var/www/agentes',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-bot-error.log',
      out_file: './logs/pm2-bot-out.log',
      log_file: './logs/pm2-bot-combined.log',
      time: true
    }
  ]
};
```

**Comandos PM2:**
```bash
# Iniciar
pm2 start ecosystem.config.js

# Ver estado
pm2 status

# Ver logs
pm2 logs

# Reiniciar
pm2 restart

# Detener
pm2 stop

# Eliminar
pm2 delete all

# Guardar para inicio automático
pm2 save
pm2 startup
```

---

### Opción 4: Systemd (Servicio del Sistema)

**Copiar archivos de servicio:**
```bash
sudo cp /var/www/agentes/systemd/controla-agentes-api.service /etc/systemd/system/
sudo cp /var/www/agentes/systemd/controla-agentes-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
```

**Habilitar servicios:**
```bash
# Iniciar API
sudo systemctl start controla-agentes-api

# Iniciar Bot
sudo systemctl start controla-agentes-bot

# Habilitar inicio automático
sudo systemctl enable controla-agentes-api
sudo systemctl enable controla-agentes-bot

# Ver estado
sudo systemctl status controla-agentes-api
sudo systemctl status controla-agentes-bot

# Ver logs
journalctl -u controla-agentes-api -f
journalctl -u controla-agentes-bot -f
```

---

## 📊 Verificación

**Verificar que los servicios estén corriendo:**
```bash
# Procesos
ps aux | grep "node /var/www/agentes" | grep -v grep

# Puertos
curl http://localhost:3847/api/health
curl http://localhost:3848/api/health

# Web App
curl http://localhost:3847/
```

**Logs en tiempo real:**
```bash
# API
tail -f /var/www/agentes/logs/api-server.log

# Bot
tail -f /var/www/agentes/logs/bot-server.log
```

---

## 🔧 Prevención

### 1. Graceful Shutdown

Agregar al código para liberar puertos limpiamente:

```javascript
// server/index.js
process.on('SIGTERM', () => {
    console.log('SIGTERM recibido, cerrando servidor...')
    server.close(() => {
        console.log('Servidor cerrado')
        process.exit(0)
    })
})

process.on('SIGINT', () => {
    console.log('SIGINT recibido (Ctrl+C), cerrando...')
    server.close(() => {
        console.log('Servidor cerrado')
        process.exit(0)
    })
})
```

### 2. Usar always-close en PM2

```javascript
{
  name: 'controla-api',
  script: './server/index.js',
  kill_timeout: 3000,  // Esperar 3s antes de kill -9
  wait_ready: true,    // Esperar a que el app esté lista
  listen_timeout: 5000 // Timeout para escuchar puerto
}
```

### 3. Health Checks

Agregar endpoint de health:

```javascript
// server/index.js
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    })
})
```

---

## 📋 Comandos Rápidos

```bash
# Reinicio rápido
./scripts/stop.sh && sleep 2 && ./scripts/clean-start.sh

# Ver estado
ps aux | grep "node /var/www/agentes" | grep -v grep

# Ver puertos
netstat -tlnp | grep -E "3847|3848"

# Matar todo
pkill -9 -f "node /var/www/agentes"

# Iniciar solo API
node server/index.js &

# Iniciar solo Bot
node app.js &

# Ver logs
tail -f logs/api-server.log
tail -f logs/bot-server.log
```

---

## 🆘 Troubleshooting

### Puerto aún ocupado después de kill

```bash
# Identificar proceso
lsof -i :3847

# Matar por PID
kill -9 <PID>

# Si no funciona, reiniciar servidor
sudo reboot
```

### Procesos se reinician solos

Verificar si hay:
- PM2 corriendo: `pm2 list`
- Systemd activo: `systemctl status controla-agentes-api`
- Scripts de autoinicio

### Memory Leak

```bash
# Ver uso de memoria
ps aux | grep node | grep agentes

# Si usa >1GB, reiniciar
./scripts/stop.sh && ./scripts/clean-start.sh
```

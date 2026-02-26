# Desplegar en agentes.controla.digital

**Subdominio:** agentes.controla.digital  
**VPS:** 95.111.241.3  
**Carpeta en servidor:** /var/www/agentes (sube aquí el proyecto)

---

## 1. DNS en Cloudflare

El subdominio **agentes** ya está creado. Comprueba que el registro **A** apunte a **95.111.241.3** y que el proxy esté en naranja (activado).

---

## 2. Subir el proyecto al VPS

Sube toda la carpeta del proyecto a **/var/www/agentes** (o crea `agentes` dentro de `/var/www/` y deja ahí el contenido).

Ejemplo con SCP desde tu PC:
```bash
scp -r "C:\Users\Johnc\CONTROLA\Publicidad\Produccion\Referencias\Video\temp\agentes" usuario@95.111.241.3:/var/www/agentes
```
O con FTP/SFTP: conectar a 95.111.241.3 y subir a `/var/www/agentes`.

---

## 3. En el VPS (SSH)

```bash
ssh usuario@95.111.241.3
cd /var/www/agentes

npm install
npm run deploy:build
npm run server
```

Deja esa terminal abierta o usa PM2 (paso 5).

En **otra terminal** (mismo servidor) para el bot de WhatsApp:
```bash
cd /var/www/agentes
npm start
```

---

## 4. Nginx en el VPS

Usa el archivo **deploy/nginx-agentes.conf** (ya está configurado para agentes.controla.digital y puerto 3847).

```bash
sudo cp /var/www/agentes/deploy/nginx-agentes.conf /etc/nginx/sites-available/agentes.controla.digital
sudo ln -sf /etc/nginx/sites-available/agentes.controla.digital /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Dejar corriendo con PM2

```bash
cd /var/www/agentes
pm2 start server/index.js --name "agentes-web"
pm2 start app.js --name "agentes-bot"
pm2 save
pm2 startup
```

---

## Acceso

- **Panel:** https://agentes.controla.digital  
  Usuario: `admin@controla.digital`  
  Contraseña: la de `APP_PASSWORD` en tu `.env`

- **QR WhatsApp:** en el servidor, mientras corre el bot, puedes usar `http://95.111.241.3:3848` para escanear el QR (o crea qr.agentes.controla.digital con deploy/nginx-qr.conf).

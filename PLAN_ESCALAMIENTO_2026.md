# 📊 PLAN DE ESCALAMIENTO - CONTROLA.agentes

**Fecha:** 26 de Febrero, 2026  
**Versión Actual:** 2.6.0  
**Estado:** Monolito funcional listo para escalar

---

## 🎯 OBJETIVO DE ESCALAMIENTO

Transformar CONTROLA.agentes de una aplicación monolítica local a un sistema **multi-tenant** o **standalone distribuido** con administración centralizada.

---

## 📈 ESTADO ACTUAL (AS-IS)

### Arquitectura Actual
```
┌─────────────────────────────────────────┐
│  CONTROLA.agentes v2.6.0                │
│  - Single-tenant (un solo usuario)      │
│  - Datos locales (JSON files)           │
│  - Bot y API en mismo servidor          │
│  - Sin autenticación de usuarios        │
│  - WhatsApp directo (Baileys)           │
└─────────────────────────────────────────┘
```

### Limitaciones Actuales
| Limitación | Impacto |
|------------|---------|
| Single-tenant | No se puede vender como SaaS |
| JSON files | No escala > 1000 agentes |
| Sin usuarios | No hay control de acceso |
| Sin roles | Todos tienen acceso total |
| Sin billing | No se puede monetizar |
| Sin analytics | No hay métricas de uso |

---

## 🏗️ MODELOS DE ESCALAMIENTO PROPUESTOS

### OPCIÓN 1: SaaS Multi-Tenant (Recomendado)

#### Arquitectura
```
┌─────────────────────────────────────────────────────────────┐
│                    CONTROLA.cloud (SaaS)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  CENTRAL SERVER (Admin Hub)                         │   │
│  │  - Autenticación de usuarios (Auth0/Cognito)        │   │
│  │  - Gestión de tenants/organizaciones                │   │
│  │  - Billing y suscripciones (Stripe)                 │   │
│  │  - Dashboard administrativo                         │   │
│  │  - Métricas globales de uso                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TENANT ISOLATION LAYER                             │   │
│  │  - Database por tenant (PostgreSQL schemas)         │   │
│  │  - Row-level security                               │   │
│  │  - Tenant context en cada request                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  BOT CLUSTER (Multi-tenant)                         │   │
│  │  - Instancias WhatsApp por tenant                   │   │
│  │  - Resource quotas (mensajes/día)                   │   │
│  │  - Rate limiting por tenant                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Ventajas
- ✅ **Revenue recurrente** (suscripciones mensuales)
- ✅ **Escalabilidad horizontal** (más tenants = más instancias)
- ✅ **Control centralizado** (updates, monitoring, billing)
- ✅ **Menor costo por tenant** (recursos compartidos)

#### Desventajas
- ❌ **Complejidad alta** (tenant isolation, data segregation)
- ❌ **Riesgo de seguridad** (brecha afecta a todos los tenants)
- ❌ **Customización limitada** (todos usan la misma versión)

#### Stack Tecnológico Sugerido
| Capa | Tecnología |
|------|------------|
| Auth | Auth0 / AWS Cognito / Clerk |
| Database | PostgreSQL + Row Level Security |
| Backend | Node.js + Express + Multi-tenant middleware |
| Bot Cluster | PM2 + Docker + Kubernetes |
| Billing | Stripe / Paddle / Lemon Squeezy |
| Frontend | React + Multi-tenant context |
| Hosting | AWS / GCP / DigitalOcean |

---

### OPCIÓN 2: Standalone Distribuido con Control Central

#### Arquitectura
```
┌─────────────────────────────────────────────────────────────┐
│                  CONTROLA Central Server                    │
│                     (License & Control)                     │
├─────────────────────────────────────────────────────────────┤
│  - License validation API                                   │
│  - User authentication (OAuth2/OIDC)                        │
│  - Feature flags por licencia                               │
│  - Usage telemetry (opcional)                               │
│  - Updates automáticos                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS (API)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  INSTANCIA A    │  │  INSTANCIA B    │  │ INSTANCIA C │ │
│  │  (Usuario 1)    │  │  (Usuario 2)    │  │ (Usuario 3) │ │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────┤ │
│  │ - PostgreSQL    │  │ - PostgreSQL    │  │ - PostgreSQL│ │
│  │ - Bot Baileys   │  │ - Bot Baileys   │  │ - Bot       │ │
│  │ - API REST      │  │ - API REST      │  │ - API REST  │ │
│  │ - Frontend      │  │ - Frontend      │  │ - Frontend  │ │
│  │ - Datos locales │  │ - Datos locales │  │ - Locales   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Ventajas
- ✅ **Aislamiento total** (cada usuario tiene su infraestructura)
- ✅ **Privacidad de datos** (no hay data sharing)
- ✅ **Customización** (cada instancia es independiente)
- ✅ **Menor riesgo** (brecha afecta solo un usuario)

#### Desventajas
- ❌ **Mayor costo operativo** (una instancia por usuario)
- ❌ **Updates complejos** (desplegar en múltiples instancias)
- ❌ **Monitoreo distribuido** (más difícil de debuggear)

#### Stack Tecnológico Sugerido
| Capa | Tecnología |
|------|------------|
| License Server | Node.js + JWT + PostgreSQL |
| Auth Central | OAuth2 Provider (Keycloak/Authelia) |
| Instancias | Docker Compose / Kubernetes Helm |
| Updates | GitHub Actions + Auto-update script |
| Telemetry | Prometheus + Grafana (opcional) |
| Billing | License key generator + Stripe |

---

### OPCIÓN 3: Híbrido (SaaS + Self-Hosted)

#### Arquitectura
```
┌─────────────────────────────────────────────────────────────┐
│                    CONTROLA.cloud                           │
│                  (SaaS - Planes Premium)                    │
├─────────────────────────────────────────────────────────────┤
│  - Hosting incluido                                         │
│  - Updates automáticos                                      │
│  - Soporte prioritario                                      │
│  - SLA garantizado                                          │
│  - Precio: $29-99/mes                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  CONTROLA.self-hosted                       │
│              (License - Planes Perpetuos)                   │
├─────────────────────────────────────────────────────────────┤
│  - Instalación local del usuario                            │
│  - License key anual/perpetua                               │
│  - Updates manuales                                         │
│  - Soporte community                                        │
│  - Precio: $299-999 one-time                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              CENTRAL LICENSE SERVER                         │
│         (Valida ambas modalidades)                          │
├─────────────────────────────────────────────────────────────┤
│  - Valida license keys                                      │
│  - Controla feature flags                                   │
│  - Trackea usage (opcional)                                 │
│  - Previene piracy                                          │
└─────────────────────────────────────────────────────────────┘
```

#### Ventajas
- ✅ **Máximo alcance** (SaaS para pymes, Self-hosted para empresas)
- ✅ **Múltiples revenue streams** (MRR + license sales)
- ✅ **Flexibilidad** (usuarios eligen modelo)

#### Desventajas
- ❌ **Doble esfuerzo de desarrollo** (mantener dos versiones)
- ❌ **Soporte más complejo** (dos tipos de clientes)

---

## 📋 PLAN DE IMPLEMENTACIÓN DETALLADO

### FASE 1: Preparación (2-3 semanas)

#### 1.1 Database Migration
```bash
# Actual: JSON files
server/data/
├── agents.json
├── connections.json
└── payments.json

# Nuevo: PostgreSQL
CREATE DATABASE controla;

CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    subdomain VARCHAR(50) UNIQUE,
    plan VARCHAR(50),
    created_at TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    email VARCHAR(255),
    password_hash VARCHAR(255),
    role VARCHAR(50)
);

CREATE TABLE agents (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    name VARCHAR(255),
    config JSONB,
    created_at TIMESTAMP
);

-- Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON agents
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

#### 1.2 Auth System
```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken')

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        
        // Set tenant context
        process.env.CURRENT_TENANT = decoded.tenantId
        
        next()
    } catch (error) {
        res.status(401).json({ error: 'Unauthorized' })
    }
}

module.exports = authMiddleware
```

#### 1.3 Tenant Context
```javascript
// middleware/tenant.js
function tenantMiddleware(req, res, next) {
    const tenantId = req.headers['x-tenant-id'] || req.user.tenantId
    
    if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' })
    }
    
    // Set PostgreSQL session variable
    pool.query(
        'SET LOCAL app.current_tenant = $1',
        [tenantId],
        (err) => {
            if (err) return next(err)
            req.tenantId = tenantId
            next()
        }
    )
}
```

---

### FASE 2: Multi-Tenant Core (4-6 semanas)

#### 2.1 Database Layer
```javascript
// services/database.js
const { Pool } = require('pg')

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Habilitar Row Level Security
    options: '-c row_security=on'
})

// Query wrapper con tenant isolation
async function queryWithTenant(sql, params, tenantId) {
    const client = await pool.connect()
    
    try {
        await client.query('BEGIN')
        await client.query('SET LOCAL app.current_tenant = $1', [tenantId])
        
        const result = await client.query(sql, params)
        
        await client.query('COMMIT')
        return result
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}
```

#### 2.2 API Updates
```javascript
// server/index.js - Actualizar todos los endpoints
app.get('/api/agents', authMiddleware, tenantMiddleware, async (req, res) => {
    // Ya no necesita filtrar por tenant_id
    // Row Level Security lo hace automáticamente
    const result = await pool.query('SELECT * FROM agents')
    res.json(result.rows)
})

app.post('/api/agents', authMiddleware, tenantMiddleware, async (req, res) => {
    const { name, config } = req.body
    
    // tenant_id se inyecta automáticamente
    const result = await pool.query(
        'INSERT INTO agents (name, config) VALUES ($1, $2) RETURNING *',
        [name, JSON.stringify(config)]
    )
    
    res.json(result.rows[0])
})
```

#### 2.3 Bot Multi-Tenant
```javascript
// app.js - Bot Orchestrator
const connections = new Map() // Map<connectionId, ConnectionData>

// Cada conexión ahora tiene tenantId
async function startConnection(connectionData) {
    const { id, tenantId, agentId } = connectionData
    
    connections.set(id, {
        ...connectionData,
        tenantId,
        sock: await createBaileysSocket(connectionData)
    })
    
    console.log(`[Tenant ${tenantId}] Connection ${id} started`)
}

// Rate limiting por tenant
const tenantQuotas = new Map() // Map<tenantId, {count, limit, resetAt}>

function checkQuota(tenantId) {
    const quota = tenantQuotas.get(tenantId) || { count: 0, limit: 1000, resetAt: Date.now() + 86400000 }
    
    if (Date.now() > quota.resetAt) {
        quota.count = 0
        quota.resetAt = Date.now() + 86400000
    }
    
    if (quota.count >= quota.limit) {
        throw new Error(`Tenant ${tenantId} exceeded daily message quota`)
    }
    
    quota.count++
    tenantQuotas.set(tenantId, quota)
}
```

---

### FASE 3: Central License Server (3-4 semanas)

#### 3.1 License Server API
```javascript
// license-server/index.js
const express = require('express')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const app = express()

// Generar license key
app.post('/api/licenses', async (req, res) => {
    const { tenantId, plan, duration } = req.body
    
    const payload = {
        tenantId,
        plan,
        features: getFeaturesForPlan(plan),
        exp: Math.floor(Date.now() / 1000) + (duration * 86400)
    }
    
    const license = jwt.sign(payload, process.env.LICENSE_SECRET)
    
    res.json({ license, expiresAt: new Date(payload.exp * 1000) })
})

// Validar license
app.post('/api/licenses/validate', async (req, res) => {
    const { license } = req.body
    
    try {
        const decoded = jwt.verify(license, process.env.LICENSE_SECRET)
        
        // Check revocation list
        const isRevoked = await checkRevocationList(decoded.tenantId)
        
        res.json({
            valid: !isRevoked,
            features: decoded.features,
            expiresAt: new Date(decoded.exp * 1000)
        })
    } catch (error) {
        res.json({ valid: false, error: 'Invalid license' })
    }
})

// Heartbeat/telemetry
app.post('/api/telemetry', async (req, res) => {
    const { license, metrics } = req.body
    
    const decoded = jwt.verify(license, process.env.LICENSE_SECRET)
    
    // Guardar métricas de uso
    await saveMetrics(decoded.tenantId, metrics)
    
    res.json({ success: true })
})
```

#### 3.2 License Client (en instancias)
```javascript
// services/licenseClient.js
const axios = require('axios')

class LicenseClient {
    constructor(licenseKey, centralServerUrl) {
        this.licenseKey = licenseKey
        this.centralServerUrl = centralServerUrl
        this.validUntil = null
        this.features = {}
    }
    
    async validate() {
        try {
            const { data } = await axios.post(`${this.centralServerUrl}/api/licenses/validate`, {
                license: this.licenseKey
            })
            
            if (data.valid) {
                this.validUntil = data.expiresAt
                this.features = data.features
                return true
            }
            
            return false
        } catch (error) {
            console.error('License validation failed:', error.message)
            return false
        }
    }
    
    async sendTelemetry(metrics) {
        try {
            await axios.post(`${this.centralServerUrl}/api/telemetry`, {
                license: this.licenseKey,
                metrics
            })
        } catch (error) {
            console.error('Telemetry failed:', error.message)
            // No bloquear por error de telemetry
        }
    }
    
    hasFeature(featureName) {
        return this.features[featureName] === true
    }
}

module.exports = LicenseClient
```

---

### FASE 4: Billing & Subscriptions (2-3 semanas)

#### 4.1 Stripe Integration
```javascript
// services/billing.js
const Stripe = require('stripe')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const PLANS = {
    free: {
        priceId: 'price_free',
        features: {
            maxAgents: 1,
            maxConnections: 1,
            messagesPerDay: 100,
            ocrPagos: false,
            agendarCitas: false
        }
    },
    pro: {
        priceId: 'price_pro',
        features: {
            maxAgents: 5,
            maxConnections: 3,
            messagesPerDay: 10000,
            ocrPagos: true,
            agendarCitas: true
        }
    },
    enterprise: {
        priceId: 'price_enterprise',
        features: {
            maxAgents: -1, // unlimited
            maxConnections: -1,
            messagesPerDay: -1,
            ocrPagos: true,
            agendarCitas: true,
            dedicatedSupport: true
        }
    }
}

async function createSubscription(tenantId, planId, paymentMethodId) {
    const plan = PLANS[planId]
    
    const subscription = await stripe.subscriptions.create({
        customer: await getOrCreateCustomer(tenantId),
        items: [{ price: plan.priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent']
    })
    
    return subscription
}

async function checkQuota(tenantId, feature, usage) {
    const subscription = await getSubscription(tenantId)
    const plan = PLANS[subscription.plan]
    const limit = plan.features[feature]
    
    if (limit === -1) return true // unlimited
    
    return usage < limit
}
```

---

### FASE 5: Dashboard & Analytics (3-4 semanas)

#### 5.1 Admin Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  CONTROLA.cloud Admin Dashboard                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 MÉTRICAS GLOBALES                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Tenants  │ │ Usuarios │ │ Mensajes │ │ Revenue  │      │
│  │   1,234  │ │  5,678   │ │  2.3M    │ │ $45.6K   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  📈 USAGE TRENDS (últimos 30 días)                         │
│  [Gráfico de líneas: mensajes/día por tenant]              │
│                                                             │
│  🏢 TENANTS ACTIVOS                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Tenant         │ Plan       │ Usage    │ Status    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Empresa SAC    │ Enterprise │ 89%      │ ✅ Active │   │
│  │ Tienda Online  │ Pro        │ 45%      │ ✅ Active │   │
│  │ Startup XYZ    │ Free       │ 12%      │ ⚠️ Trial  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🔔 ALERTAS                                                 │
│  - Tenant #123 excedió quota de mensajes                   │
│  - License por expirar: 5 tenants                          │
│  - Error rate alto en Bot Cluster                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 ROADMAP RECOMENDADO

### Corto Plazo (1-2 meses)
1. **Migrar a PostgreSQL** (reemplazar JSON files)
2. **Implementar Auth** (JWT + usuarios)
3. **Tenant isolation** (Row Level Security)
4. **Feature flags** (por plan/tenant)

### Mediano Plazo (3-4 meses)
5. **License Server** (validación central)
6. **Stripe Integration** (billing automático)
7. **Dashboard Admin** (métricas globales)
8. **Rate Limiting** (quotas por tenant)

### Largo Plazo (5-6 meses)
9. **Bot Cluster** (Kubernetes/Docker Swarm)
10. **Auto-scaling** (más instancias según demanda)
11. **Multi-region** (deploy en múltiples regiones)
12. **White-label** (custom branding por tenant)

---

## 💰 MODELO DE PRECIOS SUGERIDO

### SaaS (Opción 1)
| Plan | Precio | Agentes | Mensajes/día | Features |
|------|--------|---------|--------------|----------|
| Free | $0/mes | 1 | 100 | Básico |
| Starter | $29/mes | 3 | 1,000 | OCR, Citas |
| Pro | $79/mes | 10 | 10,000 | Todo + API |
| Enterprise | $299/mes | Unlimited | Unlimited | SLA, Soporte |

### Self-Hosted (Opción 2)
| License | Precio | Duración | Updates | Soporte |
|---------|--------|----------|---------|---------|
| Personal | $299 | 1 año | Incluidos | Community |
| Business | $799 | Perpetua | 1 año | Email |
| Enterprise | $2,499 | Perpetua | 2 años | Prioritario |

---

## ⚠️ RIESGOS Y MITIGACIÓN

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Brecha de seguridad | Alto | Penetration testing, encryption at rest |
| Downtime del Central Server | Crítico | Multi-region, failover automático |
| Tenant data leak | Crítico | Row Level Security, audits regulares |
| Billing fraud | Medio | Stripe Radar, manual review |
| WhatsApp ban | Alto | Rate limiting, múltiples números |

---

## 📊 MÉTRICAS DE ÉXITO

### Técnico
- [ ] 99.9% uptime
- [ ] < 100ms response time (p95)
- [ ] 0 data leaks entre tenants
- [ ] Auto-scaling < 5 minutos

### Negocio
- [ ] 100 tenants en 6 meses
- [ ] $10K MRR en 12 meses
- [ ] < 5% churn rate
- [ ] NPS > 50

---

## 🚀 PRÓXIMOS PASOS (INMEDIATOS)

1. **Decidir modelo** (SaaS vs Standalone vs Híbrido)
2. **Setup PostgreSQL** (local + migración desde JSON)
3. **Implementar Auth** (usuarios + roles básicos)
4. **Crear script de migración** (JSON → PostgreSQL)
5. **Testear tenant isolation** (que un tenant no vea data de otro)

---

**Recomendación:** Comenzar con **Opción 3 (Híbrido)** para maximizar alcance y revenue, priorizando SaaS para MRR recurrente y ofreciendo self-hosted para clientes enterprise que requieren privacidad total.

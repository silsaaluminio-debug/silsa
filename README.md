# Silsa Aluminio — Sitio + Backend + Panel de administración

Catálogo de discos de aluminio con carrito de compras, backend en Node.js/Express + SQLite, y un panel de administración para gestionar catálogo, pedidos y Kardex de inventario.

## Estructura

```
index.html          → sitio público (carrito, catálogo, WhatsApp)
admin/index.html     → panel de administración
server/              → API (Express)
  index.js           → servidor principal
  db.js              → esquema SQLite + siembra inicial
  auth.js            → autenticación JWT
  routes/             → products, orders, inventory, auth
  seed-products.json → catálogo inicial (84 discos)
data/silsa.db        → base de datos (se genera sola, no se sube a git)
```

## Correr en local

```bash
npm install
cp .env.example .env   # y edita usuario/contraseña del admin
npm start
```

- Sitio público: http://localhost:3000
- Panel admin: http://localhost:3000/admin

La primera vez que arranca, el sistema crea automáticamente:
- Los 84 productos del catálogo original.
- Un usuario administrador con el `ADMIN_USERNAME` / `ADMIN_PASSWORD` definidos en `.env` (por defecto `admin` / `silsa2026` — **cámbialos**).

## Panel de administración — qué puedes hacer

- **Catálogo**: editar nombre, medidas, precio por kg y stock de cada producto; agregar o eliminar productos.
- **Pedidos**: ver los pedidos que los clientes envían desde el carrito, con folio, artículos y cambiar su estatus (nuevo → cotizado → confirmado → cerrado/cancelado). Al confirmar un pedido, el sistema descuenta automáticamente el inventario.
- **Inventario (Kardex)**: registrar entradas (compras/importaciones), salidas y ajustes manuales, con referencia y notas — igual que el control contable descrito en tus notas de importación.
- **Resumen**: kg totales en inventario, pedidos por estatus, alertas de stock bajo.

## Despliegue recomendado: Render.com

Es la opción más sencilla para este proyecto (Node + SQLite) porque:
- Tiene plan gratuito/económico con **disco persistente** (necesario para que la base SQLite no se borre en cada despliegue).
- Despliega directo desde GitHub sin configuración compleja.

Pasos:
1. Sube este repositorio a GitHub (ya está listo).
2. En [render.com](https://render.com) → **New + → Web Service** → conecta el repo `silsa`.
3. Configuración:
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Disk**: agrega un disco persistente (1 GB basta) montado en `/opt/render/project/src/data`
4. Variables de entorno (pestaña *Environment*):
   - `JWT_SECRET` → un valor largo y aleatorio
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` → tus credenciales reales
5. Deploy. Tu sitio quedará en una URL tipo `https://silsa.onrender.com` y el panel en `https://silsa.onrender.com/admin`.

> Alternativas equivalentes: Railway.app (mismo modelo, disco persistente) o un VPS propio con `pm2` para mantener el proceso vivo.

## Notas importantes

- El carrito sigue enviando el pedido por WhatsApp como antes; ahora **además** lo registra en el backend con un folio, para que quede en "Pedidos" del panel admin.
- Si el backend no está disponible, el sitio público sigue funcionando con el catálogo estático embebido (no se pierde funcionalidad de cara al cliente).
- Cambia la contraseña de administrador desde el propio panel (botón "Cambiar contraseña") después del primer login.

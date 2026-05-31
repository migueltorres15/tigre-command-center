# Tigre Command Center — Instrucciones para Claude

## Contexto del proyecto
Aplicación Next.js en `/Users/papaspichones/tigre-command-center` (puerto 3000).
App hermana: YAO Dashboard en `/Users/papaspichones/yao-nextjs` (puerto 3001).
Base de datos: SQLite via better-sqlite3 en `tigre.db`.

## Protocolo de cierre de sesión

**Cuándo activarlo:** cuando el usuario diga alguna de estas frases (o similares):
- "terminamos", "hasta aquí", "eso es todo", "wrap up", "cerramos", "ya estuvo", "gracias bye", "hasta mañana", "listo por hoy"

**Pasos obligatorios:**

1. **Revisar** la conversación completa e identificar:
   - Tareas mencionadas pero no registradas
   - Próximos pasos que emergieron de decisiones
   - Pendientes de seguimiento con clientes
   - Cualquier "hay que hacer X" que no se convirtió en tarea

2. **Presentar** la lista numerada en este formato exacto:
```
📋 TAREAS PROPUESTAS PARA EL COMMAND CENTER

1. [URGENTE] Tigre Studio — Descripción clara de la tarea
2. [PENDIENTE] Sitios Web — Descripción clara de la tarea
3. [PENDIENTE] YAO — Descripción clara de la tarea

¿Cuáles confirmas? (responde con números, ej: "1 y 3" o "todas" o "ninguna")
```

3. **Esperar** confirmación explícita del usuario. No agregar nada sin aprobación.

4. **Agregar** únicamente las aprobadas via:
```
POST http://localhost:3000/api/tareas
{ "texto": "...", "tag": "urgente|pendiente|hoy", "proyecto": "Tigre Studio|Sitios Web|Fotografía|YAO|Personal" }
```

5. **Confirmar** con la lista de lo que se agregó y el estado final.

## Proyectos válidos
- `Tigre Studio` — fotografía profesional y leads
- `Sitios Web` — sitios express para negocios locales
- `Fotografía` — sesiones fotográficas
- `YAO` — bar YAO Baja en Todos Santos
- `Personal` — finanzas y asuntos personales

## Tags válidos
- `urgente` — para hoy o mañana, bloquea otras cosas
- `hoy` — específicamente para hoy
- `pendiente` — próximos días, sin fecha crítica

## Notas técnicas
- Siempre usar `cache: 'no-store'` en fetches del cliente
- API routes necesitan `export const dynamic = 'force-dynamic'`
- Después de mutaciones: `router.refresh()` + `load()`
- El servidor YAO puede estar offline — manejar con try/catch

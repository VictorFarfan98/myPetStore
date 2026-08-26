# MyPetStore Grooming

Spanish-first grooming operations app for a Guatemala pet store chain.

## Clasificaciones y servicios adicionales

`tamanos.especie` separa las clasificaciones por especie: los perros usan tamaños y los gatos usan `Pelo corto` o `Pelo largo`. El nombre `tamano_id` se conserva temporalmente en los RPC existentes para mantener compatibilidad.

Los servicios adicionales reutilizan `servicios` con `es_adicional = TRUE`. Incluyen los tipos de shampoo, Rapado y Desenredo de nudos; nunca pueden usarse como servicio principal. Su precio fijo se configura directamente en `servicios.precio`; `precios_servicios` queda para los servicios principales. Las selecciones de una hoja se guardan en `registros_servicio_adicionales` con precio y duración históricos.

El precio promocional de los servicios principales se configura opcionalmente en cada fila de `precios_servicios` con `precio_promocional`. El gerente decide en la hoja de servicio si lo aplica mediante `usar_promocion`; las hojas existentes conservan su precio histórico.

## What is included

- Next.js App Router dashboard for grooming operations.
- Live Supabase RPC data access for branches, users, customers, pets, services, appointments, records, and WhatsApp reminder logs.
- Business-rule tests for appointment status transitions, groomer conflicts, reports, and reminder messages.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database setup

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

`SUPABASE_SERVICE_ROLE_KEY` is only needed for trusted internal processes, not for the web application.

Most pages now read through `lib/app-data.ts`, which loads live data through Supabase RPC.


## CRUD INFO

Base de datos y RPC — Pet Store Grooming

Este documento describe los archivos SQL, la arquitectura de seguridad, el contrato de las funciones RPC y la forma recomendada de consumirlas desde Next.js.

Advertencia: setup.sql es destructivo. Cada ejecución elimina y recrea únicamente los objetos relacionales propios de esta aplicación. Debe usarse para inicialización y reinicios controlados, no como migración sobre una base con datos que deban conservarse.

Archivos

Archivo

Responsabilidad

setup.sql

Tipos, tablas, restricciones, índices, triggers estructurales, auditoría de DELETE físico y datos iniciales.

rpc.sql

Helpers privados, políticas RLS, permisos directos y todas las funciones RPC públicas.

supabase_storage.sql

Crea o actualiza de forma idempotente el bucket privado petstore y sus políticas para fotos de servicio. No elimina archivos existentes.

Orden de ejecución

Ejecutar setup.sql.

Ejecutar rpc.sql.

Ejecutar supabase_storage.sql una vez o cuando se quiera reafirmar la configuración del bucket.

For an existing database, also apply pending migrations from `supabase/migrations/` after initialization.

setup.sql no elimina el bucket petstore ni los objetos almacenados. rpc.sql puede volver a ejecutarse sin borrar tablas ni datos: recrea sus propias políticas, permisos, helpers y funciones.

Inicialización de usuarios

Las credenciales se crean manualmente en Supabase Auth. Después debe crearse el perfil correspondiente en public.usuarios usando exactamente el UUID de auth.users.id.

Para el arranque inicial, crea manualmente al menos:

un usuario activo con rol administrador;

un usuario activo con rol propietario.

Un trigger impide desactivar, degradar o eliminar físicamente al último usuario activo de cada uno de esos roles.

Arquitectura recomendada

La aplicación usa un enfoque RPC-first:

Next.js valida la sesión Supabase del usuario.

Next.js crea un cliente Supabase de servidor asociado al JWT del usuario.

Next.js llama supabase.rpc(...).

La función se ejecuta normalmente como SECURITY INVOKER y obtiene la identidad con auth.uid().

La función vuelve a validar usuario activo, rol y acceso por sucursal.

RLS limita las filas accesibles.

Constraints y triggers preservan la integridad aun si una función tiene un error.

Las funciones complejas de historial usan SECURITY DEFINER únicamente cuando necesitan leer relaciones históricas que exceden la visibilidad fila por fila. Estas funciones validan el usuario explícitamente, fijan search_path = '' y no exponen helpers internos como API pública.

Uso de service_role

service_role queda reservado para procesos internos como recordatorios automáticos, mantenimiento y tareas administrativas del servidor. Esta clave omite RLS y jamás debe llegar al navegador. Algunas RPC de negocio exigen un usuario humano porque deben llenar campos como creado_por_usuario_id; para esas operaciones se debe usar la sesión authenticated del empleado.

Acceso directo a tablas

authenticated tiene acceso directo a tablas bajo RLS. La aplicación puede usar `.from(...)` cuando resulte conveniente, pero las RPC son la interfaz principal.

El acceso directo puede omitir:

validaciones transaccionales de flujos complejos;

auditoría generada por RPC;

canje atómico de cupones;

reemplazo atómico de pagos;

Cuando una hoja en progreso ya tiene firma de entrega y el total de pagos coincide con el monto final, `pagos_reemplazar_lista` la marca como completada dentro de la misma transacción.

sincronización entre citas, mascotas y registros de servicio.

Por eso, las escrituras funcionales de la aplicación deben preferir RPC. El DELETE físico directo está restringido a administrador y propietario; las RPC <tabla>_eliminar realizan soft delete. Aun con permiso RLS, una eliminación física puede ser rechazada por foreign keys ON DELETE RESTRICT cuando exista historial relacionado.

Resumen RLS

Área

Encargado

Administrador/propietario

usuarios

Solo lectura de su propia fila

Acceso global

usuarios_sucursales

Solo sus asignaciones

Acceso global

clientes, mascotas

Lectura y cambios globales según reglas de activos

Acceso global, incluidos inactivos

Catálogos

Lectura de registros activos

Administración completa

Citas, servicios, pagos y recordatorios

Según sucursales asignadas

Acceso global

Cupones

Lectura

Administración completa

Configuración

Lectura

Actualización

Auditorías

Solo auditorías de sucursales asignadas; no ve auditorías globales

Todas las auditorías

DELETE físico

No

Sí, bajo RLS y con auditoría automática en tablas sensibles

Convenciones RPC

Nombres

Todas las funciones públicas viven en public y siguen el patrón:

public.<tabla>_<accion>

Ejemplos:

public.mascotas_insertar
public.mascotas_actualizar
public.citas_obtener_agenda
public.registros_servicio_completar

Desde Supabase JS se llama solo el nombre de la función:

await supabase.rpc('mascotas_insertar', parametros)

Actualizaciones

Las funciones <tabla>_actualizar son actualizaciones completas. Next.js debe enviar todos los campos editables; para limpiar un campo opcional debe enviar null explícitamente.

Soft delete

<tabla>_eliminar establece activo = false. Para reactivar, se usa <tabla>_actualizar enviando activo = true.

Listados

<tabla>_listar devuelve solo registros activos. <tabla>_listar_todos incluye activos e inactivos y requiere administrador o propietario.

Contrato de respuesta:

{
  "datos": [],
  "total": 0,
  "limite": null,
  "offset": 0
}

Parámetros estándar:

p_limite BIGINT DEFAULT NULL: NULL devuelve todos los registros permitidos por RLS.

p_offset BIGINT DEFAULT 0.

Una lista vacía no genera error.

Obtención por ID

Las funciones <tabla>_obtener_por_id lanzan REGISTRO_NO_ENCONTRADO si la fila no existe o no es visible. Para un encargado, los registros inactivos se comportan como no encontrados cuando así lo exige la entidad.

Auditoría

Las RPC auditan escrituras sensibles sobre:

usuarios y asignaciones;

clientes y mascotas;

citas;

registros de servicio;

pagos;

cupones;

configuración del sistema.

En un UPDATE, valores_anteriores y valores_nuevos contienen únicamente las columnas que cambiaron. Si no hubo cambios reales, no se genera auditoría. En un INSERT, valores_nuevos contiene la fila creada. En un soft delete se registra únicamente el cambio de activo.

Los DELETE físicos directos sobre tablas sensibles generan una auditoría con:

acción eliminar_fisico;

fila completa en valores_anteriores;

valores_nuevos = NULL;

auth.uid() como actor, o NULL para procesos de sistema con service_role.

authenticated solo puede leer auditorías según RLS; no puede insertarlas, modificarlas ni eliminarlas directamente.

Códigos de error

Las funciones usan SQLSTATE personalizados y mensajes estables.

SQLSTATE

Categoría

HTTP sugerido

Manejo en Next.js

PA001

Autenticación/autorización

401 o 403

Cerrar sesión si no hay identidad; mostrar acceso denegado si falta permiso.

PN001

No encontrado/no visible

404

Mostrar “no encontrado” sin revelar filas protegidas.

PE001

Estado inválido

409

Refrescar datos y explicar que el flujo ya cambió.

PV001

Validación

422

Mostrar el mensaje asociado al campo o regla.

PC001

Conflicto

409

Informar duplicado, recurso ya usado o restricción concurrente.

Supabase devuelve normalmente el SQLSTATE en error.code y el mensaje estable en error.message.

Ejemplos desde Next.js

Cliente asociado a la sesión del usuario

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createUserSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

Insertar una mascota

const supabase = await createUserSupabaseClient()

const { data, error } = await supabase.rpc('mascotas_insertar', {
  p_cliente_id: 15,
  p_nombre: 'Luna',
  p_especie: 'perro',
  p_raza: 'Poodle',
  p_tamano_id: 2,
  p_foto_perfil_url: null,
  p_fecha_nacimiento: '2022-05-10',
  p_notas_salud: null,
  p_notas_comportamiento: null,
  p_intervalo_preferido_dias: 30,
  p_activo: true,
})

if (error) throw error

Listar con paginación opcional

const { data, error } = await supabase.rpc('mascotas_listar', {
  p_limite: 20,
  p_offset: 0,
})

Para devolver todo lo permitido por RLS:

const { data, error } = await supabase.rpc('mascotas_listar', {
  p_limite: null,
  p_offset: 0,
})

Obtener la agenda

const { data, error } = await supabase.rpc('citas_obtener_agenda', {
  p_sucursal_id: 1, // null para todas las sucursales visibles
  p_fecha_desde: '2026-08-01T00:00:00-06:00',
  p_fecha_hasta: '2026-08-02T00:00:00-06:00',
})

El rango es inclusivo al inicio y exclusivo al final.

Reemplazar la lista completa de pagos

const { data, error } = await supabase.rpc('pagos_reemplazar_lista', {
  p_registro_servicio_id: 42,
  p_pagos: [
    { metodo_pago_id: 1, monto: 100.00 },
    { metodo_pago_id: 2, monto: 50.00 },
  ],
  p_motivo: null,
})

La función desactiva los pagos activos anteriores, inserta los nuevos y recalcula monto_pagado. El registro sincroniza precio_base y monto_final con el servicio principal, los servicios adicionales y el descuento guardados en la hoja. En un servicio completado, solo administrador o propietario puede modificar la lista y la suma debe coincidir exactamente con monto_final.

Completar un servicio

registros_servicio_completar recibe la información final, los montos y la lista completa de pagos. PostgreSQL verifica que el precio base y los servicios adicionales coincidan con las configuraciones activas, valida la fórmula final, el cupón, las fotos, la firma y la suma de pagos, y realiza todo en una sola transacción.

Consulta la firma exacta en el catálogo de RPC de este documento o en rpc.sql antes de construir el objeto de parámetros.

Proceso interno con service_role

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const { data, error } = await supabaseAdmin.rpc(
  'recordatorios_citas_insertar',
  {
    p_cita_id: 100,
    p_canal: 'whatsapp',
    p_numero_destino: '+50255555555',
    p_mensaje: 'Recordatorio de su cita',
  }
)

Acceso directo opcional bajo RLS

const { data, error } = await supabase
  .from('mascotas')
  .select('id,nombre,cliente:clientes(id,nombre)')
  .eq('activo', true)

Este acceso está permitido, pero no reemplaza los flujos transaccionales específicos.

Flujos transaccionales principales

Inicio de servicio

registros_servicio_iniciar:

valida cita, sucursal, mascota, servicio, peluquero y tamaño;

crea el registro con firma de ingreso;

fija inicio_real;

cambia citas.estado a atendida;

audita la operación;

todo ocurre en una sola transacción.

Finalización de servicio

registros_servicio_completar:

recibe servicio, peluquero y tamaño finales;

sincroniza esos datos con la cita y la mascota, sin cambiar fin_programado;

valida precios configurados activos;

valida los servicios adicionales configurados;

valida que existan fotos de ingreso y egreso cuando estén configuradas como requeridas, además de la firma de entrega;

valida y canjea el cupón de forma atómica;

reemplaza la lista activa de pagos;

crea automáticamente el pago de cupón por 0.00 cuando el total final es cero;

exige monto_pagado = monto_final;

fija fin_real solo la primera vez;

marca el registro como completado.

Reemplazo de pagos

pagos_reemplazar_lista siempre recibe la lista completa en JSON. Una lista vacía se permite durante en_progreso; en completado se exige consistencia total, salvo el caso de cero cubierto por cupón, que PostgreSQL representa con el método configurado para cupón.

Cancelación y no asistencia

citas_cancelar y citas_marcar_no_asistio cambian únicamente el estado de la cita y conservan cualquier registro de servicio existente sin modificarlo.

Storage

El bucket petstore es privado. Actualmente no impone límite de tamaño ni tipos MIME. Los prefijos sugeridos son:

pets/
signatures/
services/

`supabase_storage.sql` permite a usuarios autenticados subir y leer objetos bajo `services/`. El navegador carga cada foto directamente con la sesión del usuario; el Server Action valida y registra las rutas, sin usar `SUPABASE_SERVICE_ROLE_KEY`.

Las fotos de servicio se guardan bajo `services/{cita_id}/{ingreso|egreso}/`. PostgreSQL conserva cada ruta en `registros_servicio_fotos`; el índice `(registro_servicio_id, momento, id)` optimiza las consultas por hoja y por momento. La aplicación no limita la cantidad de fotos, pero valida un máximo de 10 MB por archivo.

Las fotos de ingreso y egreso son opcionales por defecto. Un administrador o propietario puede hacerlas obligatorias desde la configuración del sistema.

La migración elimina de `registros_servicio` las columnas legacy `foto_antes_url`, `foto_antes_subida_en`, `foto_despues_url` y `foto_despues_subida_en`. La tabla hija es la única fuente de fotos.

Las carpetas son prefijos lógicos y aparecen cuando se sube el primer objeto. La aplicación debe usar el backend para subir y firmar URLs.

Referencia organizada de RPC

La capa RPC expone 111 funciones públicas después de aplicar las migraciones. Esta referencia está organizada por dominio y por tabla para que sea fácil localizar una operación desde Next.js.

Convención de esta sección

Cada tabla incluye:

una fila en el índice general con las operaciones disponibles;

un bloque de acciones ordenado por uso;

la firma exacta de PostgreSQL;

el tipo de retorno;

los roles o contextos permitidos;

el comportamiento principal de la RPC.

Las funciones de listado mantienen el contrato estándar:

{
  "datos": [],
  "total": 0,
  "limite": null,
  "offset": 0
}

Índice general

Dominio

Tabla o recurso

RPC estándar

Operaciones específicas

Total

Identidad y acceso

usuarios

insertar, obtener, listar, listar todos, actualizar, soft delete

Obtener perfil actual, Listar usuarios asignables

8



usuarios_sucursales

insertar, obtener, listar, listar todos, actualizar, soft delete

—

6

Clientes y mascotas

clientes

insertar, obtener, listar, listar todos, actualizar, soft delete

Obtener detalle del cliente, listar progreso de fidelidad

8



mascotas

insertar, obtener, listar, listar todos, actualizar, soft delete

Transferir cliente, Obtener historial activo, Obtener historial completo

9

Sucursales y catálogos

sucursales

insertar, obtener, listar, listar todos, actualizar, soft delete

—

6



peluqueros

insertar, obtener, listar, listar todos, actualizar, soft delete

—

6



tamanos

insertar, obtener, listar, listar todos, actualizar, soft delete

—

6



servicios

insertar, obtener, listar, listar todos, actualizar, soft delete

—

6



precios_servicios

insertar, obtener, listar, listar todos, actualizar, soft delete

—

6



metodos_pago

insertar, obtener, listar, listar todos, actualizar, soft delete

—

6

Operación comercial

cupones

insertar, obtener, listar, listar todos, actualizar, soft delete

Listar por cliente

7



citas

insertar, obtener, listar, listar todos, actualizar, soft delete

Reprogramar cita, Cancelar cita, Marcar no asistencia, Obtener agenda

10



registros_servicio

insertar, obtener, listar, listar todos, actualizar, soft delete

Iniciar servicio, Completar servicio, Obtener detalle completo

9



registros_servicio_fotos

listar por registro y momento

Agregar fotos de ingreso o egreso

2



pagos

obtener, listar, listar todos

Reemplazar lista de pagos

4



recordatorios_citas

insertar, obtener, listar, listar todos, soft delete

—

5

Configuración y auditoría

configuracion_sistema

actualizar

Obtener configuración, Actualizar configuración

2



auditorias

obtener, listar, listar todos

—

3

Operaciones estándar

Acción

Patrón

Comportamiento

Insertar

<tabla>_insertar

Crea una fila y devuelve el registro resultante.

Obtener

<tabla>_obtener_por_id

Devuelve una fila o lanza REGISTRO_NO_ENCONTRADO.

Listar activos

<tabla>_listar

Devuelve solo filas con activo = TRUE.

Listar todos

<tabla>_listar_todos

Incluye activos e inactivos; normalmente solo administrador/propietario.

Actualizar

<tabla>_actualizar

Actualización completa: se deben enviar todos los campos editables.

Eliminar

<tabla>_eliminar

Soft delete: establece activo = FALSE.

RPC por dominio: Identidad y acceso

usuarios — Usuarios

Resumen

Valor

Objeto principal

public.usuarios

Cantidad de RPC

8

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

Obtener perfil actual, Listar usuarios asignables

Acciones

Insertar — usuarios_insertar

Firma: usuarios_insertar(p_id UUID, p_nombre TEXT, p_nombre_usuario TEXT, p_telefono TEXT, p_rol public.rol_usuario, p_alcance_acceso public.alcance_acceso, p_activo BOOLEAN, p_sucursal_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[])

Retorno: public.usuarios

Acceso: Administrador o propietario; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Obtener por ID — usuarios_obtener_por_id

Firma: usuarios_obtener_por_id(p_id UUID)

Retorno: public.usuarios

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — usuarios_listar

Firma: usuarios_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — usuarios_listar_todos

Firma: usuarios_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — usuarios_actualizar

Firma: usuarios_actualizar(p_id UUID, p_nombre TEXT, p_telefono TEXT, p_rol public.rol_usuario, p_alcance_acceso public.alcance_acceso, p_activo BOOLEAN, p_sucursal_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[])

Retorno: public.usuarios

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — usuarios_eliminar

Firma: usuarios_eliminar(p_id UUID)

Retorno: public.usuarios

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Obtener perfil actual — usuarios_obtener_perfil_actual

Firma: usuarios_obtener_perfil_actual()

Retorno: JSONB

Acceso: authenticated para su propio perfil; service_role.

Comportamiento: Devuelve el perfil del usuario autenticado, su rol, alcance y sucursales activas asignadas.

Listar usuarios asignables — usuarios_listar_disponibles_para_asignacion

Firma: usuarios_listar_disponibles_para_asignacion()

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista usuarios activos con alcance por sucursales para la pantalla de asignación.

usuarios_sucursales — Asignaciones de usuarios a sucursales

Resumen

Valor

Objeto principal

public.usuarios_sucursales

Cantidad de RPC

6

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

—

Acciones

Insertar — usuarios_sucursales_insertar

Firma: usuarios_sucursales_insertar(p_usuario_id UUID, p_sucursal_id BIGINT, p_activo BOOLEAN)

Retorno: public.usuarios_sucursales

Acceso: Administrador o propietario; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Obtener por ID — usuarios_sucursales_obtener_por_id

Firma: usuarios_sucursales_obtener_por_id(p_usuario_id UUID, p_sucursal_id BIGINT)

Retorno: public.usuarios_sucursales

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — usuarios_sucursales_listar

Firma: usuarios_sucursales_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — usuarios_sucursales_listar_todos

Firma: usuarios_sucursales_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — usuarios_sucursales_actualizar

Firma: usuarios_sucursales_actualizar(p_usuario_id UUID, p_sucursal_id BIGINT, p_activo BOOLEAN)

Retorno: public.usuarios_sucursales

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — usuarios_sucursales_eliminar

Firma: usuarios_sucursales_eliminar(p_usuario_id UUID, p_sucursal_id BIGINT)

Retorno: public.usuarios_sucursales

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

RPC por dominio: Clientes y mascotas

clientes — Clientes

Resumen

Valor

Objeto principal

public.clientes

Cantidad de RPC

8

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

Obtener detalle del cliente, listar progreso de fidelidad

Acciones

Insertar — clientes_insertar

Firma: clientes_insertar(p_nombre TEXT, p_telefono TEXT, p_email TEXT, p_whatsapp_opt_in BOOLEAN, p_sms_opt_in BOOLEAN, p_notas TEXT, p_activo BOOLEAN)

Retorno: public.clientes

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Obtener por ID — clientes_obtener_por_id

Firma: clientes_obtener_por_id(p_id BIGINT)

Retorno: public.clientes

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — clientes_listar

Firma: clientes_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — clientes_listar_todos

Firma: clientes_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — clientes_actualizar

Firma: clientes_actualizar(p_id BIGINT, p_nombre TEXT, p_telefono TEXT, p_email TEXT, p_whatsapp_opt_in BOOLEAN, p_sms_opt_in BOOLEAN, p_notas TEXT, p_activo BOOLEAN)

Retorno: public.clientes

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — clientes_eliminar

Firma: clientes_eliminar(p_id BIGINT)

Retorno: public.clientes

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Obtener detalle del cliente — clientes_obtener_detalle

Firma: clientes_obtener_detalle(p_cliente_id BIGINT)

Retorno: JSONB

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Devuelve el cliente, mascotas visibles y las últimas 10 citas con resumen del servicio y pagos activos.

Listar progreso de fidelidad — clientes_progreso_fidelidad_listar

Firma: clientes_progreso_fidelidad_listar()

Retorno: JSONB

Acceso: Usuario activo; service_role.

Comportamiento: Devuelve el avance de cada cliente desde `configuracion_sistema.fidelidad_inicia_en`. Cuenta servicios completados sin cupón o con cupón reutilizable y excluye cualquier cupón de uso único.

mascotas — Mascotas

Resumen

Valor

Objeto principal

public.mascotas

Cantidad de RPC

9

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

Transferir cliente, Obtener historial activo, Obtener historial completo

Acciones

Insertar — mascotas_insertar

Firma: mascotas_insertar(p_cliente_id BIGINT, p_nombre TEXT, p_especie public.especie_mascota, p_raza TEXT, p_tamano_id BIGINT, p_foto_perfil_url TEXT, p_fecha_nacimiento DATE, p_notas_salud TEXT, p_notas_comportamiento TEXT, p_intervalo_preferido_dias INTEGER, p_activo BOOLEAN)

Retorno: public.mascotas

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Obtener por ID — mascotas_obtener_por_id

Firma: mascotas_obtener_por_id(p_id BIGINT)

Retorno: public.mascotas

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — mascotas_listar

Firma: mascotas_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — mascotas_listar_todos

Firma: mascotas_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — mascotas_actualizar

Firma: mascotas_actualizar(p_id BIGINT, p_cliente_id BIGINT, p_nombre TEXT, p_especie public.especie_mascota, p_raza TEXT, p_tamano_id BIGINT, p_foto_perfil_url TEXT, p_fecha_nacimiento DATE, p_notas_salud TEXT, p_notas_comportamiento TEXT, p_intervalo_preferido_dias INTEGER, p_activo BOOLEAN)

Retorno: public.mascotas

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — mascotas_eliminar

Firma: mascotas_eliminar(p_id BIGINT)

Retorno: public.mascotas

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Transferir cliente — mascotas_transferir_cliente

Firma: mascotas_transferir_cliente(p_mascota_id BIGINT, p_nuevo_cliente_id BIGINT, p_motivo TEXT)

Retorno: public.mascotas

Acceso: Cualquier usuario activo autorizado; service_role.

Comportamiento: Transfiere una mascota a otro cliente y audita el cambio.

Obtener historial activo — mascotas_obtener_historial

Firma: mascotas_obtener_historial(p_mascota_id BIGINT)

Retorno: JSONB

Acceso: Usuario activo según visibilidad RLS; service_role.

Comportamiento: Devuelve el historial operativo activo de una mascota con citas, servicios, pagos activos y cupón.

Obtener historial completo — mascotas_obtener_historial_completo

Firma: mascotas_obtener_historial_completo(p_mascota_id BIGINT)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Devuelve el historial completo, incluidos registros inactivos; requiere administrador o propietario.

RPC por dominio: Sucursales y catálogos

sucursales — Sucursales

Resumen

Valor

Objeto principal

public.sucursales

Cantidad de RPC

6

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

—

Acciones

Insertar — sucursales_insertar

Firma: sucursales_insertar(p_nombre TEXT, p_direccion TEXT, p_telefono TEXT, p_activo BOOLEAN)

Retorno: public.sucursales

Acceso: Administrador o propietario; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Obtener por ID — sucursales_obtener_por_id

Firma: sucursales_obtener_por_id(p_id BIGINT)

Retorno: public.sucursales

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — sucursales_listar

Firma: sucursales_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — sucursales_listar_todos

Firma: sucursales_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — sucursales_actualizar

Firma: sucursales_actualizar(p_id BIGINT, p_nombre TEXT, p_direccion TEXT, p_telefono TEXT, p_activo BOOLEAN)

Retorno: public.sucursales

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — sucursales_eliminar

Firma: sucursales_eliminar(p_id BIGINT)

Retorno: public.sucursales

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

peluqueros — Peluqueros

Resumen

Valor

Objeto principal

public.peluqueros

Cantidad de RPC

6

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

—

Acciones

Insertar — peluqueros_insertar

Firma: peluqueros_insertar(p_nombre TEXT, p_telefono TEXT, p_color_calendario TEXT, p_activo BOOLEAN)

Retorno: public.peluqueros

Acceso: Administrador o propietario; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Obtener por ID — peluqueros_obtener_por_id

Firma: peluqueros_obtener_por_id(p_id BIGINT)

Retorno: public.peluqueros

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — peluqueros_listar

Firma: peluqueros_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — peluqueros_listar_todos

Firma: peluqueros_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — peluqueros_actualizar

Firma: peluqueros_actualizar(p_id BIGINT, p_nombre TEXT, p_telefono TEXT, p_color_calendario TEXT, p_activo BOOLEAN)

Retorno: public.peluqueros

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — peluqueros_eliminar

Firma: peluqueros_eliminar(p_id BIGINT)

Retorno: public.peluqueros

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

tamanos — Clasificaciones por especie

Resumen

Valor

Objeto principal

public.tamanos

Cantidad de RPC

6

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

—

Acciones

Insertar — tamanos_insertar

Firma: tamanos_insertar(p_especie public.especie_mascota, p_nombre TEXT, p_activo BOOLEAN)

Retorno: public.tamanos

Acceso: Administrador o propietario; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Obtener por ID — tamanos_obtener_por_id

Firma: tamanos_obtener_por_id(p_id BIGINT)

Retorno: public.tamanos

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — tamanos_listar

Firma: tamanos_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — tamanos_listar_todos

Firma: tamanos_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — tamanos_actualizar

Firma: tamanos_actualizar(p_id BIGINT, p_especie public.especie_mascota, p_nombre TEXT, p_activo BOOLEAN)

Retorno: public.tamanos

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — tamanos_eliminar

Firma: tamanos_eliminar(p_id BIGINT)

Retorno: public.tamanos

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

servicios — Servicios

Resumen

Valor

Objeto principal

public.servicios

Cantidad de RPC

6

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

—

Acciones

Insertar — servicios_insertar

Firma: servicios_insertar(p_nombre TEXT, p_intervalo_recordatorio_dias INTEGER, p_duracion_minutos INTEGER, p_es_adicional BOOLEAN, p_precio NUMERIC(10, 2), p_activo BOOLEAN)

Retorno: public.servicios

Acceso: Administrador o propietario; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada. `p_duracion_minutos` es obligatorio para servicios principales y se guarda como su duración general.

Obtener por ID — servicios_obtener_por_id

Firma: servicios_obtener_por_id(p_id BIGINT)

Retorno: public.servicios

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — servicios_listar

Firma: servicios_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — servicios_listar_todos

Firma: servicios_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — servicios_actualizar

Firma: servicios_actualizar(p_id BIGINT, p_nombre TEXT, p_intervalo_recordatorio_dias INTEGER, p_duracion_minutos INTEGER, p_es_adicional BOOLEAN, p_precio NUMERIC(10, 2), p_activo BOOLEAN)

Retorno: public.servicios

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante. La duración general es obligatoria para servicios principales.

Eliminar lógicamente — servicios_eliminar

Firma: servicios_eliminar(p_id BIGINT)

Retorno: public.servicios

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

precios_servicios — Precios y duraciones de servicios principales por especie y clasificación

Resumen

Valor

Objeto principal

public.precios_servicios

Cantidad de RPC

6

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

—

Acciones

Insertar — precios_servicios_insertar

Firma: precios_servicios_insertar(p_servicio_id BIGINT, p_especie public.especie_mascota, p_tamano_id BIGINT, p_precio NUMERIC(10, 2), p_precio_promocional NUMERIC(10, 2), p_duracion_minutos INTEGER, p_activo BOOLEAN)

Retorno: public.precios_servicios

Acceso: Administrador o propietario; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Obtener por ID — precios_servicios_obtener_por_id

Firma: precios_servicios_obtener_por_id(p_servicio_id BIGINT, p_especie public.especie_mascota, p_tamano_id BIGINT)

Retorno: public.precios_servicios

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — precios_servicios_listar

Firma: precios_servicios_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — precios_servicios_listar_todos

Firma: precios_servicios_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — precios_servicios_actualizar

Firma: precios_servicios_actualizar(p_servicio_id BIGINT, p_especie public.especie_mascota, p_tamano_id BIGINT, p_precio NUMERIC(10, 2), p_precio_promocional NUMERIC(10, 2), p_duracion_minutos INTEGER, p_activo BOOLEAN)

Retorno: public.precios_servicios

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — precios_servicios_eliminar

Firma: precios_servicios_eliminar(p_servicio_id BIGINT, p_especie public.especie_mascota, p_tamano_id BIGINT)

Retorno: public.precios_servicios

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

metodos_pago — Métodos de pago

Resumen

Valor

Objeto principal

public.metodos_pago

Cantidad de RPC

6

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

—

Acciones

Insertar — metodos_pago_insertar

Firma: metodos_pago_insertar(p_nombre TEXT, p_activo BOOLEAN)

Retorno: public.metodos_pago

Acceso: Administrador o propietario; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Obtener por ID — metodos_pago_obtener_por_id

Firma: metodos_pago_obtener_por_id(p_id BIGINT)

Retorno: public.metodos_pago

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — metodos_pago_listar

Firma: metodos_pago_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — metodos_pago_listar_todos

Firma: metodos_pago_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — metodos_pago_actualizar

Firma: metodos_pago_actualizar(p_id BIGINT, p_nombre TEXT, p_activo BOOLEAN)

Retorno: public.metodos_pago

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — metodos_pago_eliminar

Firma: metodos_pago_eliminar(p_id BIGINT)

Retorno: public.metodos_pago

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

RPC por dominio: Operación comercial

cupones — Cupones

Resumen

Valor

Objeto principal

public.cupones

Cantidad de RPC

7

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

Listar por cliente

Acciones

Insertar — cupones_insertar

Firma: cupones_insertar(p_id UUID, p_nombre TEXT, p_cliente_id BIGINT, p_servicio_id BIGINT, p_tipo_descuento public.tipo_descuento_cupon, p_valor NUMERIC(10, 2), p_fecha_expiracion DATE, p_uso_unico BOOLEAN, p_activo BOOLEAN)

Retorno: public.cupones

Acceso: Administrador o propietario; service_role.

Comportamiento: Inserta un cupón manual y registra al usuario creador. Cliente, servicio y expiración pueden ser NULL para promociones globales, aplicables a cualquier servicio o indefinidas.

Obtener por ID — cupones_obtener_por_id

Firma: cupones_obtener_por_id(p_id UUID)

Retorno: public.cupones

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — cupones_listar

Firma: cupones_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — cupones_listar_todos

Firma: cupones_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — cupones_actualizar

Firma: cupones_actualizar(p_id UUID, p_nombre TEXT, p_cliente_id BIGINT, p_servicio_id BIGINT, p_tipo_descuento public.tipo_descuento_cupon, p_valor NUMERIC(10, 2), p_fecha_expiracion DATE, p_uso_unico BOOLEAN, p_activo BOOLEAN)

Retorno: public.cupones

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — cupones_eliminar

Firma: cupones_eliminar(p_id UUID)

Retorno: public.cupones

Acceso: Administrador o propietario; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Listar por cliente — cupones_listar_por_cliente

Firma: cupones_listar_por_cliente(p_cliente_id BIGINT)

Retorno: JSONB

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Lista los cupones propios del cliente y las promociones globales. El canje valida y calcula el descuento sobre el servicio principal y todos sus adicionales; los cupones reutilizables permanecen activos hasta su desactivación manual.

citas — Citas

Resumen

Valor

Objeto principal

public.citas

Cantidad de RPC

10

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

Reprogramar cita, Cancelar cita, Marcar no asistencia, Obtener agenda

Valores de `origen_cita`: `telefono`, `presencial`, `whatsapp`, `google`, `pauta_whatsapp`, `pauta_instagram`.

Acciones

Insertar — citas_insertar

Firma: citas_insertar(p_mascota_id BIGINT, p_sucursal_id BIGINT, p_peluquero_id BIGINT, p_servicio_id BIGINT, p_inicio_programado TIMESTAMPTZ, p_origen public.origen_cita)

Retorno: public.citas

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Inserta una cita y calcula su fin con la duración general del servicio; si no existe, usa la duración configurada para la especie y clasificación de la mascota.

Obtener por ID — citas_obtener_por_id

Firma: citas_obtener_por_id(p_id BIGINT)

Retorno: public.citas

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — citas_listar

Firma: citas_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — citas_listar_todos

Firma: citas_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — citas_actualizar

Firma: citas_actualizar(p_id BIGINT, p_mascota_id BIGINT, p_sucursal_id BIGINT, p_peluquero_id BIGINT, p_servicio_id BIGINT, p_inicio_programado TIMESTAMPTZ, p_fin_programado TIMESTAMPTZ, p_estado public.estado_cita, p_origen public.origen_cita, p_activo BOOLEAN)

Retorno: public.citas

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — citas_eliminar

Firma: citas_eliminar(p_id BIGINT)

Retorno: public.citas

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Reprogramar cita — citas_reprogramar

Firma: citas_reprogramar(p_cita_id BIGINT, p_inicio_programado TIMESTAMPTZ, p_servicio_id BIGINT, p_peluquero_id BIGINT)

Retorno: public.citas

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Reprograma una cita, permite cambiar servicio y peluquero y recalcula `fin_programado` con la duración general del servicio, usando la duración específica como respaldo.

Cancelar cita — citas_cancelar

Firma: citas_cancelar(p_cita_id BIGINT, p_motivo TEXT)

Retorno: public.citas

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Cambia la cita a cancelada y registra auditoría con el motivo.

Marcar no asistencia — citas_marcar_no_asistio

Firma: citas_marcar_no_asistio(p_cita_id BIGINT, p_motivo TEXT)

Retorno: public.citas

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Cambia la cita a no_asistio y registra auditoría con el motivo.

Obtener agenda — citas_obtener_agenda

Firma: citas_obtener_agenda(p_sucursal_id BIGINT, p_fecha_desde TIMESTAMPTZ, p_fecha_hasta TIMESTAMPTZ)

Retorno: JSONB

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Devuelve la agenda anidada por rango con mascota, cliente, sucursal, servicio, peluquero y registro de servicio.

registros_servicio — Registros de servicio

Resumen

Valor

Objeto principal

public.registros_servicio

Cantidad de RPC

9

Operaciones estándar

insertar, obtener, listar, listar todos, actualizar, soft delete

Operaciones específicas

Iniciar servicio, Completar servicio, Obtener detalle completo

Acciones

Insertar — registros_servicio_insertar

Firma: registros_servicio_insertar(p_cita_id BIGINT, p_servicio_id BIGINT, p_peluquero_id BIGINT, p_tamano_id BIGINT, p_heridas_visibles BOOLEAN, p_raspones BOOLEAN, p_piel_irritada BOOLEAN, p_costras BOOLEAN, p_inflamacion BOOLEAN, p_cojera BOOLEAN, p_dolor_al_tocar BOOLEAN, p_pulgas BOOLEAN, p_garrapatas BOOLEAN, p_piojos BOOLEAN, p_observaciones_ingreso TEXT, p_firma_ingreso_url TEXT, p_notas_servicio TEXT)

Retorno: public.registros_servicio

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Inserta una fila y devuelve la fila creada.

Iniciar servicio — registros_servicio_iniciar

Firma: registros_servicio_iniciar(p_cita_id BIGINT, p_servicio_id BIGINT, p_peluquero_id BIGINT, p_tamano_id BIGINT, p_heridas_visibles BOOLEAN, p_raspones BOOLEAN, p_piel_irritada BOOLEAN, p_costras BOOLEAN, p_inflamacion BOOLEAN, p_cojera BOOLEAN, p_dolor_al_tocar BOOLEAN, p_pulgas BOOLEAN, p_garrapatas BOOLEAN, p_piojos BOOLEAN, p_observaciones_ingreso TEXT, p_firma_ingreso_url TEXT, p_notas_servicio TEXT)

Retorno: public.registros_servicio

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Crea atómicamente el registro de ingreso, fija inicio_real y cambia la cita a atendida.

Obtener por ID — registros_servicio_obtener_por_id

Firma: registros_servicio_obtener_por_id(p_id BIGINT)

Retorno: public.registros_servicio

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — registros_servicio_listar

Firma: registros_servicio_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0, p_sucursal_id BIGINT DEFAULT NULL)

Retorno: JSONB

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional. Si `p_sucursal_id` no es NULL, filtra por esa sucursal; el acceso del usuario a la sucursal continúa validándose mediante RLS.

Listar todos — registros_servicio_listar_todos

Firma: registros_servicio_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Actualizar — registros_servicio_actualizar

Firma: registros_servicio_actualizar(p_id BIGINT, p_servicio_id BIGINT, p_peluquero_id BIGINT, p_tamano_id BIGINT, p_cupon_id UUID, p_heridas_visibles BOOLEAN, p_raspones BOOLEAN, p_piel_irritada BOOLEAN, p_costras BOOLEAN, p_inflamacion BOOLEAN, p_cojera BOOLEAN, p_dolor_al_tocar BOOLEAN, p_pulgas BOOLEAN, p_garrapatas BOOLEAN, p_piojos BOOLEAN, p_observaciones_ingreso TEXT, p_firma_ingreso_url TEXT, p_firma_entrega_url TEXT, p_notas_servicio TEXT, p_calificacion_satisfaccion SMALLINT, p_comentario_satisfaccion TEXT, p_precio_base NUMERIC(10, 2), p_descuento_cupon NUMERIC(10, 2), p_monto_final NUMERIC(10, 2), p_monto_pagado NUMERIC(10, 2), p_activo BOOLEAN, p_pagos JSONB DEFAULT NULL, p_motivo TEXT DEFAULT NULL)

Retorno: public.registros_servicio

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Eliminar lógicamente — registros_servicio_eliminar

Firma: registros_servicio_eliminar(p_id BIGINT)

Retorno: public.registros_servicio

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Completar servicio — registros_servicio_completar

Firma: registros_servicio_completar(p_registro_servicio_id BIGINT, p_servicio_id BIGINT, p_peluquero_id BIGINT, p_tamano_id BIGINT, p_cupon_id UUID, p_firma_entrega_url TEXT, p_notas_servicio TEXT, p_calificacion_satisfaccion SMALLINT, p_comentario_satisfaccion TEXT, p_precio_base NUMERIC(10, 2), p_descuento_cupon NUMERIC(10, 2), p_monto_final NUMERIC(10, 2), p_monto_pagado NUMERIC(10, 2), p_pagos JSONB)

Retorno: JSONB

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Completa el servicio atómicamente: valida precios, fotos, firma, cupón y pagos; canjea el cupón y fija fin_real.

Obtener detalle completo — registros_servicio_obtener_detalle

Firma: registros_servicio_obtener_detalle(p_registro_servicio_id BIGINT)

Retorno: JSONB

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Devuelve el detalle anidado del servicio, cita, mascota, cliente, catálogos, cupón y pagos.

Agregar fotos — registros_servicio_fotos_agregar

Firma: registros_servicio_fotos_agregar(p_registro_servicio_id BIGINT, p_fotos_ingreso TEXT[] DEFAULT '{}', p_fotos_egreso TEXT[] DEFAULT '{}')

Retorno: JSONB con todas las fotos del registro.

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Agrega rutas nuevas de forma idempotente. Las fotos existentes se conservan.

Listar fotos — registros_servicio_fotos_listar

Firma: registros_servicio_fotos_listar(p_registro_servicio_id BIGINT, p_momento TEXT DEFAULT NULL)

Retorno: JSONB ordenado por id. `p_momento` acepta `ingreso`, `egreso` o NULL para devolver ambas.

Acceso: Usuario con acceso a la sucursal; service_role.

pagos — Pagos

Resumen

Valor

Objeto principal

public.pagos

Cantidad de RPC

4

Operaciones estándar

obtener, listar, listar todos

Operaciones específicas

Reemplazar lista de pagos

Acciones

Reemplazar lista de pagos — pagos_reemplazar_lista

Firma: pagos_reemplazar_lista(p_registro_servicio_id BIGINT, p_pagos JSONB, p_motivo TEXT DEFAULT NULL)

Retorno: JSONB

Acceso: Encargado de la sucursal durante en_progreso; administrador o propietario si está completado; service_role.

Comportamiento: Desactiva los pagos activos anteriores, inserta exactamente la lista JSON enviada y recalcula monto_pagado.

Obtener por ID — pagos_obtener_por_id

Firma: pagos_obtener_por_id(p_id BIGINT)

Retorno: public.pagos

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — pagos_listar

Firma: pagos_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — pagos_listar_todos

Firma: pagos_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

recordatorios_citas — Recordatorios de citas

Resumen

Valor

Objeto principal

public.recordatorios_citas

Cantidad de RPC

5

Operaciones estándar

insertar, obtener, listar, listar todos, soft delete

Operaciones específicas

—

Acciones

Insertar — recordatorios_citas_insertar

Firma: recordatorios_citas_insertar(p_cita_id BIGINT, p_canal public.canal_recordatorio, p_numero_destino TEXT, p_mensaje TEXT)

Retorno: public.recordatorios_citas

Acceso: Usuario con acceso a la sucursal; proceso interno con service_role.

Comportamiento: Registra un recordatorio ya enviado; admite un usuario autenticado o un proceso interno con service_role.

Obtener por ID — recordatorios_citas_obtener_por_id

Firma: recordatorios_citas_obtener_por_id(p_id BIGINT)

Retorno: public.recordatorios_citas

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — recordatorios_citas_listar

Firma: recordatorios_citas_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — recordatorios_citas_listar_todos

Firma: recordatorios_citas_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Eliminar lógicamente — recordatorios_citas_eliminar

Firma: recordatorios_citas_eliminar(p_id BIGINT)

Retorno: public.recordatorios_citas

Acceso: Usuario con acceso a la sucursal; service_role.

Comportamiento: Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

RPC por dominio: Configuración y auditoría

configuracion_sistema — Configuración del sistema

Resumen

Valor

Objeto principal

public.configuracion_sistema

Cantidad de RPC

2

Operaciones estándar

actualizar

Operaciones específicas

Obtener configuración, Actualizar configuración

Acciones

Obtener configuración — configuracion_sistema_obtener

Firma: configuracion_sistema_obtener()

Retorno: public.configuracion_sistema

Acceso: Usuario activo para lectura; administrador o propietario para cambios; service_role.

Comportamiento: Devuelve la única fila de configuración del sistema (id = 1).

Actualizar configuración — configuracion_sistema_actualizar

Firma: configuracion_sistema_actualizar(p_foto_antes_requerida BOOLEAN, p_foto_despues_requerida BOOLEAN, p_dias_anticipacion_recordatorio INTEGER, p_metodo_pago_cupon_id BIGINT, p_habilitar_calificaciones BOOLEAN, p_servicios_requeridos_cupon INTEGER, p_vigencia_cupon_automatico_dias INTEGER)

Retorno: public.configuracion_sistema

Acceso: Administrador o propietario; service_role.

Comportamiento: Actualiza completamente la configuración global, incluyendo el umbral de fidelidad y los días de vigencia del cupón automático. El programa inicia en `fidelidad_inicia_en`, establecido por la migración, por lo que no cuenta servicios históricos.

Reportes

`reportes_peluqueros_obtener()` devuelve los groomers activos con servicios completados agrupados por servicio principal y servicio adicional, cantidades, montos históricos y promedio de calificaciones. Solo incluye datos de sucursales visibles para el usuario.

`reportes_sucursales_obtener()` devuelve las sucursales activas visibles con citas completadas y próximas.

Ambas funciones devuelven JSONB con la forma `{ datos, total }` y se consultan únicamente al abrir el reporte correspondiente.

calificaciones_groomer — Calificaciones

`calificaciones_groomer_insertar(p_registro_servicio_id BIGINT, p_calificacion SMALLINT, p_calificacion_notas TEXT DEFAULT NULL)` inserta una sola calificación por hoja con firma de entrega, incluso si aún está `en_progreso`. La tabla no permite actualizaciones ni inserciones directas; la calificación solo se crea por RPC cuando `configuracion_sistema.habilitar_calificaciones` está activa.

auditorias — Auditorías

Resumen

Valor

Objeto principal

public.auditorias

Cantidad de RPC

3

Operaciones estándar

obtener, listar, listar todos

Operaciones específicas

—

Acciones

Obtener por ID — auditorias_obtener_por_id

Firma: auditorias_obtener_por_id(p_id BIGINT)

Retorno: public.auditorias

Acceso: Usuario activo según RLS; service_role.

Comportamiento: Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no existe o no es visible por RLS.

Listar activos — auditorias_listar

Firma: auditorias_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Usuario activo según RLS; service_role.

Comportamiento: Lista únicamente registros activos con paginación opcional.

Listar todos — auditorias_listar_todos

Firma: auditorias_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

Retorno: JSONB

Acceso: Administrador o propietario; service_role.

Comportamiento: Lista registros activos e inactivos con paginación opcional.

Referencias técnicas

Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

Supabase Database Functions: https://supabase.com/docs/guides/database/functions

Supabase JavaScript RPC: https://supabase.com/docs/reference/javascript/rpc

Supabase Server-Side Auth for Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs

PostgreSQL RAISE y SQLSTATE: https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html

Notas de migración futura

La lógica principal está implementada en PostgreSQL, por lo que una migración futura a Amazon RDS for PostgreSQL o Aurora PostgreSQL puede conservar tablas, funciones, constraints y triggers. Las piezas que requerirían adaptación son principalmente:

auth.uid() y la integración con Supabase Auth;

roles authenticated, anon y service_role;

claims JWT disponibles mediante PostgreSQL;

Storage y generación de URLs firmadas;

cliente Supabase usado por Next.js.

En una migración, puede sustituirse auth.uid() por una variable de sesión establecida por el backend o por una capa de autenticación equivalente, sin reescribir necesariamente la lógica transaccional de negocio.

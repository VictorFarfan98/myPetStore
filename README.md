# MyPetStore Grooming

Spanish-first grooming operations app for a Guatemala pet store chain.

## What is included

- Next.js App Router dashboard for grooming operations.
- Seeded in-memory data for branches, users, customers, pets, services, appointments, records, and WhatsApp reminder logs.
- Prisma PostgreSQL schema for the planned production data model.
- Business-rule tests for appointment status transitions, groomer conflicts, reports, and reminder messages.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database setup

Copy `.env.example` to `.env`, set `DATABASE_URL`, then run:

```bash
npx prisma generate
npx prisma migrate dev
```

Most pages now read through `lib/app-data.ts`, which queries Prisma when `DATABASE_URL` is set and falls back to `lib/seed-data.ts` when it is not.


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

Crea o actualiza de forma idempotente el bucket privado petstore. No elimina archivos existentes.

Orden de ejecución

Ejecutar setup.sql.

Ejecutar rpc.sql.

Ejecutar supabase_storage.sql una vez o cuando se quiera reafirmar la configuración del bucket.

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

authenticated tiene acceso directo a tablas bajo RLS. La aplicación puede usar .from(...) cuando resulte conveniente, pero las RPC son la interfaz principal.

El acceso directo puede omitir:

validaciones transaccionales de flujos complejos;

auditoría generada por RPC;

canje atómico de cupones;

reemplazo atómico de pagos;

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

La función desactiva los pagos activos anteriores, inserta los nuevos y recalcula monto_pagado. En un servicio completado, solo administrador o propietario puede modificar la lista y la suma debe coincidir exactamente con monto_final.

Completar un servicio

registros_servicio_completar recibe la información final, los montos y la lista completa de pagos. PostgreSQL verifica que precio_base y recargo_shampoo coincidan con las configuraciones activas, valida la fórmula final, el cupón, las fotos, la firma y la suma de pagos, y realiza todo en una sola transacción.

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

valida shampoo cuando corresponde;

valida fotos requeridas y firma de entrega;

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

Las carpetas son prefijos lógicos y aparecen cuando se sube el primer objeto. La aplicación debe usar el backend para subir, reemplazar y firmar URLs.

Catálogo completo de RPC

Las firmas siguientes se extraen del rpc.sql generado. Los retornos tipados devuelven filas PostgreSQL; los retornos JSONB contienen objetos o listas anidadas.

Asignaciones de usuarios a sucursales

Función y parámetros

Retorno

Propósito

Acceso

usuarios_sucursales_insertar(p_usuario_id UUID, p_sucursal_id BIGINT, p_activo BOOLEAN)

public.usuarios_sucursales

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

usuarios_sucursales_obtener_por_id(p_usuario_id UUID, p_sucursal_id BIGINT)

public.usuarios_sucursales

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

usuarios_sucursales_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

usuarios_sucursales_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

usuarios_sucursales_actualizar(p_usuario_id UUID, p_sucursal_id BIGINT, p_activo BOOLEAN)

public.usuarios_sucursales

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

usuarios_sucursales_eliminar(p_usuario_id UUID, p_sucursal_id BIGINT)

public.usuarios_sucursales

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

Precios y duraciones de servicios

Función y parámetros

Retorno

Propósito

Acceso

precios_servicios_insertar(p_servicio_id BIGINT, p_tamano_id BIGINT, p_precio NUMERIC(10, 2), p_duracion_minutos INTEGER, p_activo BOOLEAN)

public.precios_servicios

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

precios_servicios_obtener_por_id(p_servicio_id BIGINT, p_tamano_id BIGINT)

public.precios_servicios

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

precios_servicios_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

precios_servicios_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

precios_servicios_actualizar(p_servicio_id BIGINT, p_tamano_id BIGINT, p_precio NUMERIC(10, 2), p_duracion_minutos INTEGER, p_activo BOOLEAN)

public.precios_servicios

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

precios_servicios_eliminar(p_servicio_id BIGINT, p_tamano_id BIGINT)

public.precios_servicios

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

Opciones de shampoo

Función y parámetros

Retorno

Propósito

Acceso

opciones_shampoo_insertar(p_nombre TEXT, p_activo BOOLEAN)

public.opciones_shampoo

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

opciones_shampoo_obtener_por_id(p_id BIGINT)

public.opciones_shampoo

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

opciones_shampoo_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

opciones_shampoo_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

opciones_shampoo_actualizar(p_id BIGINT, p_nombre TEXT, p_activo BOOLEAN)

public.opciones_shampoo

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

opciones_shampoo_eliminar(p_id BIGINT)

public.opciones_shampoo

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

Recargos de shampoo

Función y parámetros

Retorno

Propósito

Acceso

precios_shampoo_insertar(p_shampoo_id BIGINT, p_tamano_id BIGINT, p_recargo NUMERIC(10, 2), p_activo BOOLEAN)

public.precios_shampoo

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

precios_shampoo_obtener_por_id(p_shampoo_id BIGINT, p_tamano_id BIGINT)

public.precios_shampoo

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

precios_shampoo_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

precios_shampoo_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

precios_shampoo_actualizar(p_shampoo_id BIGINT, p_tamano_id BIGINT, p_recargo NUMERIC(10, 2), p_activo BOOLEAN)

public.precios_shampoo

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

precios_shampoo_eliminar(p_shampoo_id BIGINT, p_tamano_id BIGINT)

public.precios_shampoo

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

Configuración del sistema

Función y parámetros

Retorno

Propósito

Acceso

configuracion_sistema_obtener()

public.configuracion_sistema

Devuelve la única fila de configuración del sistema (id = 1).

Usuario activo para lectura; administrador/propietario para cambios; service_role

configuracion_sistema_actualizar(p_foto_antes_requerida BOOLEAN, p_foto_despues_requerida BOOLEAN, p_dias_anticipacion_recordatorio INTEGER, p_metodo_pago_cupon_id BIGINT)

public.configuracion_sistema

Actualiza completamente la configuración global.

Administrador/propietario; service_role

Registros de servicio

Función y parámetros

Retorno

Propósito

Acceso

registros_servicio_insertar(p_cita_id BIGINT, p_servicio_id BIGINT, p_peluquero_id BIGINT, p_tamano_id BIGINT, p_shampoo_id BIGINT, p_heridas_visibles BOOLEAN, p_raspones BOOLEAN, p_piel_irritada BOOLEAN, p_costras BOOLEAN, p_inflamacion BOOLEAN, p_cojera BOOLEAN, p_dolor_al_tocar BOOLEAN, p_pulgas BOOLEAN, p_garrapatas BOOLEAN, p_piojos BOOLEAN, p_observaciones_ingreso TEXT, p_firma_ingreso_url TEXT, p_foto_antes_url TEXT, p_notas_servicio TEXT)

public.registros_servicio

Inserta una fila y devuelve la fila creada.

Usuario con acceso a la sucursal; service_role

registros_servicio_iniciar(p_cita_id BIGINT, p_servicio_id BIGINT, p_peluquero_id BIGINT, p_tamano_id BIGINT, p_shampoo_id BIGINT, p_heridas_visibles BOOLEAN, p_raspones BOOLEAN, p_piel_irritada BOOLEAN, p_costras BOOLEAN, p_inflamacion BOOLEAN, p_cojera BOOLEAN, p_dolor_al_tocar BOOLEAN, p_pulgas BOOLEAN, p_garrapatas BOOLEAN, p_piojos BOOLEAN, p_observaciones_ingreso TEXT, p_firma_ingreso_url TEXT, p_foto_antes_url TEXT, p_notas_servicio TEXT)

public.registros_servicio

Crea atómicamente el registro de ingreso y cambia la cita a atendida.

Usuario con acceso a la sucursal; service_role

registros_servicio_obtener_por_id(p_id BIGINT)

public.registros_servicio

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario con acceso a la sucursal; service_role

registros_servicio_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario con acceso a la sucursal; service_role

registros_servicio_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

registros_servicio_actualizar(p_id BIGINT, p_servicio_id BIGINT, p_peluquero_id BIGINT, p_tamano_id BIGINT, p_shampoo_id BIGINT, p_cupon_id UUID, p_heridas_visibles BOOLEAN, p_raspones BOOLEAN, p_piel_irritada BOOLEAN, p_costras BOOLEAN, p_inflamacion BOOLEAN, p_cojera BOOLEAN, p_dolor_al_tocar BOOLEAN, p_pulgas BOOLEAN, p_garrapatas BOOLEAN, p_piojos BOOLEAN, p_observaciones_ingreso TEXT, p_firma_ingreso_url TEXT, p_firma_entrega_url TEXT, p_foto_antes_url TEXT, p_foto_despues_url TEXT, p_notas_servicio TEXT, p_calificacion_satisfaccion SMALLINT, p_comentario_satisfaccion TEXT, p_precio_base NUMERIC(10, 2), p_recargo_shampoo NUMERIC(10, 2), p_descuento_cupon NUMERIC(10, 2), p_monto_final NUMERIC(10, 2), p_monto_pagado NUMERIC(10, 2), p_activo BOOLEAN, p_pagos JSONB DEFAULT NULL, p_motivo TEXT DEFAULT NULL)

public.registros_servicio

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Usuario con acceso a la sucursal; service_role

registros_servicio_eliminar(p_id BIGINT)

public.registros_servicio

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Usuario con acceso a la sucursal; service_role

registros_servicio_completar(p_registro_servicio_id BIGINT, p_servicio_id BIGINT, p_peluquero_id BIGINT, p_tamano_id BIGINT, p_shampoo_id BIGINT, p_cupon_id UUID, p_firma_entrega_url TEXT, p_foto_antes_url TEXT, p_foto_despues_url TEXT, p_notas_servicio TEXT, p_calificacion_satisfaccion SMALLINT, p_comentario_satisfaccion TEXT, p_precio_base NUMERIC(10, 2), p_recargo_shampoo NUMERIC(10, 2), p_descuento_cupon NUMERIC(10, 2), p_monto_final NUMERIC(10, 2), p_monto_pagado NUMERIC(10, 2), p_pagos JSONB)

JSONB

Completa el servicio atómicamente: valida precios, fotos, firma, cupón y pagos; canjea cupón y fija fin_real.

Usuario con acceso a la sucursal; service_role

registros_servicio_obtener_detalle(p_registro_servicio_id BIGINT)

JSONB

Devuelve el detalle anidado del servicio, cita, mascota, cliente, catálogos, cupón y pagos.

Usuario con acceso a la sucursal; service_role

Recordatorios de citas

Función y parámetros

Retorno

Propósito

Acceso

recordatorios_citas_insertar(p_cita_id BIGINT, p_canal public.canal_recordatorio, p_numero_destino TEXT, p_mensaje TEXT)

public.recordatorios_citas

Registra un recordatorio ya enviado; admite usuario autenticado o proceso interno con service_role.

Usuario con acceso a la sucursal; procesos internos con service_role

recordatorios_citas_obtener_por_id(p_id BIGINT)

public.recordatorios_citas

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario con acceso a la sucursal; service_role

recordatorios_citas_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario con acceso a la sucursal; service_role

recordatorios_citas_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

recordatorios_citas_eliminar(p_id BIGINT)

public.recordatorios_citas

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Usuario con acceso a la sucursal; service_role

Métodos de pago

Función y parámetros

Retorno

Propósito

Acceso

metodos_pago_insertar(p_nombre TEXT, p_activo BOOLEAN)

public.metodos_pago

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

metodos_pago_obtener_por_id(p_id BIGINT)

public.metodos_pago

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

metodos_pago_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

metodos_pago_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

metodos_pago_actualizar(p_id BIGINT, p_nombre TEXT, p_activo BOOLEAN)

public.metodos_pago

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

metodos_pago_eliminar(p_id BIGINT)

public.metodos_pago

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

Usuarios

Función y parámetros

Retorno

Propósito

Acceso

usuarios_insertar(p_id UUID, p_nombre TEXT, p_nombre_usuario TEXT, p_telefono TEXT, p_rol public.rol_usuario, p_alcance_acceso public.alcance_acceso, p_activo BOOLEAN, p_sucursal_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[])

public.usuarios

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

usuarios_obtener_por_id(p_id UUID)

public.usuarios

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

usuarios_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

usuarios_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

usuarios_actualizar(p_id UUID, p_nombre TEXT, p_telefono TEXT, p_rol public.rol_usuario, p_alcance_acceso public.alcance_acceso, p_activo BOOLEAN, p_sucursal_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[])

public.usuarios

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

usuarios_eliminar(p_id UUID)

public.usuarios

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

usuarios_obtener_perfil_actual()

JSONB

Devuelve el perfil del usuario autenticado, su rol, alcance y sucursales activas asignadas.

authenticated (propio perfil); service_role

usuarios_listar_disponibles_para_asignacion()

JSONB

Lista usuarios activos con alcance por sucursales para la pantalla de asignación.

Administrador/propietario; service_role

Sucursales

Función y parámetros

Retorno

Propósito

Acceso

sucursales_insertar(p_nombre TEXT, p_direccion TEXT, p_telefono TEXT, p_activo BOOLEAN)

public.sucursales

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

sucursales_obtener_por_id(p_id BIGINT)

public.sucursales

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

sucursales_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

sucursales_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

sucursales_actualizar(p_id BIGINT, p_nombre TEXT, p_direccion TEXT, p_telefono TEXT, p_activo BOOLEAN)

public.sucursales

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

sucursales_eliminar(p_id BIGINT)

public.sucursales

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

Clientes

Función y parámetros

Retorno

Propósito

Acceso

clientes_insertar(p_nombre TEXT, p_telefono TEXT, p_whatsapp_opt_in BOOLEAN, p_sms_opt_in BOOLEAN, p_notas TEXT, p_activo BOOLEAN)

public.clientes

Inserta una fila y devuelve la fila creada.

Usuario activo según visibilidad RLS; service_role

clientes_obtener_por_id(p_id BIGINT)

public.clientes

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo según visibilidad RLS; service_role

clientes_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo según visibilidad RLS; service_role

clientes_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

clientes_actualizar(p_id BIGINT, p_nombre TEXT, p_telefono TEXT, p_whatsapp_opt_in BOOLEAN, p_sms_opt_in BOOLEAN, p_notas TEXT, p_activo BOOLEAN)

public.clientes

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Usuario activo según visibilidad RLS; service_role

clientes_eliminar(p_id BIGINT)

public.clientes

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Usuario activo según visibilidad RLS; service_role

clientes_obtener_detalle(p_cliente_id BIGINT)

JSONB

Devuelve cliente, mascotas visibles y las últimas 10 citas con resumen del servicio y pagos activos.

Usuario activo según visibilidad RLS; service_role

Tamaños

Función y parámetros

Retorno

Propósito

Acceso

tamanos_insertar(p_nombre TEXT, p_activo BOOLEAN)

public.tamanos

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

tamanos_obtener_por_id(p_id BIGINT)

public.tamanos

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

tamanos_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

tamanos_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

tamanos_actualizar(p_id BIGINT, p_nombre TEXT, p_activo BOOLEAN)

public.tamanos

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

tamanos_eliminar(p_id BIGINT)

public.tamanos

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

Mascotas

Función y parámetros

Retorno

Propósito

Acceso

mascotas_insertar(p_cliente_id BIGINT, p_nombre TEXT, p_especie public.especie_mascota, p_raza TEXT, p_tamano_id BIGINT, p_foto_perfil_url TEXT, p_fecha_nacimiento DATE, p_notas_salud TEXT, p_notas_comportamiento TEXT, p_intervalo_preferido_dias INTEGER, p_activo BOOLEAN)

public.mascotas

Inserta una fila y devuelve la fila creada.

Usuario activo según visibilidad RLS; service_role

mascotas_obtener_por_id(p_id BIGINT)

public.mascotas

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo según visibilidad RLS; service_role

mascotas_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo según visibilidad RLS; service_role

mascotas_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

mascotas_actualizar(p_id BIGINT, p_cliente_id BIGINT, p_nombre TEXT, p_especie public.especie_mascota, p_raza TEXT, p_tamano_id BIGINT, p_foto_perfil_url TEXT, p_fecha_nacimiento DATE, p_notas_salud TEXT, p_notas_comportamiento TEXT, p_intervalo_preferido_dias INTEGER, p_activo BOOLEAN)

public.mascotas

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Usuario activo según visibilidad RLS; service_role

mascotas_eliminar(p_id BIGINT)

public.mascotas

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Usuario activo según visibilidad RLS; service_role

mascotas_transferir_cliente(p_mascota_id BIGINT, p_nuevo_cliente_id BIGINT, p_motivo TEXT)

public.mascotas

Transfiere una mascota a otro cliente y audita el cambio.

Cualquier usuario activo autorizado; service_role

mascotas_obtener_historial(p_mascota_id BIGINT)

JSONB

Devuelve historial operativo activo de una mascota con citas, servicios, pagos activos y cupón.

Usuario activo según visibilidad RLS; service_role

mascotas_obtener_historial_completo(p_mascota_id BIGINT)

JSONB

Devuelve historial completo, incluyendo registros inactivos; solo administrador/propietario.

Administrador/propietario; service_role

Peluqueros

Función y parámetros

Retorno

Propósito

Acceso

peluqueros_insertar(p_nombre TEXT, p_telefono TEXT, p_color_calendario TEXT, p_activo BOOLEAN)

public.peluqueros

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

peluqueros_obtener_por_id(p_id BIGINT)

public.peluqueros

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

peluqueros_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

peluqueros_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

peluqueros_actualizar(p_id BIGINT, p_nombre TEXT, p_telefono TEXT, p_color_calendario TEXT, p_activo BOOLEAN)

public.peluqueros

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

peluqueros_eliminar(p_id BIGINT)

public.peluqueros

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

Servicios

Función y parámetros

Retorno

Propósito

Acceso

servicios_insertar(p_nombre TEXT, p_intervalo_recordatorio_dias INTEGER, p_activo BOOLEAN)

public.servicios

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

servicios_obtener_por_id(p_id BIGINT)

public.servicios

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

servicios_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

servicios_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

servicios_actualizar(p_id BIGINT, p_nombre TEXT, p_intervalo_recordatorio_dias INTEGER, p_activo BOOLEAN)

public.servicios

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

servicios_eliminar(p_id BIGINT)

public.servicios

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

Cupones

Función y parámetros

Retorno

Propósito

Acceso

cupones_insertar(p_id UUID, p_cliente_id BIGINT, p_servicio_id BIGINT, p_tipo_descuento public.tipo_descuento_cupon, p_valor NUMERIC(10, 2), p_fecha_expiracion DATE, p_activo BOOLEAN)

public.cupones

Inserta una fila y devuelve la fila creada.

Administrador/propietario; service_role

cupones_obtener_por_id(p_id UUID)

public.cupones

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo para lectura; administrador/propietario para cambios; service_role

cupones_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo para lectura; administrador/propietario para cambios; service_role

cupones_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

cupones_actualizar(p_id UUID, p_cliente_id BIGINT, p_servicio_id BIGINT, p_tipo_descuento public.tipo_descuento_cupon, p_valor NUMERIC(10, 2), p_fecha_expiracion DATE, p_activo BOOLEAN)

public.cupones

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Administrador/propietario; service_role

cupones_eliminar(p_id UUID)

public.cupones

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Administrador/propietario; service_role

cupones_listar_por_cliente(p_cliente_id BIGINT)

JSONB

Lista los cupones reales almacenados de un cliente, sin estado derivado.

Usuario activo para lectura; administrador/propietario para cambios; service_role

Citas

Función y parámetros

Retorno

Propósito

Acceso

citas_insertar(p_mascota_id BIGINT, p_sucursal_id BIGINT, p_peluquero_id BIGINT, p_servicio_id BIGINT, p_inicio_programado TIMESTAMPTZ, p_origen public.origen_cita)

public.citas

Inserta una fila y devuelve la fila creada.

Usuario con acceso a la sucursal; service_role

citas_obtener_por_id(p_id BIGINT)

public.citas

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario con acceso a la sucursal; service_role

citas_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario con acceso a la sucursal; service_role

citas_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

citas_actualizar(p_id BIGINT, p_mascota_id BIGINT, p_sucursal_id BIGINT, p_peluquero_id BIGINT, p_servicio_id BIGINT, p_inicio_programado TIMESTAMPTZ, p_fin_programado TIMESTAMPTZ, p_estado public.estado_cita, p_origen public.origen_cita, p_activo BOOLEAN)

public.citas

Realiza una actualización completa con parámetros tipados y devuelve la fila resultante.

Usuario con acceso a la sucursal; service_role

citas_eliminar(p_id BIGINT)

public.citas

Realiza soft delete (activo = FALSE) y devuelve la fila resultante.

Usuario con acceso a la sucursal; service_role

citas_reprogramar(p_cita_id BIGINT, p_inicio_programado TIMESTAMPTZ, p_servicio_id BIGINT, p_peluquero_id BIGINT)

public.citas

Reprograma una cita, puede cambiar servicio y peluquero, y recalcula fin_programado con la duración vigente.

Usuario con acceso a la sucursal; service_role

citas_cancelar(p_cita_id BIGINT, p_motivo TEXT)

public.citas

Cambia la cita a cancelada y registra la auditoría con el motivo.

Usuario con acceso a la sucursal; service_role

citas_marcar_no_asistio(p_cita_id BIGINT, p_motivo TEXT)

public.citas

Cambia la cita a no_asistio y registra la auditoría con el motivo.

Usuario con acceso a la sucursal; service_role

citas_obtener_agenda(p_sucursal_id BIGINT, p_fecha_desde TIMESTAMPTZ, p_fecha_hasta TIMESTAMPTZ)

JSONB

Devuelve agenda anidada por rango, con mascota, cliente, sucursal, servicio, peluquero y registro de servicio.

Usuario con acceso a la sucursal; service_role

Pagos

Función y parámetros

Retorno

Propósito

Acceso

pagos_reemplazar_lista(p_registro_servicio_id BIGINT, p_pagos JSONB, p_motivo TEXT DEFAULT NULL)

JSONB

Desactiva los pagos activos anteriores e inserta exactamente la lista JSON enviada; recalcula monto_pagado.

Encargado de la sucursal si está en progreso; administrador/propietario si está completado; service_role

pagos_obtener_por_id(p_id BIGINT)

public.pagos

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario con acceso a la sucursal; service_role

pagos_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario con acceso a la sucursal; service_role

pagos_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

Auditorías

Función y parámetros

Retorno

Propósito

Acceso

auditorias_obtener_por_id(p_id BIGINT)

public.auditorias

Obtiene una fila por su llave; lanza REGISTRO_NO_ENCONTRADO si no es visible o no existe.

Usuario activo según RLS; service_role

auditorias_listar(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista únicamente registros activos con paginación opcional.

Usuario activo según RLS; service_role

auditorias_listar_todos(p_limite BIGINT DEFAULT NULL, p_offset BIGINT DEFAULT 0)

JSONB

Lista registros activos e inactivos con paginación opcional.

Administrador/propietario; service_role

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
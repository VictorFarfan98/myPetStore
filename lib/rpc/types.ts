export type RpcSqlState = "PA001" | "PN001" | "PE001" | "PV001" | "PC001";

export type RpcListEnvelope<T> = {
  datos: T[];
  total: number;
  limite: number | null;
  offset: number;
};

export type RpcResult<T> = {
  data: T | null;
  error: RpcError | null;
};

export type RpcError = {
  code: string;
  message: string;
  details?: string;
  hint?: string;
  httpStatus: number;
};

export type RpcPaginationParams = {
  p_limite?: number | null;
  p_offset?: number;
};

export type Id = number | string;
export type DateString = string;

export type SucursalRow = {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string;
  activo: boolean;
};

export type SucursalInsertParams = {
  p_nombre: string;
  p_direccion: string;
  p_telefono: string;
  p_activo: boolean;
};

export type SucursalUpdateParams = SucursalInsertParams & {
  p_id: number;
};

export type ClienteRow = {
  id: number;
  nombre: string;
  telefono: string;
  email: string | null;
  whatsapp_opt_in: boolean;
  sms_opt_in: boolean;
  notas: string | null;
  activo: boolean;
};

export type ClienteInsertParams = {
  p_nombre: string;
  p_telefono: string;
  p_email: string | null;
  p_whatsapp_opt_in: boolean;
  p_sms_opt_in: boolean;
  p_notas: string | null;
  p_activo: boolean;
};

export type ClienteUpdateParams = ClienteInsertParams & {
  p_id: number;
};

export type TamanoRow = {
  id: number;
  nombre: string;
  especie: "perro" | "gato" | "otro";
  activo: boolean;
};

export type TamanoInsertParams = {
  p_especie: "perro" | "gato" | "otro";
  p_nombre: string;
  p_activo: boolean;
};

export type TamanoUpdateParams = TamanoInsertParams & {
  p_id: number;
};

export type MascotaRow = {
  id: number;
  cliente_id: number;
  nombre: string;
  especie: string;
  raza: string;
  tamano_id: number;
  foto_perfil_url: string | null;
  fecha_nacimiento: DateString | null;
  notas_salud: string | null;
  notas_comportamiento: string | null;
  intervalo_preferido_dias: number | null;
  activo: boolean;
};

export type MascotaInsertParams = {
  p_cliente_id: number;
  p_nombre: string;
  p_especie: string;
  p_raza: string;
  p_tamano_id: number;
  p_foto_perfil_url: string | null;
  p_fecha_nacimiento: DateString | null;
  p_notas_salud: string | null;
  p_notas_comportamiento: string | null;
  p_intervalo_preferido_dias: number | null;
  p_activo: boolean;
};

export type MascotaUpdateParams = MascotaInsertParams & {
  p_id: number;
};

export type PeluqueroRow = {
  id: number;
  nombre: string;
  telefono: string | null;
  color_calendario: string | null;
  activo: boolean;
};

export type PeluqueroInsertParams = {
  p_nombre: string;
  p_telefono: string | null;
  p_color_calendario: string | null;
  p_activo: boolean;
};

export type PeluqueroUpdateParams = PeluqueroInsertParams & {
  p_id: number;
};

export type ServicioRow = {
  id: number;
  nombre: string;
  intervalo_recordatorio_dias: number | null;
  duracion_minutos: number | null;
  es_adicional: boolean;
  precio: string | null;
  activo: boolean;
};

export type ServicioInsertParams = {
  p_nombre: string;
  p_intervalo_recordatorio_dias: number | null;
  p_duracion_minutos: number | null;
  p_es_adicional: boolean;
  p_precio: string | null;
  p_activo: boolean;
};

export type ServicioUpdateParams = ServicioInsertParams & {
  p_id: number;
};

export type UsuarioSucursalRow = {
  usuario_id: string;
  sucursal_id: number;
  activo: boolean;
};

export type UsuarioSucursalInsertParams = {
  p_usuario_id: string;
  p_sucursal_id: number;
  p_activo: boolean;
};

export type UsuarioSucursalUpdateParams = UsuarioSucursalInsertParams;

export type PrecioServicioRow = {
  servicio_id: number;
  especie: "perro" | "gato" | "otro";
  tamano_id: number;
  precio: string;
  precio_promocional: string | null;
  duracion_minutos: number;
  activo: boolean;
};

export type PrecioServicioInsertParams = {
  p_servicio_id: number;
  p_especie: "perro" | "gato" | "otro";
  p_tamano_id: number;
  p_precio: string;
  p_precio_promocional: string | null;
  p_duracion_minutos: number;
  p_activo: boolean;
};

export type PrecioServicioUpdateParams = PrecioServicioInsertParams;

export type MetodoPagoRow = {
  id: number;
  nombre: string;
  activo: boolean;
};

export type MetodoPagoInsertParams = {
  p_nombre: string;
  p_activo: boolean;
};

export type MetodoPagoUpdateParams = MetodoPagoInsertParams & {
  p_id: number;
};

export type UsuarioRow = {
  id: string;
  nombre: string;
  nombre_usuario: string;
  telefono: string | null;
  rol: string;
  alcance_acceso: string;
  activo: boolean;
};

export type UsuarioInsertParams = {
  p_id: string;
  p_nombre: string;
  p_nombre_usuario: string;
  p_telefono: string | null;
  p_rol: string;
  p_alcance_acceso: string;
  p_activo: boolean;
  p_sucursal_ids?: number[];
};

export type UsuarioUpdateParams = {
  p_id: string;
  p_nombre: string;
  p_telefono: string | null;
  p_rol: string;
  p_alcance_acceso: string;
  p_activo: boolean;
  p_sucursal_ids?: number[];
};

export type ConfiguracionSistemaRow = {
  id: number;
  foto_antes_requerida: boolean;
  foto_despues_requerida: boolean;
  dias_anticipacion_recordatorio: number;
  metodo_pago_cupon_id: number;
  habilitar_calificaciones: boolean;
  servicios_requeridos_cupon: number;
  vigencia_cupon_automatico_dias: number;
  fidelidad_inicia_en: DateString;
};

export type ConfiguracionSistemaUpdateParams = {
  p_foto_antes_requerida: boolean;
  p_foto_despues_requerida: boolean;
  p_dias_anticipacion_recordatorio: number;
  p_metodo_pago_cupon_id: number;
  p_habilitar_calificaciones: boolean;
  p_servicios_requeridos_cupon: number;
  p_vigencia_cupon_automatico_dias: number;
};

export type CalificacionGroomerInsertParams = {
  p_registro_servicio_id: number;
  p_calificacion: number;
  p_calificacion_notas: string | null;
};

export type CalificacionGroomerRow = {
  id: number;
  peluquero_id: number;
  mascota_id: number;
  registro_servicio_id: number;
  calificacion: number;
  calificacion_notas: string | null;
  creado_en: DateString;
  actualizado_en: DateString;
};

export type ReporteServicioRow = {
  servicio_id: number;
  servicio_nombre: string;
  cantidad: number;
  monto_total: number;
};

export type ReportePeluqueroRow = {
  peluquero_id: number;
  peluquero_nombre: string;
  servicios_completados: number;
  adicionales_realizados: number;
  duracion_promedio_minutos: number;
  monto_servicios: number;
  monto_adicionales: number;
  monto_total_generado: number;
  calificacion_promedio: number | null;
  servicios: ReporteServicioRow[];
  subservicios: ReporteServicioRow[];
};

export type ReportePeluquerosResult = {
  datos: ReportePeluqueroRow[];
  total: number;
};

export type ReporteSucursalRow = {
  sucursal_id: number;
  sucursal_nombre: string;
  direccion: string;
  telefono: string;
  completadas: number;
  proximas: number;
};

export type ReporteSucursalesResult = {
  datos: ReporteSucursalRow[];
  total: number;
};

export type CuponRow = {
  id: string;
  nombre: string;
  cliente_id: number | null;
  servicio_id: number | null;
  tipo_descuento: string;
  valor: string;
  fecha_expiracion: DateString | null;
  canjeado_en: DateString | null;
  activo: boolean;
  uso_unico: boolean;
  origen: "manual" | "automatico";
  registro_origen_id: number | null;
  creado_por_usuario_id: string | null;
};

export type CuponInsertParams = {
  p_id: string;
  p_nombre: string;
  p_cliente_id: number | null;
  p_servicio_id: number | null;
  p_tipo_descuento: string;
  p_valor: string;
  p_fecha_expiracion: DateString | null;
  p_uso_unico: boolean;
  p_activo: boolean;
};

export type CuponUpdateParams = CuponInsertParams;

export type ClienteProgresoFidelidadRow = {
  cliente_id: number;
  completados: number;
  requeridos: number;
};

export type CitaRow = {
  id: number;
  mascota_id: number;
  sucursal_id: number;
  servicio_id: number;
  peluquero_id: number | null;
  creada_por_usuario_id: string;
  inicio_programado: DateString;
  fin_programado: DateString;
  estado: string;
  origen: string;
  activo: boolean;
};

export type CitaInsertParams = {
  p_sucursal_id: number;
  p_mascota_id: number;
  p_inicio_programado: DateString;
  p_servicio_id: number;
  p_peluquero_id: number;
  p_origen: string;
};

export type CitaUpdateParams = {
  p_id: number;
  p_sucursal_id: number;
  p_mascota_id: number;
  p_inicio_programado: DateString;
  p_fin_programado: DateString;
  p_servicio_id: number;
  p_peluquero_id: number;
  p_estado: string;
  p_origen: string;
  p_activo: boolean;
};

export type RegistroServicioRow = {
  id: number;
  cita_id: number;
  servicio_id: number;
  peluquero_id: number;
  tamano_id: number;
  usar_promocion: boolean;
  cupon_id: string | null;
  estado: string;
  activo: boolean;
  inicio_real: DateString;
  fin_real: DateString | null;
  observaciones_ingreso: string;
  notas_servicio: string | null;
  comentario_satisfaccion: string | null;
  firma_ingreso_url: string | null;
  firma_ingreso_en: DateString | null;
  firma_entrega_url: string | null;
  firma_entrega_en: DateString | null;
  precio_base: string | null;
  descuento_cupon: string | null;
  monto_final: string | null;
  monto_pagado: string | null;
  heridas_visibles: boolean;
  raspones: boolean;
  piel_irritada: boolean;
  costras: boolean;
  inflamacion: boolean;
  cojera: boolean;
  dolor_al_tocar: boolean;
  pulgas: boolean;
  garrapatas: boolean;
  piojos: boolean;
  adicionales?: Array<{ servicio_id: number; cantidad?: number; precio?: string }>;
  fotos?: RegistroServicioFotoRow[];
};

export type RegistroServicioFotoRow = {
  id: number;
  registro_servicio_id: number;
  momento: "ingreso" | "egreso";
  ruta_storage: string;
  subida_en: DateString;
};

export type RegistroServicioInsertParams = {
  p_cita_id: number;
  p_servicio_id: number;
  p_peluquero_id: number;
  p_tamano_id: number;
  p_heridas_visibles: boolean;
  p_raspones: boolean;
  p_piel_irritada: boolean;
  p_costras: boolean;
  p_inflamacion: boolean;
  p_cojera: boolean;
  p_dolor_al_tocar: boolean;
  p_pulgas: boolean;
  p_garrapatas: boolean;
  p_piojos: boolean;
  p_observaciones_ingreso: string | null;
  p_firma_ingreso_url: string | null;
  p_notas_servicio: string | null;
};

export type RegistroServicioIniciarParams = RegistroServicioInsertParams;

export type RegistroServicioUpdateParams = {
  p_id: number;
  p_servicio_id: number;
  p_peluquero_id: number;
  p_tamano_id: number;
  p_cupon_id: string | null;
  p_heridas_visibles: boolean;
  p_raspones: boolean;
  p_piel_irritada: boolean;
  p_costras: boolean;
  p_inflamacion: boolean;
  p_cojera: boolean;
  p_dolor_al_tocar: boolean;
  p_pulgas: boolean;
  p_garrapatas: boolean;
  p_piojos: boolean;
  p_observaciones_ingreso: string | null;
  p_firma_ingreso_url: string | null;
  p_firma_entrega_url: string | null;
  p_notas_servicio: string | null;
  p_calificacion_satisfaccion: number | null;
  p_comentario_satisfaccion: string | null;
  p_precio_base: string | null;
  p_descuento_cupon: string | null;
  p_monto_final: string | null;
  p_monto_pagado: string | null;
  p_activo: boolean;
  p_pagos?: unknown;
  p_motivo?: string | null;
};

export type RegistroServicioAdicionalesParams = {
  p_registro_servicio_id: number;
  p_adicionales: Array<{ servicio_id: number; cantidad: number }>;
};

export type RegistroServicioFotosAgregarParams = {
  p_registro_servicio_id: number;
  p_fotos_ingreso: string[];
  p_fotos_egreso: string[];
};

export type PagoRow = {
  id: number;
  registro_servicio_id: number;
  metodo_pago_id: number;
  monto: string;
  activo: boolean;
  creado_por_usuario_id: string | null;
};

export type PagoInsertParams = {
  p_registro_servicio_id: number;
  p_metodo_pago_id: number;
  p_monto: string;
  p_activo: boolean;
};

export type PagoUpdateParams = PagoInsertParams & {
  p_id: number;
};

export type RecordatorioCitaRow = {
  id: number;
  cita_id: number;
  canal: string;
  numero_destino: string;
  mensaje: string;
  enviado_en: DateString;
  activo: boolean;
};

export type RecordatorioCitaInsertParams = {
  p_cita_id: number;
  p_canal: string;
  p_numero_destino: string;
  p_mensaje: string;
};

export type RecordatorioCitaDeleteParams = {
  p_id: number;
};

export type AuditoriaRow = {
  id: number;
  tipo_entidad: string;
  entidad_id: string;
  accion: string;
  valores_anteriores: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
  sucursal_id: number | null;
  usuario_id: string | null;
  motivo: string | null;
};

export type CitasAgendaParams = {
  p_sucursal_id: number | null;
  p_fecha_desde: DateString;
  p_fecha_hasta: DateString;
};

export type PagosReemplazarListaParams = {
  p_registro_servicio_id: number;
  p_pagos: Array<{ metodo_pago_id: number; monto: string }>;
  p_motivo?: string | null;
};

export type CitasReprogramarParams = {
  p_cita_id: number;
  p_inicio_programado: DateString;
  p_servicio_id: number;
  p_peluquero_id: number;
};

export type CitasMotivoParams = {
  p_cita_id: number;
  p_motivo: string;
};

export type RegistrosServicioCompletarParams = {
  p_registro_servicio_id: number;
  p_servicio_id: number;
  p_peluquero_id: number;
  p_tamano_id: number;
  p_cupon_id: string | null;
  p_firma_entrega_url: string | null;
  p_notas_servicio: string | null;
  p_calificacion_satisfaccion: number | null;
  p_comentario_satisfaccion: string | null;
  p_precio_base: string;
  p_descuento_cupon: string;
  p_monto_final: string;
  p_monto_pagado: string;
  p_pagos: Array<{ metodo_pago_id: number; monto: string }>;
};

export type MascotaTransferirClienteParams = {
  p_mascota_id: number;
  p_nuevo_cliente_id: number;
  p_motivo: string;
};

export type ClientesDetalleParams = {
  p_cliente_id: number;
};

export type MascotasHistorialParams = {
  p_mascota_id: number;
};

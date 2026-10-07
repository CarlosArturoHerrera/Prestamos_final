import Decimal from "decimal.js";

/**
 * Ganancias del representante a partir del interés EFECTIVAMENTE PAGADO por sus
 * clientes asignados.
 *
 * Regla de comisión: cada PRÉSTAMO guarda su propio porcentaje en
 * `comision_representante`, y la ganancia es
 *
 *     interés efectivamente pagado × (comisión / 100)
 *
 * El porcentaje se aplica sobre el INTERÉS PAGADO, no sobre el capital. Un
 * préstamo con 30 % y RD$5 000 de interés cobrado produce RD$1 500.
 *
 * Antes el porcentaje se deducía de la tasa mediante una tabla fija
 * (tasa 4 % → 1 % del capital, tasa 5 % → 1.5 %). Esa tabla ya no existe: los
 * préstamos históricos se migraron a 25 % y 30 %, que son esas mismas reglas
 * expresadas sobre el interés, de modo que las ganancias no cambiaron.
 *
 * No es una comisión fija por cuota: escala proporcionalmente con lo que el cliente
 * pagó. Un abono que cubre RD$3 000 de un interés de RD$5 000 al 30 % genera RD$900,
 * y los RD$2 000 restantes generan después los RD$600 que completan el período.
 * Un préstamo sin comisión configurada aporta 0.00.
 *
 * Fuentes de «interés pagado» (las dos que produce el sistema hoy, sin solaparse):
 *   1. `abonos.interes_cobrado` — interés que el abono aplicó realmente
 *      (`Registrar abono`, y también `Saldar` porque delega en ese mismo handler).
 *   2. Filas de `intereses_atrasados` en estado `PAGADO`, por el remanente
 *      liquidado fuera de un abono: `interes_generado − interes_pagado`.
 *      `marcar-pagado` / `saldar` cierran el período sin tocar `interes_pagado`,
 *      así que ese resto es exactamente lo cobrado por fuera. Cuando el período
 *      se saldó vía abonos, `interes_pagado == interes_generado` y el resto es 0,
 *      de modo que nunca se cuenta dos veces el mismo dinero.
 *
 * Nunca cuentan: intereses PENDIENTE (no cobrados), CAPITALIZADO (fueron a
 * capital, no se cobraron) ni ANULADO.
 */

// ── Comisión ──────────────────────────────────────────────────────────────────

/** Comisión sugerida al crear un préstamo, según su tasa. Sólo es un prefijo
 *  del formulario: el usuario puede escribir cualquier otro porcentaje. */
export const COMISION_SUGERIDA_POR_TASA: ReadonlyArray<{
  tasa: string;
  comision: string;
}> = [
  { tasa: "4", comision: "25" },
  { tasa: "5", comision: "30" },
];

/** Clave estable de agrupación: "4.0000" → "4", "25.000" → "25". */
export function normalizarTasa(valor: string | number | null): string {
  try {
    return new Decimal(valor ?? 0).toDecimalPlaces(4).toString();
  } catch {
    return "0";
  }
}

/** Porcentaje que se propone en el formulario para una tasa dada, o "" si ninguno. */
export function comisionSugerida(valor: string | number | null): string {
  const key = normalizarTasa(valor);
  return COMISION_SUGERIDA_POR_TASA.find((c) => c.tasa === key)?.comision ?? "";
}

/** Normaliza el porcentaje de un préstamo a texto, con 0 por defecto. */
export function normalizarComision(valor: string | number | null): string {
  try {
    const d = new Decimal(valor ?? 0);
    if (d.lt(0)) return "0";
    return d.toDecimalPlaces(3).toString();
  } catch {
    return "0";
  }
}

/**
 * Ganancia del representante sobre un interés ya cobrado:
 * `interesPagado × comision / 100`.
 *
 * El porcentaje se aplica directamente al interés pagado. Un préstamo sin
 * comisión configurada —NULL o 0— no genera ganancia.
 */
export function gananciaDesdeInteresPagado(
  interesPagado: string | number,
  comision: string | number | null,
): string {
  const c = new Decimal(comision ?? 0);
  if (c.lte(0)) return "0.00";
  return new Decimal(interesPagado)
    .mul(c)
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

// ── Tipos de entrada (filas tal cual vienen de Supabase) ──────────────────────

export type GananciaClienteRow = {
  id: number;
  nombre: string | null;
  apellido: string | null;
  cedula: string | null;
};

export type GananciaPrestamoRow = {
  id: number;
  cliente_id: number;
  tasa_interes: string | number | null;
  /** Porcentaje sobre el interés pagado que cobra el representante. */
  comision_representante: string | number | null;
  estado: string | null;
};

export type GananciaAbonoRow = {
  id: number;
  prestamo_id: number;
  fecha_abono: string | null;
  interes_cobrado: string | number | null;
};

export type GananciaInteresRow = {
  id: number;
  prestamo_id: number;
  estado: string | null;
  fecha_aplicado: string | null;
  fecha_periodo: string | null;
  fecha_generado: string | null;
  interes_generado: string | number | null;
  interes_pagado: string | number | null;
  monto: string | number | null;
};

// ── Tipos de salida ───────────────────────────────────────────────────────────

export type GananciaMovimiento = {
  /** ABONO → fila de `abonos`; INTERES_PERIODO → fila de `intereses_atrasados`. */
  tipo: "ABONO" | "INTERES_PERIODO";
  id: number;
  fecha: string | null;
  interesPagado: string;
};

export type GananciaPrestamoDetalle = {
  prestamoId: number;
  clienteId: number;
  clienteNombre: string;
  clienteCedula: string | null;
  estado: string;
  /** Tasa del préstamo en porcentaje ("4", "5", …). Informativa. */
  tasa: string;
  /** Porcentaje de comisión guardado en este préstamo ("25", "30", "1.5"…). */
  comision: string;
  comisionable: boolean;
  interesPagado: string;
  ganancia: string;
  movimientos: GananciaMovimiento[];
};

/** Agrupación por porcentaje de comisión: con comisiones por préstamo, dos
 *  préstamos a la misma tasa pueden pagar distinto, así que agrupar por tasa
 *  daría una cifra engañosa. */
export type GananciaPorComision = {
  comision: string;
  comisionable: boolean;
  prestamos: number;
  clientes: number;
  interesPagado: string;
  ganancia: string;
};

export type GananciasTotales = {
  interesPagado: string;
  ganancia: string;
  clientesConGanancia: number;
  prestamosConGanancia: number;
};

export type GananciasResultado = {
  totales: GananciasTotales;
  porComision: GananciaPorComision[];
  detalle: GananciaPrestamoDetalle[];
};

// ── Cálculo ───────────────────────────────────────────────────────────────────

/**
 * Remanente de interés liquidado fuera de un abono para una fila PAGADO de
 * `intereses_atrasados`: `interes_generado − interes_pagado`, nunca negativo.
 * Filas antiguas sin `interes_generado` usan `monto` como respaldo.
 */
export function remanenteInteresLiquidado(row: GananciaInteresRow): string {
  const generadoRaw = row.interes_generado ?? row.monto ?? 0;
  const generado = new Decimal(generadoRaw === "" ? 0 : generadoRaw);
  const pagado = new Decimal(row.interes_pagado ?? 0);
  return Decimal.max(new Decimal(0), generado.minus(pagado)).toFixed(2);
}

function dentroDelRango(
  fecha: string | null,
  desde?: string,
  hasta?: string,
): boolean {
  if (!desde && !hasta) return true;
  // Sin fecha no se puede atribuir a un período: fuera de cualquier rango.
  if (!fecha) return false;
  const f = fecha.slice(0, 10);
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
}

function nombreCompletoCliente(c: GananciaClienteRow | undefined): string {
  if (!c) return "—";
  return `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim() || `Cliente #${c.id}`;
}

/**
 * Agrega los pagos reales por préstamo y los convierte en ganancias.
 * Los totales son la suma de las filas del desglose (mismos valores redondeados),
 * de modo que el total siempre cuadra con lo que se muestra.
 */
export function construirGananciasRepresentante(input: {
  clientes: GananciaClienteRow[];
  prestamos: GananciaPrestamoRow[];
  abonos: GananciaAbonoRow[];
  interesesPeriodo: GananciaInteresRow[];
  desde?: string;
  hasta?: string;
}): GananciasResultado {
  const { desde, hasta } = input;

  const clientePorId = new Map<number, GananciaClienteRow>();
  for (const c of input.clientes) clientePorId.set(c.id, c);

  const prestamoPorId = new Map<number, GananciaPrestamoRow>();
  for (const p of input.prestamos) {
    if (clientePorId.has(p.cliente_id)) prestamoPorId.set(p.id, p);
  }

  const acumulado = new Map<
    number,
    { interes: Decimal; movimientos: GananciaMovimiento[] }
  >();

  const acumular = (prestamoId: number, mov: GananciaMovimiento) => {
    const actual = acumulado.get(prestamoId) ?? {
      interes: new Decimal(0),
      movimientos: [],
    };
    actual.interes = actual.interes.plus(mov.interesPagado);
    actual.movimientos.push(mov);
    acumulado.set(prestamoId, actual);
  };

  // 1) Interés aplicado por cada abono (Registrar abono / Saldar).
  for (const a of input.abonos) {
    if (!prestamoPorId.has(a.prestamo_id)) continue;
    if (!dentroDelRango(a.fecha_abono, desde, hasta)) continue;
    const monto = new Decimal(a.interes_cobrado ?? 0);
    if (monto.lte(0)) continue;
    acumular(a.prestamo_id, {
      tipo: "ABONO",
      id: a.id,
      fecha: a.fecha_abono,
      interesPagado: monto.toFixed(2),
    });
  }

  // 2) Remanente de períodos cerrados como PAGADO fuera de un abono.
  for (const i of input.interesesPeriodo) {
    if (!prestamoPorId.has(i.prestamo_id)) continue;
    if (String(i.estado ?? "").toUpperCase() !== "PAGADO") continue;
    const remanente = remanenteInteresLiquidado(i);
    if (new Decimal(remanente).lte(0)) continue;
    const fecha = i.fecha_aplicado ?? i.fecha_periodo ?? i.fecha_generado;
    if (!dentroDelRango(fecha, desde, hasta)) continue;
    acumular(i.prestamo_id, {
      tipo: "INTERES_PERIODO",
      id: i.id,
      fecha,
      interesPagado: remanente,
    });
  }

  // 3) Una fila de desglose por préstamo con interés cobrado.
  const detalle: GananciaPrestamoDetalle[] = [];
  for (const [prestamoId, agg] of acumulado) {
    const prestamo = prestamoPorId.get(prestamoId);
    if (!prestamo) continue;
    if (agg.interes.lte(0)) continue;

    const cliente = clientePorId.get(prestamo.cliente_id);
    const interesPagado = agg.interes
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toFixed(2);
    const tasa = normalizarTasa(prestamo.tasa_interes);
    const comision = normalizarComision(prestamo.comision_representante);

    detalle.push({
      prestamoId,
      clienteId: prestamo.cliente_id,
      clienteNombre: nombreCompletoCliente(cliente),
      clienteCedula: cliente?.cedula ?? null,
      estado: String(prestamo.estado ?? "—"),
      tasa,
      comision,
      comisionable: new Decimal(comision).gt(0),
      interesPagado,
      ganancia: gananciaDesdeInteresPagado(interesPagado, comision),
      movimientos: agg.movimientos.sort((a, b) =>
        String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")),
      ),
    });
  }

  detalle.sort((a, b) => {
    const g = new Decimal(b.ganancia).comparedTo(a.ganancia);
    if (g !== 0) return g;
    const i = new Decimal(b.interesPagado).comparedTo(a.interesPagado);
    if (i !== 0) return i;
    return a.prestamoId - b.prestamoId;
  });

  // 4) Desglose por porcentaje de comisión.
  const porComisionMap = new Map<
    string,
    {
      interes: Decimal;
      ganancia: Decimal;
      prestamos: number;
      clientes: Set<number>;
    }
  >();
  const asegurarComision = (comision: string) => {
    const actual = porComisionMap.get(comision) ?? {
      interes: new Decimal(0),
      ganancia: new Decimal(0),
      prestamos: 0,
      clientes: new Set<number>(),
    };
    porComisionMap.set(comision, actual);
    return actual;
  };

  let interesTotal = new Decimal(0);
  let gananciaTotal = new Decimal(0);
  const clientesConGanancia = new Set<number>();
  let prestamosConGanancia = 0;

  for (const fila of detalle) {
    const bucket = asegurarComision(fila.comision);
    bucket.interes = bucket.interes.plus(fila.interesPagado);
    bucket.ganancia = bucket.ganancia.plus(fila.ganancia);
    bucket.prestamos += 1;
    bucket.clientes.add(fila.clienteId);

    interesTotal = interesTotal.plus(fila.interesPagado);
    gananciaTotal = gananciaTotal.plus(fila.ganancia);
    if (new Decimal(fila.ganancia).gt(0)) {
      clientesConGanancia.add(fila.clienteId);
      prestamosConGanancia += 1;
    }
  }

  const porComision: GananciaPorComision[] = [...porComisionMap.entries()]
    .filter(([, b]) => b.prestamos > 0)
    .map(([comision, b]) => ({
      comision,
      comisionable: new Decimal(comision).gt(0),
      prestamos: b.prestamos,
      clientes: b.clientes.size,
      interesPagado: b.interes.toFixed(2),
      ganancia: b.ganancia.toFixed(2),
    }))
    .sort((a, b) => {
      if (a.comisionable !== b.comisionable) return a.comisionable ? -1 : 1;
      return new Decimal(b.comision).comparedTo(a.comision);
    });

  return {
    totales: {
      interesPagado: interesTotal.toFixed(2),
      ganancia: gananciaTotal.toFixed(2),
      clientesConGanancia: clientesConGanancia.size,
      prestamosConGanancia,
    },
    porComision,
    detalle,
  };
}

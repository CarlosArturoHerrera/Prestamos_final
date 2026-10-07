"use client";

import { Camera, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Selector de imagen con vista previa, drag & drop, cámara y galería.
 *
 * No sube nada: entrega el `File` ya comprimido al componente padre, que lo
 * guarda cuando el usuario envía el formulario. Así cancelar la edición deja
 * la foto anterior intacta.
 *
 * Reparto por dispositivo:
 *   • En PC se prioriza arrastrar o seleccionar archivo; el drag & drop sólo
 *     tiene sentido con ratón.
 *   • En móvil se ofrecen "Tomar foto" y "Galería", que son dos inputs
 *     distintos: el atributo `capture` es lo que hace que el sistema abra la
 *     cámara en vez del explorador de archivos.
 */

const TIPOS_ACEPTADOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

/** Lado mayor al que se reduce la foto antes de subirla. */
const LADO_MAXIMO = 1280;
/** Tope duro tras comprimir. Coincide con el límite del bucket. */
const TAMANO_MAXIMO = 5 * 1024 * 1024;
/** Por encima de esto ni se intenta leer: el navegador se atragantaría. */
const TAMANO_MAXIMO_ORIGEN = 25 * 1024 * 1024;

export type ImagePickerProps = {
  /** URL de la imagen ya guardada, si la hay. */
  valorActual?: string | null;
  /** Archivo elegido en esta sesión de edición, o null. */
  archivo: File | null;
  onArchivoChange: (file: File | null) => void;
  /** true cuando el usuario pidió borrar la imagen existente. */
  eliminar: boolean;
  onEliminarChange: (eliminar: boolean) => void;
  disabled?: boolean;
  /** Texto bajo el icono cuando no hay imagen. */
  etiqueta?: string;
};

/**
 * Reduce y convierte a WebP en el navegador.
 *
 * Merece la pena: una foto de móvil ronda los 4 MB y sale de aquí en torno a
 * 100 KB sin diferencia apreciable a tamaño de avatar. Subir el original
 * cargaría el bucket y haría lentos los listados.
 *
 * Si algo falla —un HEIC que el navegador no sabe decodificar, por ejemplo— se
 * devuelve el archivo original y que decida el servidor.
 */
async function comprimir(file: File): Promise<File> {
  // El GIF puede estar animado; redibujarlo en un canvas se quedaría con el
  // primer fotograma, así que se deja intacto.
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);

    const escala = Math.min(
      1,
      LADO_MAXIMO / Math.max(bitmap.width, bitmap.height),
    );
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob) return file;

    // Si la conversión no mejora nada, no se toca el original.
    if (blob.size >= file.size && escala === 1) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
    });
  } catch {
    return file;
  }
}

export function ImagePicker({
  valorActual,
  archivo,
  onArchivoChange,
  eliminar,
  onEliminarChange,
  disabled,
  etiqueta = "Foto del cliente",
}: ImagePickerProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [esMovil, setEsMovil] = useState(false);

  const refArchivo = useRef<HTMLInputElement>(null);
  const refCamara = useRef<HTMLInputElement>(null);

  // Detección por capacidad, no por tamaño de pantalla: una laptop con pantalla
  // táctil no debe perder el drag & drop.
  useEffect(() => {
    const táctil =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    setEsMovil(táctil);
  }, []);

  // La URL del objeto se revoca al cambiar de archivo: si no, cada foto elegida
  // deja un blob retenido en memoria hasta recargar la página.
  useEffect(() => {
    if (!archivo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const aceptar = useCallback(
    async (file: File | undefined | null) => {
      setError(null);
      if (!file) return;

      if (!TIPOS_ACEPTADOS.includes(file.type)) {
        setError("Formato no admitido. Usa JPG, PNG, WEBP, GIF o HEIC.");
        return;
      }
      if (file.size > TAMANO_MAXIMO_ORIGEN) {
        setError("La imagen es demasiado grande para procesarla.");
        return;
      }

      setProcesando(true);
      try {
        const listo = await comprimir(file);
        if (listo.size > TAMANO_MAXIMO) {
          setError("La imagen sigue siendo demasiado grande tras optimizarla.");
          return;
        }
        onArchivoChange(listo);
        // Elegir una imagen cancela una eliminación pendiente.
        onEliminarChange(false);
      } catch {
        setError("No se pudo leer la imagen. Puede estar dañada.");
      } finally {
        setProcesando(false);
      }
    },
    [onArchivoChange, onEliminarChange],
  );

  const quitar = () => {
    onArchivoChange(null);
    setError(null);
    // Sólo se marca para eliminar si había una imagen guardada; si el usuario
    // sólo descarta la que acaba de elegir, no hay nada que borrar al guardar.
    if (valorActual) onEliminarChange(true);
    if (refArchivo.current) refArchivo.current.value = "";
    if (refCamara.current) refCamara.current.value = "";
  };

  // Lo que se muestra: lo recién elegido manda; luego lo guardado, salvo que
  // esté marcado para eliminar.
  const imagen = preview ?? (eliminar ? null : (valorActual ?? null));

  return (
    <div className="space-y-2">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: zona de arrastre, los controles accesibles son los botones de abajo */}
      <div
        onDragOver={(e) => {
          if (disabled || esMovil) return;
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          if (disabled || esMovil) return;
          e.preventDefault();
          setArrastrando(false);
          void aceptar(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "rounded-xl border border-dashed border-border bg-muted/30 p-4 transition-colors",
          arrastrando && "border-primary bg-primary/5",
          disabled && "opacity-60",
        )}
      >
        <div className="flex items-center gap-4">
          {/* Vista previa / marcador */}
          <div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-border bg-background">
            {imagen ? (
              // biome-ignore lint/performance/noImgElement: blob: y URL firmada, fuera del optimizador de Next
              <img
                src={imagen}
                alt=""
                className="size-full object-cover"
                onError={() => setError("No se pudo cargar la imagen.")}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-7" />
              </div>
            )}
            {procesando && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{etiqueta}</p>

            <div className="mt-2 flex flex-wrap gap-2">
              {esMovil ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || procesando}
                    onClick={() => refCamara.current?.click()}
                  >
                    <Camera className="size-4" />
                    Tomar foto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || procesando}
                    onClick={() => refArchivo.current?.click()}
                  >
                    <ImageIcon className="size-4" />
                    Galería
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || procesando}
                  onClick={() => refArchivo.current?.click()}
                >
                  <Upload className="size-4" />
                  {imagen ? "Cambiar" : "Seleccionar imagen"}
                </Button>
              )}

              {imagen && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || procesando}
                  onClick={quitar}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Quitar
                </Button>
              )}
            </div>

            {!esMovil && (
              <p className="mt-2 text-xs text-muted-foreground">
                o arrastra una imagen aquí
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Dos inputs separados: `capture` es lo que abre la cámara en vez del
          explorador. Un solo input no puede ofrecer ambas cosas. */}
      <input
        ref={refArchivo}
        type="file"
        accept={TIPOS_ACEPTADOS.join(",")}
        className="hidden"
        onChange={(e) => void aceptar(e.target.files?.[0])}
      />
      <input
        ref={refCamara}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void aceptar(e.target.files?.[0])}
      />
    </div>
  );
}

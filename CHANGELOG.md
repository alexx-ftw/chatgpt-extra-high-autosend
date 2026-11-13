# Changelog

## 1.3.14 - 2026-11-13

- Añade un respaldo estructural para un campo del chat en un formulario sin marcas o en un contenedor conocido sin `form`.
- Conserva los selectores existentes y su prioridad. La selección del esfuerzo y su confirmación no cambian.
- Exige un único editable, identidad de chat y un único botón Enviar asociado; rechaza contextos ajenos y ambiguos.
- Conserva cancelación manual, protección del borrador, Extra High, envío único y avisos solo ante problemas.
- Añade un resumen categórico de los campos no reconocidos, sin texto, HTML, IDs ni atributos libres.
- Mantiene autoupdate y el contenido de Always Classic sin cambios.
- El respaldo y la regresión de ambas interfaces se prueban en páginas sintéticas; la estructura de la pestaña del diagnóstico sigue sin confirmarse.

## 1.3.13 - 2026-11-11

- La confirmación tras cerrar Power usa el plazo global restante en vez de cortar a los 8 segundos.
- Relee el botón actual y exige Extra High, un control habilitado y el menú cerrado; una desaparición o sustitución no cuenta como éxito.
- Reinicia la ventana de confirmación al cambiar la identidad del botón.
- Evita consultas con ID vacío cuando el selector aún no tiene un menú asociado.
- Mantiene la validación final conjunta de texto, nivel y botón Enviar, sin añadir pausas fijas ni repetir clics.
- Cancela si el borrador pasa a ser distinto; conserva Escape, navegación y cambios de consulta.
- Registra el estado categórico de la confirmación, sin HTML, IDs ni etiquetas arbitrarias.
- Conserva los selectores de ambas interfaces, el autoupdate y el script Always Classic sin cambios.
- El fallo por confirmación tardía está reproducido en pruebas; la causa exacta de la transición en la sesión real no está determinada.

## 1.3.12 - 2026-11-03

- Añade editores alternativos solo dentro de un compositor identificado, sin desplazar los selectores existentes.
- Exige un candidato único y descarta campos ocultos, de solo lectura, diálogos y buscadores.
- Mantiene la cancelación por edición manual también en los editores alternativos.
- Sustituye el aviso genérico de inicio de sesión por E11 con diagnóstico categórico de arranque.
- Separa el estado al detenerse del estado observado al copiar, sin guardar HTML ni contenidos privados.
- Conserva Extra High, el envío único, las esperas rápidas, el seguimiento posterior y el autoupdate.
- La causa concreta del registro con cero editores sigue sin confirmarse en la sesión real.

## 1.3.11 - 2026-11-01

- Añade detección del botón de razonamiento de la interfaz clásica en el mismo compositor.
- Conserva la prioridad y el comportamiento de todos los selectores de la interfaz nueva.
- Exige una etiqueta de nivel completa y un candidato único; descarta adjuntos, controles ocultos y otros formularios.
- Mantiene sin cambios el resto de la lógica de ejecución, verificado mediante una comparación con v1.3.10.
- Conserva el envío único, las esperas rápidas, el autoupdate y los avisos solo ante problemas.
- Pruebas de regresión para ambos diseños y menús de selección; no se publica HTML privado.

## 1.3.10 - 2026-10-30

- Evita E31 por falta de respuesta a los 30 segundos cuando ya hay actividad visible.
- Separa actividad de la interfaz, respuesta observable y errores explícitos; no trata una burbuja o Stop como éxito.
- Sigue detectando fallos de conexión posteriores al plazo inicial.
- Limita el seguimiento a 10 minutos y termina silenciosamente sin confirmar si la respuesta no es observable.
- Conserva E31 cuando no se observa ninguna señal de inicio en 30 segundos.
- Añade señales categóricas al diagnóstico y detiene el seguimiento al navegar a otro chat.
- Mantiene el envío único, las ventanas rápidas, Extra High y el panel únicamente para alertas.

## 1.3.9 - 2026-10-29

- No confirma el envío por una burbuja local ni por un botón Stop.
- Observa contenido de respuesta y avisos de conexión durante hasta 30 segundos tras el clic.
- Reconoce `Failed to fetch` en avisos o junto a Retry, sin buscar en mensajes del usuario ni en código.
- Mantiene un único clic, el ajuste de Extra High, el autoupdate y los avisos solo ante problemas.
- Añade resultado y categoría de ruta al diagnóstico, sin texto del prompt ni identificador del chat.
- La causa del fallo de red de la sesión real sigue sin determinarse; no se añaden reintentos automáticos.

## 1.3.8 - 2026-10-16

- Distingue la etiqueta seleccionada de las etiquetas ocultas de medición; ignora comentarios DOM.
- No confunde Max, Ultra, Persistent ni una lista de niveles con Extra High.
- Reconoce botones de envío semánticos, etiquetas con atajo y `type="button"` dentro del compositor.
- No pulsa controles de voz, controles con acciones distintas ni un conjunto ambiguo de botones.
- Recupera de forma limitada un restablecimiento del esfuerzo o un editor vaciado antes del primer envío.
- Conserva un estado de diagnóstico al detenerse, separado del estado que se lee al copiarlo.
- Añade regresiones de preparación; conserva la ventana final rápida y el panel solo ante alertas.

## 1.3.7 - 2026-10-09

- Elimina tres pausas redundantes de preparación y conserva la comprobación final de 80 ms.
- Verifica conjuntamente texto, Extra High, menú cerrado y botón habilitado antes de enviar.
- Reinicia la ventana si se sustituye cualquiera de los tres controles, aunque sus valores sean iguales.
- Prueba primero el thumb del deslizador, con propagación del evento y respaldos anteriores.
- Mantiene el margen de rellenado nativo, los timeouts, el envío único y el panel solo para alertas.
- Verificación: 83 pruebas automáticas sobre DOM/reloj simulados, más sintaxis y sincronización.
- Benchmark simulado frente a 1.3.6: preparado 260 → 80 ms; vacío 510 → 330 ms; deslizador con control interno 1.740 → 260 ms. No mide la web real ni la respuesta del modelo.

## 1.3.6 - 2026-10-09

- Acelera las esperas mediante cambios DOM y eventos, con temporizador de respaldo.
- Reduce pausas fijas y evita reabrir un selector que ya indica Extra High.
- Conserva los timeouts máximos, las protecciones y el panel solo para alertas.
- Registra el tiempo de preparación en el diagnóstico local.
- Incluye benchmark reproducible y pruebas de velocidad, estados lentos y limpieza de recursos.

## 1.3.5 - 2026-10-09

- Muestra el panel solo ante errores, fallos o advertencias.
- Mantiene silenciosos el progreso, la espera de confirmación y el envío correcto, sin crear el panel ni momentáneamente.
- Conserva el registro local completo y el botón de diagnóstico en las alertas.
- Añade pruebas con la función real de notificación sobre un DOM simulado, incluida la copia del diagnóstico.
- No cambia la selección de Extra High, el control de URL ni el envío único.

## 1.3.4 - 2026-10-09

- Elimina el panel inmediatamente al observar el inicio del mensaje, sin mostrar un aviso de éxito durante ocho segundos.
- Conserva el panel mientras se espera confirmación y ante errores; mantiene el registro de diagnóstico local.
- Añade pruebas de confirmación inmediata, confirmación tardía, falta de confirmación y panel ya retirado.
- Mantiene el ajuste de esfuerzo, la carga del texto, las protecciones de URL y el envío único.

## 1.3.3 - 2026-10-08

- Corrige cancelaciones al vaciar o retirar los parámetros de consulta durante la carga.
- Acepta el mismo texto entre `q` y `prompt`, con normalización consistente con el editor.
- Mantiene el rechazo de consultas distintas y detecta valores repetidos conflictivos.
- Añade estados de URL al diagnóstico sin registrar el texto ni la dirección completa.
- Añade pruebas de regresión de la comprobación de URL y del flujo con un compositor simulado.
- Conserva el código de selección, carga del texto y envío único de la versión 1.3.2.

## 1.3.2 - 2026-10-04

- Añade `@updateURL`, `@downloadURL`, `@homepageURL` y `@supportURL` públicos.
- Incluye metadatos mínimos para comprobar actualizaciones y un generador de distribuciones.
- Usa namespace y helper de diagnóstico genéricos.
- Documenta la reinstalación inicial y la configuración del actualizador del gestor.
- Añade pruebas de metadatos y conservación de la lógica de autoenvío.

## 1.3.1 - 2026-10-04

Primera versión incorporada a este repositorio, sin modificar el userscript entregado previamente como TXT.

- Añade la detección del editor `[data-composer-markdown][contenteditable="true"]` sin exigir `id="prompt-textarea"`.
- Conserva los selectores de editor anteriores por compatibilidad.
- Actualiza las marcas de mensaje y actividad utilizadas para proteger y confirmar el envío.
- Amplía el diagnóstico con coincidencias, tipo de editor y estado de actividad.
- Mantiene el soporte de `?q=` y `?prompt=`, el ajuste de Extra High mediante Power y la protección de envío único.

El usuario indicó que esta versión parecía funcionar. La subida no incorpora cambios en su lógica ni supone una nueva prueba de integración.

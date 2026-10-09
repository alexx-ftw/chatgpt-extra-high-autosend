# Changelog

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

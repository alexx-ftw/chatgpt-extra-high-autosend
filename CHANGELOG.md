# Changelog

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

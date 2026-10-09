# ChatGPT Extra High Auto-send

Userscript para abrir ChatGPT con texto en la URL, seleccionar **Extra High** y solicitar el envío una sola vez.

**Versión: 1.3.4.** Proyecto no oficial, no afiliado a OpenAI. El panel desaparece al confirmar el envío. Conserva las correcciones de URL, el ajuste de Extra High, el envío único y las actualizaciones automáticas.

## Instalación

1. Con tu gestor de userscripts instalado, abre [Instalar el userscript](https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-extra-high.user.js) y confirma la instalación.
2. Si vienes de la versión 1.3.1 o anterior, **elimina la copia anterior e instala esta una sola vez**. Ha cambiado el namespace; no dejes dos copias activas.
3. Recarga ChatGPT y usa una de las direcciones indicadas abajo.

También puedes copiar el archivo [chatgpt-extra-high.user.js](./chatgpt-extra-high.user.js) o la [copia TXT](./chatgpt-extra-high.txt) en el editor del gestor. Conserva la cabecera completa.

## Actualizaciones automáticas

La cabecera declara una URL pública de metadatos y otra de descarga:

- `@updateURL`: [chatgpt-extra-high.meta.js](https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-extra-high.meta.js)
- `@downloadURL`: [chatgpt-extra-high.user.js](https://raw.githubusercontent.com/alexx-ftw/chatgpt-extra-high-autosend/main/chatgpt-extra-high.user.js)

El gestor comprueba `@version` y descarga una versión posterior cuando corresponde. Mantén activada su opción de comprobar actualizaciones. El intervalo y las confirmaciones dependen del gestor y de tu configuración; publicar un cambio no implica instalarlo de inmediato.

No necesita iniciar sesión en GitHub ni incluir tokens. Las consultas de actualización las realiza el gestor, no el código de la página. El script no descarga ni ejecuta código remoto mediante `eval` o `@require`.

La versión 1.3.1 no incluía las URLs: necesita esa instalación manual inicial. Después, las versiones con el mismo nombre y namespace pueden usar el actualizador del gestor.

Referencia: [documentación de @updateURL y @downloadURL](https://www.tampermonkey.net/documentation.php?q=update_url).

## Uso

Para configurar una búsqueda personalizada del navegador:

```text
https://chatgpt.com/?q=%s
https://chatgpt.com/?prompt=%s
```

El navegador debe sustituir `%s` por la consulta codificada en la URL. Ejemplo:

```text
https://chatgpt.com/?q=Explica%20la%20diferencia%20entre%20QNH%20y%20QFE
```

Si ambos parámetros contienen texto válido, `q` tiene prioridad. Una consulta vacía o el marcador literal `%s` no inicia la automatización. Solo se activa en la ruta `/`, no en conversaciones `/c/...` ya abiertas.

## Funcionamiento

Espera al editor, comprueba o introduce el texto, selecciona Extra High, verifica el estado y pulsa Enviar una sola vez. Reconoce `data-composer-markdown` y conserva compatibilidad con `prompt-textarea`.

La comprobación de la URL permite retirar o vaciar `q`/`prompt`, o pasar el mismo texto de un alias al otro. Sigue cancelando ante una consulta distinta, un cambio de conversación o una edición manual. La comparación solo normaliza saltos CRLF y espacios exteriores; no decodifica el texto dos veces.

Admite una opción de menú o el deslizador Power. Intenta eventos de teclado y dispone de un respaldo mediante el controlador React del deslizador. No asume que la posición máxima sea Extra High: rechaza una etiqueta Pro como confirmación del objetivo.

## Protección y privacidad

- Abrir una URL `/?q=...` o `/?prompt=...` con el script activo puede enviar ese texto desde tu cuenta. No abras consultas de fuentes no fiables.
- Escape o editar manualmente el compositor cancela el autoenvío. No debe reemplazar un borrador distinto ni enviar cuando detecta conversación o actividad en curso.
- Si no confirma el texto y Extra High, se detiene. Retira los parámetros justo antes del único clic; no reintenta el envío sin confirmación.
- No realiza peticiones de red propias ni necesita una API key. Envía mediante la interfaz de ChatGPT.
- El diagnóstico de controles, estados y pasos es local. No recopila deliberadamente el prompt, cookies ni tokens. Revísalo antes de compartirlo.

El texto forma parte de la URL y puede quedar en el historial u otros registros del navegador o del servicio. No uses este mecanismo para datos sensibles.

## Diagnóstico

El panel se elimina inmediatamente cuando la interfaz muestra el inicio del mensaje, sin esperar a que termine la respuesta. Mientras el envío está pendiente permanece visible; si falla o no se confirma, conserva el aviso y el botón para copiar el diagnóstico. El registro sigue disponible desde la consola después de ocultar el panel.

El diagnóstico añade `URL actual` con estados como `vacío`, `ausente`, `mismo texto` o `texto distinto`, sin copiar la consulta ni la dirección completa.

El panel muestra los pasos Texto, Selector y Envío. Ante un bloqueo, pulsa **Copiar diagnóstico** y adjunta el resultado a una incidencia, indicando la versión. Desde la consola:

```js
window.__chatgptExtraHighDebug.diagnostic()
```

## Mantenimiento y verificación

El archivo fuente es `chatgpt-extra-high.user.js`. Para publicar una actualización, incrementa `@version` y `VERSION`, genera las dos distribuciones y ejecuta las comprobaciones antes de subir los archivos a `main`:

```sh
node scripts/sync-distribution.cjs
node --check chatgpt-extra-high.user.js
node --check scripts/sync-distribution.cjs
node scripts/sync-distribution.cjs --check
node --test
```

Las pruebas comprueban metadatos de actualización, identidad, permisos, distribución, transiciones de URL y privacidad del diagnóstico. También ejecutan el flujo de envío sobre un compositor simulado y verifican que la selección del esfuerzo, la carga del editor y el envío no se han modificado. Comprueban la retirada inmediata del panel tras confirmar el envío y su conservación en caso de error. No son pruebas de integración con una sesión real. El funcionamiento depende del HTML, de los controles de la cuenta y de detalles internos de React. No se incluyen capturas privadas ni conversaciones.

## Licencia

MIT. Consulta [LICENSE](./LICENSE).

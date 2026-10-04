# ChatGPT Extra High Auto-send

Userscript para abrir ChatGPT con texto en la URL, seleccionar **Extra High** y solicitar el envío una sola vez.

**Versión conservada: 1.3.1.** La lógica corresponde a la versión comprobada por el usuario el 4 de octubre de 2026; los identificadores técnicos son genéricos. Es un proyecto no oficial, no afiliado a OpenAI.

## Instalación

1. Abre [chatgpt-extra-high.user.js](./chatgpt-extra-high.user.js) y copia su contenido completo en un script nuevo de tu gestor de userscripts. También está disponible una [copia en TXT](./chatgpt-extra-high.txt), con contenido idéntico.
2. Guarda y desactiva las versiones anteriores. Deja una sola copia activa.
3. Recarga ChatGPT y abre una de las direcciones indicadas abajo.

El repositorio es privado en el momento de esta subida. Para acceder a los archivos necesitas una cuenta con acceso. No se han añadido URLs de actualización con tokens de acceso.

## Uso

Para configurar una búsqueda personalizada del navegador:

```text
https://chatgpt.com/?q=%s
https://chatgpt.com/?prompt=%s
```

El navegador debe sustituir `%s` por la consulta codificada en la URL. Ejemplo de una dirección completa:

```text
https://chatgpt.com/?q=Explica%20la%20diferencia%20entre%20QNH%20y%20QFE
```

Si ambos parámetros contienen texto válido, `q` tiene prioridad. Una consulta vacía o el marcador literal `%s` no inicia la automatización. Esta versión solo se activa en la ruta `/`, no en conversaciones `/c/...` ya abiertas.

## Funcionamiento

El script espera a que el editor esté disponible, comprueba o introduce el texto, selecciona Extra High, verifica el estado resultante y pulsa el botón Enviar una sola vez. Reconoce el editor `data-composer-markdown` y conserva los selectores antiguos de `prompt-textarea`.

Para seleccionar el esfuerzo admite una opción de menú o el deslizador Power. Intenta eventos de teclado y dispone de un respaldo que llama al controlador React del deslizador. No asume que la posición máxima sea Extra High: rechaza una etiqueta Pro como confirmación del objetivo.

## Protección y privacidad

- Abrir una URL `/?q=...` o `/?prompt=...` con el script activo puede enviar ese texto automáticamente desde tu cuenta. No abras consultas procedentes de fuentes que no consideres fiables.
- Escape o la edición manual del compositor cancelan el autoenvío. El script no debe reemplazar un borrador distinto ni enviar cuando detecta una conversación o actividad en curso.
- Si no confirma el texto y Extra High, se detiene. Retira los parámetros de consulta justo antes del único clic de envío; no reintenta el envío si la interfaz no lo confirma.
- El script no realiza peticiones de red propias ni necesita una API key. El mensaje se envía a través de la interfaz de ChatGPT.
- El panel permite copiar un diagnóstico local de controles, estados y pasos. No recopila deliberadamente el contenido del prompt, cookies ni tokens. Revisa cualquier diagnóstico antes de compartirlo.

El texto forma parte de la URL y puede quedar en el historial o en otros registros del navegador o del servicio. No uses este mecanismo para datos sensibles.

## Diagnóstico

El panel superior derecho muestra los pasos Texto, Selector y Envío. Ante un bloqueo, pulsa **Copiar diagnóstico** y adjunta el resultado a una incidencia, indicando la versión. También puedes obtenerlo desde la consola:

```js
window.__chatgptExtraHighDebug.diagnostic()
```

## Verificación y límites

Los dos archivos del userscript son idénticos. La sintaxis puede comprobarse sin ejecutar la automatización:

```sh
node --check chatgpt-extra-high.user.js
cmp chatgpt-extra-high.user.js chatgpt-extra-high.txt
```

La comprobación de sintaxis no es una prueba de integración. El funcionamiento depende del HTML, los controles disponibles en la cuenta y detalles internos de React que pueden cambiar. No se incluyen en este repositorio las pruebas simuladas ni las capturas privadas usadas durante el desarrollo. La indicación de que funciona proviene del usuario y no constituye una garantía para otras cuentas o interfaces.

## Licencia

MIT, de acuerdo con la cabecera del userscript. Consulta [LICENSE](./LICENSE).
